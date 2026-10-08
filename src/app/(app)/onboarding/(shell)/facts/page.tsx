import { redirect } from 'next/navigation'
import { factPath, firstUnanswered } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/** Step 01 with no question named: on to her first unanswered one (the last when all are). */
export default async function FactsPage() {
  const { user } = await requireStudent()
  const { answers } = await getProfile(user.id)
  redirect(factPath(firstUnanswered(answers)))
}
