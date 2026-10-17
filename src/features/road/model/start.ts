// Start a new roadmap from it, as the board shows it before the new roadmap's draft opens: first the
// road ahead turns into the new roadmap's (each step that differs crossfades to its new name and
// date, in road order, one beat after another; the options and jobs beside a step fade out and in
// with it), then the course the roadmap is built around trades places with hers. Drawn only, never
// saved. Pure: frames of the board's scene.

import type { Tile, TileKind } from './road-data'
import type { Scene } from './scene'

/** Each step's crossfade, in ms. */
export const MORPH_FADE_MS = 300
/** Between one step's crossfade starting and the next's, in ms. */
export const MORPH_STAGGER_MS = 150
/** After the swap has landed, the moment before the new roadmap's draft opens, in ms. */
export const START_HOLD_MS = 400

/** A step of the new roadmap's road ahead, on the tile (`id`) that holds its slot on this board. */
export type NextStep = { id: string; name: string; short?: string; when?: string; kind: TileKind }

/**
 * The road a new roadmap around a tile would draw: its road ahead in road order, slot by slot, and
 * the options and jobs beside its steps (each `beside` a tile of this board).
 */
export type NextRoad = { ahead: NextStep[]; options: Tile[] }

/** A step's words before it turned, and how far its crossfade is (0 to 1). */
export type Was = { name: string; short?: string; when?: string; k: number }

/** A frame: the scene to draw, the opacity of each tile fading, the old words of each turning. */
export type MorphFrame = { scene: Scene; fade: Record<string, number>; was: Record<string, Was> }

/** One beat: a step turning, and the options beside it going, coming and moving. */
type Beat = { step: NextStep | null; out: Tile[]; arrive: Tile[]; move: [Tile, Tile][] }

const reads = (t: Tile) => [t.name, t.short, t.when, t.kind].join('|')
const readsNext = (s: NextStep) => [s.name, s.short, s.when, s.kind].join('|')
const samePlace = (a: Tile, b: Tile) => a.gx === b.gx && a.gy === b.gy

/**
 * The road ahead's turn as it starts: the next road, the tile the new roadmap is built around
 * (`keep`, which never fades), and how long the turn takes in ms (nothing when nothing changes).
 */
export type Morph = { next: NextRoad; keep: string | null; ms: number }

/** The beats, in road order: a step whose words differ, or whose options change. */
function beatsOf(scene: Scene, { next, keep }: Pick<Morph, 'next' | 'keep'>): Beat[] {
  return next.ahead.flatMap((step): Beat[] => {
    const tile = scene.tiles.find((t) => t.id === step.id)
    const turns = !!tile && reads(tile) !== readsNext(step)
    const was = scene.tiles.filter((t) => t.beside === step.id && t.id !== keep)
    const coming = next.options.filter((o) => o.beside === step.id && o.id !== keep)
    const out = was.filter((t) => !coming.some((o) => o.id === t.id))
    const arrive = coming.filter((o) => !was.some((t) => t.id === o.id))
    const move = coming.flatMap((o): [Tile, Tile][] => {
      const from = was.find((t) => t.id === o.id)
      return from && !samePlace(from, o) ? [[from, o]] : []
    })
    return turns || out.length || arrive.length || move.length
      ? [{ step: turns ? step : null, out, arrive, move }]
      : []
  })
}

/**
 * The turn to the road `next`, around the tile `keep`. Nothing arrives on the place of the tile
 * kept: her course takes that place when the two trade, so the option the new road has there
 * waits for the new board.
 */
export function startMorph(scene: Scene, next: NextRoad, keep: string | null): Morph {
  const kept = scene.tiles.find((t) => t.id === keep)
  const options = kept ? next.options.filter((o) => !samePlace(o, kept)) : next.options
  const morph = { next: { ...next, options }, keep }
  const beats = beatsOf(scene, morph).length
  return { ...morph, ms: beats ? (beats - 1) * MORPH_STAGGER_MS + MORPH_FADE_MS : 0 }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/**
 * The scene `ms` into the turn. Before its beat a step reads as it did; from its start it carries
 * the new words, the old ones in `was` until it ends. An option going fades out and is gone at its
 * beat's end; one coming fades in from its beat's start; one on both roads moves to its new place.
 */
export function morphFrame(scene: Scene, morph: Morph, ms: number): MorphFrame {
  const changes = new Map<string, Partial<Tile> | null>()
  const fade: Record<string, number> = {}
  const was: Record<string, Was> = {}
  const arriving: Tile[] = []
  beatsOf(scene, morph).forEach((beat, i) => {
    const k = Math.min(1, Math.max(0, (ms - i * MORPH_STAGGER_MS) / MORPH_FADE_MS))
    if (k === 0) return
    const { step } = beat
    if (step) {
      const tile = scene.tiles.find((t) => t.id === step.id)!
      const { name, short, when, kind } = step
      changes.set(step.id, { name, short, when, kind })
      if (k < 1) was[step.id] = { name: tile.name, short: tile.short, when: tile.when, k }
    }
    for (const t of beat.out) {
      changes.set(t.id, k < 1 ? {} : null)
      if (k < 1) fade[t.id] = 1 - k
    }
    for (const [from, to] of beat.move)
      changes.set(from.id, { ...to, gx: lerp(from.gx, to.gx, k), gy: lerp(from.gy, to.gy, k) })
    for (const o of beat.arrive) {
      arriving.push(o)
      if (k < 1) fade[o.id] = k
    }
  })
  const tiles = scene.tiles.flatMap((t) => {
    const change = changes.get(t.id)
    if (change === undefined) return [t]
    return change === null ? [] : [{ ...t, ...change }]
  })
  return { scene: { ...scene, tiles: [...tiles, ...arriving] }, fade, was }
}

/**
 * The course `tileId` on her road in her place, and hers in its place, as the board's swap draws
 * the alternative: it is where she is, hers is visited; the lines her road runs through name it in
 * hers. An option traded on is no longer beside a step.
 */
export function tradePlaces(scene: Scene, tileId: string): Scene {
  const here = scene.tiles.find((t) => t.id === scene.here)
  const to = scene.tiles.find((t) => t.id === tileId)
  if (!here || !to || here === to) return scene
  const trade = (ids: string[]) =>
    ids.map((id) => (id === here.id ? to.id : id === to.id ? here.id : id))
  const tiles = scene.tiles.map((t): Tile => {
    if (t === here)
      return { ...t, gx: to.gx, gy: to.gy, lab: to.lab, state: 'lit', kicker: 'Visited' }
    if (t !== to) return t
    const { beside: _, ...course } = t
    return { ...course, gx: here.gx, gy: here.gy, lab: here.lab, state: 'here' }
  })
  return {
    ...scene,
    tiles,
    here: to.id,
    alternative: scene.alternative === to.id ? here.id : scene.alternative,
    lit: trade(scene.lit),
    next: trade(scene.next),
    rows: trade(scene.rows),
    courseLine: trade(scene.courseLine),
  }
}
