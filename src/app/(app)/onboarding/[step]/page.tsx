import { notFound } from 'next/navigation'
import { OpeningScreen, SCREENS } from '@/features/opening'
import { saveAnswersAction, saveRelativeAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding steps 02–04 (/onboarding/study, /living, /after), outside the onboarding shell for
 * now; opening one marks it as where she left off.
 */
export default async function OpeningPage({ params }: PageProps<'/onboarding/[step]'>) {
  const { step } = await params
  // Only these three; step 01 (facts) and step 00 (character) are pages of their own.
  const screen = SCREENS.find((s) => s.step === step && s.step !== 'facts')
  if (!screen) notFound()
  const { user } = await requireStudent()
  const [profile] = await Promise.all([getProfile(user.id), markStep(user.id, screen.step)])

  return (
    <OpeningScreen
      key={screen.step}
      screen={screen}
      answers={profile.answers}
      relative={profile.relative}
      saveAnswersAction={saveAnswersAction}
      saveRelativeAction={saveRelativeAction}
    />
  )
}
