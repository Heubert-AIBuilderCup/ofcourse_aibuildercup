import { CoinsScreen } from '@/features/opening'
import { saveCoinsAction } from '@/features/opening/actions'
import { getProfile, markStep } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Screen 6, the coins: optional, and always reachable again. Coins she spent show as she left
 * them; "later" starts empty. They never touch her answers or her futures (DS-R7).
 */
export default async function AttentionPage() {
  const { user } = await requireStudent()
  const { coins } = await getProfile(user.id)
  await markStep(user.id, 'attention')

  return (
    <CoinsScreen
      initial={coins?.state === 'spent' ? coins : null}
      saveCoinsAction={saveCoinsAction}
    />
  )
}
