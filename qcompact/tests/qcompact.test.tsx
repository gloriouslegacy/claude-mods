// qcompact tests: the confirm steps (idle -> confirm -> running, expiry, presses ignored while running) and button/toast text.
import { expect, test } from 'claude-code/testing'

import { CONFIRM_MS, expire, failure, label, look, press } from '../hooks/confirm'

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

test('the button label follows the phase, after the clamp icon', () => {
  expect(label('idle')).toBe('\u{1F5DC} [Compact]')
  expect(label('confirm')).toBe('\u{1F5DC} [Compact?]')
  expect(label('running')).toBe('\u{1F5DC} [Compacting…]')
})

test('the button style follows the phase: cyan bold, yellow bold, then dim', () => {
  expect(look('idle')).toEqual({ bold: true, color: 'cyan' })
  expect(look('confirm')).toEqual({ bold: true, color: 'yellow' })
  expect(look('running')).toEqual({ dimColor: true })
})

test('every phase on the way gets its own style', () => {
  const first = press('idle')
  const second = press(first.phase)
  expect([look('idle').color, look(first.phase).color, look(second.phase).dimColor]).toEqual(['cyan', 'yellow', true])
  expect(look(expire(first.phase))).toEqual(look('idle'))
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

test('the failure reason turns bidi marks and zero-width/format characters into spaces', () => {
  expect(failure('a\u{200e}b\u{200f}c\u{061c}d')).toBe('Compact failed: a b c d')
  expect(failure('a\u{200b}b\u{200c}c\u{200d}d\u{2060}e\u{feff}f')).toBe('Compact failed: a b c d e f')
  expect(failure('\u{feff}\u{200b}')).toBe('Compact failed: unknown error')
})

test('a very long failure reason is cut the same way as one just over the limit', () => {
  const emoji = '\u{1F600}'
  expect(failure('z'.repeat(100000))).toBe(`Compact failed: ${'z'.repeat(200)} …`)
  expect(failure(emoji.repeat(100000))).toBe(`Compact failed: ${emoji.repeat(200)} …`)
  expect(failure(`x${emoji.repeat(250)}`)).toBe(`Compact failed: x${emoji.repeat(199)} …`)
  expect(failure(`${'x'.repeat(199)}${emoji}${'y'.repeat(300)}`)).toBe(`Compact failed: ${'x'.repeat(199)}${emoji} …`)
  expect(failure(emoji.repeat(200))).toBe(`Compact failed: ${emoji.repeat(200)}`)
})

test('the host runtime supports Unicode property escapes', () => {
  expect(/^\p{Cf}$/u.test('\u{00ad}')).toBe(true)
  expect(/^\p{Cf}$/u.test('\u{e0041}')).toBe(true)
  expect(/^\p{Cf}$/u.test('a')).toBe(false)
})

test('the failure reason turns format characters, tag characters and variation selectors into spaces', () => {
  expect(failure('a\u{00ad}b\u{e0041}c\u{e007f}d')).toBe('Compact failed: a b c d')
  expect(failure('a\u{2061}b\u{206a}c\u{fff9}d\u{fe00}e\u{fe0f}f')).toBe('Compact failed: a b c d e f')
  expect(failure('\u{e0001}\u{00ad}\u{fe0f}')).toBe('Compact failed: unknown error')
})

test('a huge failure reason with long leading and trailing blank runs gives the same result as trimming it whole', () => {
  const blank = ` \n\x00\u{200b}\u{e0041}`.repeat(50000)
  expect(failure(`${blank}abc${blank}`)).toBe('Compact failed: abc')
  expect(failure(`${blank}${'z'.repeat(300)}`)).toBe(`Compact failed: ${'z'.repeat(200)} …`)
  expect(failure(`${blank}x${' '.repeat(100000)}y`)).toBe(`Compact failed: x${' '.repeat(199)} …`)
  expect(failure(`x${' '.repeat(398)}\u{e0041}${' '.repeat(1000)}`)).toBe('Compact failed: x')
  expect(failure(`${'x'.repeat(199)}\u{e0041}${' '.repeat(1000)}z`)).toBe(`Compact failed: ${'x'.repeat(199)}  …`)
  expect(failure(blank)).toBe('Compact failed: unknown error')
})

test('a failure reason that is not a string reads as unknown error', () => {
  expect(failure(undefined)).toBe('Compact failed: unknown error')
  expect(failure(42)).toBe('Compact failed: unknown error')
  expect(failure({ toString: () => 'evil\x1b' })).toBe('Compact failed: unknown error')
})
