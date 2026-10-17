// agent-flow: one pane with the main agent and every subagent of the session, opened with /aflow
// (never by itself); /aflow text prints the same as text.
//   Agent flow · main + 2 agents · 2 running · 0 waiting
//   ● main  Fable 5.1  running  38.2k tok  ×14  ✎3  [main_Diff] [+]   Agent "Fix the parser" 41s
//   ├ ● Explore "Summarize src/greet.js"  Haiku 4.5  2s  4.1k tok  ×3  ✎0  [+]
//   └ ● implementer "Fix the parser"  Fable 5.1  41s  22.7k tok  ×9  ✎2  [sub_Diff] [+]   Bash npm test 38s  ⚠ slow 38s
//   ▸ unlisted loops (1)
//   last: implementer · Edit src/parser.ts
// Each row: status, model, time, tokens (cache reads left out), tool calls (×), files changed (✎), what it
// is doing now, and warnings: ⚠ slow when a tool call runs past its threshold (60 s; shell 3 min), never
// for tools that wait by design (Agent, Monitor, ...); "thinking 1m10s" while a long model request runs;
// ⚠ silent when a working loop has neither for 2 min. Yellow past the threshold, red past three times it.
// Each finished subagent run is logged across sessions: /aflow stats [days] sums it by agent and model.
// [+] opens the model, the task prompt and the last tool calls. main_Diff / sub_Diff open that agent's
// changes one diff at a time. Loops the engine's roster does not list (a workflow's agents, engine
// forks) go in a folded "unlisted loops" group. Nothing here calls a model; session-only.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, AgentRow, Change, FlowView, LogEntry, MainRow, ToolRecord } from '../types'
import { counts, creation, lineCount, normalise, render } from './diff'
import type { RawHunk } from './diff'
import {
  COLLAPSED_LINES,
  KEEP_CHANGES,
  KEEP_LINES,
  KEEP_RECENT,
  PROMPT_CHARS,
  asText,
  changesOf,
  clockTime,
  doing,
  elapsed,
  fmt,
  fresh,
  headline,
  isCapped,
  isWorking,
  mergeRoster,
  short,
  shortPath,
  shouldTick,
  stepTokens,
  toolLabel,
  tree,
} from './flow'
import type { Limits, RosterEntry, Usage } from './flow'
import { KEEP_LOG, LOG_KEY, statsDays, statsText } from './stats'

const PANE = 'agent-flow'
const TITLE = 'Agent flow'
const TICK_MS = 2000

const main = atom({ plugin: 'agent-flow', key: 'main' } as const, { model: null, isRunning: false, tokens: 0, edits: 0, ...fresh(0) } as MainRow)
const agents = atom({ plugin: 'agent-flow', key: 'agents' } as const, [] as AgentRow[])
const changes = atom({ plugin: 'agent-flow', key: 'changes' } as const, [] as Change[])
const last = atom({ plugin: 'agent-flow', key: 'last' } as const, '')
const view = atom({ plugin: 'agent-flow', key: 'view' } as const, { mode: 'flow', agent: 'main', pos: null, expanded: false, open: [], showUnlisted: false } as FlowView)
const tick = atom({ plugin: 'agent-flow', key: 'tick' } as const, 0)

// What spawns told us before the agent had a row: its prompt and the time it started, by agent id.
const spawned = new Map<string, { prompt: string; at: number; type: string; task: string }>()

type Roster = Awaited<ReturnType<EngineInterface['agent']['list']>>

async function roster($: EngineInterface): Promise<Roster | null> {
  try {
    return await $.agent.list()
  } catch {
    return null // unavailable for a moment
  }
}

function newRow(id: string, now: number): AgentRow {
  const s = spawned.get(id)
  return { id, type: s?.type || 'subagent', task: s?.task || '', model: null, status: 'running', startedAt: s?.at ?? now, tokens: 0, edits: 0, prompt: s?.prompt, ...fresh(now) }
}

