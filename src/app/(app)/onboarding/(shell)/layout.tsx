import { OnboardingShell } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * The onboarding steps' one page: the steel panel beside the step. The (app) layout above already
 * requires a student. A layout persists across its pages, so moving between steps keeps the panel
 * as it is instead of replaying its entrance, and reads her answers (the roadmap she is answering)
 * once per load: the shell holds them from there, for the panel and the screen to share as she
 * taps. The lock (closed once she has finished one and is answering none) is the (locked) group's
 * layout, inside this one.
 */
export default async function OnboardingLayout({ children }: LayoutProps<'/onboarding'>) {
  const { user } = await requireStudent()
  const { answers } = await getProfile(user.id)
  return <OnboardingShell answers={answers}>{children}</OnboardingShell>
}
