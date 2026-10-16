import { notFound } from 'next/navigation'
import { QuestionScreen, questionBySlug } from '@/features/opening'
import { saveAnswersAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { englishScores } from '@/features/roads'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding step 02, "What you'd study": one question per screen, named by its slug
 * (/onboarding/study/field). Opening it marks the step as where she left off; a slug that names
 * no question is not a page. A question not asked for her answers (the field without "Something
 * particular") is judged by QuestionScreen with the answers on screen, not here: the server may not
 * have her last tap yet, and a `router.refresh()` in that window must not send her back (the
 * provider keeps her taps); a hard reload before the 300 ms save lands still opens her first open
 * question. Moving between questions changes only the URL (QuestionScreen), so this page renders
 * once per visit to the step.
 */
export default async function StudyQuestionPage({
  params,
}: PageProps<'/onboarding/study/[question]'>) {
  const { question } = await params
  if (!questionBySlug(2, question)) notFound()
  const { user } = await requireStudent()
  const [profile] = await Promise.all([getProfile(user.id), markStep(user.id, 'study')])

  return (
    <QuestionScreen
      step={2}
      relative={profile.relative}
      saveAnswersAction={saveAnswersAction}
      englishScores={englishScores()}
    />
  )
}
