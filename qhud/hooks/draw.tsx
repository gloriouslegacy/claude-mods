// qhud: the lines' render, pure — it takes the components $.ui.resolve(e) gave (ui), the view and the
// style option, and returns the tree; it never touches the host itself.
import type { TcwView, Ui } from '../types'
import { SEP, bandLines, modelBlock, pctText } from './view'
import { leftColor } from './weather'

// Each part of the view as one coloured piece; band, bottom and compact share them, so a part keeps its colour everywhere.
const pieces = ({ Text }: Ui, v: TcwView, bg?: string) => ({
  model: modelBlock(v) ? <Text bold backgroundColor={bg}>{modelBlock(v)}</Text> : null,
  git: v.git ? <Text backgroundColor={bg} color={v.git.endsWith('✓') ? 'green' : 'yellow'}>{v.git}</Text> : null,
  meter: v.weather ? (
    <Text backgroundColor={bg} color={leftColor(100 - (v.weather.pct ?? 0))} bold>{pctText(v.weather.pct)}</Text>
  ) : null,
  limits: v.limits.map(l => (
    <Text backgroundColor={bg}>
      {l.name ? <Text backgroundColor={bg}>{l.name} </Text> : null}
      <Text backgroundColor={bg} color={leftColor(l.left)} bold>{l.left}%</Text>
      {l.reset ? <Text backgroundColor={bg}> ({l.reset})</Text> : null}
    </Text>
  )),
  resume: v.resume ? <Text backgroundColor={bg}>{v.resume}</Text> : null,
})

// The pieces present, a dim SEP between them.
const joined = ({ Text }: Ui, parts: (JSX.Element | null)[], bg?: string) =>
  parts.filter(Boolean).map((p, i) => (
    <Text backgroundColor={bg}>
      {i > 0 ? <Text backgroundColor={bg} dimColor>{SEP}</Text> : null}
      {p}
    </Text>
  ))

// Our lines as a tree. style plain (default): bare coloured text; chip: each line on a shaded
// background; box: one rounded frame.
export const drawLines = (ui: Ui, v: TcwView, style: 'chip' | 'box' | 'plain') => {
  const { Box, Text } = ui
  const bg = style === 'chip' ? (v.isLight ? '#e8e8e8' : '#3a3a3a') : undefined
  const pad = bg ? ' ' : ''
  const p = pieces(ui, v, bg)
  const rows = bandLines(v).map(line =>
    line.kind === 'model' ? (
      <Text wrap="truncate" backgroundColor={bg}>
        {pad}
        {p.model}
        {p.model && p.git ? '   ' : ''}
        {p.git}
        {(p.model || p.git) && p.meter ? '   ' : ''}
        {p.meter}
        {pad}
      </Text>
    ) : (
      <Text wrap="truncate" backgroundColor={bg}>
        {pad}
        {joined(ui, [...p.limits, p.resume], bg)}
        {pad}
      </Text>
    ),
  )
  return style === 'box' ? (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} alignSelf="flex-start">
      {rows}
    </Box>
  ) : style === 'chip' ? (
    <Box flexDirection="column" alignItems="flex-start" rowGap={0}>
      {rows}
    </Box>
  ) : (
    <Box flexDirection="column">{rows}</Box>
  )
}

// The compact layout: oneLine's text in one plain line, coloured piece by piece as band and bottom are;
// left to the host's wrapping when wider than the terminal (never cut).
export const drawLine = (ui: Ui, v: TcwView) => {
  const { Text } = ui
  const p = pieces(ui, v)
  return <Text>{joined(ui, [p.model, p.git, p.meter, ...p.limits, p.limits.length ? p.resume : null])}</Text>
}

// Our lines stacked on top of what the engine or other mods render below them (band, bottom and, as 'compact', compact layouts).
export const stackLines = (ui: Ui, v: TcwView, style: 'chip' | 'box' | 'plain' | 'compact', below: unknown) => {
  const { Box } = ui
  return (
    <Box flexDirection="column">
      {style === 'compact' ? drawLine(ui, v) : drawLines(ui, v, style)}
      {below}
    </Box>
  )
}
