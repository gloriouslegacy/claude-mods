// agent-flow tick tests: the 2 s tick stays a single timer however many times session.start comes,
// and it puts the chosen Show/Hide back after /clear resets the folded atom
import { expect, mock, test } from 'claude-code/testing'

import { foldToRestore } from '../hooks/flow'

test('after /clear the chosen Show/Hide comes back; nothing is written while the atom holds it', () => {
  expect(foldToRestore(true, false)).toBe(false) // unfolded, then /clear reset the atom to folded
  expect(foldToRestore(true, true)).toBe(undefined) // folded was chosen: the reset changed nothing
  expect(foldToRestore(false, false)).toBe(undefined)
  expect(foldToRestore(false, true)).toBe(true)
  expect(foldToRestore(true, undefined)).toBe(undefined) // before the first session.start nothing was chosen
})

test('tick timer registers once across repeated session.start', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let listed = 0
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('ui.panes', () => ({ value: [{ id: 'agent-flow', title: 'AFlow', isShown: true, isFocused: false, isPlaced: true }] }))
  on('agent.list', () => {
    listed++
    return { value: [] }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true }) // resume / compact (/clear sends none)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'x', turnId: 't' }) // main is running and the pane is up, so every tick syncs once
  await clock.advance(2_000)
  expect(listed).toBe(1)
  await clock.advance(2_000)
  expect(listed).toBe(2) // the one timer left keeps ticking
})
