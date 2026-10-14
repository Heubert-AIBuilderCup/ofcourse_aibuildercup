import { onboardingResumePath, ROAD_PATH } from '@/features/opening'

/**
 * Who may open her road: null once she has pressed "Go to your road" (onboarding resumes on the
 * road), else the onboarding screen she left ("You're all set" once her coins are stored), where
 * /road sends her instead.
 */
export function roadRedirect(profile: Parameters<typeof onboardingResumePath>[0]): string | null {
  const resume = onboardingResumePath(profile)
  return resume === ROAD_PATH ? null : resume
}
