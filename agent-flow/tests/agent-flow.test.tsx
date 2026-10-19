import { expect, mock, test } from 'claude-code/testing'

import { doing, elapsed, fmt, fresh, headline, mergeRoster, shouldAutoOpen, shouldTick, stepTokens, toolLabel, tree } from '../hooks/flow'
import type { RosterEntry } from '../hooks/flow'
import type { AgentRow } from '../types'
import { groups, statsDays, statsText } from '../hooks/stats'

const row = (id: string, parentId?: string) => ({ id, type: 'Explore', task: id, model: null, status: 'running', parentId, startedAt: 0, tokens: 0, edits: 0 })

test('helpers', () => {
  expect(stepTokens({ input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 10, cache_read_input_tokens: 90_000 })).toBe(160)
  expect(fmt(4_100)).toBe('4.1k')
  expect(elapsed(125_000)).toBe('2m05s')
  expect(tree([row('a'), row('b'), row('c', 'a')]).map(t => `${t.depth}${t.row.id}${t.isLast ? '.' : ''}`)).toEqual(['0a', '1c.', '0b.'])
  expect(headline([row('a'), { ...row('b'), status: 'completed' }])).toBe('Agent flow · main + 2 agents · 1 running · 0 waiting')
  expect(toolLabel('Edit', { file_path: '/a/b/c/src/parser.ts' })).toBe('Edit .../c/src/parser.ts')
  expect(toolLabel('Bash', { command: 'npm   test' })).toBe('Bash npm test')
  expect(toolLabel('mcp__kiwoom__get_quote', { query: 'x' })).toBe('get_quote x')
  // shell tools: 3 min, then red past 9 min; other tools: 60 s
  expect(doing({ running: [{ tool: 'Bash', label: 'Bash npm test', at: 0 }], lastSeenAt: 0 }, true, 45_000)).toEqual({ now: 'Bash npm test 45s' })
  expect(doing({ running: [{ tool: 'Bash', label: 'Bash npm test', at: 0 }], lastSeenAt: 0 }, true, 200_000)).toEqual({ now: 'Bash npm test 3m20s', warn: '⚠ slow 3m20s', level: 'warn' })
  expect(doing({ running: [{ tool: 'Bash', label: 'Bash npm test', at: 0 }], lastSeenAt: 0 }, true, 600_000).level).toBe('alert')
  expect(doing({ running: [{ tool: 'Read', label: 'Read a.ts', at: 0 }], lastSeenAt: 0 }, true, 61_000).warn).toBe('⚠ slow 1m01s')
  // waiting on a subagent is never slow
  expect(doing({ running: [{ tool: 'Agent', label: 'Agent Fix the parser', at: 0 }], lastSeenAt: 0 }, true, 900_000)).toEqual({ now: 'Agent Fix the parser 15m00s', isWaiting: true })
  // a long model request is thinking, not silence
  expect(doing({ running: [], lastSeenAt: 0, requestAt: 0 }, true, 300_000)).toEqual({ thinking: 'thinking 5m00s' })
  expect(doing({ running: [], lastSeenAt: 0, requestAt: 0 }, true, 10_000)).toEqual({})
  expect(doing({ running: [], lastSeenAt: 0 }, true, 125_000)).toEqual({ warn: '⚠ silent 2m05s', level: 'warn' })
  expect(doing({ running: [], lastSeenAt: 0 }, false, 125_000)).toEqual({})
  // custom thresholds
  expect(doing({ running: [{ tool: 'Read', label: 'Read a.ts', at: 0 }], lastSeenAt: 0 }, true, 11_000, { slow: 10_000, slowShell: 10_000, silent: 10_000 }).warn).toBe('⚠ slow 11s')
})

