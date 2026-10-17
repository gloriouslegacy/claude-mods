// change-tutor: a "Change Notes" pane. Every Edit/Write becomes a note holding the turn's
// request, what Claude said right before the change, and the diff; the pane explains a note
// simply or quizzes on it with a small model call. Notes persist in $.store across sessions.
// Only the main thread's changes are noted: subagents' changes are agent-flow's (main_Diff / sub_Diff).
// Off by default (option `enabled`): nothing is noted and no status line shows until it is turned on in
// /config, or for one session with /change-tutor on. Notes kept earlier stay readable with /change-tutor.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Note, View } from '../types'
import { counts, creation, lineCount, normalise, render } from './diff'
import type { RawHunk } from './diff'
import {
  COLLAPSED_LINES,
  KEEP_LINES,
  KEEP_NOTES,
  TUTOR_SYSTEM,
  explainPrompt,
  listFor,
  oneLine,
  parseQuiz,
  position,
  quizPrompt,
  shortPath,
  stamp,
} from './tutor'

const PANE = 'change-tutor'
const TITLE = 'Change Notes'
const STORE_KEY = 'notes'

const notes = atom({ plugin: 'change-tutor', key: 'notes' } as const, [] as Note[])
const session = atom({ plugin: 'change-tutor', key: 'session' } as const, 0)
const view = atom({ plugin: 'change-tutor', key: 'view' } as const, { tab: 'session', pos: null, expanded: false } as View)
const busy = atom({ plugin: 'change-tutor', key: 'busy' } as const, null as string | null)

// Whether changes are noted now: the `enabled` option, or /change-tutor on|off for this session.
let recording = false

async function showCount($: EngineInterface): Promise<void> {
  if (!recording) {
    $.ui.status(undefined)
    return
  }
  const all = await read($, notes)
  $.ui.status(all.length === 0 ? undefined : `📘 ${all.length} change note${all.length === 1 ? '' : 's'}`)
}

async function saveNotes($: EngineInterface, list: Note[]): Promise<void> {
  await update($, notes, () => list)
  await $.store.set(STORE_KEY, list)
  await showCount($)
}

async function patchNote($: EngineInterface, id: string, change: Partial<Note>): Promise<void> {
  const list = await read($, notes)
  await saveNotes($, list.map(n => (n.id === id ? { ...n, ...change } : n)))
}

async function addNote($: EngineInterface, note: Note): Promise<void> {
  const list = await read($, notes)
  const isFirstThisSession = !list.some(n => n.session === note.session)
  await saveNotes($, [...list, note].slice(-KEEP_NOTES))
  await update($, view, v => ({ ...v, pos: null, expanded: false }))
  if (isFirstThisSession) await $.ui.open({ id: PANE, title: TITLE })
}

async function explain($: EngineInterface, note: Note, model: string): Promise<void> {
  if ((await read($, busy)) !== null) return
  await update($, busy, () => note.id)
  try {
    const r = await $.model.complete({ model, system: TUTOR_SYSTEM, prompt: explainPrompt(note, render(note.hunks, null).source), maxTokens: 1200 })
    if (r.isAnswered) await patchNote($, note.id, { explain: r.text.trim() })
    else $.ui.toast(`change-tutor: no explanation came back (${r.reason})`)
  } catch (err) {
    $.ui.toast(`change-tutor: explanation failed (${String(err)})`)
  } finally {
    await update($, busy, () => null)
  }
}

async function quiz($: EngineInterface, note: Note, model: string): Promise<void> {
  if ((await read($, busy)) !== null) return
  await update($, busy, () => note.id)
  try {
    const r = await $.model.complete({ model, system: TUTOR_SYSTEM, prompt: quizPrompt(note, render(note.hunks, null).source), maxTokens: 1200 })
    const made = r.isAnswered ? parseQuiz(r.text) : null
    if (made) await patchNote($, note.id, { quiz: made })
    else $.ui.toast('change-tutor: could not make a quiz. Press it again.')
  } catch (err) {
    $.ui.toast(`change-tutor: quiz failed (${String(err)})`)
  } finally {
    await update($, busy, () => null)
  }
}

