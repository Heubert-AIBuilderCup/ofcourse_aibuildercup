import { describe, expect, it } from 'bun:test'
import { statesClaim } from './statement'

// Which title sentences make a claim (criterion 96): one with a verb or a number is checked
// against the article; a short label is not a claim at all.

describe('statesClaim (96)', () => {
  it('is true for a sentence with a verb, in any of its forms', () => {
    for (const title of [
      'Joining a sports club improves grades',
      'Student rents rise again in two cities',
      'Student visa decisions are getting faster',
      'Rents rose in Sydney',
      'Part-time work has helped first-year students',
      'Sleep can make a difference',
    ]) {
      expect(statesClaim(title), title).toBe(true)
    }
  })

  it('is true for a sentence with a number, verb or not', () => {
    expect(statesClaim('Night shifts cut student sleep by 40 percent')).toBe(true)
    expect(statesClaim('Two in three students')).toBe(true)
    expect(statesClaim('AUD 499 a week')).toBe(true)
  })

  it('is false for a label: no verb, no number', () => {
    for (const title of [
      'Test Feed',
      'Paid work and grades',
      'Hours of paid work and first-year results',
      'A new night bus route for the north campus',
      'Books and movies',
    ]) {
      expect(statesClaim(title), title).toBe(false)
    }
  })
})
