import 'server-only'
import { getDraft, lastOpenedAnswers } from '@/features/roadmaps/server/roadmaps'
import type { StudentProfile } from '../lib/profile-contract'
import { profileFromAnswers } from '../lib/profile-from-answers'

/**
 * The student's profile, or null (ADR-126): from her roadmap opened last (listRoadmaps' order, one
 * row read), else from the one she is answering, else null, so the chips start empty (criterion
 * 84). The name, the argument and the shape (lib/profile-contract.ts) are the contract.
 */
export async function loadStudentProfile(userId: string): Promise<StudentProfile | null> {
  const answers = (await lastOpenedAnswers(userId)) ?? (await getDraft(userId))?.answers
  return answers ? profileFromAnswers(answers) : null
}
