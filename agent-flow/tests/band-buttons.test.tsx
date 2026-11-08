// agent-flow band button tests (v2.5.0 F1): the unfolded band shows the pane's row buttons; pressing one opens the pane on that row
import { expect, mock, test } from 'claude-code/testing'

type On = Parameters<typeof mock.clock>[0]

const BAND = { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 160, scroll: { offset: 0, bodyRows: 10 }, view: {} }
const PANE = { title: 'Agent flow', isFocused: false, bodyColumns: 160, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
const patch = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }]

type Roster = { id: string; description: string; type: string; status: 'running' }[]
const A1: Roster = [{ id: 'a1', description: 'Fix the parser', type: 'implementer', status: 'running' }]

/** A host whose roster lists one running implementer (a1) unless told otherwise; main and a1 have each made one edit. */
const host = (on: On, roster: Roster = A1, panes: () => object[] = () => []) => {
  mock.clock(on, { now: 10_000 })
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({ value: panes() as never }))
  on('agent.list', () => ({ value: roster }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    const usage = { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: e.model }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage }
  })
  on('tool.call', { tool: 'Edit' }, (_$, e) => ({
    result: { filePath: e.file_path, oldString: 'a', newString: 'b', originalFile: 'a\n', structuredPatch: patch, userModified: false, replaceAll: false },
  }))
  // the engine's own drawing beneath the band
  on('ui.render', ($$, e) => {
    const { Box } = $$.ui.resolve(e)
    return <Box key="engine" />
  })
}

/** Starts a session in which main and a1 each edit a file, then mounts the band unfolded. */
const unfoldedBand = async ($: Parameters<Parameters<typeof test>[1]>[0]) => {
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't' })
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-fable-5-1', messageCount: 1, agentId: 'a1' })) {
    // drain
  }
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/p/src/main.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e2', file_path: '/p/src/parser.ts', old_string: 'a', new_string: 'b', agentId: 'a1' })
  const band = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'aflow-fold' })
  return band
}

test('the unfolded band shows [main_Diff], [sub_Diff] and [+]; each opens the pane on that row, the band stays one line each', async ($, on) => {
  host(on)
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  const band = await unfoldedBand($)
  const drawn = JSON.stringify(await band.drawn())
  expect(drawn).toContain('[main_Diff]')
  expect(drawn).toContain('[sub_Diff]')
  expect(drawn).toContain('[+]')
  expect(opened).toEqual([])

  // [+]: the pane opens with a1's details unfolded; the band draws no details
  await band.press({ key: 'aflow-more-a1' })
  expect(opened).toEqual(['agent-flow'])
  expect(await band.find({ text: /model claude-fable-5-1/ })).toBeUndefined()
  expect(JSON.stringify(await band.drawn())).toContain('[+]')
  const pane = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: PANE })
  expect(await pane.find({ text: 'Agent flow · main + 1 agent · 2 running · 0 waiting' })).toBeDefined()
  expect(await pane.find({ text: /model claude-fable-5-1/ })).toBeDefined()
  expect(JSON.stringify(await pane.drawn())).toContain('[-]')

  // pressed again it keeps the details open rather than folding them
  await band.press({ key: 'aflow-more-a1' })
  expect(await pane.find({ text: /model claude-fable-5-1/ })).toBeDefined()

  // [sub_Diff]: the pane opens on a1's diffs; the band draws no diff
  await band.press({ key: 'aflow-diff-a1' })
  expect(opened.length).toBe(3)
  expect(await pane.find({ text: /sub_Diff · implementer "Fix the parser"/ })).toBeDefined()
  expect(await pane.find({ text: /parser\.ts/ })).toBeDefined()
  expect(await band.find({ text: /sub_Diff ·/ })).toBeUndefined()

  // [main_Diff]: main's diffs
  await band.press({ key: 'aflow-diff-main' })
  expect(await pane.find({ text: 'main_Diff · main' })).toBeDefined()
})

