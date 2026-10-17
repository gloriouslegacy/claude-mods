// agent-flow: pure helpers — token counts, labels, elapsed times and the tree order.
import type { AgentRow, Change } from '../types'
import { modelName } from './model'

export const KEEP_CHANGES = 300
export const KEEP_LINES = 200
export const COLLAPSED_LINES = 12
/** Thresholds of the stall warnings, in ms; the userConfig options set them in seconds. */
export type Limits = { slow: number; slowShell: number; silent: number }
export const DEFAULT_LIMITS: Limits = { slow: 60_000, slowShell: 180_000, silent: 120_000 }
/** A model request is shown as "thinking" once it has run this long. */
export const THINKING_MS = 15_000
/** Tools that wait on something else by design (a subagent, a monitor, the person): never slow. */
export const WAITING_TOOLS = new Set(['Agent', 'Task', 'TaskOutput', 'TaskGet', 'Monitor', 'Workflow', 'AskUserQuestion', 'ScheduleWakeup', 'SendMessage', 'EnterPlanMode', 'ExitPlanMode'])
/** Shell tools, whose builds and tests run long: their own threshold. */
export const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])
export const KEEP_RECENT = 5
export const PROMPT_CHARS = 300

export type Usage = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }

/** What a request cost, cache reads left out (they barely count against limits). */
export const stepTokens = (u: Usage | null | undefined): number =>
  u ? (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0) : 0

/** 950 → "950", 4_100 → "4.1k", 1_250_000 → "1.25M" */
export const fmt = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

/** 2_000 → "2s", 125_000 → "2m05s", 3_900_000 → "1h05m" */
export const elapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

export const short = (model: string | null): string => (model ? modelName(model) : '?')

/** Fable (and Mythos) draw from their own weekly cap: worth seeing at a glance. */
export const isCapped = (model: string | null): boolean => !!model && /fable|mythos/i.test(model)

export const isActive = (status: string): boolean => status === 'running' || status === 'pending'

/** Working now: in a turn by our own count, or running by the engine's roster. */
export const isWorking = (row: { status: string; isBusy?: boolean }): boolean => !!row.isBusy || isActive(row.status)

/** Agents in tree order (each after its parent), with their depth. */
export const tree = (agents: readonly AgentRow[]): { row: AgentRow; depth: number; isLast: boolean }[] => {
  const ids = new Set(agents.map(a => a.id))
  const kids = (parent: string | undefined) => agents.filter(a => (a.parentId && ids.has(a.parentId) ? a.parentId : undefined) === parent)
  const out: { row: AgentRow; depth: number; isLast: boolean }[] = []
  const walk = (parent: string | undefined, depth: number) => {
    const list = kids(parent)
    list.forEach((row, i) => {
      out.push({ row, depth, isLast: i === list.length - 1 })
      walk(row.id, depth + 1)
    })
  }
  walk(undefined, 0)
  return out
}

/** "Agent flow · main + 2 agents · 3 running · 0 waiting": main counts when it is in a turn. */
export const headline = (agents: readonly AgentRow[], isMainRunning = false): string => {
  const running = agents.filter(isWorking).length + (isMainRunning ? 1 : 0)
  const waiting = agents.filter(a => !isWorking(a) && (a.status === 'waiting' || a.status === 'idle')).length
  return `Agent flow · main + ${agents.length} agent${agents.length === 1 ? '' : 's'} · ${running} running · ${waiting} waiting`
}

export const changesOf = (changes: readonly Change[], agent: string): Change[] => changes.filter(c => c.agent === agent)

/** ".../src/parser.ts": the last three segments. */
export const shortPath = (path: string): string => {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.length <= 3 ? path : `.../${parts.slice(-3).join('/')}`
}

const pad = (n: number): string => String(n).padStart(2, '0')
export const clockTime = (ms: number): string => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const one = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.replace(/\s+/g, ' ').trim() : undefined)

/** A tool call as one short label: "Edit src/parser.ts", "Bash npm test", "Grep TODO". */
export const toolLabel = (tool: string, args: Record<string, unknown>): string => {
  const path = one(args.file_path) ?? one(args.notebook_path) ?? one(args.path)
  const what = path ? shortPath(path) : (one(args.command) ?? one(args.pattern) ?? one(args.description) ?? one(args.url) ?? one(args.query) ?? one(args.skill))
  const name = tool.startsWith('mcp__') ? tool.split('__').slice(-1)[0] ?? tool : tool
  const label = what ? `${name} ${what}` : name
  return label.length > 60 ? `${label.slice(0, 59)}…` : label
}

