// qhud: per-model weekly windows ("Fable") the API response headers do not carry.
// They come from the account's usage endpoint, the one /usage reads, polled at most every 5 minutes.
// Two shapes are read: the `limits` list's weekly windows scoped to a model
// ({ kind: 'weekly_scoped', group: 'weekly', percent, resets_at, scope }), and the older
// top-level keys "seven_day_<model family>" with a numeric utilization.
import type { Limit } from './weather'

export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
export const USAGE_HEADERS = { 'anthropic-beta': 'oauth-2025-04-20' }
export const PLAN_EVERY_MS = 5 * 60_000

const FAMILIES = ['fable', 'mythos', 'opus', 'sonnet', 'haiku']

type Window = { utilization?: unknown; resets_at?: unknown }

/** A scope as the endpoint names it (a string, or an object holding one) → "fable", "opus", or its own words. */
export const scopeName = (scope: unknown): string | undefined => {
  const words: string[] = []
  const collect = (v: unknown, depth: number): void => {
    if (typeof v === 'string') words.push(v)
    else if (v && typeof v === 'object' && depth < 3) for (const x of Object.values(v)) collect(x, depth + 1)
  }
  collect(scope, 0)
  for (const w of words) {
    const family = FAMILIES.find(f => w.toLowerCase().includes(f))
    if (family) return family
  }
  const first = words.find(w => w.trim() !== '')
  return first ? first.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : undefined
}

/** The `limits` list's model-scoped weekly windows. */
const scopedLimits = (list: unknown): Limit[] => {
  if (!Array.isArray(list)) return []
  const out: Limit[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const l = item as { kind?: unknown; group?: unknown; percent?: unknown; resets_at?: unknown; scope?: unknown }
    const isWeekly = l.group === 'weekly' || (typeof l.kind === 'string' && l.kind.startsWith('weekly'))
    if (!isWeekly || l.kind === 'weekly_all' || typeof l.percent !== 'number') continue
    const name = scopeName(l.scope)
    if (!name) continue
    const limit: Limit = { kind: `seven_day_${name}`, percentUsed: Math.round(l.percent * 10) / 10 }
    if (typeof l.resets_at === 'string') limit.resetsAt = l.resets_at
    out.push(limit)
  }
  return out
}

/** The endpoint's JSON → one Limit per model-specific weekly window, e.g. { kind: 'seven_day_fable', percentUsed: 100 }. */
export const planLimits = (body: unknown): Limit[] => {
  if (!body || typeof body !== 'object') return []
  const out: Limit[] = scopedLimits((body as { limits?: unknown }).limits)
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const m = /^seven_day_(.+)$/.exec(key)
    if (!m || !value || typeof value !== 'object') continue
    const family = FAMILIES.find(f => m[1].toLowerCase().includes(f))
    const w = value as Window
    if (!family || typeof w.utilization !== 'number') continue
    const limit: Limit = { kind: `seven_day_${family}`, percentUsed: Math.round(w.utilization * 10) / 10 }
    if (typeof w.resets_at === 'string') limit.resetsAt = w.resets_at
    if (!out.some(o => o.kind === limit.kind)) out.push(limit)
  }
  return out
}

