// qhud tick tests: the 15 s refresh stays a single timer however many times session.start comes
import { expect, mock, test } from 'claude-code/testing'

test('tick timer registers once across repeated session.start', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let usageReads = 0
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.usage', () => {
    usageReads++
    // window 0: refresh stops right after reading usage, so each tick reads it exactly once
    return { value: { startedAt: 0, context: { tokens: null, window: 0, percent: null }, rateLimits: [] } }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true }) // resume / compact
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  usageReads = 0
  await clock.advance(15_000)
  expect(usageReads).toBe(1)
  await clock.advance(15_000)
  expect(usageReads).toBe(2) // the one timer left keeps ticking
})
