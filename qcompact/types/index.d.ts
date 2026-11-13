/** Where the [Compact] button stands: waiting, waiting for the confirming second press, or compacting. */
export type Phase = 'idle' | 'confirm' | 'running'

/** What a press asks for: start the confirm window, run the compact, or nothing (ignored while running). */
export type Action = 'arm' | 'run' | 'none'

declare module 'claude-code' {
  interface PluginState {
    'qcompact': {
      /** The button's phase for this session (never saved to the store). */
      phase: Phase
    }
  }
}
