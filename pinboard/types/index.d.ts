/** One pinned note. */
export type Pin = {
  id: string
  text: string
  /** Typed with a leading "!": drawn red with a star. */
  important: boolean
  done: boolean
  at: number
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
    }
  }
}
