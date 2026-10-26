// The search's word-count floor, with no database: text of fewer than FINDER_MIN_WORDS content words
// is nothing close before anything is embedded or queried (Nikhil, 17 Oct). The embedding is a spy
// over the real module that refuses, so a search that gets as far as embedding fails loudly here.

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

process.env.AI_PROVIDER = 'fake'
mock.module('server-only', () => ({}))

const realEmbed = { ...(await import('./embed')) }
const embedQuery = mock(realEmbed.embedQuery)
mock.module('./embed', () => ({ ...realEmbed, embedQuery }))

const { fitsBoth, searchCourses, subjectsOf } = await import('./search')
const { DRAWN_TO_AREAS, PARTICULAR } = await import('@/features/opening/model/questions')

beforeEach(() => {
  embedQuery.mockClear()
  embedQuery.mockImplementation(async () => {
    throw new Error('reached the embedding')
  })
})
afterAll(() => {
  embedQuery.mockImplementation(realEmbed.embedQuery)
})

describe('searchCourses', () => {
  test('answers nothing close to fewer than three content words, embedding nothing', async () => {
    for (const text of ['hmm', '...', 'robots puzzles', 'I like the puzzles']) {
      const result = await searchCourses('student-1', text, {})
      expect(`${text}: ${result.kind} ${result.kind === 'nothing-close' ? result.best : ''}`).toBe(
        `${text}: nothing-close 0`,
      )
      expect(result.keyword.length).toBe(0)
    }
    expect(embedQuery).not.toHaveBeenCalled()
  })

  test('searches a sentence of three content words or more, as hers', async () => {
    await expect(searchCourses('student-1', 'robots, puzzles and gardens', {})).rejects.toThrow(
      'reached the embedding',
    )
    expect(embedQuery.mock.calls[0]?.slice(0, 2)).toEqual([
      'student-1',
      'robots, puzzles and gardens',
    ])
  })
})

describe('subjectsOf: a hit’s subjects, and whether it fits two of her interests', () => {
  const CYBER_PSYCH = 'f-master-of-cyber-psychology-utas-sandy-bay'
  const stated = (value: string | string[]) => ({ value, state: 'stated' as const })
  const drawnTo = (areas: string[]) => ({ know: stated(DRAWN_TO_AREAS), areas: stated(areas) })

  test('a catalogue course carries its fields from the extras, primary first', () => {
    expect(subjectsOf(CYBER_PSYCH, 'psych', {}).fields).toEqual(['psych', 'cyber'])
  })

  test('a course outside the catalogue is its own field alone', () => {
    expect(subjectsOf('sd-t-both', 'cyber', {})).toEqual({ fields: ['cyber'], fitsBoth: false })
  })

  test('it fits both when two of her interests each reach one of its fields', () => {
    // IT and computing reaches it and cyber; Psychology reaches psych.
    expect(
      subjectsOf(CYBER_PSYCH, 'psych', drawnTo(['Psychology', 'IT and computing'])).fitsBoth,
    ).toBe(true)
  })

  test('one picked field, no pick, or picks she did not state: it does not fit both', () => {
    expect(subjectsOf(CYBER_PSYCH, 'psych', drawnTo(['Psychology'])).fitsBoth).toBe(false)
    expect(subjectsOf(CYBER_PSYCH, 'psych', drawnTo(['Psychology', 'Business'])).fitsBoth).toBe(
      false,
    )
    expect(subjectsOf(CYBER_PSYCH, 'psych', {}).fitsBoth).toBe(false)
    const assumed = {
      know: { value: DRAWN_TO_AREAS, state: 'assumed' as const },
      areas: { value: ['Psychology', 'IT and computing'], state: 'assumed' as const },
    }
    expect(subjectsOf(CYBER_PSYCH, 'psych', assumed).fitsBoth).toBe(false)
  })

  test('a single-field course never fits both, however many fields she picked', () => {
    expect(
      subjectsOf('sd-t-both', 'cyber', drawnTo(['IT and computing', 'Psychology'])).fitsBoth,
    ).toBe(false)
  })

  test('one area that reaches two of its fields is one interest: it does not fit both', () => {
    // IT and computing reaches it and cyber, but it is a single interest of hers.
    expect(fitsBoth(['it', 'cyber'], drawnTo(['IT and computing']))).toBe(false)
  })

  test('two areas that each reach one of its fields fit both', () => {
    expect(fitsBoth(['psych', 'cyber'], drawnTo(['Psychology', 'IT and computing']))).toBe(true)
  })

  test('a single stated field never fits both', () => {
    const particular = (field: string) => ({ know: stated(PARTICULAR), field: stated(field) })
    expect(fitsBoth(['psych', 'cyber'], particular('Cyber security'))).toBe(false)
    expect(fitsBoth(['it', 'cyber'], particular('Information technology'))).toBe(false)
  })

  test('assumed answers never count', () => {
    const assumed = {
      know: { value: DRAWN_TO_AREAS, state: 'assumed' as const },
      areas: { value: ['Psychology', 'IT and computing'], state: 'assumed' as const },
    }
    expect(fitsBoth(['psych', 'cyber'], assumed)).toBe(false)
    const areasAssumed = {
      know: stated(DRAWN_TO_AREAS),
      areas: { value: ['Psychology', 'IT and computing'], state: 'assumed' as const },
    }
    expect(fitsBoth(['psych', 'cyber'], areasAssumed)).toBe(false)
  })
})
