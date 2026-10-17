// The judges' accounts: the shared admin judge sees the content sections and never an admin's,
// every judge account is marked by its domain, and a student judge lands on her roadmap, or on
// the welcome to start from the beginning.

import { describe, expect, test } from 'bun:test'
import { sectionsFor } from '@/features/admin/lib/nav'
import {
  canManageModels,
  canManageRoles,
  canSeeBoard,
  canUseAdmin,
  isStudent,
  surfaceSessionError,
} from '@/shared/lib/auth/access'
import { adminHome } from '@/shared/lib/auth/gate'
import {
  isJudgeEmail,
  JUDGE_ADMIN,
  judgeStudentEmail,
  judgeStudentLanding,
  judgeStudentName,
} from './accounts'

describe('the admin judge', () => {
  const account = JUDGE_ADMIN.grants

  test('is one shared account, a user with the editor and reviewer capabilities', () => {
    expect(JUDGE_ADMIN.email).toBe('judge-admin@judges.ofcourse.app')
    expect(JUDGE_ADMIN.name).toBe('Judge (admin)')
    expect(account).toEqual({ role: 'user', editor: true, reviewer: true })
  })

  test('sees Board, Comic gaps, Updates, Ideas and Insights, and lands on the Board', () => {
    expect(sectionsFor(account).map((s) => s.label)).toEqual([
      'Board',
      'Comic gaps',
      'Updates',
      'Ideas',
      'Insights',
    ])
    expect(adminHome(account)).toBe('/admin/board')
    expect(canSeeBoard(account)).toBe(true)
    expect(surfaceSessionError('admin', account.role, account)).toBe(null)
  })

  test('can never reach Users or Models, nor change roles', () => {
    // /admin/users and /admin/models are behind requireAdmin (canUseAdmin).
    expect(canUseAdmin(account.role)).toBe(false)
    expect(canManageModels(account.role)).toBe(false)
    expect(canManageRoles(account.role)).toBe(false)
  })

  test('is no student, so the student page refuses it', () => {
    expect(isStudent(account)).toBe(false)
  })
})

describe('the student judges', () => {
  test('each gets an address of its own under the judges’ domain', () => {
    const a = judgeStudentEmail()
    const b = judgeStudentEmail()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^judge-[a-z0-9]{10}@judges\.ofcourse\.app$/)
  })

  test('is named after the story, or as a new student', () => {
    expect(judgeStudentName('Priya')).toBe('Judge · Priya')
    expect(judgeStudentName(null)).toBe('Judge · New student')
  })

  test('lands on the story’s roadmap, or on the welcome to start from the beginning', () => {
    expect(judgeStudentLanding('rm-1')).toBe('/roadmaps/rm-1')
    expect(judgeStudentLanding(null)).toBe('/onboarding/welcome')
  })
})

describe('isJudgeEmail', () => {
  test('marks the judges’ accounts by their domain, and nobody else', () => {
    expect(isJudgeEmail(JUDGE_ADMIN.email)).toBe(true)
    expect(isJudgeEmail(judgeStudentEmail())).toBe(true)
    expect(isJudgeEmail('JUDGE-ADMIN@Judges.OfCourse.app')).toBe(true)
    expect(isJudgeEmail('someone@ofcourse.app')).toBe(false)
    expect(isJudgeEmail('judge@judges.ofcourse.app.evil.test')).toBe(false)
    expect(isJudgeEmail('judge@notjudges.ofcourse.app')).toBe(false)
  })
})