/** Brings the rows in line with the engine's roster: new agents added, types, tasks and states refreshed. */
async function sync($: EngineInterface): Promise<void> {
  const list = await roster($)
  if (!list) return
  const now = await $.clock.now()
  const add = (a: RosterEntry): AgentRow => ({ ...newRow(a.id, now), type: a.type || 'subagent', task: a.description || spawned.get(a.id)?.task || '', status: a.status, parentId: a.parentId })
  // a quiet roster leaves the atom alone, so the tick alone redraws the pane
  const rows = await read($, agents)
  if (mergeRoster(rows, list, now, add) === rows) return
  await update($, agents, current => mergeRoster(current, list, now, add))
}

/** Makes sure a loop heard from has a row: from the roster, or else as an unlisted loop. */
async function ensureRow($: EngineInterface, id: string): Promise<void> {
  if ((await read($, agents)).some(r => r.id === id)) return
  await sync($)
  if ((await read($, agents)).some(r => r.id === id)) return
  const now = await $.clock.now()
  const s = spawned.get(id)
  await update($, agents, rows => (rows.some(r => r.id === id) ? rows : [...rows, { ...newRow(id, now), type: s?.type || 'loop', isUnlisted: !s }]))
}

/** Applies a change to main's or one agent's activity. */
async function touch($: EngineInterface, agentId: string | undefined, change: (a: Activity) => Partial<Activity>): Promise<void> {
  if (agentId === undefined) await update($, main, m => ({ ...m, ...change(m) }))
  else await update($, agents, rows => rows.map(r => (r.id === agentId ? { ...r, ...change(r) } : r)))
}

async function nameOf($: EngineInterface, agent: string): Promise<string> {
  if (agent === 'main') return 'main'
  return (await read($, agents)).find(r => r.id === agent)?.type ?? 'subagent'
}

async function record($: EngineInterface, agentId: string | undefined, tool: string, path: string, isNew: boolean, raw: RawHunk[]): Promise<void> {
  const agent = agentId ?? 'main'
  const at = await $.clock.now()
  const { hunks, total } = normalise(raw, KEEP_LINES)
  const { added, removed } = counts(raw)
  const change: Change = { id: `${at}-${Math.random().toString(36).slice(2, 7)}`, agent, at, path, isNew, added, removed, hunks, totalLines: total }
  await update($, changes, list => [...list, change].slice(-KEEP_CHANGES))
  if (agentId === undefined) await update($, main, m => ({ ...m, edits: m.edits + 1 }))
  else await update($, agents, rows => rows.map(r => (r.id === agentId ? { ...r, edits: r.edits + 1 } : r)))
  const who = await nameOf($, agent)
  await update($, last, () => `${who} · ${tool} ${shortPath(path)}`)
}

async function openDiffs($: EngineInterface, agent: string): Promise<void> {
  await update($, view, v => ({ ...v, mode: 'diffs', agent, pos: null, expanded: false }))
}

async function toggleOpen($: EngineInterface, id: string): Promise<void> {
  await update($, view, v => ({ ...v, open: v.open.includes(id) ? v.open.filter(x => x !== id) : [...v.open, id] }))
}

async function flowText($: EngineInterface, limits: Limits): Promise<string> {
  await sync($)
  const [m, rows, lastText] = await Promise.all([read($, main), read($, agents), read($, last)])
  return asText(m, rows, lastText, await $.clock.now(), limits)
}

