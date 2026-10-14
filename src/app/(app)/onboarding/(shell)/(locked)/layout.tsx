import { RedirectType, redirect } from 'next/navigation'
import { ROAD_PATH } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Once she has pressed "Go to your road" onboarding is locked: every step sends her to her road.
 * For now "You're all set" (/onboarding/done) sits outside this group and stays open; moving
 * done/ in here locks it too. A replace, said outright: this layout can re-render inside that
 * press's own response (its refresh), where a redirect would otherwise push.
 */
export default async function LockedOnboardingLayout({ children }: LayoutProps<'/onboarding'>) {
  const { user } = await requireStudent()
  const { onboardedAt } = await getProfile(user.id)
  if (onboardedAt !== null) redirect(ROAD_PATH, RedirectType.replace)
  return children
}
