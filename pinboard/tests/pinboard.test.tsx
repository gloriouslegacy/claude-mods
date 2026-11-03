import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { CAPTURE_CHARS, CAPTURE_LINES, JUMP_GONE, KEEP_CAPTURED, addCaptured, captureOf, delivery, firstLine, fullLines, header, isCapture, jumpTo, listing, markerId, parse, removeCaptured, toggleOpen, withRequestId } from '../hooks/pins'

test('parsing /pin', () => {
  expect(parse('! check the .env keys')).toEqual({ kind: 'add', text: 'check the .env keys', important: true, urgent: false })
  expect(parse('!! stop, use v2')).toEqual({ kind: 'add', text: 'stop, use v2', important: true, urgent: true })
  expect(parse('upload to the drive')).toEqual({ kind: 'add', text: 'upload to the drive', important: false, urgent: false })
  expect(parse('done 2')).toEqual({ kind: 'done', n: 2 })
  expect(parse('RM 1')).toEqual({ kind: 'rm', n: 1 })
  expect(parse('')).toEqual({ kind: 'fold' })
  expect(parse('!')).toEqual({ kind: 'help' })
  const pin = { id: 'a', text: 'x', important: true, done: false, at: 0 }
  expect(delivery(pin, 3)).toContain('#3 (marked important): x')
  expect(header([pin, { ...pin, id: 'b', done: true }])).toBe('📌 Pins 1 (done 1)')
  expect(listing([pin])).toBe('1. [ ] ★ x')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`pins reach Claude, show above the prompt, check off and go with × on ${surface}`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000 })
    mock.store(on)
    const session = mock.session(on)
    on('session.cwd', () => ({ value: '/p/project' }))
    on('session.start', () => ({ cwd: '/p/project' }))
    on('command.register', (_$, e) => ({ value: { command: e.name } }))
    const prompts: string[] = []
    on('prompt.submit', (_$, e) => {
      prompts.push(e.text)
      return { text: e.text }
    })
    on('ui.render', ($$, e) => {
      const { Text } = $$.ui.resolve(e)
      return <Text>other row</Text>
    })

    await $.session.start({ cwd: '/p/project', surface, isInteractive: true })
    const first = await $.command.run({ command: 'pin', args: '! check the .env keys before deploying' })
    // idle: the pin goes in as the prompt itself, so Claude starts on it
    await clock.advance(200)
    expect(first.text).toBe('📌 Pinned #1 and sent to Claude as a prompt: check the .env keys before deploying')
    expect(prompts).toEqual(['📌 Pin #1 (important): check the .env keys before deploying'])
    expect(session.appended().length).toBe(0)
    await $.command.run({ command: 'pin', args: 'upload to the drive when the render is done' })
    await clock.advance(200)

    const props = { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} }
    const band = await $.ui.mount({ plugin: 'pinboard', surface, component: 'AbovePrompt', props })
    expect(await band.find({ text: '📌 Pins 2' })).toBeDefined()
    expect(await band.find({ text: '1. ★ check the .env keys before deploying' })).toBeDefined()
    expect(await band.find({ text: 'other row' })).toBeDefined()

    const r = await $.command.run({ command: 'pin', args: 'done 2' })
    expect(r.text).toBe('Marked #2 done.')
    expect(await band.find({ text: '📌 Pins 1 (done 1)' })).toBeDefined()
    expect(JSON.stringify(await band.drawn()).includes('"strikethrough":true')).toBe(true)

    const tree = JSON.stringify(await band.drawn())
    const rmKey = /"key":"(rm-[^"]+)"/.exec(tree)?.[1] ?? ''
    await band.press({ key: rmKey })
    expect(await band.find({ text: /check the \.env keys/ })).toBeUndefined()
    expect((await $.command.run({ command: 'pin', args: 'list' })).text).toBe('1. [x] upload to the drive when the render is done')

    // a new session in the same folder finds the board as it was left
    await $.session.start({ cwd: '/p/project', surface, isInteractive: true })
    expect((await $.command.run({ command: 'pin', args: 'list' })).text).toBe('1. [x] upload to the drive when the render is done')
  })
}

test('a new pin is only pinned when sending is off', { options: { deliver: false } }, async ($, on) => {
  mock.clock(on, { now: 1 })
  mock.store(on)
  const session = mock.session(on)
  on('session.cwd', () => ({ value: '/p' }))
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect((await $.command.run({ command: 'pin', args: 'quiet note' })).text).toBe('📌 Pinned #1: quiet note')
  expect(session.appended().length).toBe(0)
})

