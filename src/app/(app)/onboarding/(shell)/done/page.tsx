import { redirect } from 'next/navigation'
import { ATTENTION_PATH, DoneScreen } from '@/features/opening'
import { finishOnboardingAction } from '@/features/opening/actions'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * The end of onboarding, once her coins are stored (placed, or left for later); before that,
 * step 05. It stays open after she goes to her road, for now; moving it into (locked) locks it.
 */
export default async function DonePage() {
  const { user } = await requireStudent()
  const { coins } = await getProfile(user.id)
  if (coins === null) redirect(ATTENTION_PATH)

  return (
    <DoneScreen spent={coins.state === 'spent'} finishOnboardingAction={finishOnboardingAction} />
  )
}
