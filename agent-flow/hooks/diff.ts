// agent-flow: diff helpers (shared with change-tutor) — normalise the tools' patches, count changes, and cut a
// display copy whose hunk headers always match their lines (a Code diff that does not
// parse is refused by the engine, so counts are recomputed after every cut).
import type { Hunk } from '../types'

const MAX_CHARS = 9_500 // Code.source holds at most 10 000 characters

const clean = (line: string): string =>
  // Code.source allows tab and newline only among control characters
  line.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')

export type RawHunk = { oldStart: number; newStart: number; lines: string[] }

/** Keep marker lines only, drop "\ No newline" markers, cap the kept lines at `limit`. */
export const normalise = (raw: readonly RawHunk[], limit: number): { hunks: Hunk[]; total: number } => {
  const hunks: Hunk[] = []
  let total = 0
  let kept = 0
  for (const h of raw) {
    const lines = h.lines.filter(l => /^[ +-]/.test(l)).map(clean)
    total += lines.length
    const room = limit - kept
    if (room <= 0) continue
    const taken = lines.slice(0, room)
    kept += taken.length
    if (taken.length > 0) hunks.push({ oldStart: h.oldStart, newStart: h.newStart, lines: taken })
  }
  return { hunks, total }
}

/** A brand-new file as one all-added hunk. */
export const creation = (content: string): RawHunk[] => {
  const lines = content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
  return content === '' ? [] : [{ oldStart: 0, newStart: 1, lines: lines.map(l => `+${l}`) }]
}

export const counts = (raw: readonly RawHunk[]): { added: number; removed: number } => {
  let added = 0
  let removed = 0
  for (const h of raw)
    for (const l of h.lines) {
      if (l.startsWith('+')) added += 1
      else if (l.startsWith('-')) removed += 1
    }
  return { added, removed }
}

const header = (h: Hunk, lines: string[]): string => {
  const oldCount = lines.filter(l => !l.startsWith('+')).length
  const newCount = lines.filter(l => !l.startsWith('-')).length
  // as `diff -u` writes it: an empty side starts at the line before
  const oldStart = oldCount === 0 ? Math.max(0, h.oldStart - 1) : h.oldStart
  const newStart = newCount === 0 ? Math.max(0, h.newStart - 1) : h.newStart
  return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`
}

/** Unified-diff text of at most `maxLines` lines (all when null), each hunk's header recounted. */
export const render = (hunks: readonly Hunk[], maxLines: number | null): { source: string; shown: number } => {
  const out: string[] = []
  let shown = 0
  let chars = 0
  for (const h of hunks) {
    const taken: string[] = []
    for (const l of h.lines) {
      if (maxLines !== null && shown >= maxLines) break
      if (chars + l.length + 40 > MAX_CHARS) break
      taken.push(l)
      shown += 1
      chars += l.length + 1
    }
    if (taken.length === 0) break
    out.push(header(h, taken), ...taken)
    chars += 30
    if (taken.length < h.lines.length) break
  }
  return { source: out.join('\n'), shown }
}

export const lineCount = (hunks: readonly Hunk[]): number => hunks.reduce((n, h) => n + h.lines.length, 0)