test('mid-turn: a pin is appended and read at the next step; one no step read is sent when the turn ends', async ($, on) => {
  mock.clock(on, { now: 1 })
  mock.store(on)
  const session = mock.session(on)
  const prompts: string[] = []
  on('session.cwd', () => ({ value: '/p' }))
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('prompt.submit', (_$, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>other row</Text>
  })
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: null }
  })
  const done = { answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' as const }
  const step = async () => {
    for await (const _ of $.turn.step({ turnId: 't', index: 1, model: 'm', messageCount: 3 })) {
      // drain
    }
  }
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  // read at the next step: appended once, no follow-up
  await $.turn.start({ text: 'do the three tasks', turnId: 't' })
  expect((await $.command.run({ command: 'pin', args: 'do them in order' })).text).toBe('📌 Pinned #1 and sent to Claude (read at its next step): do them in order')
  expect(session.appended().length).toBe(1)
  expect(JSON.stringify(session.appended()[0]?.message)).toContain('pinned note #1: do them in order')
  await step()
  await $.turn.complete(done)
  expect(prompts).toEqual([])

  // the turn ends first: the pin follows as a prompt
  await $.turn.start({ text: 'next', turnId: 't2' })
  await $.command.run({ command: 'pin', args: 'then push' })
  await $.turn.complete({ ...done, turnId: 't2' })
  expect(prompts).toEqual(['📌 Pinned while you were working:\n#2: then push'])

  // neither the appended note nor the follow-up prompt is listed as something typed
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: '📌 Pins 2' })).toBeDefined()
  expect(await band.find({ text: /»/ })).toBeUndefined()
})

test('!! mid-turn stops the turn and sends the pin as the next prompt at once', async ($, on) => {
  mock.clock(on, { now: 1 })
  mock.store(on)
  const session = mock.session(on)
  const prompts: string[] = []
  const aborted: string[] = []
  on('session.cwd', () => ({ value: '/p' }))
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('prompt.submit', (_$, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.abort', (_$, e) => {
    aborted.push(e.turnId)
    return { value: undefined }
  })
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  await $.turn.start({ text: 'refactor the parser', turnId: 't9' })
  const r = await $.command.run({ command: 'pin', args: '!! stop, keep the old API' })
  expect(r.text).toBe("📌 Pinned #1, stopped Claude's turn and sent it now: stop, keep the old API")
  expect(aborted).toEqual(['t9'])
  expect(session.appended().length).toBe(0)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: true, turnId: 't9', reason: 'answer' as const })
  expect(prompts.length).toBe(1)
  expect(prompts[0]).toContain('📌 Pin #1 (urgent — I stopped your turn for this): stop, keep the old API')
})

test('capture helpers: who counts, the cap of 20, removal, the first line', () => {
  const typed = { text: 'use staging', origin: { kind: 'composer' } }
  expect(isCapture(typed)).toBe(true)
  expect(isCapture({ ...typed, origin: { kind: 'plugin' } })).toBe(false)
  expect(isCapture({ ...typed, command: { name: 'pin', args: 'x' } })).toBe(false)
  expect(isCapture({ ...typed, isMeta: true })).toBe(false)
  expect(isCapture({ ...typed, text: '  \n ' })).toBe(false)
  let list = [] as { id: string; text: string; at: number }[]
  for (let i = 1; i <= KEEP_CAPTURED + 2; i++) list = addCaptured(list, { id: `c${i}`, text: `p${i}`, at: i })
  expect(list.length).toBe(20)
  expect(list[0]?.id).toBe('c3')
  expect(removeCaptured(list, 'c3')[0]?.id).toBe('c4')
  expect(firstLine('  one line  ')).toBe('one line')
  expect(firstLine('first\nsecond\nthird')).toBe('first …')
  expect(firstLine('\n\x1b \nok\x1b[31mred\x07\r\n')).toBe('ok [31mred')
  expect(firstLine(`a\rb${String.fromCharCode(0x2028)}c\td\u009be`)).toBe('a b c d e')
  // bidi and other format characters cannot reorder or hide the board line
  expect(firstLine('a‮b⁦c​d')).toBe('a b c d')
  expect(firstLine('x'.repeat(CAPTURE_CHARS))).toBe('x'.repeat(CAPTURE_CHARS))
  const long = firstLine(`${'y'.repeat(CAPTURE_CHARS + 50)}\nmore`)
  expect(long.length).toBe(CAPTURE_CHARS)
  expect(long.endsWith('y …')).toBe(true)
  expect(header([], 2)).toBe('📌 Pins 0 · » 2')
  expect(withRequestId(list, 'c4', 'r4').find(c => c.id === 'c4')?.requestId).toBe('r4')
  expect(markerId('12.5-ab')).toBe('cap-12_5-ab')
  expect(markerId('x'.repeat(80)).length).toBe(64)
})

