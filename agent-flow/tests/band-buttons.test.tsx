// agent-flow band button tests (v2.5.0 F1): the unfolded band shows the pane's row buttons; pressing one opens the pane on that row
import { expect, mock, test } from 'claude-code/testing'

type On = Parameters<typeof mock.clock>[0]

const BAND = { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 160, scroll: { offset: 0, bodyRows: 10 }, view: {} }
const PANE = { title: 'Agent flow', isFocused: false, bodyColumns: 160, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
const patch = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }]

/** A host whose roster lists one running implementer (a1); main and a1 have each made one edit. */
const host = (on: On) => {
  mock.clock(on, { now: 10_000 })
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({ value: [] }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Fix the parser', type: 'implementer', status: 'running' as const }] }))
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
