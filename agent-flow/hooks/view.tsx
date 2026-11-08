// agent-flow: the pane's render, pure — it takes the components $.ui.resolve(e) gave (ui), the state and
// the callbacks, and returns the tree; it never touches the host itself. bandView draws the band above the
// prompt: the same headline with [Show]/[Hide] and, unfolded, the rows below with buttons that open the pane.
//   AFlow · main + 2 agents · 2 running · 0 waiting
//   ● main  Fable 5.1  running  38.2k tok  ×14  ✎3  [main_Diff] [+]   Agent "Fix the parser" 41s
//   ├ ● Explore "Summarize src/greet.js"  Haiku 4.5  2s  4.1k tok  ×3  ✎0  [+]
//   └ ● implementer "Fix the parser"  Fable 5.1  41s  22.7k tok  ×9  ✎2  [sub_Diff] [+]   Bash npm test 38s  ⚠ slow 38s
//   ▸ unlisted loops (1)
//   last: implementer · Edit src/parser.ts
import type { AgentRow, Change, FlowView, MainRow, ToolRecord, Ui } from '../types'
import { lineCount, render } from './diff'
import { COLLAPSED_LINES, changesOf, clockTime, doing, elapsed, fmt, headline, isCapped, isWorking, short, shortPath, tree } from './flow'
import type { Doing, Limits } from './flow'

/** What pressing a button does: change the view, open an agent's diffs, open or close a row's [+] details. */
export type Actions = {
  setView: (change: Partial<FlowView>) => Promise<unknown>
  openDiffs: (agent: string) => Promise<unknown>
  toggleOpen: (id: string) => Promise<unknown>
}

/** A row's buttons: the rows opened with [+], the actions and what the button keys start with (the band's
 *  differ from the pane's). Without them a row has no buttons and no details. */
export type RowButtons = { open: readonly string[]; act: Actions; prefix: string }

/** What the flow view draws. */
export type FlowState = { v: FlowView; m: MainRow; rows: readonly AgentRow[]; lastText: string; now: number; limits: Limits }

/** main_Diff / sub_Diff: one agent's changes, one diff at a time. */
export const diffView = ({ Box, Text, Button, Code }: Ui, v: FlowView, all: readonly Change[], rows: readonly AgentRow[], act: Actions) => {
  const { setView } = act
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

/** The [+] details under a row: model, prompt excerpt, last tool calls. */
export const details = ({ Box, Text }: Ui, key: string, model: string | null, prompt: string | undefined, recent: readonly ToolRecord[], indent: string) => (
  <Box key={`open-${key}`} flexDirection="column">
    <Text dimColor wrap="truncate">{`${indent}  model ${model ?? '?'}`}</Text>
    {prompt ? <Text dimColor wrap="truncate">{`${indent}  prompt "${prompt.replace(/\s+/g, ' ')}"`}</Text> : null}
    {recent.length === 0 ? <Text dimColor>{`${indent}  no tool calls yet`}</Text> : null}
    {recent.map((t, i) => (
      <Text key={`rec-${key}-${i}`} dimColor wrap="truncate" color={t.isError ? 'red' : undefined}>{`${indent}  · ${t.label} ${elapsed(t.ms)}`}</Text>
    ))}
  </Box>
)

/** What a row is doing now, its long-request note and its warning. */
export const doingTail = ({ Box, Text }: Ui, d: Doing) => [
  d.now ? <Box key="now" flexShrink={1}><Text wrap="truncate" color={d.isWaiting ? undefined : 'cyan'} dimColor={d.isWaiting}>{d.now}</Text></Box> : null,
  d.thinking ? <Text key="thinking" dimColor>{d.thinking}</Text> : null,
  d.warn ? <Text key="warn" color={d.level === 'alert' ? 'red' : 'yellow'} bold>{d.warn}</Text> : null,
]

/** One subagent's row; with buttons also [sub_Diff], [+] and its details when open. */
export const agentRow = (ui: Ui, row: AgentRow, prefix: string, indent: string, now: number, limits: Limits, btn?: RowButtons) => {
  const { Box, Text, Button } = ui
  const active = isWorking(row)
  const color = active ? 'yellow' : row.status === 'failed' || row.status === 'killed' ? 'red' : row.status === 'completed' ? 'green' : 'gray'
  const d = doing(row, active, now, limits)
  const isOpen = !!btn && btn.open.includes(row.id)
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
          {btn && row.edits > 0 ? <Button key={`${btn.prefix}diff-${row.id}`} plain label="[sub_Diff]" onPress={() => btn.act.openDiffs(row.id)} /> : null}
          {btn ? <Button key={`${btn.prefix}more-${row.id}`} plain label={isOpen ? '[-]' : '[+]'} onPress={() => btn.act.toggleOpen(row.id)} /> : null}
        </Box>
        {doingTail(ui, d)}
      </Box>
      {isOpen ? details(ui, row.id, row.model, row.prompt, row.recent, indent) : null}
    </Box>
  )
}

