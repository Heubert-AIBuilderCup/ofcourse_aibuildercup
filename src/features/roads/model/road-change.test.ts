import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import { ROAD_CANDIDATES } from '../data/candidates'
import { courseById } from '../data/courses'
import { DEMO_PROFILES } from './demo-profiles'
import { matchRoad } from './match'
import { roadChange } from './road-change'

const { answers, relative } = DEMO_PROFILES[0]
const changed = (key: keyof StoredAnswers, value: string | number | string[]): StoredAnswers => ({
  ...answers,
  [key]: { value, state: 'stated' },
})

describe('roadChange', () => {
  it('names the road her changed answer moves her to', () => {
    expect(roadChange(answers, changed('field', 'Data science'), relative)).toBe(
      'Your road changes to Perth · Master of Data Science · 190.',
    )
  })

  it('names a composed road outside the hand-written six: from Cyber to Health', () => {
    const health = {
      ...changed('know', "A few areas I'm drawn to"),
      areas: { value: ['Health'], state: 'stated' as const },
    }
    expect(roadChange(answers, health, relative)).toBe(
      'Your road changes to Adelaide · Master of Nursing (graduate entry) · 190.',
    )
  })

  it('names the Diploma road a change of level moves her to', () => {
    expect(roadChange(answers, changed('level', 'Diploma'), relative)).toBe(
      'Your road changes to Perth · Diploma of Information Technology (Cyber Security) · no clear PR.',
    )
  })

  it('says nothing when the budget changes: it never moves the road', () => {
    expect(roadChange(answers, changed('amount', 24), relative)).toBeNull()
  })

  it('says nothing when an answer no rule reads changes', () => {
    expect(roadChange(answers, changed('climate', 'Warm'), relative)).toBeNull()
  })

  it('says nothing when a road list leaves none at her level: the matcher throws, the preview does not', () => {
    const mastersOnly = ROAD_CANDIDATES.filter((r) => courseById(r.courseId)?.level === "Master's")
    const school = changed('qual', 'High school')
    expect(matchRoad(answers, relative, mastersOnly).spec).toBeDefined()
    expect(() => matchRoad(school, relative, mastersOnly)).toThrow()
    expect(roadChange(answers, school, relative, mastersOnly)).toBeNull()
    expect(roadChange(school, answers, relative, mastersOnly)).toBeNull()
  })
})
