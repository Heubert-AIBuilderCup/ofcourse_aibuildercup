import 'server-only'
import { getDraft, listRoadmaps } from '@/features/roadmaps/server/roadmaps'
import type { StudentProfile } from '../lib/profile-contract'
import { feedRoadmapOf, profileFromAnswers, profileFromRoadmaps } from '../lib/profile-from-answers'
import type { FeedRoadmap } from '../lib/roadmap-lines'

/** What the feed knows of a student: the profile its chips start from, and her roadmaps. */
export type FeedStudent = { profile: StudentProfile | null; roadmaps: FeedRoadmap[] }

/**
 * The student's profile and her roadmaps as the feed reads them, in one read of her finished
 * roadmaps (listRoadmaps: last opened first, archived ones too, at most its bound): the home
 * country from the one opened last and every destination across them all (profileFromRoadmaps).
 * With none finished, the profile of the one she is answering and no roadmaps; with neither (an
 * admin), no profile, so the chips start empty (criterion 84).
 */
export async function loadFeedStudent(userId: string): Promise<FeedStudent> {
  const finished = await listRoadmaps(userId)
  if (finished.length > 0) {
    return { profile: profileFromRoadmaps(finished), roadmaps: finished.map(feedRoadmapOf) }
  }
  const draft = await getDraft(userId)
  return { profile: draft ? profileFromAnswers(draft.answers) : null, roadmaps: [] }
}

/**
 * The student's profile, or null (ADR-126): loadFeedStudent's. The name, the argument and the
 * shape (lib/profile-contract.ts) are the contract.
 */
export async function loadStudentProfile(userId: string): Promise<StudentProfile | null> {
  return (await loadFeedStudent(userId)).profile
}
