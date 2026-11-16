// qhud auto-resume tests: exhaustion, main model's weekly window, resume time, fixed texts, the alert's resume note,
// and with a fake host the one resume timer: scheduled once, submitted once, dropped on the user's prompt or when off,
// and its backup at reset + 300 s: only with no main turn since and the main thread idle
import { expect, mock, test } from 'claude-code/testing'

import { alertText } from '../hooks/alert'
import { backupAt, clockText, exhausted, mainWeeklyKind, MAX_AHEAD_MS, RESUME_PROMPT, resumeAt, resumeNote, scheduleToast, shouldArm, shouldBackup } from '../hooks/resume'

const MIN = 60_000
const at = (min: number) => new Date(min * MIN).toISOString()
const OPUS = 'claude-opus-5-5'

test('exhaustion: 100% used counts, 99.9% does not', () => {
  expect(exhausted([{ kind: 'five_hour', percentUsed: 99.9, resetsAt: at(60) }], OPUS)).toEqual([])
  expect(exhausted([{ kind: 'five_hour', percentUsed: 100, resetsAt: at(60) }], OPUS).map(l => l.kind)).toEqual(['five_hour'])
  expect(resumeAt([{ kind: 'seven_day', percentUsed: 99.9, resetsAt: at(60) }], OPUS)).toBeUndefined()
})

test('spend_limit at 100% never schedules a resume', () => {
  const lims = [{ kind: 'spend_limit', percentUsed: 100, resetsAt: at(60) }]
  expect(exhausted(lims, OPUS)).toEqual([])
  expect(resumeAt(lims, OPUS)).toBeUndefined()
})

test('several exhausted windows: the latest reset + 60 s', () => {
  const lims = [
    { kind: 'five_hour', percentUsed: 100, resetsAt: at(60) },
    { kind: 'seven_day', percentUsed: 100.5, resetsAt: at(3000) },
    { kind: 'seven_day_opus', percentUsed: 100, resetsAt: at(1500) },
    { kind: 'spend_limit', percentUsed: 100, resetsAt: at(9000) },
  ]
  expect(resumeAt(lims, OPUS)).toBe(3000 * MIN + 60_000)
})

test("only the main model's weekly window blocks; another model's is ignored", () => {
  expect(mainWeeklyKind(OPUS)).toBe('seven_day_opus')
  expect(mainWeeklyKind(undefined)).toBeUndefined()
  const lims = [{ kind: 'seven_day_fable', percentUsed: 100, resetsAt: at(600) }]
  expect(resumeAt(lims, OPUS)).toBeUndefined()
  expect(resumeAt(lims, 'claude-fable-5')).toBe(600 * MIN + 60_000)
})

test('fixed prompt and the scheduling toast', () => {
  expect(RESUME_PROMPT).toBe('[qhud] Usage limit has reset. Resume the previous task from where it stopped; read docs/mem.md first if it exists.')
  const t = new Date(2026, 10, 16, 14, 5).getTime()
  expect(clockText(t)).toBe('2026-11-16 14:05')
  expect(scheduleToast(t)).toBe('Auto-resume scheduled at 2026-11-16 14:05')
})

test('alert: resume note only with autoResume on; off is the v2.11.0 text', () => {
  const reset = new Date(2026, 10, 16, 14, 5)
  const lims = [{ kind: 'five_hour', percentUsed: 96, resetsAt: reset.toISOString() }]
  const now = reset.getTime() - 62 * MIN
  const base = '[qhud] Usage limit nearly reached: 5h 96% used, 4% left (resets in 1h2m). Finish the current step, save progress notes, and avoid starting large new work.'
  const note = 'Auto-resume is on: if the limit runs out, this session resumes automatically after it resets (2026-11-16 14:05); leave notes so the next turn can continue.'
  expect(alertText(lims, now)).toBe(base)
  expect(alertText(lims, now, false)).toBe(base)
  expect(alertText(lims, now, true)).toBe(`${base} ${note}`)
  expect(resumeNote(lims, OPUS)).toBe(note)
})

