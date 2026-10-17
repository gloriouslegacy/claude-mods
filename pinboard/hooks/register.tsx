// pinboard: notes pinned above the prompt, kept per folder across sessions.
//   📌 Pins 2 (done 1)  [Hide]
//   [✓] 1. ★ check the .env keys before deploying        [×]
//   [↺] 2. upload to the drive when the render is done   [×]   (struck through: done)
// /pin <note> pins one ("!" first marks it important); /pin done|undo|rm N, /pin clear, /pin list,
// /pin alone folds the board. The command runs at once even mid-turn. A new pin reaches Claude:
//   idle      → submitted as your prompt, so Claude starts on it right away;
//   mid-turn  → appended as a note from you, read at Claude's next step; if the turn ends before
//               another step reads it, it is submitted as a follow-up prompt then;
//   !! first  → mid-turn, the running turn is stopped and the pin is submitted at once as your prompt.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pin } from '../types'
import { HELP, KEEP_PINS, delivery, followUp, header, interrupted, listing, parse, prompted, storeKey } from './pins'

const pins = atom({ plugin: 'pinboard', key: 'pins' } as const, [] as Pin[])
const folder = atom({ plugin: 'pinboard', key: 'folder' } as const, '')
const folded = atom({ plugin: 'pinboard', key: 'folded' } as const, false)

// Whether the main loop is in a turn, and pins appended mid-turn that no request has carried yet.
let running = false
let turnId = ''
// The urgent pin whose prompt waits for the stopped turn to end.
let urgentPrompt: string | null = null
const SUBMIT_DELAY_MS = 100
let unread: { n: number; text: string }[] = []

async function save($: EngineInterface, change: (list: Pin[]) => Pin[]): Promise<Pin[]> {
  const next = change(await read($, pins)).slice(-KEEP_PINS)
  await update($, pins, () => next)
  await $.store.set(storeKey(await read($, folder)), next)
  return next
}

async function setDone($: EngineInterface, id: string, done: boolean): Promise<void> {
  await save($, list => list.map(p => (p.id === id ? { ...p, done } : p)))
}

async function remove($: EngineInterface, id: string): Promise<void> {
  await save($, list => list.filter(p => p.id !== id))
}

async function add($: EngineInterface, text: string, important: boolean, urgent: boolean, deliver: boolean): Promise<string> {
  const at = await $.clock.now()
  const pin: Pin = { id: `${at}-${Math.random().toString(36).slice(2, 7)}`, text, important, done: false, at }
  const list = await save($, l => [...l, pin])
  await update($, folded, () => false)
  const n = list.findIndex(p => p.id === pin.id) + 1
  if (!deliver) return `📌 Pinned #${n}: ${text}`
  try {
    if (!running) {
      // idle: a note alone would wait for your next message, so it goes in as the prompt itself,
      // a moment after this command (a command's own hook may not submit: it holds the turn)
      const asPrompt = prompted(pin, n)
      $.clock.after(SUBMIT_DELAY_MS, () => void $.prompt.submit({ text: asPrompt, asUser: true }))
      return `📌 Pinned #${n} and sent to Claude as a prompt: ${text}`
    }
    if (urgent) {
      // stop the turn; its turn.complete submits the pin (with any unread ones) as the next prompt
      urgentPrompt = interrupted(pin, n)
      try {
        await $.turn.abort({ turnId })
        return `📌 Pinned #${n}, stopped Claude's turn and sent it now: ${text}`
      } catch {
        urgentPrompt = null // the turn could not be stopped: fall back to the next step
      }
    }
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: delivery(pin, n) }] } })
    unread.push({ n, text })
    return `📌 Pinned #${n} and sent to Claude (read at its next step): ${text}`
  } catch (err) {
    return `📌 Pinned #${n}: ${text} (could not send it to Claude: ${err instanceof Error ? err.message : String(err)})`
  }
}

