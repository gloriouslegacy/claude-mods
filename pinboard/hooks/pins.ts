// pinboard: pure helpers — parsing /pin, changing the list, the words Claude reads.
import type { Captured, Pin } from '../types'

export const KEEP_PINS = 50
export const KEEP_CAPTURED = 20

export type Action =
  | { kind: 'add'; text: string; important: boolean; urgent: boolean }
  | { kind: 'done' | 'undo' | 'rm'; n: number }
  | { kind: 'clear' | 'list' | 'fold' | 'help' }

const NUMBERED = /^(done|undo|rm)\s+(\d+)$/i

/** "/pin ! check .env" → add (important); "/pin !! stop" → add (urgent: interrupts); "/pin done 2"; "/pin rm 1"; "/pin clear"; "/pin" → fold. */
export const parse = (args: string): Action => {
  const t = args.trim()
  if (t === '') return { kind: 'fold' }
  const m = NUMBERED.exec(t)
  if (m) return { kind: m[1].toLowerCase() as 'done' | 'undo' | 'rm', n: Number(m[2]) }
  const word = t.toLowerCase()
  if (word === 'clear' || word === 'list' || word === 'help') return { kind: word }
  const urgent = t.startsWith('!!')
  const important = t.startsWith('!')
  const text = t.slice(urgent ? 2 : important ? 1 : 0).trim()
  return text === '' ? { kind: 'help' } : { kind: 'add', text, important, urgent }
}

export const HELP =
  '/pin <note> pins a note (! first: important; !! first: interrupt Claude and read it now) · /pin done N · /pin undo N · /pin rm N · /pin clear (removes done ones) · /pin (fold or unfold) · what you type while Claude is working is listed dimmed with » for this session (click one to jump to that turn; × removes one; turn off with the capture setting)'

export const storeKey = (folder: string): string => `pins:${folder}`

/** What Claude reads when a pin is added: a note from the user, to weigh in the work under way. */
export const delivery = (pin: Pin, n: number): string =>
  [
    `[pinboard] The user just pinned note #${n}${pin.important ? ' (marked important)' : ''}: ${pin.text}`,
    'It comes from the user directly. If it bears on what you are doing now, take it into account from this step on; otherwise keep it in mind.',
  ].join('\n')

export const counts = (pins: readonly Pin[]): { open: number; done: number } => {
  const done = pins.filter(p => p.done).length
  return { open: pins.length - done, done }
}

/** "📌 Pins 2 (done 1)", with " · » 3" when prompts typed mid-turn are listed too. */
export const header = (pins: readonly Pin[], captured = 0): string => {
  const c = counts(pins)
  return `📌 Pins ${c.open}${c.done > 0 ? ` (done ${c.done})` : ''}${captured > 0 ? ` · » ${captured}` : ''}`
}

/** The fields of a prompt.submit input that decide a capture (structural, so this module stays host-free). */
export type Submitted = {
  text: string
  origin: { kind: string }
  command?: unknown
  isMeta?: true
  turnId?: string
}

/** Typed by the user at the prompt (Enter) while a turn was running, not a slash command or hidden prompt. */
export const isCapture = (e: Submitted): boolean =>
  e.origin.kind === 'composer' && e.command === undefined && e.isMeta === undefined && e.turnId !== undefined && e.text.trim() !== ''

/** The list with one more captured prompt, keeping the newest KEEP_CAPTURED. */
export const addCaptured = (list: readonly Captured[], item: Captured): Captured[] => [...list, item].slice(-KEEP_CAPTURED)

export const removeCaptured = (list: readonly Captured[], id: string): Captured[] => list.filter(c => c.id !== id)

/** The list with the captured prompt `id` pointing at its transcript marker. */
export const withRequestId = (list: readonly Captured[], id: string, requestId: string): Captured[] =>
  list.map(c => (c.id === id ? { ...c, requestId } : c))

/** The transcript marker's id for a captured prompt (`$.ui.place` takes 1-64 of letters, digits, `_`, `-`). */
export const markerId = (id: string): string => `cap-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 64)

/** The marker row drawn in the transcript where a prompt was captured: its board number only. */
export const markerLabel = (n: number): string => `» #${n}`

/**
 * A click on a captured row: scrolls to its marker through `scroll` (the host's `$.ui.scroll`), and answers
 * why it could not ('no marker' without one, 'failed: …' when the scroll rejected, else the host's deny),
 * or undefined once it moved.
 */
export const jumpTo = async (c: Captured, scroll: (requestId: string) => Promise<{ deny?: string }>): Promise<string | undefined> => {
  if (c.requestId === undefined) return 'no marker'
  try {
    return (await scroll(c.requestId)).deny
  } catch (err) {
    return `failed: ${err instanceof Error ? err.message : String(err)}`
  }
}

/** Shown when a captured prompt's turn cannot be scrolled to. */
export const JUMP_GONE = 'That turn is no longer in view (before the last compaction)'

/** The longest board line kept for a captured prompt, in characters. */
export const CAPTURE_CHARS = 200

// Control characters (incl. a lone \r and ESC), the Unicode line/paragraph separators and format characters (bidi overrides, zero-width).
const CONTROL = /[\u0000-\u001f\u007f-\u009f\p{Zl}\p{Zp}\p{Cf}]/gu

/**
 * A captured prompt as the one line that is kept: its first non-empty line with control characters
 * turned into spaces, at most CAPTURE_CHARS long, ending in " …" when more was cut.
 */
export const firstLine = (text: string): string => {
  const lines = text.split('\n').map(l => l.replace(CONTROL, ' ').trim()).filter(l => l !== '')
  const chars = [...(lines[0] ?? '')]
  if (lines.length <= 1 && chars.length <= CAPTURE_CHARS) return chars.join('')
  return `${chars.slice(0, CAPTURE_CHARS - 2).join('').trimEnd()} …`
}

/** The list as plain lines, for /pin list. */
export const listing = (pins: readonly Pin[]): string =>
  pins.length === 0
    ? 'No pins in this folder.'
    : pins.map((p, i) => `${i + 1}. [${p.done ? 'x' : ' '}] ${p.important ? '★ ' : ''}${p.text}`).join('\n')

/** A pin made while Claude is idle, submitted as your prompt: "📌 Pin #1 (important): ..." */
export const prompted = (pin: Pin, n: number): string => `📌 Pin #${n}${pin.important ? ' (important)' : ''}: ${pin.text}`

/** Pins appended mid-turn that the turn ended without reading, as one follow-up prompt. */
export const followUp = (left: readonly { n: number; text: string }[]): string =>
  ['📌 Pinned while you were working:', ...left.map(l => `#${l.n}: ${l.text}`)].join('\n')

/** An urgent pin, sent after the running turn was stopped for it. */
export const interrupted = (pin: Pin, n: number): string =>
  `📌 Pin #${n} (urgent — I stopped your turn for this): ${pin.text}\nApply it before you go on with what you were doing.`
