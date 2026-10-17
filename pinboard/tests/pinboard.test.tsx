import { expect, mock, test } from 'claude-code/testing'

import { delivery, header, listing, parse } from '../hooks/pins'

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
