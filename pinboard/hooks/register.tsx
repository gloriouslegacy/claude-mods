// pinboard: notes pinned above the prompt, kept per folder across sessions.
//   📌 Pins 2 (done 1)  [Hide]
//   [✓] 1. ★ check the .env keys before deploying        [×]
//   [↺] 2. upload to the drive when the render is done   [×]   (struck through: done)
// /pin <note> pins one ("!" first marks it important); /pin done|undo|rm N, /pin clear, /pin list,
// /pin alone folds the board. A session starts folded unless `showBoard` is on, and a new pin does not
// unfold it: only [Show]/[Hide] and /pin do. The command runs at once even mid-turn. A new pin reaches Claude:
//   idle      → submitted as your prompt, so Claude starts on it right away;
//   mid-turn  → appended as a note from you, read at Claude's next step; if the turn ends before
//               another step reads it, it is submitted as a follow-up prompt then;
//   !! first  → mid-turn, the running turn is stopped and the pin is submitted at once as your prompt.
// With `capture` on, prompts you type (idle or mid-turn) are listed below the pins for this session:
//   »  1. use the staging bucket instead                 [×]   (dimmed; never saved, never re-sent)
//   »  2. then rerun the tests …                    [+]  [×]   ([+] unfolds its remaining lines below it)
// Each one leaves a dim "» #N" marker row in the transcript; clicking its board row scrolls there.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Captured, Pin } from '../types'
import { HELP, JUMP_GONE, KEEP_PINS, addCaptured, captureOf, delivery, followUp, header, interrupted, isCapture, jumpTo, listing, markerId, markerLabel, parse, prompted, removeCaptured, storeKey, toggleOpen, withRequestId } from './pins'
import { restoreOf } from './restore'
import type { Board } from './restore'

const pins = atom({ plugin: 'pinboard', key: 'pins' } as const, [] as Pin[])
const folder = atom({ plugin: 'pinboard', key: 'folder' } as const, '')
const folded = atom({ plugin: 'pinboard', key: 'folded' } as const, false)
const captured = atom({ plugin: 'pinboard', key: 'captured' } as const, [] as Captured[])

// Whether the main loop is in a turn, and pins appended mid-turn that no request has carried yet.
let running = false
let turnId = ''
// The urgent pin whose prompt waits for the stopped turn to end.
let urgentPrompt: string | null = null
const SUBMIT_DELAY_MS = 100
let unread: { n: number; text: string }[] = []
// The board as last seen (set at session.start and at a /clear's session.end): a /clear resets the atoms
// but not this, so restore() puts the folder, its pins and the fold back from it.
let kept: Board = { folder: '', folded: false }
const RESTORE_POLL_MS = 500
// The restore in flight: the tick and a pin change share it, so a late one never writes a stale list over a newer change.
let restoring: Promise<void> | undefined

/** Puts the board back once a /clear has reset the session atoms; does nothing while they hold it. */
function restore($: EngineInterface): Promise<void> {
  restoring ??= restoreNow($).finally(() => {
    restoring = undefined
  })
  return restoring
}

async function restoreNow($: EngineInterface): Promise<void> {
  const back = restoreOf(await read($, folder), kept)
  if (back === undefined) return
  const stored = await $.store.get(storeKey(back.folder))
  await update($, folder, () => back.folder)
  await update($, folded, () => back.folded)
  await update($, pins, () => (Array.isArray(stored) ? (stored as Pin[]) : []))
}

