import { describe, expect, it } from 'bun:test'
import { compareOn, courseDetailOn, finderOn } from './switch'

describe('the finder switches', () => {
  it('are off unless set to 1', () => {
    expect(finderOn({})).toBe(false)
    expect(courseDetailOn({ COURSE_DETAIL_ON: 'true' })).toBe(false)
    expect(compareOn({ COMPARE_ON: '1' })).toBe(true)
  })
  it('keeps the finder off while the student AI is off (one switch turns every student model call off)', () => {
    expect(finderOn({ FINDER_ON: '1' })).toBe(true)
    expect(finderOn({ FINDER_ON: '1', STUDENT_AI_OFF: '1' })).toBe(false)
  })
})