const capturing = (on: On, clock: 'ok' | 'throw' = 'ok') => {
  if (clock === 'ok') mock.clock(on, { now: 5 })
  else
    on('clock.now', () => {
      throw new Error('clock down')
    })
  mock.store(on)
  const session = mock.session(on)
  const entered: string[] = []
  on('session.cwd', () => ({ value: '/p' }))
  on('session.start', () => ({ cwd: '/p' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('prompt.submit', (_$, e) => {
    entered.push(e.text)
    return { text: e.text }
  })
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>other row</Text>
  })
  // transcript markers and toasts as the host would answer them (the test host cannot answer a transcript scroll: see jumpTo's test)
  const placed: string[] = []
  const toasts: string[] = []
  const host = { place: 'ok' as 'ok' | 'none' | 'throw' }
  on('ui.place', (_$, e) => {
    placed.push(e.id)
    if (host.place === 'throw') throw new Error('no conversation')
    return { value: host.place === 'ok' ? { isPlaced: true as const, requestId: `req-${placed.length}` } : { isPlaced: false as const, reason: 'past the cap' } }
  })
  const logs: string[] = []
  on('ui.log', (_$, e) => {
    logs.push(String(e.text))
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  return { session, entered, placed, toasts, logs, host }
}

const BAND = { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} }

test('a prompt typed mid-turn is listed dimmed with », passes unchanged, folds with /pin and goes with ×', async ($, on) => {
  const { session, entered } = capturing(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const composer = { origin: { kind: 'composer' as const }, wait: false }

  // a slash command, a hidden prompt and a plugin's prompt are not listed
  await $.prompt.submit({ ...composer, text: '/pin x', command: { name: 'pin', args: 'x' }, turnId: 't' })
  await $.prompt.submit({ ...composer, text: 'hidden', isMeta: true, turnId: 't' })
  await $.prompt.submit({ text: 'from a plugin', origin: { kind: 'plugin', name: 'other' }, wait: false, turnId: 't' })
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: /»/ })).toBeUndefined()

  const r = await $.prompt.submit({ ...composer, text: 'use the staging bucket\nand keep the logs', turnId: 't' })
  expect(r.text).toBe('use the staging bucket\nand keep the logs')
  expect(entered.at(-1)).toBe('use the staging bucket\nand keep the logs')
  expect(session.appended().length).toBe(0)
  expect(await band.find({ text: '📌 Pins 0 · » 1' })).toBeDefined()
  expect(await band.find({ text: '1. use the staging bucket …' })).toBeDefined()
  expect(JSON.stringify(await band.drawn()).includes('"dimColor":true')).toBe(true)
  // a prompt queued with wait: true is listed too
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: true, text: 'then rerun the tests', turnId: 't' })
  expect(await band.find({ text: '📌 Pins 0 · » 2' })).toBeDefined()
  expect(await band.find({ text: '2. then rerun the tests' })).toBeDefined()
  // pin numbering stays its own; rm N touches pins only
  await $.command.run({ command: 'pin', args: 'a real pin' })
  expect(await band.find({ text: '1. a real pin' })).toBeDefined()
  expect((await $.command.run({ command: 'pin', args: 'rm 2' })).text).toBe('No pin #2 (the board has 1).')

  await $.command.run({ command: 'pin', args: '' })
  expect(await band.find({ text: /staging bucket/ })).toBeUndefined()
  await $.command.run({ command: 'pin', args: '' })

  const tree = JSON.stringify(await band.drawn())
  await band.press({ key: /"key":"(caprm-[^"]+)"/.exec(tree)?.[1] ?? '' })
  expect(await band.find({ text: /staging bucket/ })).toBeUndefined()
  expect(await band.find({ text: '1. a real pin' })).toBeDefined()
})

test('with capture off nothing typed mid-turn is listed', { options: { capture: false } }, async ($, on) => {
  const { placed } = capturing(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'use staging', origin: { kind: 'composer' }, wait: false, turnId: 't' })
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: /staging/ })).toBeUndefined()
  expect(placed).toEqual([])
  // nor is any transcript marker drawn
  const marker = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'Placed', props: { id: 'cap-5-abcde', plugin: 'pinboard' } })
  expect(await marker.find({ text: /»/ })).toBeUndefined()
})

