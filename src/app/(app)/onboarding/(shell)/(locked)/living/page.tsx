import { redirect } from 'next/navigation'
import { firstOpenQuestion, questionPath } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Step 03 with no question named: on to her first unanswered one among those asked for her
 * answers (her person counts once stored), else Climate.
 */
export default async function LivingPage() {
  const { user } = await requireStudent()
  const { answers, relative } = await getProfile(user.id)
  redirect(questionPath(3, firstOpenQuestion(3, answers, relative)))
}
