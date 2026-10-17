import { expect, mock, test } from 'claude-code/testing'

import { counts, creation, normalise, render } from '../hooks/diff'
import { parseQuiz, shortPath } from '../hooks/tutor'

/** Every hunk header must match its lines, or the engine refuses the Code diff. */
const headersMatch = (source: string): boolean => {
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; ) {
    const m = /^@@ -\d+,(\d+) \+\d+,(\d+) @@$/.exec(lines[i] ?? '')
    if (!m) return false
    let j = i + 1
    let olds = 0
    let news = 0
    while (j < lines.length && !(lines[j] ?? '').startsWith('@@')) {
      const l = lines[j] ?? ''
      if (!l.startsWith('+')) olds += 1
      if (!l.startsWith('-')) news += 1
      j += 1
    }
    if (olds !== Number(m[1]) || news !== Number(m[2])) return false
    i = j
  }
  return true
}

const readme = Array.from({ length: 32 }, (_, i) => `line ${i + 1}`).join('\n') + '\n'

test('a cut diff keeps hunk headers that match their lines', () => {
  const raw = creation(readme)
  expect(counts(raw)).toEqual({ added: 32, removed: 0 })
  const { hunks, total } = normalise(raw, 200)
  expect(total).toBe(32)
  const cut = render(hunks, 10)
  expect(cut.shown).toBe(10)
  expect(cut.source.split('\n')[0]).toBe('@@ -0,0 +1,10 @@')
  expect(headersMatch(cut.source)).toBe(true)
  expect(headersMatch(render(hunks, null).source)).toBe(true)

  const edit = [
    { oldStart: 3, newStart: 3, lines: [' a', '-b', '+B', '+B2', ' c', '\\ No newline at end of file'] },
    { oldStart: 20, newStart: 21, lines: [' x', '-y', ' z'] },
  ]
  const n = normalise(edit, 200)
  expect(headersMatch(render(n.hunks, 4).source)).toBe(true)
  expect(render(n.hunks, null).source).toBe('@@ -3,3 +3,4 @@\n a\n-b\n+B\n+B2\n c\n@@ -20,3 +21,2 @@\n x\n-y\n z')
})

test('quiz parsing and short paths', () => {
  const q = parseQuiz('Here you go\n{"question":"Q?","choices":["a","b","c","d"],"answer":2,"explanation":"why"}')
  expect(q?.answer).toBe(2)
  expect(q?.picked).toBe(null)
  expect(parseQuiz('{"question":"Q?","choices":["a","b"],"answer":5}')).toBe(null)
  expect(parseQuiz('no json')).toBe(null)
  expect(shortPath('C:\\Users\\me\\mods\\stock-analyzer\\README.md')).toBe('.../mods/stock-analyzer/README.md')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a Write becomes a note in the pane on ${surface}`, { options: { enabled: true } }, async ($, on) => {
    mock.clock(on, { now: Date.UTC(2026, 9, 3, 8, 18) })
    mock.store(on)
    const statuses: (string | undefined)[] = []
    on('session.usage', () => ({ value: { startedAt: 42, rateLimits: [], context: { window: 200_000 } } }))
    on('session.start', () => ({ cwd: '/' }))
    on('command.register', (_$, e) => ({ value: { command: e.name } }))
    on('ui.status', (_$, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('prompt.submit', () => ({ text: '' }))
    on('turn.step', async function* (_$, e) {
      return { turnId: e.turnId, index: e.index, answer: 'Still installing. I will write the README while I wait.', toolUses: [], stopReason: 'tool_use', usage: null }
    })
    on('tool.call', { tool: 'Write' }, (_$, e) => ({
      result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [], originalFile: null },
    }))
    on('model.complete', () => ({
      value: { isAnswered: true, text: '{"question":"What is a README for?","choices":["Docs","An executable","Config","Logs"],"answer":0,"explanation":"It explains how to use the project."}', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    }))
    on('ui.render', ($, e) => {
      const { Box } = $.ui.resolve(e)
      return <Box key="engine" />
    })

    await $.session.start({ cwd: '/', surface, isInteractive: true })
    await $.prompt.submit({ text: 'Build a small stock analysis MVP', wait: false, origin: { kind: 'composer' } })
    for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 })) {
      // drain
    }
    await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: '/p/mods/stock-analyzer/README.md', content: readme })
    expect(statuses.at(-1)).toBe('📘 1 change note')

    const pane = { title: 'Change Notes', isFocused: false, bodyColumns: 80, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
    const ui = await $.ui.mount({ plugin: 'change-tutor', surface, component: 'Pane', requestId: 'change-tutor', props: pane })
    expect(await ui.find({ text: /README\.md \(new file\)/ })).toBeDefined()
    expect(await ui.find({ text: 'This session 1' })).toBeDefined()
    expect(await ui.find({ text: /stock analysis MVP/ })).toBeDefined()
    expect(await ui.find({ text: /write the README/ })).toBeDefined()
    expect(await ui.find({ text: '⤢ Show all (+22 lines)' })).toBeDefined()

    await ui.press({ key: 'expand' })
    expect(await ui.find({ text: '⤡ Collapse' })).toBeDefined()

    await ui.press({ key: 'quiz' })
    expect(await ui.find({ text: /What is a README for/ })).toBeDefined()
    await ui.press({ key: 'choice-0' })
    expect(await ui.find({ text: /Correct!/ })).toBeDefined()
  })
}

test("a subagent's Edit is left to agent-flow", { options: { enabled: true } }, async ($, on) => {
  mock.clock(on, { now: 1 })
  mock.store(on)
  const statuses: (string | undefined)[] = []
  on('session.usage', () => ({ value: { startedAt: 1, rateLimits: [], context: { window: 200_000 } } }))
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.status', (_$, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.call', { tool: 'Edit' }, (_$, e) => ({
    result: { filePath: e.file_path, oldString: 'a', newString: 'b', originalFile: 'a\n', structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }], userModified: false, replaceAll: false },
  }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/p/x.ts', old_string: 'a', new_string: 'b', agentId: 'a1' })
  expect(statuses.filter(Boolean)).toEqual([])
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e2', file_path: '/p/y.ts', old_string: 'a', new_string: 'b' })
  expect(statuses.at(-1)).toBe('📘 1 change note')
})

test('off by default: nothing noted, no status line, and /change-tutor on|off switches it for the session', async ($, on) => {
  mock.clock(on, { now: 1 })
  mock.store(on)
  const statuses: (string | undefined)[] = []
  on('session.usage', () => ({ value: { startedAt: 1, rateLimits: [], context: { window: 200_000 } } }))
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.status', (_$, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.call', { tool: 'Edit' }, (_$, e) => ({
    result: { filePath: e.file_path, oldString: 'a', newString: 'b', originalFile: 'a\n', structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }], userModified: false, replaceAll: false },
  }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/p/x.ts', old_string: 'a', new_string: 'b' })
  expect(statuses.filter(Boolean)).toEqual([])
  expect((await $.command.run({ command: 'change-tutor', args: '' })).text).toContain('noting is off')

  expect((await $.command.run({ command: 'change-tutor', args: 'on' })).text).toBe('change-tutor: noting changes for this session.')
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e2', file_path: '/p/y.ts', old_string: 'a', new_string: 'b' })
  expect(statuses.at(-1)).toBe('📘 1 change note')

  await $.command.run({ command: 'change-tutor', args: 'off' })
  expect(statuses.at(-1)).toBe(undefined)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e3', file_path: '/p/z.ts', old_string: 'a', new_string: 'b' })
  expect(statuses.at(-1)).toBe(undefined)
})