test('a capture that fails still lets the prompt through unchanged and lists nothing', async ($, on) => {
  const { entered, placed, logs } = capturing(on, 'throw')
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const r = await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: 'use staging', turnId: 't' })
  expect(r.text).toBe('use staging')
  expect(r.drop).toBeUndefined()
  expect(entered).toEqual(['use staging'])
  expect(placed).toEqual([])
  expect(logs.some(l => l.startsWith('capture failed'))).toBe(true)
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: /staging/ })).toBeUndefined()
})

const pressRow = async (band: { drawn: () => Promise<unknown>; press: (t: { key: string }) => Promise<unknown> }) => {
  const key = /"key":"(capgo-[^"]+)"/.exec(JSON.stringify(await band.drawn()))?.[1] ?? ''
  expect(key).not.toBe('')
  await band.press({ key })
}

test('a click on a captured row scrolls to its stored marker, or answers why not', async () => {
  const asked: string[] = []
  const scroll = (deny?: string) => async (requestId: string) => {
    asked.push(requestId)
    return deny === undefined ? {} : { deny }
  }
  const item = { id: 'c1', text: 'use staging', at: 1, requestId: 'req-7' }
  expect(await jumpTo(item, scroll())).toBeUndefined()
  expect(asked).toEqual(['req-7'])
  expect(await jumpTo(item, scroll('not person-initiated'))).toBe('not person-initiated')
  expect(await jumpTo({ ...item, requestId: undefined }, scroll())).toBe('no marker')
  expect(asked).toEqual(['req-7', 'req-7'])
  // a scroll that rejects is answered like a deny, so the click toasts instead of failing
  const rejecting = async () => {
    throw new Error('no conversation')
  }
  expect(await jumpTo(item, rejecting)).toBe('failed: no conversation')
})

test('a captured prompt leaves a » #N marker in the transcript, kept on its record', async ($, on) => {
  const { placed } = capturing(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const composer = { origin: { kind: 'composer' as const }, wait: false }

  // prompts that are not captured place no marker
  await $.prompt.submit({ ...composer, text: '/pin x', command: { name: 'pin', args: 'x' }, turnId: 't' })
  expect(placed).toEqual([])

  await $.prompt.submit({ ...composer, text: 'use the staging bucket', turnId: 't' })
  expect(placed.length).toBe(1)
  expect(placed[0]?.startsWith('cap-')).toBe(true)
  const marker = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'Placed', props: { id: placed[0] ?? '', plugin: 'pinboard' } })
  expect(await marker.find({ text: '» #1' })).toBeDefined()
  expect(await marker.find({ text: /staging/ })).toBeUndefined()
  const other = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'Placed', props: { id: placed[0] ?? '', plugin: 'other' } })
  expect(await other.find({ text: /»/ })).toBeUndefined()

  // the row's text is the button that jumps, beside its [×]
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const tree = JSON.stringify(await band.drawn())
  expect(/"key":"capgo-/.test(tree)).toBe(true)
  expect(/"key":"caprm-/.test(tree)).toBe(true)
  expect(await band.find({ text: '1. use the staging bucket' })).toBeDefined()
})

test('a prompt that is only control characters is not listed', async ($, on) => {
  const { placed } = capturing(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '\x1b\x07\r', turnId: 't' })
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: /»/ })).toBeUndefined()
  expect(placed).toEqual([])
})

for (const fault of ['none', 'throw'] as const) {
  test(`a prompt whose marker was not placed (${fault}) is still listed; a click on it toasts and keeps it`, async ($, on) => {
    const { host, toasts, placed } = capturing(on)
    host.place = fault
    await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
    const r = await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: 'use staging', turnId: 't' })
    expect(r.text).toBe('use staging')
    expect(placed.length).toBe(1)
    const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    await pressRow(band)
    expect(toasts).toEqual([JUMP_GONE])
    expect(await band.find({ text: '1. use staging' })).toBeDefined()
  })
}

test('a prompt typed while Claude is idle is listed the same way; commands, hidden and plugin prompts still are not', async ($, on) => {
  const { entered, placed } = capturing(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const composer = { origin: { kind: 'composer' as const }, wait: false }
  await $.prompt.submit({ ...composer, text: '/pin x', command: { name: 'pin', args: 'x' } })
  await $.prompt.submit({ ...composer, text: 'hidden', isMeta: true })
  await $.prompt.submit({ text: 'from a plugin', origin: { kind: 'plugin', name: 'other' }, wait: false })
  expect(placed).toEqual([])

  const r = await $.prompt.submit({ ...composer, text: 'start the build' })
  expect(r.text).toBe('start the build')
  expect(entered.at(-1)).toBe('start the build')
  expect(placed.length).toBe(1)
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: '📌 Pins 0 · » 1' })).toBeDefined()
  expect(await band.find({ text: '1. start the build' })).toBeDefined()
  expect(await band.find({ text: /hidden|from a plugin|\/pin x/ })).toBeUndefined()
})