/** Writes one finished run of a subagent to the log: what it spent since its last logged run. */
async function logRun($: EngineInterface, id: string, ms: number, isAborted: boolean): Promise<void> {
  const row = (await read($, agents)).find(r => r.id === id)
  if (!row || row.isUnlisted) return
  const was = row.logged ?? { tokens: 0, calls: 0, edits: 0 }
  const entry: LogEntry = {
    at: await $.clock.now(),
    cwd: await $.session.cwd(),
    type: row.type,
    task: row.task,
    model: row.model,
    tokens: row.tokens - was.tokens,
    ms,
    calls: row.calls - was.calls,
    edits: row.edits - was.edits,
    isAborted,
  }
  await update($, agents, rows => rows.map(r => (r.id === id ? { ...r, logged: { tokens: r.tokens, calls: r.calls, edits: r.edits } } : r)))
  const log = await $.store.get(LOG_KEY)
  await $.store.set(LOG_KEY, [...(Array.isArray(log) ? (log as LogEntry[]) : []), entry].slice(-KEEP_LOG))
}

async function stats($: EngineInterface, args: string): Promise<string> {
  const log = await $.store.get(LOG_KEY)
  return statsText(Array.isArray(log) ? (log as LogEntry[]) : [], await $.clock.now(), statsDays(args))
}

/** Whether our pane is up to redraw; when the host cannot say, as before: yes. */
async function isPaneUp($: EngineInterface): Promise<boolean> {
  try {
    return shouldTick(await $.ui.panes(), PANE)
  } catch {
    return true // unavailable for a moment: keep ticking
  }
}

/** /aflow: no word opens the pane, "text" prints the flow, "stats [days]" sums the run log. */
async function run($: EngineInterface, args: string, limits: Limits): Promise<string> {
  const word = args.trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (word === 'text') return flowText($, limits)
  if (word === 'stats') return stats($, args)
  await update($, view, v => ({ ...v, mode: 'flow' }))
  const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })
  // where no pane is drawn (a -p run, an editor extension), the flow comes as text (flowText syncs first)
  if (!isPlaced) return flowText($, limits)
  // the pane is already open; the engine agent list fills it in when it arrives
  await sync($)
  return 'Opened Agent flow.'
}

const seconds = (v: unknown, fallback: number): number => (typeof v === 'number' && v > 0 ? v * 1000 : typeof v === 'string' && Number(v) > 0 ? Number(v) * 1000 : fallback)

