import 'server-only'
// The live updates on one student's feed: her roadmaps (finished, not deleted, last opened first),
// each read as the board reads it (the road its answers match, its courses' institutions, her
// country), matched against the live updates by feedUpdates. A read that fails gives nothing, so a
// failing update read never breaks the feed. An admin has no roadmaps, so sees none.

// For its side effect: a roadmap pinned to a finder course draws its road, with its institution.
import '@/features/finder/server/road-courses'
import { roadmapName, roadNames } from '@/features/roadmaps/model/roadmap'
// A namespace, read at call time: a test elsewhere that mocks this module without listRoadmaps
// (bun's module mocks are process-wide) then cannot break this module's loading.
import * as roadmapStore from '@/features/roadmaps/server/roadmaps'
import { herCountry, roadFor } from '@/features/roads'
import { courseById } from '@/features/roads/data/courses'
import type { Roadmap } from '@/shared/types/student'
import { type FeedRoadmap, type FeedUpdate, feedUpdates } from '../lib/feed-updates'
import { type LiveUpdateRow, listLiveUpdates } from './updates'

type Sources = {
  listLiveUpdates: () => Promise<LiveUpdateRow[]>
  listRoadmaps: (userId: string) => Promise<Roadmap[]>
  env: Record<string, string | undefined>
}

const SOURCES: Sources = {
  listLiveUpdates,
  listRoadmaps: (userId) => roadmapStore.listRoadmaps(userId),
  env: process.env,
}

/** A roadmap as the match needs it; none when its answers match no road (or the roads are off). */
function feedRoadmap(r: Roadmap, env: Sources['env']): FeedRoadmap[] {
  const { road, spec } = roadFor(
    { answers: r.answers, relative: r.relative, pinned: r.choices.pinned },
    env,
  )
  if (!spec) return []
  const universities = [spec.courseId, spec.altCourseId, spec.stackCourseId].flatMap(
    (id) => courseById(id)?.university ?? [],
  )
  return [
    {
      id: r.id,
      name: roadmapName(r, roadNames(road)),
      universities,
      country: herCountry(r.answers),
    },
  ]
}

/** The live updates that are hers, with why and the roadmap to open; none on a failed read. */
export async function readFeedUpdates(
  userId: string,
  sources: Sources = SOURCES,
): Promise<FeedUpdate[]> {
  try {
    const [updates, roadmaps] = await Promise.all([
      sources.listLiveUpdates(),
      sources.listRoadmaps(userId),
    ])
    return feedUpdates(
      updates,
      roadmaps.flatMap((r) => feedRoadmap(r, sources.env)),
    )
  } catch (error) {
    console.error('[updates.feed]', error)
    return []
  }
}