async function pick($: EngineInterface, note: Note, choice: number): Promise<void> {
  if (!note.quiz) return
  await patchNote($, note.id, { quiz: { ...note.quiz, picked: choice } })
}

async function copyDiff($: EngineInterface, note: Note, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile'): Promise<void> {
  const r = await $.ui.copy({ text: render(note.hunks, null).source, surface })
  $.ui.toast(r.isCopied ? 'Diff copied.' : `Could not copy (${r.reason})`)
}

export const register: Register = (on, options) => {
  const model = typeof options.model === 'string' ? options.model : 'haiku'
  recording = options.enabled === true
  // The turn under way: its prompt and the latest thing Claude said before a tool call.
  let request = ''
  let why = ''

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const stored = await $.store.get(STORE_KEY)
    // notes a subagent made (kept by 0.2.x under sub_Diff) are left out: agent-flow shows those now
    await update($, notes, () => (Array.isArray(stored) ? (stored as (Note & { agent?: unknown })[]).filter(n => !n.agent) : []))
    const { startedAt } = await $.session.usage()
    await update($, session, () => startedAt)
    await $.command.register({ name: 'change-tutor', description: 'Open the Change Notes pane; "on" / "off" turns noting on or off for this session', argumentHint: '[on | off]' })
    await showCount($)
    return result
  })

  on('command.run', { command: 'change-tutor' }, async ($, e) => {
    const word = e.args.trim().toLowerCase()
    if (word === 'on' || word === 'off') {
      recording = word === 'on'
      await showCount($)
      await update($, view, v => ({ ...v })) // redraw the pane's banner
      return { text: recording ? 'change-tutor: noting changes for this session.' : 'change-tutor: noting stopped for this session.' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: recording ? 'Opened Change Notes.' : 'Opened Change Notes (noting is off: /change-tutor on, or change-tutor.enabled in /config).' }
  })

  on('prompt.submit', async ($, e, next) => {
    request = e.text
    why = ''
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    if (recording && e.agentId === undefined && step.answer.trim() !== '') why = step.answer.trim()
    return step
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (!recording || e.agentId !== undefined) return ran // off, or a subagent's: agent-flow's
    if (ran.deny !== undefined || ran.isError || !ran.result || ran.result.staged) return ran
    const raw: RawHunk[] = ran.result.structuredPatch
    await addNote($, await makeNote($, e.file_path, false, raw, request, why))
    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (!recording || e.agentId !== undefined) return ran // off, or a subagent's: agent-flow's
    if (ran.deny !== undefined || ran.isError || !ran.result || ran.result.staged) return ran
    const isNew = ran.result.type === 'create'
    const patch: RawHunk[] = ran.result.structuredPatch
    const raw = isNew && patch.length === 0 ? creation(e.content) : patch
    if (raw.length === 0) return ran
    await addNote($, await makeNote($, e.file_path, isNew, raw, request, why))
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code, Markdown } = $.ui.resolve(e)
    const [all, current, v, working] = await Promise.all([read($, notes), read($, session), read($, view), read($, busy)])
    const list = listFor(all, v, current)
    const at = position(list.length, v)
    const note = at >= 0 ? list[at] : undefined
    const sessionCount = all.filter(n => n.session === current).length
    const setView = (change: Partial<View>) => update($, view, old => ({ ...old, ...change }))

    const header = (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Button key="tab-session" variant={v.tab === 'session' ? 'primary' : 'secondary'} label={`This session ${sessionCount}`} onPress={() => setView({ tab: 'session', pos: null, expanded: false })} />
          <Button key="tab-all" variant={v.tab === 'all' ? 'primary' : 'secondary'} label={`All notes ${all.length}`} onPress={() => setView({ tab: 'all', pos: null, expanded: false })} />
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="prev" hotkey="h" label="◀" onPress={() => setView({ pos: Math.max(0, at - 1), expanded: false })} />
          <Text>{list.length === 0 ? '0 / 0' : `${at + 1} / ${list.length}`}</Text>
          <Button key="next" hotkey="l" label="▶" onPress={() => setView({ pos: at + 1 >= list.length - 1 ? null : at + 1, expanded: false })} />
          <Button key="latest" label="Latest" onPress={() => setView({ pos: null, expanded: false })} />
        </Box>
      </Box>
    )

    const banner = recording ? null : <Text color="yellow">Noting is off: /change-tutor on (this session) or change-tutor.enabled in /config.</Text>
    if (!note) {
      return (
        <Box flexDirection="column" gap={1}>
          {banner}
          {header}
          <Text dimColor>No notes yet. Each file Claude creates or edits adds one here.</Text>
        </Box>
      )
    }

    const shownMax = v.expanded ? null : COLLAPSED_LINES
    const diff = render(note.hunks, shownMax)
    const hidden = lineCount(note.hunks) - diff.shown
    const isBusy = working === note.id
    const q = note.quiz

    return (
      <Box flexDirection="column" gap={1}>
        {banner}
        {header}
        <Box flexDirection="column">
          <Text bold wrap="truncate-start">📄 {shortPath(note.path)}{note.isNew ? ' (new file)' : ''}</Text>
          <Box flexDirection="row">
            <Text color="green">+{note.added}</Text>
            <Text> </Text>
            <Text color="red">-{note.removed}</Text>
            <Text dimColor> · {stamp(note.at)}</Text>
          </Box>
        </Box>
        <Text>🙋 Request: {oneLine(note.request, 400) || '(none recorded)'}</Text>
        <Box flexDirection="column">
          <Text bold color="cyan">🤔 Why it changed</Text>
          <Text>{oneLine(note.why, 600) || '(Claude said nothing right before this change)'}</Text>
        </Box>
        {diff.source === '' ? <Text dimColor>(no diff to show)</Text> : <Code source={diff.source} format="diff" path={note.path} wrap="truncate-end" />}
        {note.totalLines > lineCount(note.hunks) ? <Text dimColor>(long change: only the first {lineCount(note.hunks)} lines were kept)</Text> : null}
        {note.explain ? (
          <Box flexDirection="column">
            <Text bold color="yellow">💡 In plain words</Text>
            <Markdown text={note.explain} />
          </Box>
        ) : null}
        {q ? (
          <Box flexDirection="column">
            <Text bold color="magenta">❓ {q.question}</Text>
            {q.choices.map((c, i) => (
              <Button key={`choice-${i}`} hotkey={String(i + 1)} plain label={q.picked === null ? c : `${c}${i === q.answer ? '  ✅' : i === q.picked ? '  ❌' : ''}`} onPress={() => void pick($, note, i)} />
            ))}
            {q.picked !== null ? <Text color={q.picked === q.answer ? 'green' : 'red'}>{q.picked === q.answer ? 'Correct! ' : 'Not quite. '}{q.explanation}</Text> : null}
          </Box>
        ) : null}
        {isBusy ? <Text dimColor>The tutor is thinking…</Text> : null}
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          <Button key="explain" hotkey="e" label="💡 Explain simply" onPress={() => void explain($, note, model)} />
          <Button key="quiz" hotkey="q" label={q ? '❓ New quiz' : '❓ Quiz'} onPress={() => void quiz($, note, model)} />
          {hidden > 0 || v.expanded ? (
            <Button key="expand" hotkey="v" label={v.expanded ? '⤡ Collapse' : `⤢ Show all (+${hidden} lines)`} onPress={() => setView({ pos: at, expanded: !v.expanded })} />
          ) : null}
          <Button key="copy" hotkey="c" label="Copy diff" onPress={() => void copyDiff($, note, e.surface)} />
        </Box>
      </Box>
    )
  })
}

async function makeNote($: EngineInterface, path: string, isNew: boolean, raw: RawHunk[], request: string, why: string): Promise<Note> {
  const at = await $.clock.now()
  const s = await read($, session)
  const { hunks, total } = normalise(raw, KEEP_LINES)
  const { added, removed } = counts(raw)
  return {
    id: `${at}-${Math.random().toString(36).slice(2, 8)}`,
    session: s,
    at,
    path,
    isNew,
    added,
    removed,
    request: request.slice(0, 2000),
    why: why.slice(0, 2000),
    hunks,
    totalLines: total,
    explain: null,
    quiz: null,
  }
}
