// What a roadmap's board says about it, for the list: how far she has walked and what is next.
// Read from the scene its stored choices draw (never the first arrival), so the list and the board
// agree. Pure.

import type { RoadmapChoices } from '@/shared/types/student'
import type { Road } from './road-data'
import { buildScene, sessionFrom } from './scene'

export type BoardFacts = {
  /** The steps lit on its road. */
  walked: number
  /** The road's rows. */
  steps: number
  /** The next step's name ("Student visa"), or null when nothing is next. */
  next: string | null
  /** The next step's date ("Late 2026"), or null when it has none. */
  nextWhen: string | null
}

export function boardFacts(road: Road, choices: RoadmapChoices): BoardFacts {
  const scene = buildScene(road, sessionFrom(choices, false))
  const byId = (id: string | undefined) => scene.tiles.find((t) => t.id === id)
  const next = byId(scene.next[1])
  return {
    walked: scene.lit.length,
    steps: scene.rows.length,
    next: next ? (next.short ?? next.name) : null,
    nextWhen: next?.when ?? null,
  }
}
