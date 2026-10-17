/** One hunk of a unified diff, as the Edit and Write tools report it. */
export type Hunk = { oldStart: number; newStart: number; lines: string[] }

/** A tool call under way: its id, what it shows as ("Edit src/parser.ts") and when it began. */
export type Running = { id: string; tool: string; label: string; at: number }

/** A finished tool call, for the [+] details. */
export type ToolRecord = { label: string; ms: number; isError: boolean }

/** What every loop (main or a subagent) is doing: calls, the ones under way, the last few. */
export type Activity = {
  /** Tool calls made so far. */
  calls: number
  running: Running[]
  /** The last few finished calls, newest last. */
  recent: ToolRecord[]
  /** The last time anything was heard from it (a request, a tool call starting or ending). */
  lastSeenAt: number
  /** When the model request under way began; absent between requests. */
  requestAt?: number
}

/** The main loop's line in the flow. */
export type MainRow = Activity & {
  /** The model that answered last, as the API names it. */
  model: string | null
  isRunning: boolean
  /** Tokens this session: input, cache writes and output (cache reads left out). */
  tokens: number
  edits: number
}

/** One subagent's line in the flow. */
export type AgentRow = Activity & {
  id: string
  /** Its agent type: Explore, general-purpose, implementer, ... */
  type: string
  /** The few words of its task. */
  task: string
  model: string | null
  /** pending, running, waiting, idle, completed, failed or killed. */
  status: string
  parentId?: string
  startedAt: number
  endedAt?: number
  /** True from its first request until its loop's turn.complete: working, whatever the roster last said. */
  isBusy?: boolean
  tokens: number
  edits: number
  /** The start of its task prompt, from the spawn. */
  prompt?: string
  /** Heard from (a request or a tool call) but not in the engine's roster: a workflow's agent, an engine fork. */
  isUnlisted?: boolean
  /** Totals already written to the run log, so a woken agent's next run logs only what it adds. */
  logged?: { tokens: number; calls: number; edits: number }
}

/** One Edit or Write, by the main loop ("main") or a subagent (its id). */
export type Change = {
  id: string
  agent: string
  at: number
  path: string
  isNew: boolean
  added: number
  removed: number
  hunks: Hunk[]
  /** Diff lines the change had (more than hunks keep when it was long). */
  totalLines: number
}

/** One finished subagent run, kept across sessions for /agent-flow stats. */
export type LogEntry = {
  /** When the run ended, ms since the epoch. */
  at: number
  /** The working directory of the session. */
  cwd: string
  type: string
  task: string
  model: string | null
  /** Tokens spent in this run (cache reads left out). */
  tokens: number
  ms: number
  calls: number
  edits: number
  isAborted: boolean
}

/** flow: the agents; diffs: one agent's changes (main_Diff or sub_Diff). */
export type FlowView = {
  mode: 'flow' | 'diffs'
  agent: string
  pos: number | null
  /** The diff shown whole. */
  expanded: boolean
  /** Rows opened with [+] ("main" or an agent id). */
  open: string[]
  /** The unlisted-loops group unfolded. */
  showUnlisted: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'agent-flow': {
      main: MainRow
      agents: AgentRow[]
      changes: Change[]
      /** The last thing that happened: "implementer · Edit src/parser.ts". */
      last: string
      view: FlowView
      /** Bumped every 2 s while an agent runs, so elapsed times redraw. */
      tick: number
    }
  }
}
