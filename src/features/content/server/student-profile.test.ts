import { describe, expect, it, mock } from 'bun:test'

mock.module('server-only', () => ({}))
const { loadStudentProfile } = await import('./student-profile')

describe('loadStudentProfile (ADR-126)', () => {
  it('is null until the student slice supplies the body', async () => {
    expect(await loadStudentProfile('user-1')).toBeNull()
  })
})
