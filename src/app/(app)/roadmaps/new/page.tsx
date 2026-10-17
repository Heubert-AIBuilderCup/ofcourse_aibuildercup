import { notFound, redirect } from 'next/navigation'
import { draftPin } from '@/features/finder/model/compare'
// For its side effect: a finder course resolves as a road course, so a draft can be pinned to one.
import '@/features/finder/server/road-courses'
import { compareOn } from '@/features/finder/switch'
import { getProfile } from '@/features/opening/server/profile'
import { getRoad, RoadBoard, roadRedirect } from '@/features/road'
import { roadmapName, roadNames } from '@/features/roadmaps'
import { createRoadmapAction } from '@/features/roadmaps/actions'
import { getRoadmap } from '@/features/roadmaps/server/roadmaps'
import { roadFor } from '@/features/roads'
import { courseById } from '@/features/roads/data/courses'
import { requireStudent } from '@/shared/lib/auth/session'

/**
 * A new roadmap's draft, `/roadmaps/new?from=<id>`: the source's board on the source's road,
 * drawn only (never opened, never saved), with Your answers open in draft mode on the source's
 * answers; nothing is stored until Create roadmap. A source that is not hers, deleted or unknown
 * is a 404. With `&pin=<courseId>` (Start a new roadmap from it), the road is drawn around that
 * course in its own city and Create pins it; a course that cannot be pinned, or any with the compare
 * switch off, is a 404. A copy of a pinned roadmap keeps its source's pin while that still resolves,
 * as its board draws it; a stale one drafts unpinned (draftPin). Before onboarding is closed, on to
 * where she left off. Without `from`, from scratch: Priya's road emptied (no tiles yet, its cards
 * and copy kept) under no answers, every question open; never onboarding again.
 */
export default async function NewRoadmapPage({ searchParams }: PageProps<'/roadmaps/new'>) {
  const [{ user }, { from, pin }] = await Promise.all([requireStudent(), searchParams])
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
  const pinned = draftPin(
    typeof pin === 'string' ? pin : undefined,
    source.choices.pinned,
    compareOn(process.env),
  )
  if (pinned === null) notFound()

  // Named as her list names the source; drawn around the pin, if there is one.
  const own = roadFor(
    { answers: source.answers, relative: source.relative, pinned: source.choices.pinned },
    process.env,
  )
  const name = roadmapName(source, roadNames(own.road))
  // The course she chose to switch to, asked for by `?pin=`: Create needs no answer changed.
  const around =
    pinned && pinned !== source.choices.pinned ? courseById(pinned.courseId) : undefined
  const { road } =
    pinned === source.choices.pinned
      ? own
      : roadFor({ answers: source.answers, relative: source.relative, pinned }, process.env)

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
      draft={{
        from: { id: source.id, name },
        answers: source.answers,
        ...(pinned && { pinned }),
        ...(around && { around: `${around.name} · ${around.university}` }),
      }}
      createRoadmapAction={createRoadmapAction}
    >
      {null}
    </RoadBoard>
  )
}
