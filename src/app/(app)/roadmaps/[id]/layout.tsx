import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'
import { getProfile } from '@/features/opening/server/profile'
import { getRoad, RoadBoard, roadRedirect } from '@/features/road'
import { roadmapName, roadNames } from '@/features/roadmaps'
import { saveChoicesAction } from '@/features/roadmaps/actions'
import { getRoadmap, touchOpened } from '@/features/roadmaps/server/roadmaps'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * One of her roadmaps' board, once onboarding is closed; before that, on to where she left off. A
 * roadmap that is not hers, deleted or unknown is a 404. The board renders here once, so it stays
 * mounted (camera, session) across the board, its lesson and its route steps; those pages only
 * choose what its card column shows. It opens on the roadmap's stored choices, with the first
 * arrival when she has never opened it; that she opened it is recorded after the response. Its
 * name is resolved as the list resolves it: hers, else from where she is on its road.
 */
export default async function RoadmapLayout({ children, params }: LayoutProps<'/roadmaps/[id]'>) {
  const [{ user }, { id }] = await Promise.all([requireStudent(), params])
  const [profile, roadmap] = await Promise.all([getProfile(user.id), getRoadmap(user.id, id)])
  const to = roadRedirect(profile)
  if (to) redirect(to)
  if (!roadmap) notFound()

  after(() => touchOpened(user.id, id))

  const road = getRoad()
  const name = roadmapName(roadmap, roadNames(road))

  return (
    <RoadBoard
      road={road}
      roadmap={{
        id,
        name,
        choices: roadmap.choices,
        firstVisit: roadmap.lastOpenedAt === null,
      }}
      saveChoicesAction={saveChoicesAction}
    >
      {children}
    </RoadBoard>
  )
}
