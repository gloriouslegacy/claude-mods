// qhud: what the lines show, gathered once per refresh, and their text.
//   Opus 5.5 · high · ⤷ Sonnet › Haiku   ⎇ main ↑2 ~3   CT 67%
//   0% (2d 11h)  |  98% (2h16m)  |  82% (2d 12h)
import type { LimitView, TcwView } from '../types'
import { delta, filledCells, fmt, forecast, limitText, sparkline } from './weather'

export type View = TcwView

export const SEP = '  |  '

export type Inputs = {
  model?: string
  effort?: string
  fallback?: string
  activeFallback?: string
  showWeather: boolean
  /** undefined before the first response: the meter then reads "-%". */
  tokens?: number
  window: number
  percent?: number
  turns: number[]
  git?: string
  cache: string
  limits: LimitView[]
  usd?: number
}

export const build = (i: Inputs): View => {
  const v: View = { cache: i.cache, isCacheCold: !i.cache.startsWith('🧊'), limits: i.limits }
  if (i.model) v.model = i.model
  if (i.effort) v.effort = i.effort
  if (i.fallback) v.fallback = i.fallback
  if (i.activeFallback) v.activeFallback = i.activeFallback
  if (i.git) v.git = i.git
  if (i.usd !== undefined) v.usd = `$${i.usd.toFixed(2)}`
  if (i.showWeather) {
    const pct = i.tokens === undefined ? null : (i.percent ?? (i.window > 0 ? Math.round((i.tokens / i.window) * 100) : 0))
    const f = forecast(pct ?? 0)
    const change = delta(i.turns)
    const chart = i.turns.length > 0 ? (change ? `${sparkline(i.turns)} ${change}` : sparkline(i.turns)) : undefined
    v.weather = {
      icon: f.icon,
      word: f.word,
      color: f.color,
      pct,
      filled: filledCells(pct),
      tokens: `${i.tokens === undefined ? '-' : fmt(i.tokens)}/${fmt(i.window)}`,
    }
    if (chart) v.weather.chart = chart
  }
  return v
}

/** "Opus 5.5 · high · ⤷ Sonnet › Haiku", the fallback marked "⤷ now Sonnet 4.5" while it answers. */
export const modelBlock = (v: View): string | undefined => {
  if (!v.model && !v.effort && !v.fallback && !v.activeFallback) return undefined
  const bits: string[] = []
  if (v.model) bits.push(v.model)
  if (v.effort) bits.push(v.effort)
  if (v.activeFallback) bits.push(`⤷ now ${v.activeFallback}`)
  else if (v.fallback) bits.push(`⤷ ${v.fallback}`)
  return bits.join(' · ')
}

/** "67%", or "-%" before the first response. */
export const pctText = (pct: number | null): string => (pct === null ? '-%' : `${pct}%`)

/** "CT 67%" */
export const ctxBlock = (v: View): string | undefined => (v.weather ? `CT ${pctText(v.weather.pct)}` : undefined)

/** "0% (2d 11h)  |  98% (2h16m)  |  82% (2d 12h)" */
export const usageBlock = (v: View): string | undefined => (v.limits.length > 0 ? v.limits.map(limitText).join(SEP) : undefined)

/** "Opus 5.5 · high   ⎇ main ↑2 ~3   CT 67%" */
export const topLine = (v: View): string => [modelBlock(v), v.git, ctxBlock(v)].filter(Boolean).join('   ')

/** The one-line layout: model  |  git  |  CT …  |  limits */
export const oneLine = (v: View): string => [modelBlock(v), v.git, ctxBlock(v), usageBlock(v)].filter(Boolean).join(SEP)

/** The band layout: model, git and CT / usage limits, model-specific first; empty lines left out. */
export const bandLines = (v: View): { text: string; kind: 'model' | 'usage' }[] => {
  const top = topLine(v)
  const lines: { text: string; kind: 'model' | 'usage' }[] = []
  if (top) lines.push({ text: top, kind: 'model' })
  const u = usageBlock(v)
  if (u) lines.push({ text: u, kind: 'usage' })
  return lines
}
