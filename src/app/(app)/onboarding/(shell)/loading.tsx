import { DuckLoader } from '@/features/opening'

/**
 * Shown while an onboarding step loads, inside the shell: the panel stays and the step's column
 * shows the duck. Invisible for the first 400 ms, so short waits show nothing.
 */
export default function Loading() {
  return <DuckLoader />
}
