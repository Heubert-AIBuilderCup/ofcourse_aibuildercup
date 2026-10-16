// The judges' accounts: ordinary rows, marked only by their email domain, so the admin's Users and
// Insights can tell them apart. One shared admin judge, a user with the editor and reviewer
// capabilities (never admin, never superadmin: no Users, no Models); a fresh student for every
// student sign-in, so judges never share state. Pure.

import { WELCOME_PATH } from '@/features/opening/model/onboarding'
import { roadmapPath } from '@/shared/lib/student-paths'

/** Every judge account's email domain. */
export const JUDGE_DOMAIN = 'judges.ofcourse.app'

/** The one admin judge account, created on first use, and what it may do. */
export const JUDGE_ADMIN = {
  email: `judge-admin@${JUDGE_DOMAIN}`,
  name: 'Judge (admin)',
  grants: { role: 'user', editor: true, reviewer: true },
} as const

/**
 * A new student judge's address: `judge-<10 random hex characters>@judges.ofcourse.app`, from Web
 * Crypto, so this module stays loadable in the browser (the dialog reads FRESH_START from it).
 */
export function judgeStudentEmail(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `judge-${id}@${JUDGE_DOMAIN}`
}

/** "Judge · Priya", or "Judge · New student" for one starting from the beginning. */
export const judgeStudentName = (storyName: string | null): string =>
  `Judge · ${storyName ?? 'New student'}`

/** Where a student judge lands: the story's roadmap, else onboarding's welcome. */
export const judgeStudentLanding = (roadmapId: string | null): string =>
  roadmapId === null ? WELCOME_PATH : roadmapPath(roadmapId)

/** Whether an address is a judge's: the judges' domain, exactly. */
export const isJudgeEmail = (email: string): boolean =>
  email.trim().toLowerCase().endsWith(`@${JUDGE_DOMAIN}`)

/** The student form's choice for a new student with no story, who starts from the beginning. */
export const FRESH_START = 'fresh'
