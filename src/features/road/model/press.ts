// One press = one meaning: a press opens the tile in the card, and the card's buttons act. At
// Whole road a press first brings the camera to Level, centred on the tile.

import type { BadgeId, Road, Tile, TileKind } from './road-data'
import type { RoadState } from './road-url'
import type { Scene } from './scene'

/** here: where she is · look: a route step, looked at from where she is · else the tile's kind. */
export type CardKind = 'here' | 'look' | Exclude<TileKind, 'step' | 'slab'>

export type Card = {
  kind: CardKind
  kicker: string
  name: string
  sub: string
  gains?: string
  costs?: string
  guide?: string
  /** "On your board because: …" */
  because: string
  badges: BadgeId[]
  primary?: string
  secondary?: string
  /** The lesson the card offers. */
  lesson?: string
  /** Route detail's id (`/road/route/<id>`): the step looked at, or for where she is the next step. */
  routeId?: string
  /** Where she is: the heading over the alternative and the stack. */
  siblingsTitle?: string
}

/** A route step's card: the duck stays where she is (spec §7). */
const LOOK = {
  kicker: 'Look ahead · the duck stays · Route step',
  primary: 'Open route detail at this step',
}

/** The state after pressing a tile: it opens in the card; pressing where she is shows her card. */
export function pressTile(state: RoadState, tileId: string, scene: Scene): RoadState {
  return {
    ...state,
    tile: tileId === scene.here ? null : tileId,
    zoom: state.zoom === 'whole' ? 'level' : state.zoom,
    open: null,
  }
}

/** The card for a tile on the board; with no tile, the card where she is. */
export function cardFor(road: Road, scene: Scene, tileId: string | null): Card {
  const byId = (id: string) => scene.tiles.find((t) => t.id === id)
  const here = byId(scene.here)!
  const tile = (tileId && byId(tileId)) || here

  if (tile.id === here.id) {
    const copy = road.here[here.id]
    const nextStep = byId(scene.next[scene.next.length - 1])
    return { kind: 'here', name: here.name, ...copy, routeId: nextStep?.routeId }
  }

  const copy = road.cards[tile.id]
  const card = {
    name: tile.name,
    sub: copy.sub,
    gains: copy.gains,
    costs: copy.costs,
    guide: copy.guide,
    because: copy.because,
    badges: tile.badges ?? [],
  }
  if (tile.routeId) {
    return {
      ...card,
      kind: 'look',
      ...LOOK,
      secondary: `Back to ${here.name}`,
      lesson: copy.lesson,
      routeId: tile.routeId,
    }
  }
  return {
    ...card,
    kind: tile.kind as Exclude<CardKind, 'here' | 'look'>,
    kicker: copy.kicker ?? '',
    primary: copy.primary,
    secondary: 'Cancel',
  }
}

/**
 * What a card's primary does. look: open the next step's card · swap: the alternative beside her
 * onto her road, or back · list: the course stack's list · walk: back to her country or her city,
 * or on to her course. null where this round's data has no road for it (another city, the cities'
 * stack, a course put on the board from the stack): the button is drawn and does nothing.
 */
export type CardAction =
  | { kind: 'look'; tileId: string }
  | { kind: 'swap'; tileId: string }
  | { kind: 'list' }
  | { kind: 'walk'; to: 'country' | 'city' | 'course' }
  | null

export function primaryAction(road: Road, scene: Scene, tileId: string | null): CardAction {
  const byId = (id: string | undefined) => scene.tiles.find((t) => t.id === id)
  const here = byId(scene.here)
  const next = byId(scene.next[scene.next.length - 1])
  if (!tileId || tileId === scene.here) {
    if (here?.kind === 'course' && next) return { kind: 'look', tileId: next.id }
    if (here?.kind === 'place' && next?.kind === 'course') return { kind: 'walk', to: 'course' }
    if (here?.kind === 'place' && next?.kind === 'place') return { kind: 'walk', to: 'city' }
    return null
  }
  const tile = byId(tileId)
  const fromStack = road.tiles.find((t) => t.id === tileId)?.inStack
  if (tileId === scene.alternative && !fromStack) return { kind: 'swap', tileId }
  if (tile?.kind === 'stack' && tile.level === 'course') return { kind: 'list' }
  if (tileId === scene.cityLine[0] && scene.lit.includes(tileId))
    return { kind: 'walk', to: 'city' }
  // Her country is where the first arrival stands her.
  if (tileId === road.arrival.walk.here && scene.lit.includes(tileId))
    return { kind: 'walk', to: 'country' }
  return null
}

/** The tiles beside where she is on her level (the alternative and the stack), in line order. */
export function siblingsOf(scene: Scene): Tile[] {
  const line = [scene.cityLine, scene.courseLine].find((l) => l.includes(scene.here)) ?? []
  return line
    .filter((id) => id !== scene.here)
    .map((id) => scene.tiles.find((t) => t.id === id))
    .filter((t): t is Tile => !!t)
}
