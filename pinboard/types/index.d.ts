/** One pinned note. */
export type Pin = {
  id: string
  text: string
  /** Typed with a leading "!": drawn red with a star. */
  important: boolean
  done: boolean
  at: number
}

/** A prompt the user typed while a turn was running, listed for this session only. */
export type Captured = {
  id: string
  /** The board line only: the prompt's first line, cleaned and capped (`firstLine`); the full prompt is never kept. */
  text: string
  at: number
  /** The marker row placed in the transcript at capture (`$.ui.place`), to scroll back to; absent when none was placed. */
  requestId?: string
}

declare module 'claude-code' {
  interface PluginState {
    'pinboard': {
      /** This folder's pins, oldest first. */
      pins: Pin[]
      /** The folder the pins belong to (the session's working directory). */
      folder: string
      /** True while the board is folded to its header line. */
      folded: boolean
      /** Prompts typed mid-turn this session, oldest first (never saved to the store). */
      captured: Captured[]
    }
  }
}
