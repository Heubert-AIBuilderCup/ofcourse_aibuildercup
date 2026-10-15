import { redirect } from 'next/navigation'
import { AccountMenu, onboardingResumePath } from '@/features/opening'
import { getProfile } from '@/features/opening/server/profile'
import { getRoad } from '@/features/road'
import {
  answerDiffs,
  isNew,
  openedLabel,
  type RoadmapSummary,
  RoadmapsPage,
  roadmapName,
} from '@/features/roadmaps'
import {
  deleteRoadmapAction,
  renameRoadmapAction,
  restoreRoadmapAction,
  startFromScratchAction,
} from '@/features/roadmaps/actions'
import { listRoadmaps } from '@/features/roadmaps/server/roadmaps'
import { Duck } from '@/shared/components/Duck'
import { requireStudent } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'
import type { Roadmap } from '@/shared/types/student'

/** What every card reads from the road (Priya's mock road for now, the same for each roadmap). */
function roadWords() {
  const road = getRoad()
  const tile = (id: string | undefined) => road.tiles.find((t) => t.id === id)
  const here = tile(road.walk.here)
  const course = tile(road.walk.courseStep)
  const pointB = tile(road.walk.ahead.at(-1))
  const city = tile(road.walk.cityLine[0])
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')
  return {
    names: { here: here?.name ?? '', city: city?.name ?? '' },
    // "Master's · ECU · Perth": the study step and where the course is.
    line: join(course?.short ?? course?.name, road.here[road.walk.here]?.sub),
    // "Permanent residency · 2032": the road's last step and when.
    pointB: join(pointB?.name, pointB?.when),
    // "Australia · Perth": the country (where the first arrival stands her) and the city.
    place: join(tile(road.arrival.walk.here)?.name, city?.name),
  }
}

/** Where she stands on its road: 3 at her course, 2 walked back to its city, 1 to her country. */
const hereOf = ({ choices }: Roadmap) => (choices.country ? 1 : choices.city ? 2 : 3)

/**
 * "Your roadmaps", where she lands once she has finished one; before that, on to where she left
 * off. Each card is resolved here, on the server, from her roadmaps (last opened first) and the
 * road; the screen does the rest. `?made=` names the roadmap the loader just made: passed on only
 * when it is one of hers, so its toast never opens anything else.
 */
export default async function RoadmapsRoute({ searchParams }: PageProps<'/roadmaps'>) {
  const { user } = await requireStudent()
  const [profile, roadmaps, { made }] = await Promise.all([
    getProfile(user.id),
    listRoadmaps(user.id),
    searchParams,
  ])
  if (profile.finished === 0) redirect(onboardingResumePath(profile))

  const words = roadWords()
  const now = new Date()
  const byId = new Map(roadmaps.map((r) => [r.id, r]))
  const madeId = typeof made === 'string' && byId.has(made) ? made : null
  const named = new Map(roadmaps.map((r) => [r.id, roadmapName(r, words.names)]))

  const summaries: RoadmapSummary[] = roadmaps.map((r) => {
    // A deleted source is not in the list (only Undo reaches it).
    const source = r.copiedFrom ? byId.get(r.copiedFrom) : undefined
    return {
      id: r.id,
      name: named.get(r.id) ?? '',
      line: words.line,
      pointB: words.pointB,
      place: words.place,
      from:
        r.copiedFrom === null
          ? 'From onboarding'
          : source
            ? `Copy of ${named.get(source.id)}`
            : 'Copy of a roadmap you deleted',
      diffs: answerDiffs(source?.answers ?? null, r.answers),
      openedLabel: openedLabel(r.lastOpenedAt, r.createdAt, now),
      isNew: isNew(r),
      thumb: { here: hereOf(r), alt: !!r.choices.swapped },
    }
  })

  return (
    <div className="@container flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex min-h-16 items-center gap-4 border-b bg-background px-gutter">
        <span className="flex items-center gap-2 font-heading text-h4 font-semibold">
          <Duck size="1.75rem" eager className="size-7 object-contain" />
          {SITE_NAME}
        </span>
        <AccountMenu band={false} className="ml-auto" />
      </header>
      <RoadmapsPage
        roadmaps={summaries}
        madeId={madeId}
        renameRoadmapAction={renameRoadmapAction}
        deleteRoadmapAction={deleteRoadmapAction}
        restoreRoadmapAction={restoreRoadmapAction}
        startFromScratchAction={startFromScratchAction}
      />
    </div>
  )
}
