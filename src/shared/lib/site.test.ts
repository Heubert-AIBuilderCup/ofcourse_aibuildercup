import { describe, expect, it } from 'bun:test'
import { formatWhen } from './site'

describe('formatWhen', () => {
  it('formats in the app time zone, the same on server and browser', () => {
    expect(formatWhen('2026-10-04T09:12:00Z')).toBe('4 Oct 2026, 09:12')
  })
})