async function save($: EngineInterface, change: (list: Pin[]) => Pin[]): Promise<Pin[]> {
  try {
    await restore($) // a change right after a /clear goes to this folder's saved list, not a fresh one under `pins:`
  } catch (err) {
    // the change still applies to the board; it is saved below only once a folder is known
    $.ui.log(`restore failed error=${err instanceof Error ? err.message : String(err)}`)
  }
  const next = change(await read($, pins)).slice(-KEEP_PINS)
  await update($, pins, () => next)
  const at = await read($, folder)
  if (at !== '') await $.store.set(storeKey(at), next) // never under the empty `pins:` key
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

/** Places a captured prompt's marker row at the transcript's end: its requestId, or undefined when none came back. */
async function placeMarker($: EngineInterface, id: string): Promise<string | undefined> {
  const marker = markerId(id)
  try {
    const placed = await $.ui.place({ id: marker })
    // ui.log shows in the transcript, so only failures are logged; the host adds the plugin name
    if (!placed.isPlaced) $.ui.log(`place marker=${marker} not placed reason=${placed.reason}`)
    return placed.requestId
  } catch (err) {
    // the record stands without a marker; a click on it then says the turn is out of view
    $.ui.log(`place marker=${marker} failed error=${err instanceof Error ? err.message : String(err)}`)
    return undefined
  }
}

/** Lists a typed prompt (its board line, and its full lines when longer), then marks its place in the transcript. */
async function record($: EngineInterface, typed: Pick<Captured, 'text' | 'lines'>): Promise<void> {
  const at = await $.clock.now()
  const id = `${at}-${Math.random().toString(36).slice(2, 7)}`
  await update($, captured, list => addCaptured(list, { id, ...typed, at }))
  const requestId = await placeMarker($, id)
  if (requestId !== undefined) await update($, captured, list => withRequestId(list, id, requestId))
}

/** Scrolls the transcript to a captured prompt's marker, or says it is gone; the record stays either way. */
async function jump($: EngineInterface, c: Captured): Promise<void> {
  const deny = await jumpTo(c, requestId => $.ui.scroll({ to: { requestId }, block: 'start' }))
  if (deny === undefined) return
  $.ui.log(`jump marker=${markerId(c.id)} requestId=${c.requestId ?? '-'} deny=${deny}`)
  $.ui.toast(JUMP_GONE)
}

/** The pin numbered n on the board (1-based), or a reason. */
async function byNumber($: EngineInterface, n: number): Promise<Pin | string> {
  const list = await read($, pins)
  return list[n - 1] ?? `No pin #${n} (the board has ${list.length}).`
}

export const register: Register = (on, options) => {
  const deliver = options.deliver !== false
  const capture = options.capture !== false
  const startFolded = options.showBoard !== true
  // per run: resume and compact send session.start again and the chosen Show/Hide stays; a /clear sends
  // none and resets the atoms instead, which the restore tick puts back
  let hasStarted = false
  // The restore tick: the host keeps timers across session.start (and a /clear), so each start re-arms it.
  let ticker: ReturnType<EngineInterface['clock']['every']> | undefined

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const cwd = await $.session.cwd()
    const stored = await $.store.get(storeKey(cwd))
    await update($, folder, () => cwd)
    if (!hasStarted) await update($, folded, () => startFolded)
    hasStarted = true
    await update($, pins, () => (Array.isArray(stored) ? (stored as Pin[]) : []))
    kept = { folder: cwd, folded: await read($, folded) }
    await $.command.register({ name: 'pin', description: 'Pin a note above the prompt (! important, !! interrupt and read now); done/undo/rm N, clear, list', argumentHint: '[!|!!] <note> | done N | rm N', immediate: true })
    ticker?.cancel()
    ticker = $.clock.every(RESTORE_POLL_MS, () =>
      void restore($).catch(err => {
        // the board stays empty until the next pin change restores it; logged once, not every tick
        ticker?.cancel()
        $.ui.log(`restore failed error=${err instanceof Error ? err.message : String(err)}`)
      }),
    )
    return result
  })

  // A /clear: remember the board, since the atoms go back to their initial values right after this hook.
  on('session.end', async ($, e, next) => {
    // a second /clear before the tick restored the first finds the atoms empty: keep what was remembered
    if (e.reason === 'clear' && (await read($, folder)) !== '') kept = { folder: await read($, folder), folded: await read($, folded) }
    return next(e)
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

  // A prompt typed at the prompt is listed on the board once it has entered; the prompt itself passes unchanged.
  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    if (capture && result.drop === undefined && isCapture(e)) {
      try {
        const typed = captureOf(e.text)
        if (typed.text !== '') await record($, typed)
      } catch (err) {
        // a side effect only: the prompt has entered either way
        $.ui.log(`capture failed error=${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return result
  }).catch(($, e, next) => next(e)) // a hook that still fails or overruns lets the prompt through as it was

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

  // The marker row where a prompt was captured: its board number, dimmed; nothing once it left the board.
  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (!capture || e.props.plugin !== 'pinboard') return next(e)
    const i = (await read($, captured)).findIndex(c => markerId(c.id) === e.props.id)
    if (i < 0) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{markerLabel(i + 1)}</Text>
  })

  // Our board on top, whatever else the band holds (other mods' rows) below it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, pins)
    const typed = capture ? await read($, captured) : []
    if (e.props.hasSurvey || (list.length === 0 && typed.length === 0)) return next(e)
    const isFolded = await read($, folded)
    const { Box, Button, Text } = $.ui.resolve(e)
    const below = await next(e)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold color="yellow">{header(list, typed.length)}</Text>
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
        {isFolded
          ? null
          : typed.map((c, i) => {
              const open = c.open === true && c.lines !== undefined
              return (
                <Box key={`capbox-${c.id}`} flexDirection="column">
                  <Box key={`cap-${c.id}`} flexDirection="row" gap={1}>
                    <Text dimColor>{' » '}</Text>
                    <Box flexGrow={1}>
                      <Button key={`capgo-${c.id}`} plain dimColor onPress={() => jump($, c)}>
                        <Text wrap={open ? 'wrap' : 'truncate'} dimColor>{`${i + 1}. ${open ? (c.lines?.[0] ?? '').trimStart() : c.text}`}</Text>
                      </Button>
                    </Box>
                    {c.lines === undefined ? null : (
                      <Button key={`capx-${c.id}`} plain label={open ? '[-]' : '[+]'} onPress={() => update($, captured, l => toggleOpen(l, c.id))} />
                    )}
                    <Button key={`caprm-${c.id}`} plain label="[×]" onPress={() => update($, captured, l => removeCaptured(l, c.id))} />
                  </Box>
                  {open
                    ? (c.lines ?? []).slice(1).map((line, j) => (
                        <Box key={`capline-${c.id}-${j}`} flexDirection="row" gap={1}>
                          <Text dimColor>{'   '}</Text>
                          <Box flexGrow={1}>
                            <Text dimColor>{line === '' ? ' ' : line}</Text>
                          </Box>
                        </Box>
                      ))
                    : null}
                </Box>
              )
            })}
        {below}
      </Box>
    )
  })
}
