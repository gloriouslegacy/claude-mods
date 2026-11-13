// qcompact confirm steps: idle -> confirm (first press) -> running (second press within CONFIRM_MS),
// confirm -> idle when the window expires, presses ignored while running; plus the button's text and style
// and the toast text.
import type { Action, Phase } from '../types'

/** How long the button waits for the confirming second press, in milliseconds. */
export const CONFIRM_MS = 5000

/** The phase after a press, and what the press asks for. */
export function press(phase: Phase): { phase: Phase; action: Action } {
  if (phase === 'idle') return { phase: 'confirm', action: 'arm' }
  if (phase === 'confirm') return { phase: 'running', action: 'run' }
  return { phase, action: 'none' }
}

/** The phase once the confirm window ran out: back to idle from confirm, unchanged otherwise. */
export function expire(phase: Phase): Phase {
  return phase === 'confirm' ? 'idle' : phase
}

/** Drawn before every label: a clamp (U+1F5DC) and a space. */
const ICON = '\u{1F5DC} '

/** The button's label for a phase. */
export function label(phase: Phase): string {
  if (phase === 'confirm') return `${ICON}[Compact?]`
  if (phase === 'running') return `${ICON}[Compacting…]`
  return `${ICON}[Compact]`
}

/** The label's text style for a phase: cyan bold waiting, yellow bold confirming, dim while compacting. */
export function look(phase: Phase): { bold?: true; color?: 'cyan' | 'yellow'; dimColor?: true } {
  if (phase === 'confirm') return { bold: true, color: 'yellow' }
  if (phase === 'running') return { dimColor: true }
  return { bold: true, color: 'cyan' }
}

/** Longest failure reason shown before it is cut, in code points. */
const REASON_MAX = 200

// C0, DEL, C1, line/paragraph separators, every format character (\p{Cf}: bidi marks, embeddings/overrides/
// isolates, zero-width characters, soft hyphen, invisible operators, BOM, tag characters...) and variation
// selectors: all shown as spaces, one space per code point
const UNSAFE_CHARS = String.raw`\x00-\x1f\x7f-\x9f\u{2028}\u{2029}\p{Cf}\u{fe00}-\u{fe0f}`
const UNSAFE = new RegExp(`[${UNSAFE_CHARS}]`, 'gu')
// a character that stays visible: neither unsafe nor whitespace (\s is exactly what trim removes)
const SHOWN = new RegExp(String.raw`[^\s${UNSAFE_CHARS}]`, 'u')

/**
 * A failure reason safe to show: unsafe characters become spaces, trimmed, cut at REASON_MAX code points (never
 * inside a surrogate pair), 'unknown error' if empty or not a string. Only the head is copied and replaced, so a
 * huge reason costs no more than a short one; the result is the same as replacing and trimming the whole string.
 */
export function cleanReason(reason: unknown): string {
  if (typeof reason !== 'string') return 'unknown error'
  // everything before the first shown character is trimmed away however long it is: skip it
  const start = reason.search(SHOWN)
  if (start < 0) return 'unknown error'
  const rest = reason.slice(start)
  // a code point is at most two code units, so the first REASON_MAX code points end within 2 * REASON_MAX + 1
  // units and come out whole
  const head = Array.from(rest.slice(0, REASON_MAX * 2 + 1)).slice(0, REASON_MAX).join('')
  const flat = head.replace(UNSAFE, ' ')
  // head ends on a code point boundary: shown text after it means more than REASON_MAX code points survive the
  // trim, otherwise all that follows is trimmed away
  return rest.slice(head.length).search(SHOWN) >= 0 ? `${flat} …` : flat.trimEnd()
}

/** The toast shown when the compact rejected. */
export function failure(reason: unknown): string {
  return `Compact failed: ${cleanReason(reason)}`
}
