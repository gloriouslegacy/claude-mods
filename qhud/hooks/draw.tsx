// qhud: the lines' render, pure — it takes the components $.ui.resolve(e) gave (ui), the view and the
// style option, and returns the tree; it never touches the host itself.
import type { TcwView, Ui } from '../types'
import { SEP, bandLines, modelBlock, pctText } from './view'
import { leftColor } from './weather'

// Our lines as a tree. style plain (default): bare coloured text; chip: each line on a shaded
// background; box: one rounded frame.
export const drawLines = ({ Box, Text }: Ui, v: TcwView, style: 'chip' | 'box' | 'plain') => {
  const bg = style === 'chip' ? (v.isLight ? '#e8e8e8' : '#3a3a3a') : undefined
  const pad = bg ? ' ' : ''
  const bar = <Text backgroundColor={bg} dimColor>{SEP}</Text>
  const w = v.weather
  const meterTree = w ? (
    <Text backgroundColor={bg}>
      <Text backgroundColor={bg}>CT </Text>
      <Text backgroundColor={bg} color={leftColor(100 - (w.pct ?? 0))} bold>{pctText(w.pct)}</Text>
    </Text>
  ) : null
  const rows = bandLines(v).map(line =>
    line.kind === 'model' ? (
      <Text wrap="truncate" backgroundColor={bg}>
        {pad}
        <Text bold backgroundColor={bg}>{modelBlock(v) ?? ''}</Text>
        {v.git ? (
          <Text backgroundColor={bg} color={v.git.endsWith('✓') ? 'green' : 'yellow'}>
            {modelBlock(v) ? '   ' : ''}
            {v.git}
          </Text>
        ) : null}
        {meterTree ? (
          <Text backgroundColor={bg}>
            {modelBlock(v) || v.git ? '   ' : ''}
            {meterTree}
          </Text>
        ) : null}
        {pad}
      </Text>
    ) : (
      <Text wrap="truncate" backgroundColor={bg}>
        {pad}
        {v.limits.map((l, i) => (
          <Text backgroundColor={bg}>
            {i > 0 ? bar : null}
            {l.name ? <Text backgroundColor={bg}>{l.name} </Text> : null}
            <Text backgroundColor={bg} color={leftColor(l.left)} bold>{l.left}%</Text>
            {l.reset ? <Text backgroundColor={bg}> ({l.reset})</Text> : null}
          </Text>
        ))}
        {v.resume ? (
          <Text backgroundColor={bg}>
            {bar}
            {v.resume}
          </Text>
        ) : null}
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

// Our lines stacked on top of what the engine or other mods render below them (band and bottom layouts).
export const stackLines = (ui: Ui, v: TcwView, style: 'chip' | 'box' | 'plain', below: unknown) => {
  const { Box } = ui
  return (
    <Box flexDirection="column">
      {drawLines(ui, v, style)}
      {below}
    </Box>
  )
}
