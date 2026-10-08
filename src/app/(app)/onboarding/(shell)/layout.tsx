import { OnboardingShell } from '@/features/opening'

/**
 * The onboarding steps' one page: the steel panel beside the step. The (app) layout above already
 * requires a student. A layout persists across its pages, so moving between steps keeps the panel
 * as it is instead of replaying its entrance.
 */
export default function OnboardingLayout({ children }: LayoutProps<'/onboarding'>) {
  return <OnboardingShell>{children}</OnboardingShell>
}
