import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/features/opening/server/profile'
import { getRoad, RoadBoard, roadRedirect } from '@/features/road'
import { roadmapName, roadNames } from '@/features/roadmaps'
import { createRoadmapAction } from '@/features/roadmaps/actions'
import { getRoadmap } from '@/features/roadmaps/server/roadmaps'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * A new roadmap's draft, `/roadmaps/new?from=<id>`: the source's board, drawn only (never opened,
 * never saved), with Your answers open in draft mode on the source's answers; nothing is stored
 * until Create roadmap. A source that is not hers, deleted or unknown is a 404. Before onboarding
 * is closed, on to where she left off. Without `from`, from scratch: the empty road (no tiles yet,
 * its cards and copy kept) under no answers, every question open; never onboarding again.
 */
export default async function NewRoadmapPage({ searchParams }: PageProps<'/roadmaps/new'>) {
  const [{ user }, { from }] = await Promise.all([requireStudent(), searchParams])
  const fromId = typeof from === 'string' ? from : null
  const [profile, source] = await Promise.all([
    getProfile(user.id),
    fromId ? getRoadmap(user.id, fromId) : null,
  ])
  const to = roadRedirect(profile)
  if (to) redirect(to)

  if (!fromId) {
    const road = { ...getRoad(), tiles: [] }
    return (
      <RoadBoard
        road={road}
        roadmap={{
          id: 'new',
          name: roadmapName({ name: null }, roadNames(road)),
          choices: {},
          firstVisit: false,
          answers: {},
          relative: null,
        }}
        draft={{ from: null, answers: {} }}
        createRoadmapAction={createRoadmapAction}
      >
        {null}
      </RoadBoard>
    )
  }
  if (!source) notFound()

  const road = getRoad()
  const name = roadmapName(source, roadNames(road))

  return (
    <RoadBoard
      road={road}
      roadmap={{
        id: source.id,
        name,
        choices: source.choices,
        firstVisit: false,
        answers: source.answers,
        relative: source.relative,
      }}
      draft={{ from: { id: source.id, name }, answers: source.answers }}
      createRoadmapAction={createRoadmapAction}
    >
      {null}
    </RoadBoard>
  )
}
