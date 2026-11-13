// qcompact confirm steps: idle -> confirm (first press) -> running (second press within CONFIRM_MS),
// confirm -> idle when the window expires, presses ignored while running; plus the button and toast text.
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

/** The button's label for a phase. */
export function label(phase: Phase): string {
  if (phase === 'confirm') return '[Compact?]'
  if (phase === 'running') return '[Compacting…]'
  return '[Compact]'
}

/** Longest failure reason shown before it is cut, in code points. */
const REASON_MAX = 200

// C0, DEL, C1, line/paragraph separators and bidi embeddings/overrides/isolates: all shown as spaces
const UNSAFE = /[\x00-\x1f\x7f-\x9f\u{2028}\u{2029}\u{202a}-\u{202e}\u{2066}-\u{2069}]/gu

/**
 * A failure reason safe to show: unsafe characters become spaces, cut at REASON_MAX code points (never inside a
 * surrogate pair), 'unknown error' if empty or not a string.
 */
export function cleanReason(reason: unknown): string {
  const flat = typeof reason === 'string' ? reason.replace(UNSAFE, ' ').trim() : ''
  if (!flat) return 'unknown error'
  const chars = Array.from(flat)
  return chars.length > REASON_MAX ? `${chars.slice(0, REASON_MAX).join('')} …` : flat
}

/** The toast shown when the compact rejected. */
export function failure(reason: unknown): string {
  return `Compact failed: ${cleanReason(reason)}`
}
