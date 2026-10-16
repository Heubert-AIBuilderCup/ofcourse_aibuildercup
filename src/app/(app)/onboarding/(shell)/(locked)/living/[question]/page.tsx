import { notFound } from 'next/navigation'
import { QuestionScreen, questionBySlug } from '@/features/opening'
import {
  readOwnWordsAction,
  saveAnswersAction,
  saveRelativeAction,
} from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { englishScores, studentAiOff } from '@/features/roads'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding step 03, "Where and how you'd live": one question per screen, named by its slug
 * (/onboarding/living/who-and-where). Opening it marks the step as where she left off; a slug that
 * names no question is not a page. As step 02's page: which questions are asked is judged by
 * QuestionScreen with the answers on screen, and moving between questions changes only the URL,
 * so this page renders once per visit to the step. Her person is passed as stored; the screen
 * holds it from there.
 */
export default async function LivingQuestionPage({
  params,
}: PageProps<'/onboarding/living/[question]'>) {
  const { question } = await params
  if (!questionBySlug(3, question)) notFound()
  const { user } = await requireStudent()
  const [profile] = await Promise.all([getProfile(user.id), markStep(user.id, 'living')])

  return (
    <QuestionScreen
      step={3}
      relative={profile.relative}
      saveAnswersAction={saveAnswersAction}
      saveRelativeAction={saveRelativeAction}
      englishScores={englishScores()}
      // The student AI switched off: no own-words box (criterion 81).
      readOwnWordsAction={studentAiOff(process.env) ? undefined : readOwnWordsAction}
    />
  )
}
