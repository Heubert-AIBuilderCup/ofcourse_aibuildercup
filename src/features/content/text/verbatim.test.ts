import { describe, expect, it } from 'bun:test'
import { findQuote, normalise } from './verbatim'

describe('normalise', () => {
  it('lower-cases, collapses whitespace and makes quotes and dashes plain', () => {
    expect(normalise('  It’s  a\n“Test” — ok – fine ')).toBe('it\'s a "test" - ok - fine')
  })
})

describe('findQuote', () => {
  const paragraph = 'Students said: “We  work   long hours” and left. Rates fell.'

  it('matches across curly quotes and doubled spaces and returns original offsets', () => {
    const found = findQuote('"we work long hours"', paragraph)
    expect(found).not.toBeNull()
    expect(paragraph.slice(found?.start, found?.end)).toBe('“We  work   long hours”')
  })

  it('matches a plain-dash quote against a typographic dash', () => {
    const text = 'Pay rose 5 – then fell.'
    const found = findQuote('rose 5 - then', text)
    expect(text.slice(found?.start, found?.end)).toBe('rose 5 – then')
  })

  it('returns null for words that are not there', () => {
    expect(findQuote('rates doubled', paragraph)).toBeNull()
  })

  it('returns null for an empty quote', () => {
    expect(findQuote('   ', paragraph)).toBeNull()
  })
})
