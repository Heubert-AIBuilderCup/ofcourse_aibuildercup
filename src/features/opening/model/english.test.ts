import { describe, expect, it } from 'bun:test'
import {
  ENGLISH_RANGES,
  englishError,
  exactScore,
  formatEnglish,
  ieltsEquivalent,
  parseEnglish,
} from './english'

describe('parseEnglish', () => {
  it('reads each test’s stored form', () => {
    expect(parseEnglish('IELTS 6.5')).toEqual({ test: 'IELTS', score: 6.5 })
    expect(parseEnglish('PTE 58')).toEqual({ test: 'PTE', score: 58 })
    expect(parseEnglish('TOEFL 85')).toEqual({ test: 'TOEFL', score: 85 })
  })

  it('reads the legacy option "IELTS 7.5 or more" as IELTS 7.5', () => {
    expect(parseEnglish('IELTS 7.5 or more')).toEqual({ test: 'IELTS', score: 7.5 })
  })

  it('refuses a score outside the test’s range or off its step, and anything else', () => {
    for (const value of [
      'IELTS 6.3',
      'IELTS 9.5',
      'PTE 9',
      'PTE 91',
      'PTE 58.5',
      'TOEFL 121',
      'IELTS 6',
      'IELTS 06.5',
      'IELTS 6.5 or more',
      'Not taken yet',
      'Unknown',
      'ielts 6.5',
      '',
    ]) {
      expect(parseEnglish(value)).toBeNull()
    }
    expect(parseEnglish(6.5)).toBeNull()
    expect(parseEnglish(['IELTS 6.5'])).toBeNull()
  })
})

describe('formatEnglish', () => {
  it('gives the stored form', () => {
    expect(formatEnglish('IELTS', 6.5)).toBe('IELTS 6.5')
    expect(formatEnglish('IELTS', 7)).toBe('IELTS 7.0')
    expect(formatEnglish('PTE', 58)).toBe('PTE 58')
    expect(formatEnglish('TOEFL', 85)).toBe('TOEFL 85')
  })
})

describe('ieltsEquivalent', () => {
  it('is the score itself for IELTS', () => {
    expect(ieltsEquivalent({ test: 'IELTS', score: 6.5 })).toBe(6.5)
  })

  it('reads PTE and TOEFL through the mock concordance at its pinned pairs', () => {
    const pte = [
      [36, 5.5],
      [46, 6],
      [56, 6.5],
      [66, 7],
      [76, 7.5],
      [84, 8],
    ]
    const toefl = [
      [46, 5.5],
      [60, 6],
      [79, 6.5],
      [94, 7],
      [102, 7.5],
      [110, 8],
    ]
    for (const [score, ielts] of pte) expect(ieltsEquivalent({ test: 'PTE', score })).toBe(ielts)
    for (const [score, ielts] of toefl)
      expect(ieltsEquivalent({ test: 'TOEFL', score })).toBe(ielts)
  })

  it('takes the lower IELTS value between two pairs', () => {
    expect(ieltsEquivalent({ test: 'PTE', score: 58 })).toBe(6.5)
    expect(ieltsEquivalent({ test: 'PTE', score: 65 })).toBe(6.5)
    expect(ieltsEquivalent({ test: 'TOEFL', score: 93 })).toBe(6.5)
    expect(ieltsEquivalent({ test: 'TOEFL', score: 85 })).toBe(6.5)
  })

  it('gives every score in a test’s range a value', () => {
    for (const test of ['PTE', 'TOEFL'] as const) {
      const { min, max } = ENGLISH_RANGES[test]
      for (let score = min; score <= max; score++) {
        expect(ieltsEquivalent({ test, score })).toBeGreaterThanOrEqual(4)
      }
    }
  })
})

describe('ENGLISH_RANGES and englishError', () => {
  it('gives each test its range and step', () => {
    expect(ENGLISH_RANGES.IELTS).toEqual({ min: 4, max: 9, step: 0.5 })
    expect(ENGLISH_RANGES.PTE).toEqual({ min: 10, max: 90, step: 1 })
    expect(ENGLISH_RANGES.TOEFL).toEqual({ min: 0, max: 120, step: 1 })
  })

  it('names the range when a score is outside it', () => {
    expect(englishError('PTE')).toBe('Enter a PTE Academic score from 10 to 90.')
    expect(englishError('TOEFL')).toBe('Enter a TOEFL iBT score from 0 to 120.')
    expect(englishError('IELTS')).toBe('Enter an IELTS score from 4.0 to 9.0, in steps of 0.5.')
  })
})

describe('exactScore', () => {
  it('stores what she typed for a test when it is a valid score', () => {
    expect(exactScore('PTE', '58')).toBe('PTE 58')
    expect(exactScore('PTE', ' 58 ')).toBe('PTE 58')
    expect(exactScore('IELTS', '7')).toBe('IELTS 7.0')
    expect(exactScore('IELTS', '6.5')).toBe('IELTS 6.5')
    expect(exactScore('TOEFL', '85')).toBe('TOEFL 85')
  })

  it('is null for a score outside the range, off the step, or not a number', () => {
    for (const [test, typed] of [
      ['PTE', '95'],
      ['PTE', '5'],
      ['PTE', '58.5'],
      ['IELTS', '6.3'],
      ['TOEFL', '121'],
      ['PTE', ''],
      ['PTE', 'abc'],
      ['PTE', '5e1'],
      ['PTE', '-58'],
    ] as const) {
      expect(exactScore(test, typed)).toBeNull()
    }
  })
})
