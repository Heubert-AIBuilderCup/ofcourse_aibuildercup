import { redirect } from 'next/navigation'
import { firstOpenQuestion, questionPath } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/** Step 04 with no question named: on to her first unanswered one, else long-term. */
export default async function AfterPage() {
  const { user } = await requireStudent()
  const { answers } = await getProfile(user.id)
  redirect(questionPath(4, firstOpenQuestion(4, answers)))
}
