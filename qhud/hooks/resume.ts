// qhud: auto-resume — whether a window that blocks the main thread ran out, when to resume (and back it up), whose prompt
// cancels it, and what to say.
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

/** The main-blocking windows alerted to the main thread for their current reset (`sent`: kind → resetsAt alerted for,
 * AlertState.sent; empty when alerts are off). */
const alerted = (limits: readonly Limit[], modelId: unknown, sent: Readonly<Record<string, string>>): Limit[] =>
  limits.filter(l => blocks(l.kind, modelId) && l.resetsAt !== undefined && sent[l.kind] === l.resetsAt)

/** The windows that resume: the used-up ones when any is, else the alerted ones (an alerted window does not block the main
 * thread, so it never delays the resume of one that does). */
const due = (limits: readonly Limit[], modelId: unknown, sent: Readonly<Record<string, string>>): Limit[] => {
  const out = exhausted(limits, modelId)
  return out.length ? out : alerted(limits, modelId, sent)
}

/** When to resume (epoch ms): the latest reset of the due windows + 60 s; undefined when none is due or none has a reset. */
export const resumeAt = (limits: readonly Limit[], modelId: unknown, sent: Readonly<Record<string, string>> = {}): number | undefined => {
  const latest = latestReset(due(limits, modelId, sent))
  return latest === undefined ? undefined : latest + RESUME_DELAY_MS
}

/** How far ahead a resume may be armed: 8 days covers a weekly reset and stays far under the timer's 2^31 ms limit. */
export const MAX_AHEAD_MS = 8 * 24 * 60 * 60_000

/** Whether to arm a resume timer for `at`: after `now`, at most 8 days ahead, not the pending timer's time, and not a time
 * that fired or the user's prompt dropped. Any other time, earlier or later, re-arms. */
export const shouldArm = (at: number | undefined, now: number, pending: number | undefined, dropped: ReadonlySet<number>): at is number =>
  at !== undefined && at > now && at - now <= MAX_AHEAD_MS && at !== pending && !dropped.has(at)

/** Delay after the latest reset before the backup resume, 4 min after the first, for a first resume that started no turn. */
export const BACKUP_DELAY_MS = 300_000

/** When the backup of the resume at `at` fires: the same reset + 300 s. */
export const backupAt = (at: number): number => at - RESUME_DELAY_MS + BACKUP_DELAY_MS

/** Whether the backup submits again: no main turn started since the resume fired (count then → now) and none is running. */
export const shouldBackup = (turnsThen: number, turnsNow: number, busy: boolean): boolean => turnsNow === turnsThen && !busy

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
    : `Auto-resume is on: this session resumes automatically after the limit resets (${clockText(latest)}), even if you stop now; leave notes so the next turn can continue.`
}

/** The prompt origins a person types or sends (the terminal, Remote Control, the SDK host); no origin counts as a person. */
const PERSON = new Set(['composer', 'bridge', 'sdk'])

/** Whether a prompt from `origin` is a person's and so cancels the auto-resume; notifications, schedules, plugins and any
 * origin the engine adds later do not. Known limit: a person's input the engine cannot classify (unclassified, peer) does not cancel. */
export const byPerson = (origin: { kind: string } | undefined): boolean => origin === undefined || PERSON.has(origin.kind)

/** The user's toast when a person's prompt cancelled the pending resume (or backup) at `at`. */
export const cancelToast = (at: number): string => `Auto-resume at ${clockText(at)} cancelled (prompt sent)`

/** The line added to that prompt's main context. */
export const cancelNote = (at: number): string =>
  `[qhud] Auto-resume at ${clockText(at)} was cancelled because a prompt was sent; it will not resume automatically for this reset.`
