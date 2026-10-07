import { redirect } from 'next/navigation'
import { Hero, PictureQuestion } from '@/features/opening'
import { savePersonaAction } from '@/features/opening/actions'
import { getProfile } from '@/features/opening/server/profile'
import { HOME_PATH } from '@/shared/lib/auth/gate'
import { requireStudent } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'

/**
 * "How should we picture you?", asked once: answered, she goes on through the student home. The
 * band is the sign-in page's, so the picture question reads as the sign-up's last step.
 */
export default async function PicturePage() {
  const { user } = await requireStudent()
  const { persona } = await getProfile(user.id)
  if (persona !== null) redirect(HOME_PATH)

  return (
    // The container the phone layout (@max-[35rem]) queries; a query styles only its children.
    <div className="@container">
      <Hero
        overline={SITE_NAME}
        title="From off course to “Of Course!”"
        sub="One account, so your answers are kept. Two taps, then we start."
      />
      <div className="max-w-md px-gutter py-section @max-[35rem]:px-5 @max-[35rem]:py-6">
        <PictureQuestion savePersonaAction={savePersonaAction} />
      </div>
    </div>
  )
}
