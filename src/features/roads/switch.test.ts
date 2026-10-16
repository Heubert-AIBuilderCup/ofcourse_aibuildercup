// The student AI switch (criterion 81): only STUDENT_AI_OFF=1 turns the student model calls off.

import { describe, expect, it } from 'bun:test'
import { studentAiOff } from './switch'

describe('studentAiOff', () => {
  it('is on only for STUDENT_AI_OFF=1', () => {
    expect(studentAiOff({ STUDENT_AI_OFF: '1' })).toBe(true)
    for (const value of [undefined, '', '0', 'true', 'yes', ' 1']) {
      expect(studentAiOff({ STUDENT_AI_OFF: value })).toBe(false)
    }
    expect(studentAiOff({})).toBe(false)
  })
})