test('alert: no resume note for a spend-only alert (it never resumes)', () => {
  const lims = [{ kind: 'spend_limit', percentUsed: 97, resetsAt: at(60) }]
  expect(resumeNote(lims, OPUS)).toBe('')
  expect(alertText(lims, 0, true, OPUS)).toBe(alertText(lims, 0))
})

test("alert: another model's weekly window gets no resume note; the main model's does", () => {
  const lims = [{ kind: 'seven_day_fable', percentUsed: 98, resetsAt: at(60) }]
  expect(alertText(lims, 0, true, OPUS)).toBe(alertText(lims, 0))
  expect(alertText(lims, 0, true, 'claude-fable-5')).toContain('Auto-resume is on: ')
})

test('shouldArm: only a future time within 8 days, not the pending one, not a fired or dropped one', () => {
  const none = new Set<number>()
  expect(shouldArm(undefined, 0, undefined, none)).toBe(false)
  expect(shouldArm(0, 0, undefined, none)).toBe(false) // the reset already passed: never submit at once
  expect(shouldArm(-MIN, 0, undefined, none)).toBe(false)
  expect(shouldArm(MAX_AHEAD_MS, 0, undefined, none)).toBe(true)
  expect(shouldArm(MAX_AHEAD_MS + 1, 0, undefined, none)).toBe(false) // beyond 8 days: the timer would overflow
  expect(shouldArm(61 * MIN, 0, 61 * MIN, none)).toBe(false) // the pending time is not armed twice
  expect(shouldArm(62 * MIN, 0, 61 * MIN, none)).toBe(true) // a later time re-arms
  expect(shouldArm(60 * MIN, 0, 61 * MIN, none)).toBe(true) // an earlier time re-arms too (v2.12.1 F1)
  expect(shouldArm(61 * MIN, 0, undefined, new Set([61 * MIN, 3001 * MIN]))).toBe(false) // a fired or dropped time never again
  expect(shouldArm(121 * MIN, 0, undefined, new Set([3001 * MIN]))).toBe(true) // a time other than the dropped ones arms
  expect(shouldArm(61 * MIN, 0, undefined, none)).toBe(true) // no timer and nothing dropped (autoResume off → on): armed again
})

/** A gate a handler awaits while it is shut: `shut()` holds later calls, `open()` lets them all through. */
function gate() {
  let held: Promise<void> | undefined
  let open = () => {}
  return {
    wait: () => held,
    shut: () => {
      held = new Promise<void>(r => {
        open = () => {
          held = undefined
          r()
        }
      })
    },
    open: () => open(),
  }
}

/** A fake host whose `kind` window (five_hour) is `used`% used (100) and resets at `resetMin`; collects toasts and submitted
 * prompts. `usage` holds session.usage reads while shut (a refresh then has its `now` but not its windows). */
