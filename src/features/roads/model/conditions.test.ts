import { describe, expect, it } from 'bun:test'
import { COURSES } from '@/features/engine/catalogue'
import type { StoredAnswers } from '@/shared/types/student'
import { EXTRA_COURSES } from '../data/courses'
import { entryOf } from '../data/entry'
import { courseConditions } from './conditions'

const eng = (value: string, state: 'stated' | 'assumed' = 'stated'): StoredAnswers => ({
  eng: { value, state },
})
const english = (courseId: string, answers: StoredAnswers) =>
  courseConditions(courseId, answers).find((c) => c.id === 'english')

describe('the English condition of a course', () => {
  // unisa-nursing asks IELTS 7.0
  it('is not met by a lower score', () => {
    expect(english('unisa-nursing', eng('IELTS 6.5'))?.met).toBe(false)
    expect(english('unisa-nursing', eng('IELTS 6.5'))?.explanation).toBe(
      "You have 6.5, so it isn't met yet",
    )
  })

  it('is met by the same score or a higher one', () => {
    expect(english('unisa-nursing', eng('IELTS 7.0'))?.met).toBe(true)
    expect(english('unisa-nursing', eng('IELTS 7.5 or more'))?.met).toBe(true)
    expect(english('unisa-nursing', eng('IELTS 7.5 or more'))?.explanation).toBe(
      'You have 7.5 or more, so it is met',
    )
  })

  it('is not met when the test is not taken yet, and says to take it', () => {
    const c = english('unisa-nursing', eng('Not taken yet'))
    expect(c?.met).toBe(false)
    expect(c?.explanation).toBe('Take the test before you enrol')
  })

  it('is neither met nor not met with no answer, an assumed one or one it cannot read', () => {
    for (const answers of [{}, eng('IELTS 6.0', 'assumed'), eng('Unknown')]) {
      const c = english('unisa-nursing', answers)
      expect(c?.text).toBe('Needs IELTS 7.0')
      expect(c?.met).toBeNull()
      expect(c?.explanation).toBe('Take the test before you enrol')
    }
  })

  // criterion 102: unisa-nursing asks IELTS 7.0; PTE and TOEFL read through the mock table
  it('compares an exact PTE or TOEFL score through its IELTS equivalent and names both', () => {
    const pte = english('unisa-nursing', eng('PTE 58'))
    expect(pte?.met).toBe(false)
    expect(pte?.explanation).toBe(
      'You have PTE 58 (about IELTS 6.5, mock); this course needs IELTS 7.0',
    )
    const toefl = english('unisa-nursing', eng('TOEFL 102'))
    expect(toefl?.met).toBe(true)
    expect(toefl?.explanation).toBe('You have TOEFL 102 (about IELTS 7.5, mock), so it is met')
    expect(english('unisa-nursing', eng('PTE 66'))?.met).toBe(true)
    expect(english('unisa-nursing', eng('PTE 65'))?.met).toBe(false)
  })

  it('reads an exact IELTS score as itself, and an exact one assumed decides nothing', () => {
    expect(english('unisa-nursing', eng('IELTS 5.5'))?.met).toBe(false)
    expect(english('unisa-nursing', eng('IELTS 7.0'))?.met).toBe(true)
    expect(english('unisa-nursing', eng('PTE 58', 'assumed'))?.met).toBeNull()
  })

  it('reads each course’s own score', () => {
    expect(english('ecu-cyber', {})?.text).toBe('Needs IELTS 6.5')
    expect(english('tafe-cyber', eng('IELTS 6.0'))?.met).toBe(true)
  })
})

describe('the entry degree condition', () => {
  it('is on the Master of Engineering, in its field, and not decided by her answers', () => {
    const degree = courseConditions('uts-civil', {}).find((c) => c.id === 'degree')
    expect(degree?.text).toBe('Needs a bachelor’s degree in engineering')
    expect(degree?.met).toBeNull()
  })

  it('is on no course whose entry names no field, Nursing (graduate entry) among them', () => {
    for (const c of [...COURSES, ...EXTRA_COURSES]) {
      const needs = entryOf(c.id)?.needsDegreeIn
      const degree = courseConditions(c.id, {}).find((x) => x.id === 'degree')
      expect(degree !== undefined).toBe(Boolean(needs))
    }
    expect(courseConditions('unisa-nursing', {}).map((c) => c.id)).toEqual(['english'])
  })

  it('gives no condition for a course the catalogue has no entry for', () => {
    expect(courseConditions('no-such-course', {})).toEqual([])
  })
})