test('full text helpers: 20 lines of 200 characters, " …" when cut, every line cleaned', () => {
  expect(fullLines('\n\n  first  \n\n  second\n\n\n')).toEqual(['  first', '', '  second'])
  expect(fullLines('\x1b\x07\r\n \n')).toEqual([])
  // control and bidi/format characters are replaced on every line, not only the first
  expect(fullLines('a‮b\nc⁦d​e\nf\x1b[31mg\x07')).toEqual(['a b', 'c d e', 'f [31mg'])
  const wide = fullLines(`ok\n${'w'.repeat(CAPTURE_CHARS + 10)}`)
  expect(wide[1]?.length).toBe(CAPTURE_CHARS)
  expect(wide[1]?.endsWith('w …')).toBe(true)
  expect(fullLines(`ok\n${'w'.repeat(CAPTURE_CHARS)}`)[1]).toBe('w'.repeat(CAPTURE_CHARS))
  const many = fullLines(Array.from({ length: CAPTURE_LINES + 5 }, (_, i) => `line ${i + 1}`).join('\n'))
  expect(many.length).toBe(CAPTURE_LINES)
  expect(many.at(-1)).toBe(`line ${CAPTURE_LINES} …`)
  expect(fullLines(Array.from({ length: CAPTURE_LINES }, (_, i) => `line ${i + 1}`).join('\n')).at(-1)).toBe(`line ${CAPTURE_LINES}`)

  // a one-liner keeps no full text; more lines, or a first line that was cut, do
  expect(captureOf('  just this  ')).toEqual({ text: 'just this' })
  expect(captureOf('first\nsecond')).toEqual({ text: 'first …', lines: ['first', 'second'] })
  const long = captureOf('z'.repeat(CAPTURE_CHARS + 1))
  expect(long.text.endsWith(' …')).toBe(true)
  expect(long.lines?.length).toBe(1)
  expect(captureOf('\x1b\r').text).toBe('')

  const list = [{ id: 'a', text: 'x', at: 1 }, { id: 'b', text: 'y', at: 2 }]
  const opened = toggleOpen(list, 'a')
  expect(opened[0]?.open).toBe(true)
  expect(opened[1]?.open).toBeUndefined()
  expect(toggleOpen(opened, 'a')[0]?.open).toBeUndefined()
})

test('a longer typed prompt unfolds with [+] and folds back with [-]; /pin folds it away too', async ($, on) => {
  capturing(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const composer = { origin: { kind: 'composer' as const }, wait: false }
  await $.prompt.submit({ ...composer, text: 'one line only' })
  await $.prompt.submit({ ...composer, text: 'use the staging bucket\nand keep the ‮logs\n\nthen push', turnId: 't' })
  const band = await $.ui.mount({ plugin: 'pinboard', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const expandKeys = async () => [...JSON.stringify(await band.drawn()).matchAll(/"key":"(capx-[^"]+)"/g)].map(m => m[1] ?? '')

  // only the longer one has a [+]
  const keys = await expandKeys()
  expect(keys.length).toBe(1)
  expect(await band.find({ text: '[+]' })).toBeDefined()
  expect(await band.find({ text: '2. use the staging bucket …' })).toBeDefined()
  expect(await band.find({ text: 'and keep the  logs' })).toBeUndefined()

  await band.press({ key: keys[0] ?? '' })
  expect(await band.find({ text: '[-]' })).toBeDefined()
  expect(await band.find({ text: '2. use the staging bucket' })).toBeDefined()
  expect(await band.find({ text: 'and keep the  logs' })).toBeDefined()
  expect(await band.find({ text: 'then push' })).toBeDefined()
  expect(await band.find({ text: '1. one line only' })).toBeDefined()

  // /pin folds the board, unfolded lines included; unfolding the board shows them again
  await $.command.run({ command: 'pin', args: '' })
  expect(await band.find({ text: 'then push' })).toBeUndefined()
  await $.command.run({ command: 'pin', args: '' })
  expect(await band.find({ text: 'then push' })).toBeDefined()

  await band.press({ key: keys[0] ?? '' })
  expect(await band.find({ text: '[+]' })).toBeDefined()
  expect(await band.find({ text: 'then push' })).toBeUndefined()
  expect(await band.find({ text: '2. use the staging bucket …' })).toBeDefined()
})
