// qcompact tests: the confirm steps (idle -> confirm -> running, expiry, presses ignored while running) and button/toast text.
import { expect, test } from 'claude-code/testing'

import { CONFIRM_MS, expire, failure, label, press } from '../hooks/confirm'

test('the confirm window lasts five seconds', () => {
  expect(CONFIRM_MS).toBe(5000)
})

test('a press arms from idle, runs from confirm and is ignored while running', () => {
  expect(press('idle')).toEqual({ phase: 'confirm', action: 'arm' })
  expect(press('confirm')).toEqual({ phase: 'running', action: 'run' })
  expect(press('running')).toEqual({ phase: 'running', action: 'none' })
})

test('two presses in a row go idle -> confirm -> running, a third does nothing', () => {
  const first = press('idle')
  const second = press(first.phase)
  const third = press(second.phase)
  expect([first.action, second.action, third.action]).toEqual(['arm', 'run', 'none'])
  expect(third.phase).toBe('running')
})

test('expiry returns confirm to idle and leaves other phases alone', () => {
  expect(expire('confirm')).toBe('idle')
  expect(expire('idle')).toBe('idle')
  expect(expire('running')).toBe('running')
})

test('a press after expiry arms again instead of running', () => {
  expect(press(expire(press('idle').phase))).toEqual({ phase: 'confirm', action: 'arm' })
})

test('the button label follows the phase', () => {
  expect(label('idle')).toBe('[Compact]')
  expect(label('confirm')).toBe('[Compact?]')
  expect(label('running')).toBe('[Compacting…]')
})

test('the failure toast names the reason', () => {
  expect(failure('context too short')).toBe('Compact failed: context too short')
})

test('the failure reason turns control characters into spaces', () => {
  expect(failure('bad\x1b[31m\nline\x00end\x7f!')).toBe('Compact failed: bad [31m line end !')
})

test('a failure reason over 200 characters is cut with an ellipsis', () => {
  expect(failure('x'.repeat(200))).toBe(`Compact failed: ${'x'.repeat(200)}`)
  expect(failure('y'.repeat(201))).toBe(`Compact failed: ${'y'.repeat(200)} …`)
})

test('an empty failure reason reads as unknown error', () => {
  expect(failure('')).toBe('Compact failed: unknown error')
  expect(failure('\n\t ')).toBe('Compact failed: unknown error')
})

test('the failure reason turns C1, line separators and bidi controls into spaces', () => {
  expect(failure('a\x85b\x9bc')).toBe('Compact failed: a b c')
  expect(failure('a\u{2028}b\u{2029}c')).toBe('Compact failed: a b c')
  expect(failure('a\u{202a}b\u{202e}c\u{2066}d\u{2069}e')).toBe('Compact failed: a b c d e')
})

test('a cut never splits a surrogate pair', () => {
  const emoji = '\u{1F600}' // two UTF-16 units, one code point
  expect(failure(`${'x'.repeat(199)}${emoji}`)).toBe(`Compact failed: ${'x'.repeat(199)}${emoji}`)
  expect(failure(`${'x'.repeat(199)}${emoji}z`)).toBe(`Compact failed: ${'x'.repeat(199)}${emoji} …`)
  expect(failure(emoji.repeat(201))).toBe(`Compact failed: ${emoji.repeat(200)} …`)
})

test('a failure reason that is not a string reads as unknown error', () => {
  expect(failure(undefined)).toBe('Compact failed: unknown error')
  expect(failure(42)).toBe('Compact failed: unknown error')
  expect(failure({ toString: () => 'evil\x1b' })).toBe('Compact failed: unknown error')
})
