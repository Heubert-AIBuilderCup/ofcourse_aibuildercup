import { RedirectType, redirect } from 'next/navigation'
import { ATTENTION_PATH, DoneScreen, onboardingClosed } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { finishOnboardingAction, refreshAfterOnboardingAction } from '@/features/roadmaps/actions'
import { requireStudent } from '@/shared/lib/auth/session'
import { ROADMAPS_PATH } from '@/shared/lib/student-paths'

/**
 * The end of onboarding, once the coins of the roadmap she is answering are stored (placed, or
 * left for later); before that, step 05. Once she has finished it (and is answering none), her
 * roadmaps: a replace, as this page re-renders inside the finishing press's own response.
 */
export default async function DonePage() {
  const { user } = await requireStudent()
  const profile = await getProfile(user.id)
  if (onboardingClosed(profile)) redirect(ROADMAPS_PATH, RedirectType.replace)
  const { coins } = profile
  if (coins === null) redirect(ATTENTION_PATH)

  return (
    <DoneScreen
      spent={coins.state === 'spent'}
      finished={profile.finished}
      finishOnboardingAction={finishOnboardingAction}
      refreshAfterOnboardingAction={refreshAfterOnboardingAction}
    />
  )
}
