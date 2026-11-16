// qhud: auto-resume — whether a window that blocks the main thread ran out, when to resume, and what to say.
import { scopeName } from './plan'
import type { Limit } from './weather'

/** Delay after the latest reset before resuming, so the window has surely reopened. */
export const RESUME_DELAY_MS = 60_000

/** The fixed prompt submitted when the limit has reset. */
export const RESUME_PROMPT =
  '[qhud] Usage limit has reset. Resume the previous task from where it stopped; read docs/mem.md first if it exists.'

/** The main model's weekly window kind: "claude-opus-5-5" → "seven_day_opus"; undefined when the id names nothing. */
export const mainWeeklyKind = (modelId: unknown): string | undefined => {
  const name = scopeName(modelId)
  return name ? `seven_day_${name}` : undefined
}

/** The windows that stop the main thread when used up: five_hour, seven_day and the main model's weekly window (never spend_limit). */
export const blocks = (kind: string, modelId: unknown): boolean =>
  kind === 'five_hour' || kind === 'seven_day' || kind === mainWeeklyKind(modelId)

/** The main-blocking windows at 100% used or more. */
export const exhausted = (limits: readonly Limit[], modelId: unknown): Limit[] =>
  limits.filter(l => l.percentUsed >= 100 && blocks(l.kind, modelId))

const resetMs = (l: Limit): number => (l.resetsAt === undefined ? NaN : Date.parse(l.resetsAt))

const latestReset = (limits: readonly Limit[]): number | undefined => {
  const times = limits.map(resetMs).filter(t => !Number.isNaN(t))
  return times.length ? Math.max(...times) : undefined
}

/** When to resume (epoch ms): the latest reset of the exhausted windows + 60 s; undefined when none ran out or none has a reset. */
export const resumeAt = (limits: readonly Limit[], modelId: unknown): number | undefined => {
  const latest = latestReset(exhausted(limits, modelId))
  return latest === undefined ? undefined : latest + RESUME_DELAY_MS
}

/** How far ahead a resume may be armed: 8 days covers a weekly reset and stays far under the timer's 2^31 ms limit. */
export const MAX_AHEAD_MS = 8 * 24 * 60 * 60_000

/** Whether to arm a resume timer for `at`: after `now`, at most 8 days ahead, and later than `floor` — the latest of the
 * pending timer's time and one the user's prompt dropped (-Infinity when neither; a fired time is no longer after `now`). */
export const shouldArm = (at: number | undefined, now: number, floor: number): at is number =>
  at !== undefined && at > now && at - now <= MAX_AHEAD_MS && at > floor

const pad = (n: number): string => String(n).padStart(2, '0')

/** Local date and time, "2026-11-16 14:05". */
export const clockText = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The user's toast when a resume is scheduled. */
export const scheduleToast = (at: number): string => `Auto-resume scheduled at ${clockText(at)}`

/** The sentence added to the main thread's alert when auto-resume is on; the time is the latest reset of the alerted
 * windows that block the main thread (only those ever schedule a resume). Empty when no such window has a reset. */
export const resumeNote = (limits: readonly Limit[], modelId: unknown): string => {
  const latest = latestReset(limits.filter(l => blocks(l.kind, modelId)))
  return latest === undefined
    ? ''
    : `Auto-resume is on: if the limit runs out, this session resumes automatically after it resets (${clockText(latest)}); leave notes so the next turn can continue.`
}
