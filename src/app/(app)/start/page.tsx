import { redirect } from 'next/navigation'
import { landingPath } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/** Where a signed-in student lands: on to the screen she left, or the first she has not seen. */
export default async function StartPage() {
  const { user } = await requireStudent()
  const profile = await getProfile(user.id)
  redirect(landingPath(profile))
}