export type Doing = {
  /** The tool call under way: "Bash npm test 12s". */
  now?: string
  /** True when that call waits on something else (a subagent, a monitor): drawn dim, never slow. */
  isWaiting?: boolean
  /** A model request running a while with no tool call: "thinking 1m10s". */
  thinking?: string
  /** "⚠ slow 1m05s" or "⚠ silent 2m05s" */
  warn?: string
  /** warn past the threshold, alert past three times it. */
  level?: 'warn' | 'alert'
}

/** What a loop is doing now, and whether it needs a look. A tool call is slow past its threshold (shell
 *  tools have their own); a tool that waits by design is never slow; a long model request is thinking,
 *  not silence; silent is a working loop with no tool call and no request under way for too long. */
export const doing = (
  a: { running: readonly { tool?: string; label: string; at: number }[]; lastSeenAt: number; requestAt?: number },
  isWorking: boolean,
  now: number,
  limits: Limits = DEFAULT_LIMITS,
): Doing => {
  const level = (ms: number, limit: number): 'warn' | 'alert' | undefined => (ms > limit * 3 ? 'alert' : ms > limit ? 'warn' : undefined)
  const busy = a.running.filter(r => !WAITING_TOOLS.has(r.tool ?? ''))
  const waiting = a.running.filter(r => WAITING_TOOLS.has(r.tool ?? ''))
  const oldest = (list: readonly { label: string; at: number }[]) => list.reduce<{ label: string; at: number; tool?: string } | undefined>((o, r) => (!o || r.at < o.at ? r : o), undefined)
  const more = a.running.length > 1 ? ` +${a.running.length - 1}` : ''
  const b = oldest(busy)
  if (b) {
    const ran = now - b.at
    const lv = level(ran, SHELL_TOOLS.has(b.tool ?? '') ? limits.slowShell : limits.slow)
    return { now: `${b.label}${more} ${elapsed(ran)}`, ...(lv ? { warn: `⚠ slow ${elapsed(ran)}`, level: lv } : {}) }
  }
  const w = oldest(waiting)
  if (w) return { now: `${w.label}${more} ${elapsed(now - w.at)}`, isWaiting: true }
  if (a.requestAt !== undefined) {
    const t = now - a.requestAt
    return t >= THINKING_MS ? { thinking: `thinking ${elapsed(t)}` } : {}
  }
  const quiet = now - a.lastSeenAt
  const lv = isWorking ? level(quiet, limits.silent) : undefined
  return lv ? { warn: `⚠ silent ${elapsed(quiet)}`, level: lv } : {}
}

export const fresh = (now: number) => ({ calls: 0, running: [], recent: [], lastSeenAt: now })

const word = (row: { status: string; isBusy?: boolean }): string =>
  row.isBusy || row.status === 'running' || row.status === 'pending' ? 'run' : row.status === 'completed' ? 'done' : row.status === 'failed' || row.status === 'killed' ? 'fail' : 'idle'

/** The flow as plain text, for /agent-flow text and surfaces without a pane. */
export const asText = (
  main: { model: string | null; isRunning: boolean; tokens: number; edits: number; calls: number; running: { tool?: string; label: string; at: number }[]; lastSeenAt: number; requestAt?: number },
  agents: readonly AgentRow[],
  last: string,
  now: number,
  limits: Limits = DEFAULT_LIMITS,
): string => {
  const listed = agents.filter(a => !a.isUnlisted)
  const unlisted = agents.length - listed.length
  const tail = (a: { running: { tool?: string; label: string; at: number }[]; lastSeenAt: number; requestAt?: number }, working: boolean) => {
    const d = doing(a, working, now, limits)
    return `${d.now ? `  now: ${d.now}` : ''}${d.thinking ? `  ${d.thinking}` : ''}${d.warn ? `  ${d.warn}` : ''}`
  }
  const lines = [headline(listed, main.isRunning) + (unlisted > 0 ? ` · ${unlisted} unlisted` : '')]
  lines.push(`[${main.isRunning ? 'run' : 'idle'}] main  ${short(main.model)}  ${fmt(main.tokens)} tok  ×${main.calls}  ✎${main.edits}${tail(main, main.isRunning)}`)
  for (const { row, depth, isLast } of tree(listed)) {
    const working = !!row.isBusy || isActive(row.status)
    const time = elapsed((working ? now : (row.endedAt ?? now)) - row.startedAt)
    lines.push(`${'  '.repeat(depth)}${isLast ? '└' : '├'} [${word(row)}] ${row.type}${row.task ? ` "${row.task}"` : ''}  ${short(row.model)}  ${time}  ${fmt(row.tokens)} tok  ×${row.calls}  ✎${row.edits}${tail(row, working)}`)
  }
  if (last) lines.push(`last: ${last}`)
  return lines.join('\n')
}
