import { AttentionScreen } from '@/features/opening'
import { saveCoinsAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding step 05, "Your attention": optional, and always reachable again. Coins she spent show
 * as she left them; coins left for later start empty. Opening it marks the step as where she left
 * off. Coins never touch her answers or her routes.
 */
export default async function AttentionPage() {
  const { user } = await requireStudent()
  const [{ coins }] = await Promise.all([getProfile(user.id), markStep(user.id, 'attention')])

  return (
    <AttentionScreen
      initial={coins?.state === 'spent' ? coins : null}
      saveCoinsAction={saveCoinsAction}
    />
  )
}
