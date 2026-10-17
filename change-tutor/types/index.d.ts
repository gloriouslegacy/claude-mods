/** One hunk of a unified diff, as the Edit and Write tools report it. */
export type Hunk = { oldStart: number; newStart: number; lines: string[] }

/** A four-choice question about one change, and the choice the person picked. */
export type Quiz = { question: string; choices: string[]; answer: number; explanation: string; picked: number | null }

/** One learning note: a single Edit or Write of a file. */
export type Note = {
  id: string
  /** The session it was taken in (that session's start time). */
  session: number
  /** When the change was made, ms since the epoch. */
  at: number
  path: string
  isNew: boolean
  added: number
  removed: number
  /** The person's prompt of the turn that made the change. */
  request: string
  /** What Claude said right before making the change. */
  why: string
  hunks: Hunk[]
  /** Diff lines kept in hunks (may be fewer than the change had). */
  totalLines: number
  explain: string | null
  quiz: Quiz | null
}

export type View = {
  tab: 'session' | 'all'
  /** Index into the tab's list; null follows the latest note. */
  pos: number | null
  expanded: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'change-tutor': {
      notes: Note[]
      session: number
      view: View
      /** The note an explanation or quiz is being written for, or null. */
      busy: string | null
    }
  }
}
