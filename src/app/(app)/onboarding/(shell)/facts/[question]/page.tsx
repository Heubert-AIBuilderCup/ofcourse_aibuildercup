import { notFound } from 'next/navigation'
import { factKey, QuestionScreen } from '@/features/opening'
import { saveAnswersAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding step 01, "Facts about you": one question per screen, named by its slug
 * (/onboarding/facts/who-pays). Opening it marks the step as where she left off; a slug that names
 * no question is not a page. Moving between questions changes only the URL (QuestionScreen), so this
 * page renders once per visit to the step.
 */
export default async function FactQuestionPage({
  params,
}: PageProps<'/onboarding/facts/[question]'>) {
  const { question } = await params
  if (!factKey(question)) notFound()
  const { user } = await requireStudent()
  const [profile] = await Promise.all([getProfile(user.id), markStep(user.id, 'facts')])

  return (
    <QuestionScreen step={1} relative={profile.relative} saveAnswersAction={saveAnswersAction} />
  )
}
