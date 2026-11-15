// pinboard header tests: the board's top line counts open pins as "N pins", "1 pin" for one.
import { expect, test } from 'claude-code/testing'

import { header } from '../hooks/pins'

const pin = { id: 'a', text: 'x', important: false, done: false, at: 0 }

test('the header counts open pins with a unit, singular for one', () => {
  expect(header([pin])).toBe('1 pin')
  expect(header([pin, { ...pin, id: 'b' }])).toBe('2 pins')
  expect(header([pin, { ...pin, id: 'b' }, { ...pin, id: 'c', done: true }])).toBe('2 pins (done 1)')
  expect(header([pin], 3)).toBe('1 pin · » 3')
  expect(header([], 20)).toBe('0 pins · » 20')
  expect(header([{ ...pin, done: true }])).toBe('0 pins (done 1)')
})