/** The pin numbered n on the board (1-based), or a reason. */
async function byNumber($: EngineInterface, n: number): Promise<Pin | string> {
  const list = await read($, pins)
  return list[n - 1] ?? `No pin #${n} (the board has ${list.length}).`
}

export const register: Register = (on, options) => {
  const deliver = options.deliver !== false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const cwd = await $.session.cwd()
    const stored = await $.store.get(storeKey(cwd))
    await update($, folder, () => cwd)
    await update($, pins, () => (Array.isArray(stored) ? (stored as Pin[]) : []))
    await $.command.register({ name: 'pin', description: 'Pin a note above the prompt (! important, !! interrupt and read now); done/undo/rm N, clear, list', argumentHint: '[!|!!] <note> | done N | rm N', immediate: true })
    return result
  })

  on('turn.start', async ($, e, next) => {
    running = true
    turnId = e.turnId
    return next(e)
  })

  // A main-loop request about to be sent carries every note appended before it.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) unread = []
    return yield* next(e)
  })

  // The turn ended before any request carried a pin: send it as a follow-up prompt.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    running = false
    const parts: string[] = []
    if (urgentPrompt) parts.push(urgentPrompt)
    if (deliver && unread.length > 0) parts.push(followUp(unread))
    urgentPrompt = null
    unread = []
    if (parts.length > 0) void $.prompt.submit({ text: parts.join('\n\n'), asUser: true })
    return result
  })

  on('command.run', { command: 'pin' }, async ($, e) => {
    const a = parse(e.args)
    if (a.kind === 'add') return { text: await add($, a.text, a.important, a.urgent, deliver) }
    if (a.kind === 'help') return { text: HELP }
    if (a.kind === 'list') return { text: listing(await read($, pins)) }
    if (a.kind === 'fold') {
      const isFolded = !(await read($, folded))
      await update($, folded, () => isFolded)
      return { text: isFolded ? 'Pinboard folded.' : 'Pinboard shown.' }
    }
    if (a.kind === 'clear') {
      const before = (await read($, pins)).length
      const after = (await save($, list => list.filter(p => !p.done))).length
      return { text: `Removed ${before - after} done pin${before - after === 1 ? '' : 's'}.` }
    }
    const pin = await byNumber($, a.n)
    if (typeof pin === 'string') return { text: pin }
    if (a.kind === 'rm') {
      await remove($, pin.id)
      return { text: `Removed #${a.n}: ${pin.text}` }
    }
    await setDone($, pin.id, a.kind === 'done')
    return { text: a.kind === 'done' ? `Marked #${a.n} done.` : `Reopened #${a.n}.` }
  })

  // Our board on top, whatever else the band holds (other mods' rows) below it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, pins)
    if (e.props.hasSurvey || list.length === 0) return next(e)
    const isFolded = await read($, folded)
    const { Box, Button, Text } = $.ui.resolve(e)
    const below = await next(e)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold color="yellow">{header(list)}</Text>
          <Button key="fold" plain label={isFolded ? '[Show]' : '[Hide]'} onPress={() => update($, folded, f => !f)} />
        </Box>
        {isFolded
          ? null
          : list.map((p, i) => (
              <Box key={`row-${p.id}`} flexDirection="row" gap={1}>
                <Button key={`done-${p.id}`} plain label={p.done ? '[↺]' : '[✓]'} onPress={() => setDone($, p.id, !p.done)} />
                <Box flexGrow={1}>
                  <Text wrap="truncate" strikethrough={p.done} dimColor={p.done} color={p.important && !p.done ? 'red' : undefined}>
                    {`${i + 1}. ${p.important ? '★ ' : ''}${p.text}`}
                  </Text>
                </Box>
                <Button key={`rm-${p.id}`} plain label="[×]" onPress={() => remove($, p.id)} />
              </Box>
            ))}
        {below}
      </Box>
    )
  })
}