function exhaustedHost(on: Parameters<Parameters<typeof test>[2]>[1], resetMin = 60, nowMin = 0, used = 100, kind = 'five_hour') {
  const clock = mock.clock(on, { now: nowMin * MIN })
  const toasts: string[] = []
  const submitted: string[] = []
  const usage = gate()
  const windows = [{ kind, percentUsed: used, resetsAt: at(resetMin) }] // a test may replace what later reads see
  on('session.usage', async () => {
    await usage.wait()
    return { value: { startedAt: 0, rateLimits: [...windows], context: { tokens: 1, window: 200_000 } } }
  })
  on('session.model', () => ({ value: OPUS }))
  on('settings.read', () => ({ value: {} }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  return { clock, toasts, submitted, usage, windows }
}

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const
const QUIET = { options: { layout: 'line', git: false, model: false, plan: false, alert: false } }

test('a used-up window schedules one resume, toasts once and submits the fixed prompt once', QUIET, async ($, on) => {
  const { clock, toasts, submitted } = exhaustedHost(on)
  await $.session.start(START)
  await $.session.start(START) // refreshes again: the same time is not scheduled twice
  expect(toasts).toEqual([scheduleToast(61 * MIN)])
  await clock.advance(60 * MIN)
  expect(submitted).toEqual([])
  await clock.advance(MIN)
  expect(submitted).toEqual([RESUME_PROMPT])
  await clock.advance(5 * MIN) // ticks keep reading the old reset: not armed again, only its backup at +4 min (no turn ran)
  expect(submitted).toEqual([RESUME_PROMPT, RESUME_PROMPT])
  expect(toasts.length).toBe(1)
})

test("the user's own prompt drops the scheduled resume", QUIET, async ($, on) => {
  const { clock, toasts, submitted } = exhaustedHost(on)
  await $.session.start(START)
  expect(toasts.length).toBe(1)
  await $.prompt.submit({ text: 'carry on', origin: { kind: 'composer' }, wait: false })
  await clock.advance(62 * MIN)
  expect(submitted).toEqual(['carry on'])
})

test('concurrent refreshes schedule and toast once', QUIET, async ($, on) => {
  const { toasts } = exhaustedHost(on)
  await Promise.all([$.session.start(START), $.session.start(START)])
  expect(toasts).toEqual([scheduleToast(61 * MIN)])
})

test('a prompt with no origin drops it too, and the dropped time is not armed again', QUIET, async ($, on) => {
  const { clock, toasts, submitted } = exhaustedHost(on)
  await $.session.start(START)
  await $.prompt.submit({ text: 'no origin', wait: false } as Parameters<typeof $.prompt.submit>[0]) // origin left out on purpose
  await clock.advance(MIN) // ticks still read the same used-up window
  expect(toasts.length).toBe(1)
  await clock.advance(61 * MIN)
  expect(submitted).toEqual(['no origin'])
})

test('an SDK prompt drops the scheduled resume', QUIET, async ($, on) => {
  const { clock, submitted } = exhaustedHost(on)
  await $.session.start(START)
  await $.prompt.submit({ text: 'from sdk', origin: { kind: 'sdk' }, wait: false })
  await clock.advance(62 * MIN)
  expect(submitted).toEqual(['from sdk'])
})

test('a refresh that read the time before the resume fired does not arm it again after', QUIET, async ($, on) => {
  const { clock, toasts, submitted, usage } = exhaustedHost(on)
  await $.session.start(START)
  await clock.advance(60 * MIN + 30_000)
  usage.shut()
  const late = $.session.start(START) // its refresh reads now = 60.5 min, then waits on the windows
  await clock.advance(MIN) // the resume fires at 61 min meanwhile
  expect(submitted).toEqual([RESUME_PROMPT])
  usage.open()
  await late
  await clock.advance(5 * MIN) // not armed again, only its backup at +4 min (no turn ran)
  expect(submitted).toEqual([RESUME_PROMPT, RESUME_PROMPT])
  expect(toasts.length).toBe(1)
})

test('a prompt that drops the resume while it is being recorded gets no scheduling toast', QUIET, async ($, on) => {
  const { toasts, submitted } = exhaustedHost(on)
  const write = gate()
  const hits: (() => void)[] = []
  const writes = [new Promise<void>(r => hits.push(r)), new Promise<void>(r => hits.push(r))]
  on('state.set', { plugin: 'qhud', key: 'resume' }, async ($, e, next) => {
    hits.shift()?.()
    await write.wait()
    return next(e)
  })
  write.shut()
  const start = $.session.start(START) // arms the timer, then waits on recording the time
  await writes[0]
  const prompt = $.prompt.submit({ text: 'carry on', origin: { kind: 'composer' }, wait: false })
  await writes[1] // the prompt has dropped the timer and waits on clearing the time
  write.open()
  await Promise.all([start, prompt])
  expect(toasts).toEqual([])
  expect(submitted).toEqual(['carry on'])
})

test('a reset already passed but still read as 100%: nothing scheduled, nothing submitted', QUIET, async ($, on) => {
  const { clock, toasts, submitted } = exhaustedHost(on, 60, 120)
  await $.session.start(START)
  await clock.advance(MIN)
  expect(toasts).toEqual([])
  expect(submitted).toEqual([])
})

test('a reset 9 days ahead: nothing scheduled', QUIET, async ($, on) => {
  const { clock, toasts } = exhaustedHost(on, 9 * 24 * 60)
  await $.session.start(START)
  await clock.advance(MIN)
  expect(toasts).toEqual([])
})

const ALERTING = { options: { ...QUIET.options, alert: true } }

test('an alerted blocking window at 95% schedules a resume and submits once at reset + 60 s', ALERTING, async ($, on) => {
  const { clock, toasts, submitted } = exhaustedHost(on, 60, 0, 95)
  await $.session.start(START)
  expect(toasts).toContain(scheduleToast(61 * MIN))
  await clock.advance(60 * MIN)
  expect(submitted).toEqual([])
  await clock.advance(MIN)
  expect(submitted).toEqual([RESUME_PROMPT])
  await clock.advance(5 * MIN) // only its backup at +4 min (no turn ran)
  expect(submitted).toEqual([RESUME_PROMPT, RESUME_PROMPT])
})

test('95% with alert off: nothing scheduled, nothing submitted', QUIET, async ($, on) => {
  const { clock, toasts, submitted } = exhaustedHost(on, 60, 0, 95)
  await $.session.start(START)
  await clock.advance(62 * MIN)
  expect(toasts).toEqual([])
  expect(submitted).toEqual([])
})

test('an alert on spend_limit only: nothing scheduled, nothing submitted', ALERTING, async ($, on) => {
  const { clock, toasts, submitted } = exhaustedHost(on, 60, 0, 95, 'spend_limit')
  await $.session.start(START)
  await clock.advance(62 * MIN)
  expect(toasts.length).toBe(1) // the alert's own toast
  expect(toasts).not.toContain(scheduleToast(61 * MIN))
  expect(submitted).toEqual([])
})

test('resumeAt: an alerted blocking window counts for its current reset only; spend_limit never', () => {
  const lims = [
    { kind: 'five_hour', percentUsed: 95, resetsAt: at(60) },
    { kind: 'seven_day', percentUsed: 99, resetsAt: at(3000) },
    { kind: 'spend_limit', percentUsed: 97, resetsAt: at(9000) },
  ]
  expect(resumeAt(lims, OPUS)).toBeUndefined()
  expect(resumeAt(lims, OPUS, { five_hour: at(60) })).toBe(61 * MIN)
  expect(resumeAt(lims, OPUS, { five_hour: at(60), seven_day: at(3000) })).toBe(3001 * MIN)
  expect(resumeAt(lims, OPUS, { five_hour: at(0) })).toBeUndefined() // alerted for an earlier reset
  expect(resumeAt(lims, OPUS, { spend_limit: at(9000) })).toBeUndefined()
  const out = [{ kind: 'five_hour', percentUsed: 100, resetsAt: at(60) }, lims[1]]
  expect(resumeAt(out, OPUS, { five_hour: at(60), seven_day: at(3000) })).toBe(61 * MIN) // a used-up window wins over an alerted one
})

/** The weekly window alerted at 98.5% arms its reset W (3000 min); the user's prompt drops it; then 5h runs out with reset H
 * (120 min). Returns the host once the next tick has read the used-up 5h window. */
async function droppedWeeklyThenFiveHour($: Parameters<Parameters<typeof test>[2]>[0], on: Parameters<Parameters<typeof test>[2]>[1]) {
  const host = exhaustedHost(on, 3000, 0, 98.5, 'seven_day')
  await $.session.start(START)
  expect(host.toasts).toContain(scheduleToast(3001 * MIN))
  await $.prompt.submit({ text: 'carry on', origin: { kind: 'composer' }, wait: false })
  host.windows.push({ kind: 'five_hour', percentUsed: 100, resetsAt: at(120) })
  await host.clock.advance(MIN) // ticks read the used-up 5h window
  return host
}

test('a dropped weekly resume does not hold back a 5h window that runs out later: it resumes at H + 60 s once', ALERTING, async ($, on) => {
  const { clock, toasts, submitted } = await droppedWeeklyThenFiveHour($, on)
  expect(toasts).toContain(scheduleToast(121 * MIN))
  await clock.advance(119 * MIN) // now 120 min
  expect(submitted).toEqual(['carry on'])
  await clock.advance(MIN)
  expect(submitted).toEqual(['carry on', RESUME_PROMPT])
  await clock.advance(5 * MIN) // only its backup at +4 min (no turn ran)
  expect(submitted).toEqual(['carry on', RESUME_PROMPT, RESUME_PROMPT])
})

test('the dropped weekly time is not armed again when it is computed again', ALERTING, async ($, on) => {
  const { clock, toasts, submitted, windows } = await droppedWeeklyThenFiveHour($, on)
  await clock.advance(120 * MIN) // the 5h resume fires at 121 min
  windows.splice(1, 1, { kind: 'five_hour', percentUsed: 0, resetsAt: at(420) }) // 5h reopened: only the alerted W is left
  await clock.advance(5 * MIN)
  expect(toasts.filter(t => t === scheduleToast(3001 * MIN)).length).toBe(1)
  expect(submitted).toEqual(['carry on', RESUME_PROMPT, RESUME_PROMPT]) // the 5h resume and its backup at +4 min (no turn ran)
})

test('backup: at the same reset + 300 s, only when no main turn started since the resume and none runs', () => {
  expect(backupAt(61 * MIN)).toBe(65 * MIN)
  expect(shouldBackup(2, 2, false)).toBe(true)
  expect(shouldBackup(2, 3, false)).toBe(false) // a main turn started after the resume fired
  expect(shouldBackup(2, 2, true)).toBe(false) // the main thread is busy
})

test('no main turn after the resume and the main thread idle: the backup submits once more at reset + 300 s', QUIET, async ($, on) => {
  const { clock, submitted } = exhaustedHost(on)
  await $.session.start(START)
  await clock.advance(61 * MIN)
  expect(submitted).toEqual([RESUME_PROMPT])
  await clock.advance(3 * MIN)
  expect(submitted).toEqual([RESUME_PROMPT])
  await clock.advance(MIN)
  expect(submitted).toEqual([RESUME_PROMPT, RESUME_PROMPT])
  await clock.advance(10 * MIN) // one backup per resume time
  expect(submitted).toEqual([RESUME_PROMPT, RESUME_PROMPT])
})

test('a main turn started after the resume: no backup', QUIET, async ($, on) => {
  const { clock, submitted } = exhaustedHost(on)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start(START)
  await clock.advance(61 * MIN)
  await $.turn.start({ text: RESUME_PROMPT, turnId: 't' })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' as const }) // idle again
  await clock.advance(10 * MIN)
  expect(submitted).toEqual([RESUME_PROMPT])
})

test("the user's prompt before the resume drops the backup too", QUIET, async ($, on) => {
  const { clock, submitted } = exhaustedHost(on)
  await $.session.start(START)
  await $.prompt.submit({ text: 'carry on', origin: { kind: 'composer' }, wait: false })
  await clock.advance(70 * MIN)
  expect(submitted).toEqual(['carry on'])
})

test('autoResume off: nothing scheduled, nothing submitted', { options: { ...QUIET.options, autoResume: false } }, async ($, on) => {
  const { clock, toasts, submitted } = exhaustedHost(on)
  await $.session.start(START)
  await clock.advance(62 * MIN)
  expect(toasts).toEqual([])
  expect(submitted).toEqual([])
})
