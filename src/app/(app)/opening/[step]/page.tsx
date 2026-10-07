import { notFound } from 'next/navigation'
import { OpeningScreen, SCREENS } from '@/features/opening'
import { saveAnswersAction, saveRelativeAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/** Opening screens 1–4, one per step; opening one marks it as where she left off. */
export default async function OpeningPage({ params }: PageProps<'/opening/[step]'>) {
  const { step } = await params
  // Only the four steps; any other segment is not a page.
  const screen = SCREENS.find((s) => s.step === step)
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
