/** One pinned note. */
export type Pin = {
  id: string
  text: string
  /** Typed with a leading "!": drawn red with a star. */
  important: boolean
  done: boolean
  at: number
}

/** A prompt the user typed at the prompt (idle or mid-turn), listed for this session only. */
export type Captured = {
  id: string
  /** The board line: the prompt's first line, cleaned and capped (`firstLine`). */
  text: string
  /** The prompt's full text, cleaned and capped (`fullLines`); absent when the board line already shows it all. */
  lines?: string[]
  /** True while its remaining lines are unfolded under its board row. */
  open?: true
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
      /** Prompts typed this session, oldest first, with their unfolded state (never saved to the store). */
      captured: Captured[]
    }
  }
}
