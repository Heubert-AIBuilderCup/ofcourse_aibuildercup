import { describe, expect, it } from 'bun:test'
import {
  coinsSchema,
  ownWordsSchema,
  type Relative,
  relativeSchema,
  roadmapTagsSchema,
  type StoredAnswers,
  storedAnswersSchema,
} from './student'

describe('storedAnswersSchema', () => {
  it('keeps a valid answer', () => {
    const answers: StoredAnswers = { amount: { value: 36, state: 'stated' } }
    expect(storedAnswersSchema.parse(answers)).toEqual(answers)
  })

  it('drops a key that is not a question, and keeps the rest', () => {
    expect(
      storedAnswersSchema.parse({
        nonsense: { value: 'x', state: 'stated' },
        hard: { value: 'Roughly', state: 'assumed' },
      }),
    ).toEqual({ hard: { value: 'Roughly', state: 'assumed' } })
  })

  it('drops an answer whose state is neither stated nor assumed', () => {
    expect(storedAnswersSchema.parse({ amount: { value: 36, state: 'maybe' } })).toEqual({})
  })
})

describe('coinsSchema', () => {
  const piles = [2, 2, 1, 1, 1, 1, 1, 1]

  it('accepts eight piles summing to ten, none above five', () => {
    expect(coinsSchema.safeParse({ state: 'spent', piles, assumed: false }).success).toBe(true)
    expect(
      coinsSchema.safeParse({ state: 'spent', piles: [5, 5, 0, 0, 0, 0, 0, 0], assumed: true })
        .success,
    ).toBe(true)
  })

  it('accepts coins left for later', () => {
    expect(coinsSchema.safeParse({ state: 'later' }).success).toBe(true)
  })

  it('refuses a pile of six', () => {
    expect(
      coinsSchema.safeParse({ state: 'spent', piles: [6, 4, 0, 0, 0, 0, 0, 0], assumed: false })
        .success,
    ).toBe(false)
  })

  it('refuses piles that sum to nine', () => {
    expect(
      coinsSchema.safeParse({ state: 'spent', piles: [2, 1, 1, 1, 1, 1, 1, 1], assumed: false })
        .success,
    ).toBe(false)
  })

  it('refuses seven piles', () => {
    expect(
      coinsSchema.safeParse({ state: 'spent', piles: [2, 2, 2, 1, 1, 1, 1], assumed: false })
        .success,
    ).toBe(false)
  })
})

describe('relativeSchema', () => {
  const relative: Relative = {
    placeId: 'perth',
    place: 'Perth',
    relationship: 'Cousin',
    name: 'Asha',
  }

  it('trims the place and the name', () => {
    expect(relativeSchema.parse({ ...relative, place: '  Perth ', name: ' Asha  ' })).toEqual(
      relative,
    )
  })

  it('accepts no name, and a place typed in with no place id', () => {
    const typed: Relative = { placeId: null, place: 'Geelong', relationship: 'Friend', name: null }
    expect(relativeSchema.parse(typed)).toEqual(typed)
  })

  it('refuses a relationship outside the list', () => {
    expect(relativeSchema.safeParse({ ...relative, relationship: 'Neighbour' }).success).toBe(false)
  })

  it('refuses an 81-character place', () => {
    expect(relativeSchema.safeParse({ ...relative, place: 'x'.repeat(81) }).success).toBe(false)
    expect(relativeSchema.safeParse({ ...relative, place: 'x'.repeat(80) }).success).toBe(true)
  })

  it('accepts "Somewhere else" with nothing typed, trimmed to empty', () => {
    const blank = { placeId: null, place: '   ', relationship: null, name: null }
    expect(relativeSchema.parse(blank)).toEqual({ ...blank, place: '' })
  })

  it('accepts every part blank', () => {
    const none: Relative = { placeId: null, place: null, relationship: null, name: null }
    expect(relativeSchema.parse(none)).toEqual(none)
  })

  it('refuses a name over forty characters', () => {
    expect(relativeSchema.safeParse({ ...relative, name: 'x'.repeat(41) }).success).toBe(false)
  })
})

describe('ownWordsSchema', () => {
  it('accepts one step, or none', () => {
    expect(ownWordsSchema.safeParse({ facts: 'some text' }).success).toBe(true)
    expect(ownWordsSchema.safeParse({}).success).toBe(true)
  })

  it('rejects a key outside the four steps', () => {
    expect(ownWordsSchema.safeParse({ attention: 'x' }).success).toBe(false)
  })

  it('rejects a value over 1000 characters, and takes exactly 1000', () => {
    expect(ownWordsSchema.safeParse({ study: 'a'.repeat(1001) }).success).toBe(false)
    expect(ownWordsSchema.safeParse({ study: 'a'.repeat(1000) }).success).toBe(true)
  })
})

describe('roadmapTagsSchema', () => {
  const tag = {
    text: 'near the beach',
    quote: 'I want to live near the beach',
    step: 'living',
    wellbeing: false,
  }

  it('accepts a tag', () => {
    expect(roadmapTagsSchema.safeParse([tag]).success).toBe(true)
  })

  it('rejects a text over 80 characters or a quote over 200', () => {
    expect(roadmapTagsSchema.safeParse([{ ...tag, text: 'a'.repeat(81) }]).success).toBe(false)
    expect(roadmapTagsSchema.safeParse([{ ...tag, quote: 'a'.repeat(201) }]).success).toBe(false)
  })

  it('rejects more than 30 tags, and takes 30', () => {
    expect(roadmapTagsSchema.safeParse(Array.from({ length: 31 }, () => tag)).success).toBe(false)
    expect(roadmapTagsSchema.safeParse(Array.from({ length: 30 }, () => tag)).success).toBe(true)
  })
})
