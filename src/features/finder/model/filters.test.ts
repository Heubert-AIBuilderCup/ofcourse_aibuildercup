import { describe, expect, test } from 'bun:test'
import { cityById } from '@/features/engine/catalogue'
import type { StoredAnswers } from '@/shared/types/student'
import { failedFilters } from './filters'

const course = { level: "Master's" as const, feeK: 30, cityId: 'sydney' }
const stated = (value: string | number) => ({ value, state: 'stated' as const })
const assumed = (value: string | number) => ({ value, state: 'assumed' as const })

describe('failedFilters', () => {
  test('level: a stated Bachelor’s fails a Diploma and passes a Master’s', () => {
    const answers: StoredAnswers = { qual: stated("Bachelor's") }
    expect(failedFilters(answers, { ...course, level: 'Diploma' })).toEqual(['level'])
    expect(failedFilters(answers, course)).toEqual([])
  })

  test('level: with no qualification, nothing fails level', () => {
    expect(failedFilters({}, { ...course, level: 'Diploma' })).toEqual([])
    expect(failedFilters({ qual: assumed("Bachelor's") }, { ...course, level: 'Diploma' })).toEqual(
      [],
    )
  })

  test('fee, fees only: over the amount fails, at the amount passes', () => {
    const answers: StoredAnswers = { amount: stated(30), covers: stated('Fees only') }
    expect(failedFilters(answers, { ...course, feeK: 32 })).toEqual(['fee'])
    expect(failedFilters(answers, { ...course, feeK: 30 })).toEqual([])
  })

  test('fee, fees and living: the city’s living cost counts against the amount', () => {
    const answers: StoredAnswers = { amount: stated(30), covers: stated('Fees and living') }
    const living = cityById('perth').livingK
    expect(12 + living).toBeGreaterThan(30)
    expect(failedFilters(answers, { ...course, feeK: 12, cityId: 'perth' })).toEqual(['fee'])
    expect(failedFilters(answers, { ...course, feeK: 30 - living, cityId: 'perth' })).toEqual([])
  })

  test('fee: an assumed amount never fails', () => {
    const answers: StoredAnswers = { amount: assumed(24), covers: stated('Fees only') }
    expect(failedFilters(answers, { ...course, feeK: 60 })).toEqual([])
  })

  test('destination: Australia or Open to others never fails', () => {
    for (const dest of ['Australia', 'Open to others'])
      expect(failedFilters({ dest: stated(dest) }, course)).toEqual([])
  })

  test('every failing rule is named', () => {
    const answers: StoredAnswers = {
      qual: stated("Bachelor's"),
      amount: stated(24),
      covers: stated('Fees only'),
    }
    expect(failedFilters(answers, { ...course, level: 'Diploma', feeK: 40 })).toEqual([
      'level',
      'fee',
    ])
  })
})
