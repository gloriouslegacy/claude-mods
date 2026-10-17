// agent-flow: the run log kept across sessions, and /agent-flow stats — which agents, on which models,
// spend the tokens. One entry per finished subagent run; the newest KEEP_LOG are kept.
import type { LogEntry } from '../types'
import { elapsed, fmt, short } from './flow'

export const LOG_KEY = 'log'
export const KEEP_LOG = 3000
const DAY_MS = 86_400_000

/** "/agent-flow stats 30" → 30; nothing or nonsense → 7 */
export const statsDays = (args: string): number => {
  const n = Number(args.trim().split(/\s+/)[1])
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 365) : 7
}

type Group = { type: string; model: string; runs: number; tokens: number; ms: number; calls: number; edits: number; aborted: number }

/** The log of the last `days`, grouped by agent type and model, the costliest first. */
export const groups = (log: readonly LogEntry[], now: number, days: number): Group[] => {
  const since = now - days * DAY_MS
  const by = new Map<string, Group>()
  for (const e of log) {
    if (e.at < since) continue
    const model = short(e.model)
    const key = `${e.type}\u0000${model}`
    const g = by.get(key) ?? { type: e.type, model, runs: 0, tokens: 0, ms: 0, calls: 0, edits: 0, aborted: 0 }
    g.runs += 1
    g.tokens += e.tokens
    g.ms += e.ms
    g.calls += e.calls
    g.edits += e.edits
    if (e.isAborted) g.aborted += 1
    by.set(key, g)
  }
  return [...by.values()].sort((a, b) => b.tokens - a.tokens)
}

const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length))
const lpad = (s: string, n: number): string => (s.length >= n ? s : ' '.repeat(n - s.length) + s)

/** The /agent-flow stats table. */
export const statsText = (log: readonly LogEntry[], now: number, days: number): string => {
  const gs = groups(log, now, days)
  if (gs.length === 0) return `No subagent runs logged in the last ${days} day${days === 1 ? '' : 's'}.`
  const total = gs.reduce((n, g) => n + g.tokens, 0)
  const runs = gs.reduce((n, g) => n + g.runs, 0)
  const w = Math.max(5, ...gs.map(g => g.type.length))
  const m = Math.max(5, ...gs.map(g => g.model.length))
  const head = `${pad('agent', w)}  ${pad('model', m)}  ${lpad('runs', 4)}  ${lpad('tokens', 8)}  ${lpad('share', 5)}  ${lpad('tok/run', 7)}  ${lpad('time/run', 8)}  ${lpad('calls', 5)}  ${lpad('edits', 5)}`
  const rows = gs.map(g =>
    `${pad(g.type, w)}  ${pad(g.model, m)}  ${lpad(String(g.runs), 4)}  ${lpad(fmt(g.tokens), 8)}  ${lpad(`${Math.round((g.tokens / Math.max(1, total)) * 100)}%`, 5)}  ${lpad(fmt(Math.round(g.tokens / g.runs)), 7)}  ${lpad(elapsed(g.ms / g.runs), 8)}  ${lpad(String(g.calls), 5)}  ${lpad(String(g.edits), 5)}${g.aborted ? `  (${g.aborted} stopped)` : ''}`,
  )
  return [`Subagent runs, last ${days} day${days === 1 ? '' : 's'}: ${runs} runs, ${fmt(total)} tokens (cache reads left out)`, head, ...rows].join('\n')
}
