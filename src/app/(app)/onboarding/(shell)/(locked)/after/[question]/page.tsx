import { notFound } from 'next/navigation'
import { QuestionScreen, questionBySlug } from '@/features/opening'
import { readOwnWordsAction, saveAnswersAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { englishScores, studentAiOff } from '@/features/roads'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding step 04, "After you graduate": one question per screen, named by its slug
 * (/onboarding/after/long-term). Opening it marks the step as where she left off; a slug that
 * names no question is not a page. As step 03's page, moving between questions changes only the
 * URL, so this page renders once per visit to the step; step 04 never asks her person.
 */
export default async function AfterQuestionPage({
  params,
}: PageProps<'/onboarding/after/[question]'>) {
  const { question } = await params
  if (!questionBySlug(4, question)) notFound()
  const { user } = await requireStudent()
  const [profile] = await Promise.all([getProfile(user.id), markStep(user.id, 'after')])

  return (
    <QuestionScreen
      step={4}
      relative={profile.relative}
      saveAnswersAction={saveAnswersAction}
      englishScores={englishScores()}
      // The student AI switched off: no own-words box (criterion 81).
      readOwnWordsAction={studentAiOff(process.env) ? undefined : readOwnWordsAction}
    />
  )
}
