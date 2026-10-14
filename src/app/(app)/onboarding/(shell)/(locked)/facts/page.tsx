import { redirect } from 'next/navigation'
import { firstOpenQuestion, questionPath } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/** Step 01 with no question named: on to her first unanswered one (the last when all are). */
export default async function FactsPage() {
  const { user } = await requireStudent()
  const { answers } = await getProfile(user.id)
  redirect(questionPath(1, firstOpenQuestion(1, answers)))
}
