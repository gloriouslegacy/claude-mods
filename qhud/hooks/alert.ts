// qhud: usage-limit alert — which windows are nearly used up (once per window and reset) and what to say.
import type { AlertState } from '../types'
import { resumeNote } from './resume'
import { span } from './weather'
import type { Limit } from './weather'

export const DEFAULT_LEFT = 5
export const DEFAULT_LEFT_WEEKLY = 2

const share = (v: unknown, fallback: number): number => (typeof v === 'number' && v >= 1 && v <= 50 ? v : fallback)

/** The `alertLeft` option: the share left (%) at or under which the 5h and spend windows alert; outside 1–50 it is 5. */
export const alertLeft = (v: unknown): number => share(v, DEFAULT_LEFT)

/** The `alertLeftWeekly` option: the same for the weekly and per-model weekly windows; outside 1–50 it is 2. */
export const alertLeftWeekly = (v: unknown): number => share(v, DEFAULT_LEFT_WEEKLY)

/** seven_day and the per-model weekly windows (seven_day_<family>). */
const isWeekly = (kind: string): boolean => kind === 'seven_day' || kind.startsWith('seven_day_')

const NAMES: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

/** Longest window name and most windows one alert line carries (kinds come from the endpoint's `scope`). */
export const NAME_MAX = 24
export const WINDOWS_MAX = 4

const nameOf = (kind: string): string => {
  if (kind in NAMES) return NAMES[kind]
  const m = /^seven_day_(\w+)$/.exec(kind)
  if (m) return `7d ${m[1].charAt(0).toUpperCase()}${m[1].slice(1).replace(/_/g, ' ')}`
  return kind.replace(/_/g, ' ')
}

/** five_hour → "5h", seven_day → "7d", seven_day_fable → "7d Fable", other kinds keep their words; at most 24 characters. */
export const windowName = (kind: string): string => nameOf(kind).slice(0, NAME_MAX)

/** Share left with one decimal at most: 95.1 used → 4.9. */
const leftOf = (l: Limit): number => Math.round((100 - l.percentUsed) * 10) / 10

/** The windows at or under their threshold (`weekly` for weekly windows, `left` for the rest) not alerted for their current reset yet. */
export const crossed = (limits: readonly Limit[], state: AlertState, left: number, weekly: number): Limit[] =>
  limits.filter(l => leftOf(l) <= (isWeekly(l.kind) ? weekly : left) && state.sent[l.kind] !== (l.resetsAt ?? ''))

/** Remembers the windows as alerted for their reset and queues them for the model (one entry per window). */
export const remember = (state: AlertState, hit: readonly Limit[]): AlertState => ({
  sent: { ...state.sent, ...Object.fromEntries(hit.map(l => [l.kind, l.resetsAt ?? ''])) },
  pending: [...state.pending.filter(p => !hit.some(h => h.kind === p.kind)), ...hit],
})

/** "5h 96% used, 4% left (resets in 1h2m)"; up to four windows joined with "; ", the rest dropped. */
const windowsText = (limits: readonly Limit[], now: number): string =>
  limits
    .slice(0, WINDOWS_MAX)
    .map(l => {
      const at = l.resetsAt === undefined ? NaN : Date.parse(l.resetsAt)
      const reset = Number.isNaN(at) ? '' : ` (resets in ${span(at - now)})`
      return `${windowName(l.kind)} ${l.percentUsed}% used, ${leftOf(l)}% left${reset}`
    })
    .join('; ')

/** The one line the main thread's model reads; with `autoResume` on, the resume note follows it when a window that
 * blocks the main thread (five_hour, seven_day, the main model `modelId`'s weekly window) is among the alerted ones. */
export const alertText = (limits: readonly Limit[], now: number, autoResume = false, modelId: unknown = undefined): string => {
  const text = `[qhud] Usage limit nearly reached: ${windowsText(limits, now)}. Finish the current step, save progress notes, and avoid starting large new work.`
  const note = autoResume ? resumeNote(limits, modelId) : ''
  return note ? `${text} ${note}` : text
}

/** The same, short, for the user's toast. */
export const toastText = (limits: readonly Limit[], now: number): string => `Usage limit nearly reached: ${windowsText(limits, now)}`
