import { describe, expect, it } from 'bun:test'
import { ASK_CASES } from '@/features/roads/evals/ask-cases'
import { OWN_WORDS_CASES } from './own-words-cases'

// The labelled set (criteria 84, 85): the wellbeing and instruction bars judge a case by its
// labelled words, so each label must be words of its text, and the whole set must fit the rerun's
// 50 attempts.

const loose = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()

describe('the own-words cases', () => {
  it('label the words that say how she feels in at least three cases', () => {
    const labelled = OWN_WORDS_CASES.filter((c) => (c.expect.wellbeingWords ?? []).length > 0)
    expect(labelled.length).toBeGreaterThanOrEqual(3)
  })

  it('label the words that tell the model what to do in at least three cases', () => {
    const labelled = OWN_WORDS_CASES.filter((c) => (c.expect.instructionWords ?? []).length > 0)
    expect(labelled.length).toBeGreaterThanOrEqual(3)
  })

  it('label only words of the case text', () => {
    for (const c of OWN_WORDS_CASES) {
      for (const span of [
        ...(c.expect.wellbeingWords ?? []),
        ...(c.expect.instructionWords ?? []),
      ]) {
        expect(loose(c.text)).toContain(loose(span))
      }
    }
  })

  it('fit, with the Ask cases, the rerun of 50 attempts', () => {
    expect(OWN_WORDS_CASES.length).toBeGreaterThanOrEqual(25)
    expect(OWN_WORDS_CASES.length + ASK_CASES.length).toBeLessThanOrEqual(50)
  })
})
