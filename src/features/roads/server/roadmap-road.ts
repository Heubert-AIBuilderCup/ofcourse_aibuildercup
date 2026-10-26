import 'server-only'
import { cache } from 'react'
// For its side effect: a roadmap pinned to a finder course draws its road.
import '@/features/finder/server/road-courses'
import { getRoadmap } from '@/features/roadmaps/server/roadmaps'
import type { Roadmap } from '@/shared/types/student'
import { type RoadFor, roadFor } from '../model/road-for'

// One of her roadmaps and the road it shows (around its pinned course, if it has one), read once
// per request: the board's layout and the lesson or route page under it share one query and one
// built road (React cache). Null when the roadmap is not hers, deleted or unknown.

export type RoadmapRoad = { roadmap: Roadmap; road: RoadFor }

export const roadmapRoad = cache(
  async (userId: string, id: string): Promise<RoadmapRoad | null> => {
    const roadmap = await getRoadmap(userId, id)
    if (!roadmap) return null
    return {
      roadmap,
      road: roadFor(
        { answers: roadmap.answers, relative: roadmap.relative, pinned: roadmap.choices.pinned },
        process.env,
      ),
    }
  },
)
