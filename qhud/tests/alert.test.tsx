// qhud alert tests: threshold, once per window and reset, grouping, and delivery to the main thread only
import { expect, mock, test } from 'claude-code/testing'

import { alertLeft, alertText, crossed, remember, toastText, windowName } from '../hooks/alert'
import type { AlertState } from '../types'

const MIN = 60_000
const EMPTY: AlertState = { sent: {}, pending: [] }
const at = (min: number) => new Date(min * MIN).toISOString()

test('threshold: 5% left alerts, 5.1% does not', () => {
  const lims = [
    { kind: 'five_hour', percentUsed: 95.1, resetsAt: at(60) }, // 4.9 left
    { kind: 'seven_day', percentUsed: 95, resetsAt: at(600) }, // 5 left
    { kind: 'seven_day_fable', percentUsed: 94.9, resetsAt: at(600) }, // 5.1 left
  ]
  expect(crossed(lims, EMPTY, 5).map(l => l.kind)).toEqual(['five_hour', 'seven_day'])
})

test('alertLeft outside 1–50 means 5', () => {
  expect([alertLeft(10), alertLeft(1), alertLeft(50), alertLeft(0), alertLeft(51), alertLeft(-3), alertLeft(undefined), alertLeft('7')]).toEqual([10, 1, 50, 5, 5, 5, 5, 5])
})

test('once per window and reset; a new reset alerts again', () => {
  const first = [{ kind: 'five_hour', percentUsed: 96, resetsAt: at(60) }]
  const s1 = remember(EMPTY, first)
  expect(crossed(first, s1, 5)).toEqual([])
  expect(crossed([{ kind: 'five_hour', percentUsed: 99, resetsAt: at(60) }], s1, 5)).toEqual([])
  const next = [{ kind: 'five_hour', percentUsed: 97, resetsAt: at(360) }]
  expect(crossed(next, s1, 5).map(l => l.kind)).toEqual(['five_hour'])
  const noReset = [{ kind: 'spend_limit', percentUsed: 100 }]
  expect(crossed(noReset, remember(EMPTY, noReset), 5)).toEqual([])
})

test('several windows in one line, named as people say them', () => {
  expect([windowName('five_hour'), windowName('seven_day'), windowName('seven_day_fable'), windowName('spend_limit')]).toEqual(['5h', '7d', '7d Fable', 'spend'])
  const s = remember(remember(EMPTY, [{ kind: 'five_hour', percentUsed: 96, resetsAt: at(62) }]), [{ kind: 'seven_day_fable', percentUsed: 95, resetsAt: at(3 * 1440 + 120) }])
  expect(alertText(s.pending, 0)).toBe(
    '[qhud] Usage limit nearly reached: 5h 96% used, 4% left (resets in 1h2m); 7d Fable 95% used, 5% left (resets in 3d 2h). Finish the current step, save progress notes, and avoid starting large new work.',
  )
  expect(toastText([{ kind: 'spend_limit', percentUsed: 97 }], 0)).toBe('Usage limit nearly reached: spend 97% used, 3% left')
})

test('a window name from the endpoint is cut at 24 characters', () => {
  expect(windowName(`seven_day_${'x'.repeat(100)}`)).toBe(`7d X${'x'.repeat(20)}`)
})

test('one alert line carries at most four windows', () => {
  expect(toastText(['a', 'b', 'c', 'd', 'e', 'f'].map(kind => ({ kind, percentUsed: 99 })), 0)).toBe('Usage limit nearly reached: a 99% used, 1% left; b 99% used, 1% left; c 99% used, 1% left; d 99% used, 1% left')
})

test('the alert reaches the main thread once, never a subagent', { options: { layout: 'line', git: false, model: false, plan: false } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  const toasts: string[] = []
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [{ kind: 'five_hour', percentUsed: 96, resetsAt: at(62) }], context: { tokens: 1, window: 200_000 } } }))
  on('settings.read', () => ({ value: {} }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.call', { tool: 'Read' }, () => ({ result: { type: 'text', file: { filePath: '/p/a.ts', content: '', numLines: 0, startLine: 1, totalLines: 0 } } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(toasts).toEqual(['Usage limit nearly reached: 5h 96% used, 4% left (resets in 1h2m)'])

  const sub = await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/p/a.ts', agentId: 'a1' })
  expect(sub.context).toBeUndefined()
  const main = await $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: '/p/a.ts' })
  expect(main.context?.join('\n')).toContain('[qhud] Usage limit nearly reached: 5h 96% used, 4% left')
  const again = await $.tool.call({ tool: 'Read', tool_use_id: 'r3', file_path: '/p/a.ts' })
  expect(again.context).toBeUndefined()

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true }) // refreshes again: same reset, no second alert
  expect(toasts.length).toBe(1)
})

test('a prompt before any tool call carries the alert instead', { options: { layout: 'line', git: false, model: false, plan: false } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [{ kind: 'seven_day', percentUsed: 98, resetsAt: at(62) }], context: { tokens: 1, window: 200_000 } } }))
  on('settings.read', () => ({ value: {} }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  on('tool.call', { tool: 'Read' }, () => ({ result: { type: 'text', file: { filePath: '/p/a.ts', content: '', numLines: 0, startLine: 1, totalLines: 0 } } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const entered = await $.prompt.submit({ text: 'go on', asUser: true })
  expect(entered.drop === undefined ? entered.context?.join('\n') : '').toContain('[qhud] Usage limit nearly reached: 7d 98% used, 2% left')
  const main = await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/p/a.ts' })
  expect(main.context).toBeUndefined()
})

test('alert off: no toast, no context', { options: { layout: 'line', git: false, model: false, plan: false, alert: false } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  const toasts: string[] = []
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [{ kind: 'five_hour', percentUsed: 99, resetsAt: at(62) }], context: { tokens: 1, window: 200_000 } } }))
  on('settings.read', () => ({ value: {} }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.call', { tool: 'Read' }, () => ({ result: { type: 'text', file: { filePath: '/p/a.ts', content: '', numLines: 0, startLine: 1, totalLines: 0 } } }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const main = await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/p/a.ts' })
  expect(toasts).toEqual([])
  expect(main.context).toBeUndefined()
})
