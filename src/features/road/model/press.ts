// One press = one meaning: a press opens the tile in the card, and the card's buttons act. A press
// leaves the zoom where she put it.

import type { QuestionKey } from '@/shared/types/student'
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
  /** Why the tile is there: the template, shown until the model's words arrive. */
  why?: string
  /** The heading over `why`. */
  whyTitle?: string
  badges: BadgeId[]
  primary?: string
  secondary?: string
  /** Where "Back to where you are" goes: her place, said beside the button (a look card's). */
  backTo?: string
  /** The lesson the card offers. */
  lesson?: string
  /** Route detail's id (`/road/route/<id>`): the step looked at, or for where she is the next step. */
  routeId?: string
  /** Where she is: the heading over the alternative and the stack. */
  siblingsTitle?: string
  /** Its primary only starts a new roadmap (a course beside the study step): drawn when one can. */
  starts?: boolean
}

/** A route step's card: she stays where she is (spec §7). */
const LOOK = {
  kicker: 'Look ahead · Route step',
  primary: 'Open route detail at this step',
}

/** The state after pressing a tile: it opens in the card; pressing where she is shows her card. */
export function pressTile(state: RoadState, tileId: string, scene: Scene): RoadState {
  return { ...state, tile: tileId === scene.here ? null : tileId, open: null }
}

/** The card for a tile on the board; with no tile, the card where she is. */
export function cardFor(road: Road, scene: Scene, tileId: string | null): Card {
  const byId = (id: string) => scene.tiles.find((t) => t.id === id)
  const here = byId(scene.here)!
  const tile = (tileId && byId(tileId)) || here

  if (tile.id === here.id) {
    const copy = road.here[here.id]
    const nextStep = byId(scene.next[scene.next.length - 1])
    const { why, whyTitle } = road.cards[here.id] ?? {}
    return { kind: 'here', name: here.name, ...copy, why, whyTitle, routeId: nextStep?.routeId }
  }

  const copy = road.cards[tile.id]
  const card = {
    name: tile.name,
    sub: copy.sub,
    gains: copy.gains,
    costs: copy.costs,
    guide: copy.guide,
    because: copy.because,
    why: copy.why,
    whyTitle: copy.whyTitle,
    badges: tile.badges ?? [],
  }
  if (tile.routeId) {
    return {
      ...card,
      kind: 'look',
      ...LOOK,
      secondary: 'Back to where you are',
      backTo: here.name,
      lesson: copy.lesson,
      routeId: tile.routeId,
    }
  }
  return {
    ...card,
    kind: tile.kind as Exclude<CardKind, 'here' | 'look'>,
    kicker: copy.kicker ?? '',
    primary: tile.id === scene.courseLine[0] ? ownCourse(road, scene, tile) : copy.primary,
    // A job is only looked at: its card closes. A course beside the study step can only start one.
    secondary: tile.kind === 'job' ? 'Close' : 'Cancel',
    ...(tile.beside && copy.primary && { starts: true }),
  }
}

/**
 * The primary of her road's own course, pressed while she stands elsewhere: it is already on her
 * roadmap, so never a swap; next on her road, it walks her on to it, else it has none.
 */
function ownCourse(road: Road, scene: Scene, tile: Tile): string | undefined {
  return primaryAction(road, scene, tile.id)?.kind === 'walk' ? `Walk to ${tile.name}` : undefined
}

/** What compare's pin lets a card start. */
const START = 'Start a new roadmap from it'

/**
 * A card as the board shows it, given whether its tile can start a new roadmap (compare's pin):
 * then its primary says so; else a primary that could only start one is not drawn, and nor is one
 * the board has no action for (`acts`, its primaryAction), so no button does nothing. A route
 * step's primary is its link, which needs no action; the card where she is keeps its own.
 */
export function withStart(card: Card, canStart: boolean, acts = true): Card {
  if (canStart && card.primary && card.kind !== 'here') return { ...card, primary: START }
  if (!canStart && card.starts) return { ...card, primary: undefined }
  if (!acts && card.kind !== 'look' && card.kind !== 'here') return { ...card, primary: undefined }
  return card
}

/**
 * What a card's primary does. look: open the next step's card · swap: the alternative beside her
 * onto her road, or back · list: the course stack's list · walk: back to her country or her city,
 * or on to her course · answers: her answers, opened at a question (Point A on an empty road: Pick a
 * destination opens them at the destination). null where this round's data has no road for it (another city, the cities'
 * stack, a course put on the board from the stack): unless compare's pin starts a new roadmap from
 * it, the board draws no primary (withStart).
 */
export type CardAction =
  | { kind: 'look'; tileId: string }
  | { kind: 'swap'; tileId: string }
  | { kind: 'list' }
  | { kind: 'walk'; to: 'country' | 'city' | 'course' }
  | { kind: 'answers'; at: QuestionKey }
  | null

export function primaryAction(road: Road, scene: Scene, tileId: string | null): CardAction {
  const byId = (id: string | undefined) => scene.tiles.find((t) => t.id === id)
  const here = byId(scene.here)
  const next = byId(scene.next[scene.next.length - 1])
  if (!tileId || tileId === scene.here) {
    if (here?.kind === 'point') return { kind: 'answers', at: 'dest' }
    if (here?.kind === 'course' && next) return { kind: 'look', tileId: next.id }
    if (here?.kind === 'place' && next?.kind === 'course') return { kind: 'walk', to: 'course' }
    if (here?.kind === 'place' && next?.kind === 'place') return { kind: 'walk', to: 'city' }
    return null
  }
  const tile = byId(tileId)
  const fromStack = road.tiles.find((t) => t.id === tileId)?.inStack
  if (tileId === scene.alternative && !fromStack) return { kind: 'swap', tileId }
  if (tile?.kind === 'stack' && tile.level === 'course') return { kind: 'list' }
  // The next place or course on her road, pressed on the map: its card walks her on to it.
  if (tileId === next?.id && (tile?.kind === 'place' || tile?.kind === 'course'))
    return { kind: 'walk', to: tile.kind === 'place' ? 'city' : 'course' }
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
