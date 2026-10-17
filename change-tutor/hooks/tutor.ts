// change-tutor: pure helpers for the pane — list selection, labels, and the tutor prompts.
import type { Note, Quiz, View } from '../types'

export const COLLAPSED_LINES = 10
export const KEEP_NOTES = 100
export const KEEP_LINES = 200

export const listFor = (notes: readonly Note[], view: View, session: number): Note[] =>
  view.tab === 'session' ? notes.filter(n => n.session === session) : [...notes]

/** The shown position: the view's, clamped, or the latest when it follows. */
export const position = (count: number, view: View): number =>
  count === 0 ? -1 : view.pos === null ? count - 1 : Math.min(Math.max(view.pos, 0), count - 1)

const pad = (n: number): string => String(n).padStart(2, '0')

/** "10/3 08:18" in the machine's local time. */
export const stamp = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ".../mods/stock-analyzer/README.md": the last three segments. */
export const shortPath = (path: string): string => {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.length <= 3 ? path : `.../${parts.slice(-3).join('/')}`
}

export const oneLine = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export const TUTOR_SYSTEM =
  'You are a friendly tutor for people who are just learning to code. Explain jargon in plain words the first time it appears; one analogy is welcome. Be short and accurate.'

const context = (note: Note, diff: string): string =>
  [
    `File: ${note.path}${note.isNew ? ' (new file)' : ''}`,
    `What the user asked for: ${note.request || '(none)'}`,
    `What Claude said right before the change: ${note.why || '(nothing)'}`,
    'Diff:',
    diff.slice(0, 6000),
  ].join('\n')

export const explainPrompt = (note: Note, diff: string): string =>
  `${context(note, diff)}\n\nExplain what this change does and why, so a beginner can follow. 3 to 5 markdown bullets, under 120 words in all.`

export const quizPrompt = (note: Note, diff: string): string =>
  `${context(note, diff)}\n\nWrite one four-choice question that checks whether someone understood this change. Reply with one JSON object and nothing else:\n{"question": "...", "choices": ["...", "...", "...", "..."], "answer": index of the correct choice (0-3), "explanation": "one or two sentences on why"}`

/** The first JSON object in the reply, checked; null when it is not a usable quiz. */
export const parseQuiz = (text: string): Quiz | null => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const choices = Array.isArray(raw.choices) ? raw.choices.map(String).slice(0, 4) : []
    const answer = Number(raw.answer)
    if (typeof raw.question !== 'string' || choices.length < 2 || !Number.isInteger(answer)) return null
    if (answer < 0 || answer >= choices.length) return null
    return { question: raw.question, choices, answer, explanation: String(raw.explanation ?? ''), picked: null }
  } catch {
    return null
  }
}
