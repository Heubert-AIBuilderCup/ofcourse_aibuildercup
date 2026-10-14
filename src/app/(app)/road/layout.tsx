import { redirect } from 'next/navigation'
import { getProfile } from '@/features/opening/server/profile'
import { getRoad, RoadBoard, roadRedirect } from '@/features/road'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * "Your road", for a student who has finished onboarding; before that, on to where she left off.
 * The board renders here once, so it stays mounted (camera, session) across /road, its lesson and
 * its route steps; those pages only choose what its card column shows.
 */
export default async function RoadLayout({ children }: LayoutProps<'/road'>) {
  const { user } = await requireStudent()
  const to = roadRedirect(await getProfile(user.id))
  if (to) redirect(to)

  return <RoadBoard road={getRoad()}>{children}</RoadBoard>
}
