import { onboardingResumePath } from '@/features/opening'
import { ROADMAPS_PATH } from '@/shared/lib/student-paths'

/**
 * Who may open a roadmap's board: null once onboarding is closed (she has finished a roadmap and
 * is answering none; onboarding then resumes on her roadmaps), else the onboarding screen she left
 * ("You're all set" once her coins are stored), where the board sends her instead.
 */
export function roadRedirect(profile: Parameters<typeof onboardingResumePath>[0]): string | null {
  const resume = onboardingResumePath(profile)
  return resume === ROADMAPS_PATH ? null : resume
}
