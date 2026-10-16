import { RedirectType, redirect } from 'next/navigation'
import { onboardingClosed } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'
import { ROADMAPS_PATH } from '@/shared/lib/student-paths'

/**
 * Onboarding is open while a roadmap is being answered (or before her first): once she has
 * finished one and is answering none, every step sends her to her roadmaps. "You're all set"
 * (/onboarding/done) sits outside this group and closes by its own rule. A replace, said
 * outright: this layout can re-render inside the finishing press's own response (its refresh),
 * where a redirect would otherwise push.
 */
export default async function LockedOnboardingLayout({ children }: LayoutProps<'/onboarding'>) {
  const { user } = await requireStudent()
  if (onboardingClosed(await getProfile(user.id))) redirect(ROADMAPS_PATH, RedirectType.replace)
  return children
}
