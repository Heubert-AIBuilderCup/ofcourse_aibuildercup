// The road a new roadmap around another course or city would draw, as her board needs it to turn
// into it before the new roadmap's draft opens: the new road's steps ahead, each on the tile that
// holds its slot on her board, and the options and jobs beside them. Built from the catalogue, so
// on the server; the board gets only this. Pure.

import type { NextRoad } from '@/features/road/model/start'
import type { StoredAnswers } from '@/shared/types/student'
import type { RoadSpec, SlotId } from '../data/types'
import { buildRoad } from './build'

/** The slots on the road ahead, in road order: the 491 lane after the straight road to PR. */
const AHEAD: SlotId[] = [
  'visa-500',
  'course-years',
  'visa-485',
  'fork',
  'pr-straight',
  'pr-point',
  'pr-lane',
  'pr-lane-end',
]

/** `next`'s road, slot by slot on the board drawn from `spec`. */
export function nextRoad(spec: RoadSpec, next: RoadSpec, answers: StoredAnswers): NextRoad {
  const road = buildRoad(next, { answers })
  const mine = new Map(AHEAD.map((slot) => [next.slots[slot].id, spec.slots[slot].id]))
  return {
    ahead: AHEAD.flatMap((slot) => {
      const t = road.tiles.find((tile) => tile.id === next.slots[slot].id)
      return t
        ? [{ id: spec.slots[slot].id, name: t.name, short: t.short, when: t.when, kind: t.kind }]
        : []
    }),
    options: road.tiles
      .filter((t) => t.beside)
      .map((t) => ({ ...t, beside: mine.get(t.beside ?? '') ?? t.beside })),
  }
}
