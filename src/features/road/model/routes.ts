import { ROAD_PATH } from '@/features/opening'
import type { Lesson, Road, Tile } from './road-data'

/** A lesson over the board. */
export const lessonPath = (id: string) => `${ROAD_PATH}/learn/${id}`

/** A route step's detail. */
export const routePath = (routeId: string) => `${ROAD_PATH}/route/${routeId}`

/** The road's lesson with this id (`/road/learn/<lesson>`), or null. */
export function lessonById(road: Road, id: string): Lesson | null {
  return road.lesson.id === id ? road.lesson : null
}

/** The route step this route id names (`/road/route/<route-id>`), or null. */
export function routeStep(road: Road, routeId: string): Tile | null {
  return road.tiles.find((tile) => tile.routeId === routeId) ?? null
}

/** What the card column shows over the board, from the route (null: the query's card). */
export type RoadPanel = { kind: 'lesson'; lesson: Lesson } | { kind: 'route'; step: Tile } | null

/**
 * The panel the segments below /road name (`['learn', id]`, `['route', id]`), checked against the
 * road; null at /road itself or for an id it does not know.
 */
export function panelAt(road: Road, segments: readonly string[]): RoadPanel {
  const [kind, id] = segments
  if (kind === 'learn' && id) {
    const lesson = lessonById(road, id)
    return lesson && { kind: 'lesson', lesson }
  }
  if (kind === 'route' && id) {
    const step = routeStep(road, id)
    return step && { kind: 'route', step }
  }
  return null
}
