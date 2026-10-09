import { notFound } from 'next/navigation'
import { OpeningScreen, SCREENS } from '@/features/opening'
import { saveAnswersAction, saveRelativeAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding steps 03–04 (/onboarding/living, /after), outside the onboarding shell for now;
 * opening one marks it as where she left off.
 */
export default async function OpeningPage({ params }: PageProps<'/onboarding/[step]'>) {
  const { step } = await params
  // Only these two; steps 00 to 02 (character, facts, study) are pages of their own.
  const screen = SCREENS.find((s) => s.step === step && (s.step === 'living' || s.step === 'after'))
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
