import { redirect } from 'next/navigation'
import { firstOpenQuestion, questionPath } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Step 02 with no question named: on to her first unanswered one among those asked for her
 * answers (the last when all are).
 */
export default async function StudyPage() {
  const { user } = await requireStudent()
  const { answers } = await getProfile(user.id)
  redirect(questionPath(2, firstOpenQuestion(2, answers)))
}