export const register: Register = (on, options) => {
  const limits: Limits = { slow: seconds(options.slowSeconds, 60_000), slowShell: seconds(options.slowShellSeconds, 180_000), silent: seconds(options.silentSeconds, 120_000) }
  const keepLog = options.log !== false
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const command = { description: 'Open the Agent flow pane (main and subagents); "text" prints it, "stats [days]" sums the logged runs', argumentHint: '[text | stats [days]]' }
    await $.command.register({ name: 'aflow', ...command })
    $.clock.every(TICK_MS, async () => {
      // nothing to redraw while the pane is closed, undrawn or a tab behind; /aflow syncs when it opens it
      if (!(await isPaneUp($))) return
      const rows = await read($, agents)
      // a finished agent can be woken again (SendMessage), so look while anything may be working
      if (!(await read($, main)).isRunning && !rows.some(isWorking)) return
      await sync($)
      await update($, tick, t => t + 1)
    })
    return result
  })

  on('command.run', { command: 'aflow' }, async ($, e) => ({ text: await run($, e.args, limits) }))

  // The spawn knows the task prompt and the start before the agent's first request.
  on('agent.spawn', async ($, e, next) => {
    const at = await $.clock.now()
    const result = await next(e)
    if (result.agentId) {
      const id = result.agentId
      spawned.set(id, { prompt: e.prompt.slice(0, PROMPT_CHARS), at, type: e.subagentType, task: e.description })
      await ensureRow($, id)
      await update($, agents, rows => rows.map(r => (r.id === id ? { ...r, prompt: r.prompt ?? e.prompt.slice(0, PROMPT_CHARS), model: r.model ?? result.model, startedAt: Math.min(r.startedAt, at) } : r)))
      await update($, last, () => `main · spawned ${e.subagentType} "${e.description}"`)
    }
    return result
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, main, m => ({ ...m, isRunning: true, lastSeenAt: now }))
    return next(e)
  })

  // Every request: who made it, on which model, and what it cost.
  on('turn.step', async function* ($, e, next) {
    const now = await $.clock.now()
    if (e.agentId !== undefined) {
      const id = e.agentId
      await ensureRow($, id)
      await update($, agents, rows => rows.map(r => (r.id === id ? { ...r, isBusy: true, status: r.isUnlisted ? r.status : 'running', endedAt: undefined, lastSeenAt: now, requestAt: now } : r)))
    } else {
      await update($, main, m => ({ ...m, lastSeenAt: now, requestAt: now }))
    }
    const step = yield* next(e)
    const usage = step.usage as (Usage & { model?: string }) | null
    const model = usage?.model || e.model
    const spent = stepTokens(usage)
    const after = await $.clock.now()
    if (e.agentId === undefined) {
      await update($, main, m => ({ ...m, model, tokens: m.tokens + spent, lastSeenAt: after, requestAt: undefined }))
    } else {
      const id = e.agentId
      await update($, agents, rows => rows.map(r => (r.id === id ? { ...r, model, tokens: r.tokens + spent, lastSeenAt: after, requestAt: undefined } : r)))
    }
    return step
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const at = await $.clock.now()
    if (e.agentId === undefined) {
      await update($, main, m => ({ ...m, isRunning: false, running: [], requestAt: undefined, lastSeenAt: at }))
      await update($, last, () => `main · ${e.isAborted ? 'stopped' : 'answered'} in ${elapsed(e.durationMs)}`)
    } else {
      const id = e.agentId
      await update($, agents, rows => rows.map(r => (r.id === id ? { ...r, isBusy: false, running: [], requestAt: undefined, endedAt: r.endedAt ?? at, lastSeenAt: at } : r)))
      if (keepLog) await logRun($, id, e.durationMs, e.isAborted).catch(() => undefined)
      await sync($)
      const who = await nameOf($, id)
      await update($, last, () => `${who} · ${e.isAborted ? 'stopped' : 'done'} in ${elapsed(e.durationMs)}`)
    }
    return result
  })

  // Every tool call, by anyone: counted, shown while it runs, kept among the last few.
  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) await ensureRow($, id)
    const label = toolLabel(e.tool, e as unknown as Record<string, unknown>)
    const at = await $.clock.now()
    await touch($, id, a => ({ calls: a.calls + 1, running: [...a.running, { id: e.tool_use_id, tool: e.tool, label, at }], lastSeenAt: at }))
    let isError = true
    try {
      const ran = await next(e)
      isError = ran.deny !== undefined || !!ran.isError
      return ran
    } finally {
      const end = await $.clock.now()
      const rec: ToolRecord = { label, ms: end - at, isError }
      await touch($, id, a => ({ running: a.running.filter(r => r.id !== e.tool_use_id), recent: [...a.recent, rec].slice(-KEEP_RECENT), lastSeenAt: end }))
    }
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError || !ran.result || ran.result.staged) return ran
    await record($, e.agentId, 'Edit', e.file_path, false, ran.result.structuredPatch)
    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError || !ran.result || ran.result.staged) return ran
    const isNew = ran.result.type === 'create'
    const patch: RawHunk[] = ran.result.structuredPatch
    const raw = isNew && patch.length === 0 ? creation(e.content) : patch
    if (raw.length > 0) await record($, e.agentId, 'Write', e.file_path, isNew, raw)
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const v = await read($, view)
    // the flow view does not depend on the diff atom, so only the diffs view reads it
    const [m, rows, lastText, all] = await Promise.all([read($, main), read($, agents), read($, last), v.mode === 'diffs' ? read($, changes) : Promise.resolve([]), read($, tick)])
    const now = await $.clock.now()
    const setView = (change: Partial<FlowView>) => update($, view, old => ({ ...old, ...change }))

    if (v.mode === 'diffs') {
      const list = changesOf(all, v.agent)
      const at = list.length === 0 ? -1 : v.pos === null ? list.length - 1 : Math.min(Math.max(v.pos, 0), list.length - 1)
      const c = at >= 0 ? list[at] : undefined
      const row = rows.find(r => r.id === v.agent)
      const title = v.agent === 'main' ? 'main_Diff · main' : `sub_Diff · ${row?.type ?? 'subagent'}${row?.task ? ` "${row.task}"` : ''}`
      const diff = c ? render(c.hunks, v.expanded ? null : COLLAPSED_LINES) : null
      const hidden = c && diff ? lineCount(c.hunks) - diff.shown : 0
      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" gap={1}>
            <Button key="back" hotkey="b" label="◀ Flow" onPress={() => setView({ mode: 'flow' })} />
            <Text bold wrap="truncate">{title}</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Button key="prev" hotkey="h" label="◀" onPress={() => setView({ pos: Math.max(0, at - 1), expanded: false })} />
            <Text>{list.length === 0 ? '0 / 0' : `${at + 1} / ${list.length}`}</Text>
            <Button key="next" hotkey="l" label="▶" onPress={() => setView({ pos: at + 1 >= list.length - 1 ? null : at + 1, expanded: false })} />
          </Box>
          {!c || !diff ? (
            <Text dimColor>No changes by this agent yet.</Text>
          ) : (
            <Box flexDirection="column">
              <Text bold wrap="truncate-start">📄 {shortPath(c.path)}{c.isNew ? ' (new file)' : ''}</Text>
              <Box flexDirection="row">
                <Text color="green">+{c.added}</Text>
                <Text> </Text>
                <Text color="red">-{c.removed}</Text>
                <Text dimColor> · {clockTime(c.at)}</Text>
              </Box>
              {diff.source === '' ? <Text dimColor>(no diff to show)</Text> : <Code source={diff.source} format="diff" path={c.path} wrap="truncate-end" />}
              {c.totalLines > lineCount(c.hunks) ? <Text dimColor>(long change: only the first {lineCount(c.hunks)} lines were kept)</Text> : null}
              {hidden > 0 || v.expanded ? (
                <Button key="expand" hotkey="v" label={v.expanded ? '⤡ Collapse' : `⤢ Show all (+${hidden} lines)`} onPress={() => setView({ pos: at, expanded: !v.expanded })} />
              ) : null}
            </Box>
          )}
        </Box>
      )
    }

    const listed = rows.filter(r => !r.isUnlisted)
    const unlisted = rows.filter(r => r.isUnlisted)

    // the [+] details under a row: model, prompt excerpt, last tool calls
    const details = (key: string, model: string | null, prompt: string | undefined, recent: readonly ToolRecord[], indent: string) => (
      <Box key={`open-${key}`} flexDirection="column">
        <Text dimColor wrap="truncate">{`${indent}  model ${model ?? '?'}`}</Text>
        {prompt ? <Text dimColor wrap="truncate">{`${indent}  prompt "${prompt.replace(/\s+/g, ' ')}"`}</Text> : null}
        {recent.length === 0 ? <Text dimColor>{`${indent}  no tool calls yet`}</Text> : null}
        {recent.map((t, i) => (
          <Text key={`rec-${key}-${i}`} dimColor wrap="truncate" color={t.isError ? 'red' : undefined}>{`${indent}  · ${t.label} ${elapsed(t.ms)}`}</Text>
        ))}
      </Box>
    )

    const agentRow = (row: AgentRow, prefix: string, indent: string) => {
      const active = isWorking(row)
      const color = active ? 'yellow' : row.status === 'failed' || row.status === 'killed' ? 'red' : row.status === 'completed' ? 'green' : 'gray'
      const d = doing(row, active, now, limits)
      const isOpen = v.open.includes(row.id)
      return (
        <Box key={`wrap-${row.id}`} flexDirection="column">
          <Box key={`agent-${row.id}`} flexDirection="row" gap={1}>
            <Text dimColor>{prefix}</Text>
            <Text color={color}>●</Text>
            <Box flexShrink={1}>
              <Text wrap="truncate" dimColor={!active}>{`${row.type}${row.task ? ` "${row.task}"` : ''}`}</Text>
            </Box>
            <Box flexDirection="row" gap={1} flexShrink={0}>
              <Text wrap="truncate" color={isCapped(row.model) ? 'magenta' : undefined} bold={isCapped(row.model)}>{short(row.model)}</Text>
              <Text wrap="truncate" dimColor>{active ? elapsed(now - row.startedAt) : elapsed((row.endedAt ?? now) - row.startedAt)}</Text>
              <Text wrap="truncate">{`${fmt(row.tokens)} tok`}</Text>
              <Text wrap="truncate">{`×${row.calls}`}</Text>
              <Text wrap="truncate">{`✎${row.edits}`}</Text>
              {row.edits > 0 ? <Button key={`diff-${row.id}`} plain label="[sub_Diff]" onPress={() => openDiffs($, row.id)} /> : null}
              <Button key={`more-${row.id}`} plain label={isOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, row.id)} />
            </Box>
            {d.now ? <Box flexShrink={1}><Text wrap="truncate" color={d.isWaiting ? undefined : 'cyan'} dimColor={d.isWaiting}>{d.now}</Text></Box> : null}
            {d.thinking ? <Text dimColor>{d.thinking}</Text> : null}
            {d.warn ? <Text color={d.level === 'alert' ? 'red' : 'yellow'} bold>{d.warn}</Text> : null}
          </Box>
          {isOpen ? details(row.id, row.model, row.prompt, row.recent, indent) : null}
        </Box>
      )
    }

    const md = doing(m, m.isRunning, now, limits)
    const mainOpen = v.open.includes('main')
    return (
      <Box flexDirection="column">
        <Text bold>{headline(listed, m.isRunning)}</Text>
        <Box flexDirection="row" gap={1}>
          <Text color={m.isRunning ? 'yellow' : 'gray'}>●</Text>
          <Text bold>main</Text>
          <Text color={isCapped(m.model) ? 'magenta' : undefined} bold={isCapped(m.model)}>{short(m.model)}</Text>
          <Text dimColor>{m.isRunning ? 'running' : 'idle'}</Text>
          <Text>{`${fmt(m.tokens)} tok`}</Text>
          <Text>{`×${m.calls}`}</Text>
          <Text>{`✎${m.edits}`}</Text>
          {m.edits > 0 ? <Button key="diff-main" plain label="[main_Diff]" onPress={() => openDiffs($, 'main')} /> : null}
          <Button key="more-main" plain label={mainOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'main')} />
          {md.now ? <Box flexShrink={1}><Text wrap="truncate" color={md.isWaiting ? undefined : 'cyan'} dimColor={md.isWaiting}>{md.now}</Text></Box> : null}
          {md.thinking ? <Text dimColor>{md.thinking}</Text> : null}
          {md.warn ? <Text color={md.level === 'alert' ? 'red' : 'yellow'} bold>{md.warn}</Text> : null}
        </Box>
        {mainOpen ? details('main', m.model, undefined, m.recent, '') : null}
        {tree(listed).map(({ row, depth, isLast }) => agentRow(row, `${'  '.repeat(depth)}${isLast ? '└' : '├'}`, '  '.repeat(depth + 1)))}
        {listed.length === 0 ? <Text dimColor>No subagents yet this session.</Text> : null}
        {unlisted.length > 0 ? (
          <Box flexDirection="column">
            <Button key="unlisted" plain label={`${v.showUnlisted ? '▾' : '▸'} unlisted loops (${unlisted.length})`} onPress={() => setView({ showUnlisted: !v.showUnlisted })} />
            {v.showUnlisted ? unlisted.map(row => agentRow(row, '  ·', '    ')) : null}
          </Box>
        ) : null}
        {lastText ? <Text dimColor wrap="truncate">last: {lastText}</Text> : null}
      </Box>
    )
  })
}