/** The main loop's row; with buttons also [main_Diff] and [+] (flowView draws its details). */
export const mainRow = (ui: Ui, m: MainRow, now: number, limits: Limits, btn?: RowButtons) => {
  const { Box, Text, Button } = ui
  const md = doing(m, m.isRunning, now, limits)
  const isOpen = !!btn && btn.open.includes('main')
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={m.isRunning ? 'yellow' : 'gray'}>●</Text>
      <Text bold>main</Text>
      <Text color={isCapped(m.model) ? 'magenta' : undefined} bold={isCapped(m.model)}>{short(m.model)}</Text>
      <Text dimColor>{m.isRunning ? 'running' : 'idle'}</Text>
      <Text>{`${fmt(m.tokens)} tok`}</Text>
      <Text>{`×${m.calls}`}</Text>
      <Text>{`✎${m.edits}`}</Text>
      {btn && m.edits > 0 ? <Button key={`${btn.prefix}diff-main`} plain label="[main_Diff]" onPress={() => btn.act.openDiffs('main')} /> : null}
      {btn ? <Button key={`${btn.prefix}more-main`} plain label={isOpen ? '[-]' : '[+]'} onPress={() => btn.act.toggleOpen('main')} /> : null}
      {doingTail(ui, md)}
    </Box>
  )
}

/** The flow view: the headline, main, the subagent tree, the unlisted loops and the last event. */
export const flowView = (ui: Ui, s: FlowState, act: Actions) => {
  const { Box, Text, Button } = ui
  const { v, m, rows, lastText, now, limits } = s
  const listed = rows.filter(r => !r.isUnlisted)
  const unlisted = rows.filter(r => r.isUnlisted)
  const btn: RowButtons = { open: v.open, act, prefix: '' }
  return (
    <Box flexDirection="column">
      <Text bold>{headline(listed, m.isRunning)}</Text>
      {mainRow(ui, m, now, limits, btn)}
      {v.open.includes('main') ? details(ui, 'main', m.model, undefined, m.recent, '') : null}
      {tree(listed).map(({ row, depth, isLast }) => agentRow(ui, row, `${'  '.repeat(depth)}${isLast ? '└' : '├'}`, '  '.repeat(depth + 1), now, limits, btn))}
      {listed.length === 0 ? <Text dimColor>No subagents yet this session.</Text> : null}
      {unlisted.length > 0 ? (
        <Box flexDirection="column">
          <Button key="unlisted" plain label={`${v.showUnlisted ? '▾' : '▸'} unlisted loops (${unlisted.length})`} onPress={() => act.setView({ showUnlisted: !v.showUnlisted })} />
          {v.showUnlisted ? unlisted.map(row => agentRow(ui, row, '  ·', '    ', now, limits, btn)) : null}
        </Box>
      ) : null}
      {lastText ? <Text dimColor wrap="truncate">last: {lastText}</Text> : null}
    </Box>
  )
}

/** What the band above the prompt draws. */
export type BandState = { m: MainRow; rows: readonly AgentRow[]; now: number; limits: Limits }

/** The band above the prompt: the pane's headline with [Show]/[Hide]; unfolded, main and the subagent tree
 *  one line each, as the pane's folded rows with their buttons; the actions show details and diffs in the
 *  pane, never here. Unlisted loops stay in the pane. */
export const bandView = (ui: Ui, s: BandState, columns: number, isFolded: boolean, onFold: () => unknown, act: Actions) => {
  const { Box, Text, Button } = ui
  const { m, rows, now, limits } = s
  const listed = rows.filter(r => !r.isUnlisted)
  const btn: RowButtons = { open: [], act, prefix: 'aflow-' }
  return (
    <Box flexDirection="column" width={columns}>
      <Box flexDirection="row" gap={1}>
        <Box flexShrink={1}>
          <Text bold wrap="truncate">{headline(listed, m.isRunning)}</Text>
        </Box>
        <Button key="aflow-fold" plain label={isFolded ? '[Show]' : '[Hide]'} onPress={onFold} />
      </Box>
      {isFolded ? null : mainRow(ui, m, now, limits, btn)}
      {isFolded ? null : tree(listed).map(({ row, depth, isLast }) => agentRow(ui, row, `${'  '.repeat(depth)}${isLast ? '└' : '├'}`, '  '.repeat(depth + 1), now, limits, btn))}
    </Box>
  )
}
