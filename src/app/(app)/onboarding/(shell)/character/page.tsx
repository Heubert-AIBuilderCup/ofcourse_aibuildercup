import { PictureQuestion } from '@/features/opening'
import { savePersonaAction } from '@/features/opening/actions'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding step 00, "Your comic character": reached from the welcome's Start (and with Back
 * from screen 1), her saved answer shown; Start or Skip goes on to screen 1.
 */
export default async function PicturePage() {
  const { user } = await requireStudent()
  const { persona } = await getProfile(user.id)

  return <PictureQuestion savePersonaAction={savePersonaAction} persona={persona} />
}
