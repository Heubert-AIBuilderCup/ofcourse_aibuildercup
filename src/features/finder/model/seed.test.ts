// What the Find box starts with (criterion 2): her study-step tags and her stated field or areas,
// never her raw own words, which can hold what she feels (the privacy page promises those never
// reach the models that write explanations), and never a wellbeing tag.

import { describe, expect, it } from 'bun:test'
import type { RoadmapTag, StoredAnswers } from '@/shared/types/student'
import { finderSeedText } from './seed'

const tag = (quote: string, over: Partial<RoadmapTag> = {}): RoadmapTag => ({
  text: `Tag for ${quote}`,
  quote,
  step: 'study',
  wellbeing: false,
  ...over,
})

describe('finderSeedText', () => {
  it('joins her study-step quotes and her stated areas', () => {
    const answers: StoredAnswers = { areas: { value: ['Health', 'Design'], state: 'stated' } }
    expect(finderSeedText({ answers, tags: [tag('I like people'), tag('I like puzzles')] })).toBe(
      "I like people. I like puzzles. I'm drawn to Health and Design.",
    )
  })

  it('names three areas as a list', () => {
    const answers: StoredAnswers = {
      areas: { value: ['Data', 'Health', 'Design'], state: 'stated' },
    }
    expect(finderSeedText({ answers, tags: [] })).toBe("I'm drawn to Data, Health and Design.")
  })

  it('ends a quote that already ends in a stop with only that stop', () => {
    expect(
      finderSeedText({ answers: {}, tags: [tag('I like people!'), tag('I like puzzles.')] }),
    ).toBe('I like people! I like puzzles.')
  })

  it('never gives a wellbeing tag', () => {
    const tags = [tag('I like puzzles'), tag('I get anxious in crowds', { wellbeing: true })]
    expect(finderSeedText({ answers: {}, tags })).toBe('I like puzzles.')
  })

  it('never gives a tag from another step', () => {
    const tags = [
      tag('I like puzzles'),
      tag('near the beach', { step: 'living' }),
      tag('my family pays', { step: 'facts' }),
      tag('I want to stay', { step: 'after' }),
    ]
    expect(finderSeedText({ answers: {}, tags })).toBe('I like puzzles.')
  })

  it('names a stated field', () => {
    const answers: StoredAnswers = { field: { value: 'Data science', state: 'stated' } }
    expect(finderSeedText({ answers, tags: [] })).toBe("I'm drawn to Data science.")
  })

  it("adds nothing for the field's default or an assumed answer", () => {
    expect(
      finderSeedText({ answers: { field: { value: 'Any', state: 'stated' } }, tags: [] }),
    ).toBe('')
    expect(
      finderSeedText({ answers: { field: { value: 'Any', state: 'assumed' } }, tags: [] }),
    ).toBe('')
    expect(
      finderSeedText({ answers: { areas: { value: ['Health'], state: 'assumed' } }, tags: [] }),
    ).toBe('')
  })

  it('gives nothing when she said nothing', () => {
    expect(finderSeedText({ answers: {}, tags: [] })).toBe('')
    expect(finderSeedText({ answers: { areas: { value: [], state: 'stated' } }, tags: [] })).toBe(
      '',
    )
  })
})
