// pinboard: tests for putting the board back after a /clear reset the session atoms.
import { expect, mock, test } from 'claude-code/testing'

import { restoreOf } from '../hooks/restore'
import { storeKey } from '../hooks/pins'

test('a reset board (folder back to empty) gets the remembered folder and fold back', () => {
  expect(restoreOf('', { folder: '/work/app', folded: true })).toEqual({ folder: '/work/app', folded: true })
  expect(restoreOf('', { folder: '/work/app', folded: false })).toEqual({ folder: '/work/app', folded: false })
})

test('a board that still holds its folder is left as it is', () => {
  expect(restoreOf('/work/app', { folder: '/work/app', folded: true })).toBeUndefined()
  expect(restoreOf('/work/other', { folder: '/work/app', folded: false })).toBeUndefined()
})

test('nothing remembered: no restore, so nothing is saved under the empty folder key', () => {
  expect(restoreOf('', { folder: '', folded: false })).toBeUndefined()
})

test('the restored folder saves under its own key, never the empty one', () => {
  const back = restoreOf('', { folder: '/work/app', folded: false })
  expect(back === undefined ? undefined : storeKey(back.folder)).toBe(storeKey('/work/app'))
  expect(storeKey('/work/app')).not.toBe(storeKey(''))
})

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} }

/**
 * A fake host whose pinboard atoms read as reset after host.reset(), each until pinboard writes it again
 * (the test kit cannot reset another plugin's atoms). Its clock is mocked, so every wait is stepped by the test.
 */
function clearableHost(on: Parameters<Parameters<typeof test>[2]>[1]) {
  const clock = mock.clock(on, { now: 5 })
  const store = new Map<string, unknown>()
  const initial: Record<string, unknown> = { folder: '', folded: false, pins: [], captured: [] }
  const resetKeys = new Set<string>()
  const host = {
    clock,
    store,
    reset: () => Object.keys(initial).forEach(k => resetKeys.add(k)),
    isReset: (key: string) => resetKeys.has(key),
    getStore: async (key: string): Promise<unknown> => store.get(key),
  }
  on('store.get', async (_$, e) => ({ value: await host.getStore(e.key) }))
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.cwd', () => ({ value: '/p' }))
  on('session.start', () => ({ cwd: '/p' }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>other row</Text>
  })
  // the real version is kept so pinboard's writes go through; only the value reads as the initial one
  on('state.get', async (_$, e, next) => {
    const real = await next(e)
    return e.plugin === 'pinboard' && resetKeys.has(e.key) ? { value: { ...real.value, value: initial[e.key] } } : real
  })
  on('state.set', (_$, e, next) => {
    if (e.plugin === 'pinboard') resetKeys.delete(e.key)
    return next(e)
  })
  return host
}

test('after a /clear resets the atoms the board comes back with its pins and fold, and a new pin saves to the folder', { options: { deliver: false } }, async ($, on) => {
  const host = clearableHost(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pin', args: 'a note' })
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: '[Show]' })).toBeDefined() // folded, unlike the reset atom's false

  // /clear: session.end with reason clear, no session.start, then every atom back to its initial value
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
  host.reset()
  const cleared = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await cleared.find({ text: '📌 Pins 1' })).toBeUndefined()
  await host.clock.advance(500) // resolves once the tick's restore has settled
  expect(['folder', 'folded', 'pins'].filter(host.isReset)).toEqual([])
  const restored = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await restored.find({ text: '📌 Pins 1' })).toBeDefined()
  expect(await restored.find({ text: '[Show]' })).toBeDefined()
  await restored.press({ key: 'fold' })
  expect(await restored.find({ text: '1. a note' })).toBeDefined()

  await $.command.run({ command: 'pin', args: 'after clear' })
  expect((host.store.get('pins:/p') as { text: string }[]).map(p => p.text)).toEqual(['a note', 'after clear'])
  expect(host.store.has('pins:')).toBe(false)
})

test('a /pin while the restore tick waits on the store keeps the new pin (the tick does not restore a stale list over it)', { options: { deliver: false } }, async ($, on) => {
  const host = clearableHost(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pin', args: 'a note' })
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
  host.reset()

  // the tick's store read takes the list as it is now, then waits until released
  let entered = () => {}
  const isEntered = new Promise<void>(resolve => (entered = resolve))
  let release = () => {}
  const isReleased = new Promise<void>(resolve => (release = resolve))
  host.getStore = async key => {
    host.getStore = async k => host.store.get(k)
    const stale = host.store.get(key)
    entered()
    await isReleased
    return stale
  }
  await host.clock.advance(500)
  await isEntered

  // the /pin runs as far as it can while the tick is held (it should wait on the tick's restore), then the tick goes on
  const run = $.command.run({ command: 'pin', args: 'during restore' })
  await host.clock.settle()
  release()
  await run
  await host.clock.settle()

  expect((host.store.get('pins:/p') as { text: string }[]).map(p => p.text)).toEqual(['a note', 'during restore'])
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: '📌 Pins 2' })).toBeDefined()
})

test('a /pin whose restore fails still changes the board but writes nothing under the empty folder key', { options: { deliver: false } }, async ($, on) => {
  const host = clearableHost(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pin', args: 'a note' })
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
  host.reset()
  host.getStore = async () => {
    throw new Error('store down')
  }

  const result = await $.command.run({ command: 'pin', args: 'no store' })
  expect(JSON.stringify(result)).toContain('Pinned #1')
  expect(host.store.has('pins:')).toBe(false)
  expect((host.store.get('pins:/p') as { text: string }[]).map(p => p.text)).toEqual(['a note'])
})
