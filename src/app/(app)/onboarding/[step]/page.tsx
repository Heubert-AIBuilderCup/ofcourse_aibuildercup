import { notFound } from 'next/navigation'
import { OpeningScreen, SCREENS } from '@/features/opening'
import { saveAnswersAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding step 04 (/onboarding/after), outside the onboarding shell for now; opening it marks
 * it as where she left off.
 */
export default async function OpeningPage({ params }: PageProps<'/onboarding/[step]'>) {
  const { step } = await params
  // Only this one; steps 00 to 03 (character, facts, study, living) are pages of their own.
  const screen = SCREENS.find((s) => s.step === step && s.step === 'after')
  if (!screen) notFound()
  const { user } = await requireStudent()
  const [profile] = await Promise.all([getProfile(user.id), markStep(user.id, screen.step)])

  return (
    <OpeningScreen
      key={screen.step}
      screen={screen}
      answers={profile.answers}
      saveAnswersAction={saveAnswersAction}
    />
  )
}
