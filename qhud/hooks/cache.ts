// qhud: pure helpers for the prompt-cache countdown.

export type Ttl = '5m' | '1h'

export const ttlMs = (ttl: Ttl): number => (ttl === '5m' ? 5 : 60) * 60_000

/** Warn this long before expiry: 5 minutes on a 1h cache, 1 minute on a 5m cache. */
export const warnMs = (ttl: Ttl): number => (ttl === '5m' ? 60_000 : 5 * 60_000)

export const remainingMs = (lastAt: number, ttl: Ttl, now: number): number =>
  Math.max(0, lastAt + ttlMs(ttl) - now)

/** "🧊 cache 58m", "🧊 cache 45s" (under a minute), "🔥 cache expired", "🧊 cache idle" (no response yet). */
export const cachePart = (lastAt: number | null, ttl: Ttl, now: number): string => {
  if (lastAt === null) return '🧊 cache idle'
  const left = remainingMs(lastAt, ttl, now)
  if (left <= 0) return '🔥 cache expired'
  if (left < 60_000) return `🧊 cache ${Math.ceil(left / 1000)}s`
  return `🧊 cache ${Math.ceil(left / 60_000)}m`
}
