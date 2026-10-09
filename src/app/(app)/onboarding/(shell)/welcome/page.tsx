import { redirect } from 'next/navigation'
import { onboardingResumePath, WelcomeScreen } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * The welcome before step 00: a new student lands here (landingPath) until she has answered or
 * skipped step 00; after that it sends her on to where onboarding resumes. The greeting uses the
 * first word of her name; an email-code sign-in has none.
 */
export default async function WelcomePage() {
  const { user } = await requireStudent()
  const profile = await getProfile(user.id)
  if (profile.persona !== null) redirect(onboardingResumePath(profile))

  const firstName = user.name.trim().split(/\s+/)[0]

  return <WelcomeScreen firstName={firstName} />
}