const usage = (model: string, input: number) => ({ input_tokens: input, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model })
const patch = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }]

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the flow shows main and subagents with models, tokens and their diffs on ${surface}`, { options: { autoOpen: false } }, async ($, on) => {
    mock.clock(on, { now: 10_000 })
    const opened: string[] = []
    on('session.start', () => ({ cwd: '/' }))
    on('command.register', (_$, e) => ({ value: { command: e.name } }))
    on('ui.open', (_$, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true } }
    })
    on('agent.list', () => ({ value: [{ id: 'a1', description: 'Fix the parser', type: 'implementer', status: 'running' as const }] }))
    on('turn.start', (_$, e) => ({ turnId: e.turnId }))
    on('turn.step', async function* (_$, e) {
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: usage(e.model, e.agentId ? 22_700 : 38_200) }
    })
    on('tool.call', { tool: 'Edit' }, (_$, e) => ({
      result: { filePath: e.file_path, oldString: 'a', newString: 'b', originalFile: 'a\n', structuredPatch: patch, userModified: false, replaceAll: false },
    }))

    await $.session.start({ cwd: '/', surface, isInteractive: true })
    await $.turn.start({ text: 'fix it', turnId: 't' })
    for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-fable-5-1', messageCount: 1 })) {
      // drain
    }
    for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-fable-5-1', messageCount: 1, agentId: 'a1' })) {
      // drain
    }
    await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/p/src/main.ts', old_string: 'a', new_string: 'b' })
    await $.tool.call({ tool: 'Edit', tool_use_id: 'e2', file_path: '/p/src/parser.ts', old_string: 'a', new_string: 'b', agentId: 'a1' })
    expect(opened).toEqual([]) // autoOpen off: never opens by itself

    await $.command.run({ command: 'aflow', args: '' })
    expect(opened).toEqual(['agent-flow'])
    const pane = { title: 'Agent flow', isFocused: false, bodyColumns: 100, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
    const ui = await $.ui.mount({ plugin: 'agent-flow', surface, component: 'Pane', requestId: 'agent-flow', props: pane })
    expect(await ui.find({ text: 'Agent flow · main + 1 agent · 2 running · 0 waiting' })).toBeDefined()
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('"children":["38.2k tok"]')
    expect(drawn).toContain('"children":["22.7k tok"]')
    expect(drawn).toMatch(/"color":"magenta","bold":true[^}]*},"children":\["Fable 5\.1"\]/)
    expect(await ui.find({ text: 'implementer "Fix the parser"' })).toBeDefined()
    expect(await ui.find({ text: /last: implementer · Edit .*parser\.ts/ })).toBeDefined()

    await ui.press({ key: 'diff-a1' })
    expect(await ui.find({ text: /sub_Diff · implementer "Fix the parser"/ })).toBeDefined()
    expect(await ui.find({ text: /parser\.ts/ })).toBeDefined()
    await ui.press({ key: 'back' })
    await ui.press({ key: 'diff-main' })
    expect(await ui.find({ text: 'main_Diff · main' })).toBeDefined()
    expect(await ui.find({ text: /main\.ts/ })).toBeDefined()
  })
}

test('a subagent shows as working from its first request to its own turn.complete, and again when woken', async ($, on) => {
  mock.clock(on, { now: 0 })
  let roster = 'completed' // the roster lags behind: it already says done
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [{ id: 'r1', description: 'focus_null diff review', type: 'reviewer', status: roster as 'completed' }] }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: usage('claude-sonnet-5-5', 100) }
  })
  const stepOf = async () => {
    for await (const _ of $.turn.step({ turnId: 'x', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: 'r1' })) {
      // drain
    }
  }
  const done = { answer: 'ok', durationMs: 1000, isAborted: false, turnId: 'x', reason: 'answer' as const, agentId: 'r1' }
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'aflow', args: '' })
  const pane = { title: 'Agent flow', isFocused: false, bodyColumns: 100, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
  const ui = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: pane })

  await stepOf()
  expect(await ui.find({ text: 'Agent flow · main + 1 agent · 1 running · 0 waiting' })).toBeDefined()
  await $.turn.complete(done)
  expect(await ui.find({ text: 'Agent flow · main + 1 agent · 0 running · 0 waiting' })).toBeDefined()

  roster = 'running' // woken by a message from main
  await stepOf()
  expect(await ui.find({ text: 'Agent flow · main + 1 agent · 1 running · 0 waiting' })).toBeDefined()
})

test('what each loop does now, slow and silent warnings, [+] details, unlisted loops and the text form', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let release = () => {}
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Fix the parser', type: 'implementer', status: 'running' as const }] }))
  on('agent.spawn', () => ({ model: 'claude-fable-5-1', agentId: 'a1' }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: usage(e.model, 1000) }
  })
  on('tool.call', { tool: 'Bash' }, () => new Promise(done => (release = () => done({ result: { stdout: 'ok', stderr: '', interrupted: false } }))))
  on('tool.call', { tool: 'Read' }, () => ({ result: { type: 'text', file: { filePath: '/p/a.ts', content: '', numLines: 0, startLine: 1, totalLines: 0 } } }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'Find why the parser drops the last token and fix it', description: 'Fix the parser', subagentType: 'implementer' })
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-fable-5-1', messageCount: 1, agentId: 'a1' })) {
    // drain
  }
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/p/a.ts', agentId: 'a1' })
  const pending = $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'npm test', agentId: 'a1' })
  // an engine fork the roster does not list
  for await (const _ of $.turn.step({ turnId: 'f', index: 0, model: 'claude-haiku-4-5', messageCount: 1, agentId: 'fork-1' })) {
    // drain
  }

  await $.command.run({ command: 'aflow', args: '' })
  const pane = { title: 'Agent flow', isFocused: false, bodyColumns: 160, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
  const ui = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: pane })
  expect(await ui.find({ text: '×2' })).toBeDefined()
  expect(await ui.find({ text: 'Bash npm test 0s' })).toBeDefined()
  expect(await ui.find({ text: '▸ unlisted loops (1)' })).toBeDefined()
  expect(await ui.find({ text: 'Agent flow · main + 1 agent · 1 running · 0 waiting' })).toBeDefined()

  await clock.advance(32_000)
  expect(await ui.find({ text: /⚠ slow/ })).toBeUndefined() // a shell call has 3 minutes
  await clock.advance(150_000)
  expect(await ui.find({ text: '⚠ slow 3m02s' })).toBeDefined()

  await ui.press({ key: 'more-a1' })
  expect(await ui.find({ text: /prompt "Find why the parser drops the last token/ })).toBeDefined()
  expect(await ui.find({ text: /· Read .*a\.ts 0s/ })).toBeDefined()

  await ui.press({ key: 'unlisted' })
  expect(await ui.find({ text: '▾ unlisted loops (1)' })).toBeDefined()

  release()
  await pending
  expect(await ui.find({ text: /⚠ slow/ })).toBeUndefined()
  await clock.advance(122_000)
  expect(await ui.find({ text: /⚠ silent 2m/ })).toBeDefined()

  const text = (await $.command.run({ command: 'aflow', args: 'text' })).text ?? ''
  expect(text).toContain('└ [run] implementer "Fix the parser"  Fable 5.1')
  expect(text).toContain('×2  ✎0')
  expect(text).toContain('· 1 unlisted')
})

test('stats: the run log grouped by agent and model, costliest first', () => {
  const day = 86_400_000
  const e = (type: string, model: string, tokens: number, at: number) => ({ at, cwd: '/p', type, task: '', model, tokens, ms: 60_000, calls: 10, edits: 1, isAborted: false })
  const log = [e('implementer', 'claude-fable-5-1', 80_000, 9 * day), e('implementer', 'claude-fable-5-1', 40_000, 9 * day), e('Explore', 'claude-haiku-4-5', 5_000, 9 * day), e('old', 'claude-opus-5-5', 999_999, 0)]
  expect(statsDays('stats')).toBe(7)
  expect(statsDays('stats 30')).toBe(30)
  const gs = groups(log, 10 * day, 7)
  expect(gs.map(g => `${g.type}/${g.model}/${g.runs}/${g.tokens}`)).toEqual(['implementer/Fable 5.1/2/120000', 'Explore/Haiku 4.5/1/5000'])
  const text = statsText(log, 10 * day, 7)
  expect(text).toContain('3 runs, 125.0k tokens')
  expect(text).toMatch(/implementer\s+Fable 5\.1\s+2\s+120\.0k\s+96%\s+60\.0k\s+1m00s/)
  expect(statsText([], 0, 7)).toBe('No subagent runs logged in the last 7 days.')
})

test('each finished subagent run is logged once, and /aflow stats sums it', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  on('session.start', () => ({ cwd: '/p' }))
  on('session.cwd', () => ({ value: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Fix the parser', type: 'implementer', status: 'running' as const }] }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: usage(e.model, 10_000) }
  })
  const run = async () => {
    for await (const _ of $.turn.step({ turnId: 'x', index: 0, model: 'claude-fable-5-1', messageCount: 1, agentId: 'a1' })) {
      // drain
    }
    await $.turn.complete({ answer: 'ok', durationMs: 90_000, isAborted: false, turnId: 'x', reason: 'answer' as const, agentId: 'a1' })
  }
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await run()
  await run() // woken again: logs only what this run added
  const text = (await $.command.run({ command: 'aflow', args: 'stats' })).text ?? ''
  expect(text).toContain('2 runs, 20.0k tokens')
  expect(text).toMatch(/implementer\s+Fable 5\.1\s+2\s+20\.0k\s+100%\s+10\.0k\s+1m30s/)
})

test('logging can be turned off', { options: { log: false } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  on('session.start', () => ({ cwd: '/p' }))
  on('session.cwd', () => ({ value: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('agent.list', () => ({ value: [] }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 'x', reason: 'answer' as const, agentId: 'a1' })
  expect((await $.command.run({ command: 'aflow', args: 'stats' })).text).toBe('No subagent runs logged in the last 7 days.')
})

test('mergeRoster keeps the same rows when the roster brings no change', () => {
  const base = (id: string): AgentRow => ({ id, type: 'Explore', task: 'look', model: null, status: 'running', startedAt: 0, tokens: 0, edits: 0, isUnlisted: false, ...fresh(0) })
  const rows = [base('a'), { ...base('b'), status: 'completed', endedAt: 5 }]
  const add = (a: RosterEntry): AgentRow => ({ ...base(a.id), type: a.type || 'subagent', task: a.description || '', status: a.status, parentId: a.parentId })
  const list: RosterEntry[] = [{ id: 'a', type: 'Explore', description: 'look', status: 'running' }, { id: 'b', type: 'Explore', description: 'look', status: 'completed' }]
  // no change: the same array back
  expect(mergeRoster(rows, list, 100, add)).toBe(rows)
  // a changed field: a new array with that field updated, the other row untouched
  const changed = mergeRoster(rows, [{ ...list[0]!, status: 'completed' }, list[1]!], 100, add)
  expect(changed).not.toBe(rows)
  expect(changed[0]!.status).toBe('completed')
  expect(changed[0]!.endedAt).toBe(100)
  expect(changed[1]).toBe(rows[1])
  // a new roster entry: added through add, after the existing rows
  const grown = mergeRoster(rows, [...list, { id: 'c', type: 'implementer', description: 'fix', status: 'running', parentId: 'a' }], 100, add)
  expect(grown).not.toBe(rows)
  expect(grown.map(r => r.id)).toEqual(['a', 'b', 'c'])
  expect(grown[2]).toMatchObject({ type: 'implementer', task: 'fix', status: 'running', parentId: 'a' })
  // a row first seen unlisted becomes listed once the roster names it
  const unlisted = [{ ...base('a'), isUnlisted: true }]
  expect(mergeRoster(unlisted, [list[0]!], 100, add)[0]!.isUnlisted).toBe(false)
})

test('the tick runs only while our pane is open, drawn and in front', () => {
  const pane = { id: 'agent-flow', title: 'Agent flow', isShown: true, isFocused: false, isPlaced: true }
  expect(shouldTick([pane], 'agent-flow')).toBe(true)
  expect(shouldTick([], 'agent-flow')).toBe(false)
  expect(shouldTick([{ ...pane, id: 'other' }], 'agent-flow')).toBe(false)
  expect(shouldTick([{ ...pane, isPlaced: false }], 'agent-flow')).toBe(false)
  expect(shouldTick([{ ...pane, isShown: false }], 'agent-flow')).toBe(false)
})

test('only /aflow is registered; the old name /agent-flow is gone', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  const names: string[] = []
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => {
    names.push(e.name)
    return { value: { command: e.name } }
  })
  on('command.describe', (_$, e) => ({ description: e.description, argumentHint: e.argumentHint, isHidden: e.isHidden }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect(names).toEqual(['aflow'])
  const describe = (command: string) =>
    $.command.describe({ command, description: 'd', isHidden: false, immediate: false, provider: { plugin: 'agent-flow', tier: 'user' } } as never)
  expect((await describe('aflow')).isHidden).toBe(false)
})

test('a closed pane stops the 2 s tick from reading the roster; an open one resumes it', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let listed = 0
  let panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[] = []
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('ui.panes', () => ({ value: panes }))
  on('agent.list', () => {
    listed++
    return { value: [] }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'x', turnId: 't' }) // main is running, so only the pane gates the tick
  await clock.advance(10_000)
  expect(listed).toBe(0)
  panes = [{ id: 'agent-flow', title: 'Agent flow', isShown: true, isFocused: false, isPlaced: true }]
  await clock.advance(10_000)
  expect(listed).toBeGreaterThan(0)
})

test('shouldAutoOpen: on, first time, and not up already', () => {
  expect(shouldAutoOpen(true, false, [], 'agent-flow')).toBe(true)
  expect(shouldAutoOpen(true, false, undefined, 'agent-flow')).toBe(true) // no pane list: once-per-run rule only
  expect(shouldAutoOpen(false, false, [], 'agent-flow')).toBe(false)
  expect(shouldAutoOpen(true, true, [], 'agent-flow')).toBe(false)
  expect(shouldAutoOpen(true, false, [{ id: 'agent-flow' }], 'agent-flow')).toBe(false)
  expect(shouldAutoOpen(true, false, [{ id: 'other' }], 'agent-flow')).toBe(true)
})

test('autoOpen opens the pane on the first session.start only', async ($, on) => {
  mock.clock(on, { now: 0 })
  const opened: string[] = []
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect(opened).toEqual(['agent-flow'])
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true }) // resume / compact / clear
  expect(opened).toEqual(['agent-flow'])
})

test('autoOpen off: session.start does not open the pane', { options: { autoOpen: false } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  const opened: string[] = []
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect(opened).toEqual([])
})

test('autoOpen where no pane is drawn: one toast, once', async ($, on) => {
  mock.clock(on, { now: 0 })
  const toasts: string[] = []
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: false } }))
  on('ui.toast', (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: false })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: false })
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('/aflow text')
})

test('autoOpen: a throwing open is swallowed', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => {
    throw new Error('no ui')
  })
  const result = await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect(result.cwd).toBe('/p')
})
