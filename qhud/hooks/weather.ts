// qhud: pure helpers — forecast tier, number format, sparkline, delta, usage limits.
import type { LimitView } from '../types'

export type Forecast = { icon: string; word: string; color: string }

export const BARS = 12
const TICKS = '▁▂▃▄▅▆▇█'

export const forecast = (percent: number): Forecast => {
  if (percent < 25) return { icon: '☀', word: 'Clear', color: 'yellow' }
  if (percent < 50) return { icon: '☁', word: 'Cloudy', color: 'cyan' }
  if (percent < 75) return { icon: '☂', word: 'Showers', color: 'blue' }
  if (percent < 90) return { icon: '☇', word: 'Storm', color: 'magenta' }
  return { icon: '↯', word: 'Compact soon', color: 'red' }
}

/** 134400 → "134.4k", 200000 → "200k", 1000000 → "1M", 950 → "950". */
export const fmt = (n: number): string => {
  const a = Math.abs(n)
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  if (a >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (a >= 1_000) return `${trim(n / 1_000)}k`
  return `${Math.round(n)}`
}

/** Relative scale: the fullest turn shown is █, the rest in proportion to it. */
export const sparkline = (values: number[]): string => {
  const shown = values.slice(-BARS)
  const max = Math.max(0, ...shown)
  return shown
    .map(v => {
      const f = max > 0 ? Math.max(0, v) / max : 0
      return TICKS[Math.min(TICKS.length - 1, Math.floor(f * (TICKS.length - 1) + 0.5))] ?? ''
    })
    .join('')
}

export const delta = (values: number[]): string | null => {
  if (values.length < 2) return null
  const d = (values[values.length - 1] ?? 0) - (values[values.length - 2] ?? 0)
  if (d === 0) return '■ ±0'
  return d > 0 ? `▲ +${fmt(d)}` : `▼ −${fmt(-d)}`
}

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

/** 3_420_000 ms → "57m", 8_160_000 → "2h16m", 216_000_000 → "2d 12h". */
export const span = (ms: number): string => {
  const m = Math.max(0, Math.ceil(ms / 60_000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const min = m % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return min > 0 ? `${h}h${min}m` : `${h}h`
  return `${min}m`
}

// The 5-hour and weekly windows go unnamed (their reset times tell them apart); a model's weekly window is its name.
const LIMIT_NAMES: Record<string, string> = { five_hour: '', seven_day: '', spend_limit: 'spend' }

/** 5h, weekly and a model's weekly window ("seven_day_fable") go unnamed; other unknown kinds keep their words. */
const limitName = (kind: string): string => {
  if (kind in LIMIT_NAMES) return LIMIT_NAMES[kind]
  const m = /^seven_day_(\w+)$/.exec(kind)
  if (m) return '' // a model's weekly window goes unnamed too: it always leads the line
  return kind.replace(/_/g, ' ')
}

/** Each window: its name, the share left, and when it resets. */
export const limitViews = (limits: readonly Limit[], now: number): LimitView[] =>
  limits.map(l => {
    const name = limitName(l.kind)
    const left = Math.max(0, Math.round(100 - l.percentUsed))
    const at = l.resetsAt === undefined ? NaN : Date.parse(l.resetsAt)
    return Number.isNaN(at) ? { name, left } : { name, left, reset: span(at - now) }
  })

/** Share left and time to reset: "98% (2h16m)" */
export const limitText = (l: LimitView): string => `${l.name ? `${l.name} ` : ''}${l.left}%${l.reset ? ` (${l.reset})` : ''}`

/** Green while plenty is left, yellow under half, red under a fifth. */
export const leftColor = (left: number): string => (left < 20 ? 'red' : left < 50 ? 'yellow' : 'green')

/** The 10-cell meter: "[███-------]". */
export const METER = 10
export const meter = (filled: number): string => `[${'█'.repeat(filled)}${'-'.repeat(METER - filled)}]`
export const filledCells = (pct: number | null): number => (pct === null ? 0 : Math.min(METER, Math.max(0, Math.round(pct / 10))))
