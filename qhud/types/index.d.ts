/** One reading of the context window, taken when a turn ends. */
export type Reading = { tokens: number; window: number }

/** The prompt cache's clock. */
export type CacheClock = {
  /** When the main thread's last API response arrived (ms since epoch); null before the first. */
  lastAt: number | null
  /** TTL the engine reported on a model switch, overriding the option; null until then. */
  ttl: '5m' | '1h' | null
  /** The lastAt a "cache expires soon" toast was already shown for. */
  warnedFor: number | null
}

/** What the last main-thread response ran with. */
export type RunInfo = {
  /** The effort the request asked for ("high"), or null before the first response. */
  effort: string | null
  /** The model that answered, as the API names it, or null before the first response. */
  answeredBy: string | null
}

/** One usage-limit window: "5h left 98% (reset 2h16m)". */
export type LimitView = { name: string; left: number; reset?: string }

/** Everything the line shows, gathered once per refresh (hooks/view.ts). */
export type TcwView = {
  model?: string
  effort?: string
  fallback?: string
  activeFallback?: string
  /** pct is null before the first response (drawn "-%"); bar is the 10-cell meter's filled cells. */
  weather?: { icon: string; word: string; color: string; pct: number | null; filled: number; tokens: string; chart?: string }
  git?: string
  cache: string
  isCacheCold: boolean
  limits: LimitView[]
  usd?: string
  /** True when the Claude Code theme is a light one (chip colours follow it). */
  isLight?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'qhud': {
      /** Readings of the last turns, oldest first, at most 13 (12 bars + the one before for the delta). */
      history: Reading[]
      clock: CacheClock
      run: RunInfo
      view: TcwView | null
    }
  }
}
