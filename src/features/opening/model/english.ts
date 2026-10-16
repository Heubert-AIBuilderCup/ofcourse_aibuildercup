// Her English test as the answer stores it ("IELTS 6.5", "PTE 58", "TOEFL 85"), and the one
// number every comparison reads: the IELTS it stands for. Pure and client-safe, imported by the
// question model, the controls, the answers panel's preview and the roads' conditions.

import type { StoredAnswer } from '@/shared/types/student'

export type EnglishTest = 'IELTS' | 'PTE' | 'TOEFL'
export type EnglishScore = { test: EnglishTest; score: number }

export const ENGLISH_TESTS: readonly EnglishTest[] = ['IELTS', 'PTE', 'TOEFL']

/** What each test is called on screen. */
export const ENGLISH_TEST_NAMES: Readonly<Record<EnglishTest, string>> = {
  IELTS: 'IELTS',
  PTE: 'PTE Academic',
  TOEFL: 'TOEFL iBT',
}

/** The scores each test can give, and the step between two of them. */
export const ENGLISH_RANGES: Readonly<
  Record<EnglishTest, { min: number; max: number; step: number }>
> = {
  IELTS: { min: 4, max: 9, step: 0.5 },
  PTE: { min: 10, max: 90, step: 1 },
  TOEFL: { min: 0, max: 120, step: 1 },
}

/** The stored form: "IELTS 6.5", "IELTS 7.0", "PTE 58". */
export function formatEnglish(test: EnglishTest, score: number): string {
  return `${test} ${test === 'IELTS' ? score.toFixed(1) : score}`
}

const inRange = (test: EnglishTest, score: number): boolean => {
  const { min, max, step } = ENGLISH_RANGES[test]
  return score >= min && score <= max && Number.isInteger(score / step)
}

const STORED = /^(IELTS|PTE|TOEFL) (\d{1,3}(?:\.\d)?)$/
/** The one legacy option that carries a suffix. */
const LEGACY = 'IELTS 7.5 or more'

/**
 * A stored English answer as its test and score: the exact forms, and the legacy option "IELTS 7.5
 * or more" as IELTS 7.5. Null for anything else: a score outside the test's range or off its step,
 * a form that is not the stored one ("IELTS 6", "ielts 6.5"), "Not taken yet".
 */
export function parseEnglish(value: unknown): EnglishScore | null {
  if (typeof value !== 'string') return null
  if (value === LEGACY) return { test: 'IELTS', score: 7.5 }
  const match = STORED.exec(value)
  if (!match) return null
  const test = match[1] as EnglishTest
  const score = Number(match[2])
  return inRange(test, score) && formatEnglish(test, score) === value ? { test, score } : null
}

/**
 * The stored answer for a score she typed under a test, or null when it is not a score of that
 * test ("7" under IELTS is "IELTS 7.0").
 */
export function exactScore(test: EnglishTest, typed: string): string | null {
  const text = typed.trim()
  if (!/^\d{1,3}(\.\d)?$/.test(text)) return null
  const score = Number(text)
  return inRange(test, score) ? formatEnglish(test, score) : null
}

/** What to tell her when a typed score is not one of the test's. */
export function englishError(test: EnglishTest): string {
  const { min, max } = ENGLISH_RANGES[test]
  if (test === 'IELTS') {
    return `Enter an IELTS score from ${min.toFixed(1)} to ${max.toFixed(1)}, in steps of 0.5.`
  }
  return `Enter a ${ENGLISH_TEST_NAMES[test]} score from ${min} to ${max}.`
}

/**
 * MOCK concordance, not a published one: from each score up, the IELTS overall it stands for. A
 * score between two rows takes the lower row's IELTS value. The pairs from 5.5 to 8.0 are pinned
 * by the tests; the rows around them only complete the table.
 */
const MOCK_IELTS_FROM: Readonly<Record<'PTE' | 'TOEFL', readonly (readonly [number, number])[]>> = {
  PTE: [
    [10, 4],
    [30, 5],
    [36, 5.5],
    [46, 6],
    [56, 6.5],
    [66, 7],
    [76, 7.5],
    [84, 8],
    [87, 8.5],
    [90, 9],
  ],
  TOEFL: [
    [0, 4],
    [35, 5],
    [46, 5.5],
    [60, 6],
    [79, 6.5],
    [94, 7],
    [102, 7.5],
    [110, 8],
    [114, 8.5],
    [118, 9],
  ],
}

/** The overall IELTS her score stands for: itself for IELTS, the mock table's for PTE and TOEFL. */
export function ieltsEquivalent({ test, score }: EnglishScore): number {
  if (test === 'IELTS') return score
  let ielts = MOCK_IELTS_FROM[test][0][1]
  for (const [from, value] of MOCK_IELTS_FROM[test]) if (score >= from) ielts = value
  return ielts
}

/** What the English test's "Not taken yet" stores. */
export const NOT_TAKEN = 'Not taken yet'

/**
 * Her English answer against the score a course asks for: met, not met, or null when she has said
 * nothing she can be held to ("Not sure" stores an assumed answer, which decides nothing). The one
 * comparison: the course card's condition and the answers panel's preview both read it.
 */
export function englishMeets(eng: StoredAnswer | undefined, required: number): boolean | null {
  if (!eng || eng.state === 'assumed') return null
  if (eng.value === NOT_TAKEN) return false
  const english = parseEnglish(eng.value)
  return english === null ? null : ieltsEquivalent(english) >= required
}
