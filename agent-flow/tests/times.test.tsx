// agent-flow start/end time tests (v2.16.0 F1): subagent rows show HH:MM–HH:MM (running: HH:MM–) after the elapsed time
import { expect, mock, test } from 'claude-code/testing'
import { rowTime } from '../hooks/flow'

// Built from local Date parts, so the expected strings hold in any timezone.
const at = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m).getTime()

test('rowTime: a finished row shows HH:MM–HH:MM, a working one HH:MM–, zero-padded, across midnight', () => {
  expect(rowTime({ startedAt: at(24, 14, 2), endedAt: at(24, 14, 4) }, false, at(24, 15, 0))).toBe('2m00s 14:02–14:04')
  expect(rowTime({ startedAt: at(24, 14, 2), endedAt: at(24, 14, 4) }, true, at(24, 14, 2) + 41_000)).toBe('41s 14:02–') // working: the end is ignored
  expect(rowTime({ startedAt: at(24, 14, 2) }, false, at(24, 14, 3))).toBe('1m00s 14:02–') // no end yet
  expect(rowTime({ startedAt: at(24, 7, 5), endedAt: at(24, 9, 8) }, false, 0)).toBe('2h03m 07:05–09:08')
  expect(rowTime({ startedAt: at(24, 23, 58), endedAt: at(25, 0, 3) }, false, 0)).toBe('5m00s 23:58–00:03')
})

test('the band, the pane and /aflow text show the same time range, running then done', async ($, on) => {
  const clock = mock.clock(on, { now: at(24, 14, 2) })
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Fix the parser', type: 'implementer', status: 'completed' as const }] }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: e.model } }
  })
  on('ui.render', ($$, e) => {
    const { Box } = $$.ui.resolve(e)
    return <Box key="engine" />
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  for await (const _ of $.turn.step({ turnId: 'x', index: 0, model: 'claude-fable-5-1', messageCount: 1, agentId: 'a1' })) {
    // drain
  }
  await $.command.run({ command: 'aflow', args: '' })
  const pane = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: { title: 'AFlow', isFocused: false, bodyColumns: 160, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} } })
  const band = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 160, scroll: { offset: 0, bodyRows: 10 }, view: {} } })
  await band.press({ key: 'aflow-fold' }) // unfold
  const seen = async (range: string) => {
    expect(await pane.find({ text: range })).toBeDefined()
    expect(await band.find({ text: range })).toBeDefined()
    expect((await $.command.run({ command: 'aflow', args: 'text' })).text).toContain(`Fable 5.1  ${range}  `)
  }

  await seen('0s 14:02–')
  await clock.advance(120_000)
  await $.turn.complete({ answer: 'ok', durationMs: 120_000, isAborted: false, turnId: 'x', reason: 'answer' as const, agentId: 'a1' })
  await seen('2m00s 14:02–14:04')
})
