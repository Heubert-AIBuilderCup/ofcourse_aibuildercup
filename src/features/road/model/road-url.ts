// The board's state in the query: `tile` (a tile's stable id), `zoom` (a stop), `view` (the phone's
// Road or Map) and `open` (the stack list, or her answers over the board). Defaults are omitted; an unknown or bad value is dropped
// quietly and the board opens at its default. The lesson and route detail are paths, not params.

import { STOPS, type Stop, type Tile } from './road-data'

export type View = 'road' | 'map'

export type RoadState = {
  /** The tile open in the card; null shows where she is. */
  tile: string | null
  zoom: Stop
  /** Phone only; ignored at 576px and wider. */
  view: View
  /** The stack's list, only with a stack tile open; or her answers, whatever the tile. */
  open: 'list' | 'answers' | null
}

export const DEFAULT_ROAD_STATE: RoadState = { tile: null, zoom: 'level', view: 'road', open: null }

/** URLSearchParams, or Next's read-only search params. */
type Params = { get(name: string): string | null }

const isStop = (value: string | null): value is Stop =>
  (STOPS as readonly (string | null)[]).includes(value)

/** The board's state from the query, against the tiles on the board now. */
export function parseRoadState(
  params: Params,
  tiles: readonly Pick<Tile, 'id' | 'kind'>[],
): RoadState {
  const tile = tiles.find((t) => t.id === params.get('tile')) ?? null
  const zoom = params.get('zoom')
  const open = params.get('open')
  return {
    tile: tile?.id ?? null,
    zoom: isStop(zoom) ? zoom : DEFAULT_ROAD_STATE.zoom,
    view: params.get('view') === 'map' ? 'map' : 'road',
    open:
      open === 'answers' ? 'answers' : open === 'list' && tile?.kind === 'stack' ? 'list' : null,
  }
}

/** The query for a state, without the `?`; defaults are left out. */
export function serializeRoadState(state: RoadState): string {
  const params = new URLSearchParams()
  if (state.tile) params.set('tile', state.tile)
  if (state.zoom !== DEFAULT_ROAD_STATE.zoom) params.set('zoom', state.zoom)
  if (state.view !== DEFAULT_ROAD_STATE.view) params.set('view', state.view)
  if (state.open) params.set('open', state.open)
  return params.toString()
}

/**
 * Opening the stack's list or her answers pushes a history entry, so Back closes it; a press, a
 * zoom or a Road/Map switch replaces the entry.
 */
export function historyMode(prev: RoadState, next: RoadState): 'push' | 'replace' {
  return next.open !== null && next.open !== prev.open ? 'push' : 'replace'
}
