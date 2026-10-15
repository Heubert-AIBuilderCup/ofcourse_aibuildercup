import type { Lesson, Road, Tile } from './road-data'

/** A lesson over the board at `board` (useBoardPath). */
export const lessonPath = (board: string, id: string) => `${board}/learn/${id}`

/** A route step's detail over the board at `board` (useBoardPath). */
export const routePath = (board: string, routeId: string) => `${board}/route/${routeId}`

/** The road's lesson with this id (`<board>/learn/<lesson>`), or null. */
export function lessonById(road: Road, id: string): Lesson | null {
  return road.lesson.id === id ? road.lesson : null
}

/** The route step this route id names (`<board>/route/<route-id>`), or null. */
export function routeStep(road: Road, routeId: string): Tile | null {
  return road.tiles.find((tile) => tile.routeId === routeId) ?? null
}

/** What the card column shows over the board, from the route (null: the query's card). */
export type RoadPanel = { kind: 'lesson'; lesson: Lesson } | { kind: 'route'; step: Tile } | null

/**
 * The panel the segments below the board name (`['learn', id]`, `['route', id]`), checked against the
 * road; null at the board itself or for an id it does not know.
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
