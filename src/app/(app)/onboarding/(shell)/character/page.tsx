import { PictureQuestion } from '@/features/opening'
import { savePersonaAction } from '@/features/opening/actions'
import { getProfile } from '@/features/opening/server/profile'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * Onboarding step 00, "Your comic character": a new student lands here (landingPath) and comes
 * back with Back from screen 1, her saved answer shown; Start or Skip goes on to screen 1. The
 * greeting uses the first word of her name; an email-code sign-in has none.
 */
export default async function PicturePage() {
  const { user } = await requireStudent()
  const { persona } = await getProfile(user.id)

  const firstName = user.name.trim().split(/\s+/)[0]

  return (
    <PictureQuestion
      savePersonaAction={savePersonaAction}
      firstName={firstName}
      persona={persona}
    />
  )
}