test('a band button whose pane is refused: one toast, the band keeps drawing', async ($, on) => {
  host(on)
  const toasts: string[] = []
  on('ui.open', () => {
    throw new Error('refused')
  })
  on('ui.toast', (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined }
  })
  const band = await unfoldedBand($)
  await band.press({ key: 'aflow-more-a1' })
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('/aflow text')
  expect(await band.find({ text: 'implementer "Fix the parser"' })).toBeDefined()
})

// v2.5.1 F1: a band button pressed again while the shown pane holds what it opens closes the pane

const A2: Roster = [...A1, { id: 'a2', description: 'Write the docs', type: 'documenter', status: 'running' }]

/** A host that keeps the pane's shown state: ui.open shows it, ui.close takes it away; calls land in `calls`. */
const paneHost = (on: On, roster: Roster = A1) => {
  const calls: string[] = []
  let isShown = false
  host(on, roster, () => (isShown ? [{ id: 'agent-flow', title: 'Agent flow', isShown: true, isFocused: false, isPlaced: true }] : []))
  on('ui.open', (_$, e) => {
    calls.push(`open ${e.id}`)
    isShown = true
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    calls.push(`close ${e.id}`)
    isShown = false
    return { value: undefined }
  })
  return { calls, closeByHand: () => (isShown = false) }
}

test('the same [sub_Diff] pressed twice: the pane opens, then closes', async ($, on) => {
  const { calls } = paneHost(on)
  const band = await unfoldedBand($)
  await band.press({ key: 'aflow-diff-a1' })
  await band.press({ key: 'aflow-diff-a1' })
  expect(calls).toEqual(['open agent-flow', 'close agent-flow'])
})

test('another subagent\'s [sub_Diff]: the pane switches to its diffs without closing', async ($, on) => {
  const { calls } = paneHost(on, A2)
  const band = await unfoldedBand($)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e3', file_path: '/p/docs/a.md', old_string: 'a', new_string: 'b', agentId: 'a2' })
  await band.press({ key: 'aflow-diff-a1' })
  await band.press({ key: 'aflow-diff-a2' })
  expect(calls).toEqual(['open agent-flow', 'open agent-flow'])
  const pane = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: PANE })
  expect(await pane.find({ text: /sub_Diff · documenter "Write the docs"/ })).toBeDefined()
})

test('the same [+] pressed twice: the pane closes and the row stays unfolded', async ($, on) => {
  const { calls } = paneHost(on)
  const band = await unfoldedBand($)
  await band.press({ key: 'aflow-more-a1' })
  await band.press({ key: 'aflow-more-a1' })
  expect(calls).toEqual(['open agent-flow', 'close agent-flow'])
  const pane = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: PANE })
  expect(await pane.find({ text: /model claude-fable-5-1/ })).toBeDefined()
})

test('a close refused by a hook: the press ends without an error, no reopen and no toast', async ($, on) => {
  const calls: string[] = []
  const toasts: string[] = []
  host(on, A1, () => [{ id: 'agent-flow', title: 'Agent flow', isShown: true, isFocused: false, isPlaced: true }])
  on('ui.open', (_$, e) => {
    calls.push(`open ${e.id}`)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    calls.push(`close ${e.id}`)
    throw new Error('refused')
  })
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined }
  })
  const band = await unfoldedBand($)
  await band.press({ key: 'aflow-diff-a1' })
  await band.press({ key: 'aflow-diff-a1' })
  expect(calls).toEqual(['open agent-flow', 'close agent-flow'])
  expect(toasts).toEqual([])
  expect(await band.find({ text: 'implementer "Fix the parser"' })).toBeDefined()
})

test('a pane closed by hand: the same button opens it again', async ($, on) => {
  const { calls, closeByHand } = paneHost(on)
  const band = await unfoldedBand($)
  await band.press({ key: 'aflow-diff-a1' })
  closeByHand()
  await band.press({ key: 'aflow-diff-a1' })
  expect(calls).toEqual(['open agent-flow', 'open agent-flow'])
})
