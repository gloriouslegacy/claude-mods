// pinboard: pure helpers — parsing /pin, changing the list, the words Claude reads.
import type { Pin } from '../types'

export const KEEP_PINS = 50

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
  '/pin <note> pins a note (! first: important; !! first: interrupt Claude and read it now) · /pin done N · /pin undo N · /pin rm N · /pin clear (removes done ones) · /pin (fold or unfold)'

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

/** "📌 Pins 2 (done 1)" */
export const header = (pins: readonly Pin[]): string => {
  const c = counts(pins)
  return `📌 Pins ${c.open}${c.done > 0 ? ` (done ${c.done})` : ''}`
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
