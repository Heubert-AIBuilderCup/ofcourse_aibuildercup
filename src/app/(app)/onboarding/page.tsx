import { redirect } from 'next/navigation'
import { onboardingResumePath } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/** Onboarding with no step named: on to where she left off (onboardingResumePath). */
export default async function OnboardingPage() {
  const { user } = await requireStudent()
  redirect(onboardingResumePath(await getProfile(user.id)))
}
