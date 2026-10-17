// The map's camera, as pure maths (no DOM): the isometric projection, what each zoom stop frames,
// fitting that to the map's size, the pan clamp, the log-scale move between stops, and how wheel,
// trackpad and touch-pinch input step between stops.

import { STOPS, type Stop, type Tile, type TileKind } from './road-data'
import type { Scene } from './scene'

/** phone below 576px, stacked from 576 to 1024, wide (map and card side by side) from 1024. */
export type Layout = 'phone' | 'stacked' | 'wide'

/** The map's size in px, the page's layout, and the root font size over 16 (1 to 4/3). */
export type MapSize = { width: number; height: number; layout: Layout; rs: number }

/** px per grid unit, and where the grid's origin sits on the map. */
export type Camera = { u: number; ox: number; oy: number }

/** A box in projected units. */
export type Box = { x0: number; x1: number; y0: number; y1: number }

/** A tile's half-size in grid units, per kind. */
export const TILE_SIZE: Readonly<Record<TileKind, number>> = {
  point: 0.6,
  place: 0.72,
  course: 0.72,
  step: 0.42,
  stack: 0.66,
  slab: 0.42,
  junction: 0.22,
  job: 0.5,
}

/** A tile's depth in grid units, per kind. */
export const TILE_DEPTH: Readonly<Record<TileKind, number>> = {
  point: 0.34,
  place: 0.26,
  course: 0.26,
  step: 0.16,
  stack: 0.14,
  slab: 0.16,
  junction: 0.1,
  job: 0.14,
}

/** The most px per grid unit each stop allows, at rs 1. */
export const STOP_CAP: Readonly<Record<Layout, Readonly<Record<Stop, number>>>> = {
  phone: { whole: 46, level: 30, tile: 64 },
  stacked: { whole: 46, level: 50, tile: 104 },
  wide: { whole: 46, level: 50, tile: 104 },
}

/** A move between stops, in ms (spec §9). */
export const CAMERA_MS = 550

/** Pan keeps at least this much of the road on screen, in px. */
const KEEP_ON_SCREEN = 80

export const layoutOf = (width: number): Layout =>
  width >= 1024 ? 'wide' : width >= 576 ? 'stacked' : 'phone'

/** Grid to projected units: the isometric projection. */
export const project = (gx: number, gy: number): [number, number] => [gx - gy, (gx + gy) / 2]

/** Ease-out cubic, for the move between stops. */
export const ease = (x: number) => 1 - (1 - x) ** 3

/** The tile the camera centres on: the open tile if it is on the board, else where she is. */
const focusTile = (focusId: string | null, scene: Scene) =>
  scene.tiles.find((t) => t.id === focusId) ?? scene.tiles.find((t) => t.id === scene.here)!

/** The projected corners of a tile, grown by pad grid units; an angled slab's far end at its gy1. */
function corners(t: Tile, pad: number): [number, number][] {
  if (t.kind === 'slab') {
    const w = (t.w ?? TILE_SIZE.slab) + pad
    const gx1 = t.gx1 ?? t.gx
    const gy1 = t.gy1 ?? t.gy
    return [
      project(t.gx - pad, t.gy - w),
      project(gx1 + pad, gy1 - w),
      project(gx1 + pad, gy1 + w),
      project(t.gx - pad, t.gy + w),
    ]
  }
  const h = (t.sz ?? TILE_SIZE[t.kind]) + pad
  return [
    project(t.gx - h, t.gy - h),
    project(t.gx + h, t.gy - h),
    project(t.gx + h, t.gy + h),
    project(t.gx - h, t.gy + h),
  ]
}

/**
 * What a stop frames, in projected units. Whole road: every tile and the year ruler. Level: the
 * open level (and the start of the road ahead), or, for a tile beyond it, that tile with room
 * around it; a step with options beside it (or one of them) frames the step and all of them. Tile:
 * the one tile up close.
 */
export function frame(stop: Stop, focusId: string | null, scene: Scene): Box {
  const focus = focusTile(focusId, scene)
  const pts: [number, number][] = []
  const add = (t: Tile | undefined, pad: number) => {
    if (t) pts.push(...corners(t, pad))
  }
  const byId = (id: string) => scene.tiles.find((t) => t.id === id)

  if (stop === 'whole') {
    for (const t of scene.tiles) add(t, 0.2)
    // A little past the ruler's line, for the year labels.
    pts.push(project(scene.ruler.to, scene.ruler.gy - 0.05))
  } else if (stop === 'level' && (focus.id === scene.here || scene.levelIds.includes(focus.id))) {
    for (const id of scene.levelIds) add(byId(id), 0.5)
    const beforeStudy = scene.ahead[scene.ahead.indexOf(scene.courseStep) - 1]
    if (beforeStudy && scene.levelIds.includes(beforeStudy)) add(byId(scene.courseStep), 0)
  } else if (stop === 'level') {
    const step = (focus.beside && byId(focus.beside)) || focus
    add(step, 3)
    for (const t of scene.tiles) if (t.beside === step.id) add(t, 0.5)
  } else {
    add(focus, focus.kind === 'slab' ? 0.8 : 1.5)
  }

  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

/** The room the map keeps clear for its controls, in px, per layout. */
export function mapPadding({ layout, rs }: MapSize) {
  const r = 16 * rs
  if (layout === 'wide') return { l: 2 * r, r: 2 * r, t: 5.5 * r, b: 6 * r }
  if (layout === 'stacked') return { l: 1.5 * r, r: 1.5 * r, t: 5 * r, b: 5 * r }
  return { l: r, r: r, t: 6 * r, b: 9.5 * r }
}

/** The camera that fits a stop into the map, centred, no closer than the stop's cap. */
export function fit(stop: Stop, focusId: string | null, size: MapSize, scene: Scene): Camera {
  const f = frame(stop, focusId, scene)
  const pad = mapPadding(size)
  const aw = Math.max(40, size.width - pad.l - pad.r)
  const ah = Math.max(40, size.height - pad.t - pad.b)
  const u = Math.min(aw / (f.x1 - f.x0), ah / (f.y1 - f.y0), STOP_CAP[size.layout][stop] * size.rs)
  return {
    u,
    ox: pad.l + (aw - (f.x1 - f.x0) * u) / 2 - f.x0 * u,
    oy: pad.t + (ah - (f.y1 - f.y0) * u) / 2 - f.y0 * u,
  }
}

/** A panned camera, held so some of the road stays on screen. */
export function clamp(cam: Camera, size: MapSize, scene: Scene): Camera {
  const f = frame('whole', null, scene)
  const { u } = cam
  return {
    u,
    ox: Math.min(
      size.width - KEEP_ON_SCREEN - f.x0 * u,
      Math.max(KEEP_ON_SCREEN - f.x1 * u, cam.ox),
    ),
    oy: Math.min(
      size.height - KEEP_ON_SCREEN - f.y0 * u,
      Math.max(KEEP_ON_SCREEN - f.y1 * u, cam.oy),
    ),
  }
}

/** The camera k of the way from one to the other: the scale moves evenly in log space. */
export const tween = (from: Camera, to: Camera, k: number): Camera => ({
  u: from.u * (to.u / from.u) ** k,
  ox: from.ox + (to.ox - from.ox) * k,
  oy: from.oy + (to.oy - from.oy) * k,
})

/** What the camera frames: a stop, where she is, and the tile it centres on. */
export type Framing = { stop: Stop; here: string; focus: string | null }

/**
 * The framing after the board changes. A press opens a tile without moving the camera at Whole
 * road or Level, so she sees the board as she left it; a zoom, a move of hers, or a press at Tile
 * (where the camera follows the tile she opens) frames the open tile.
 */
export function reframe(
  was: Framing,
  now: { stop: Stop; here: string; tile: string | null },
): Framing {
  const same =
    was.stop === now.stop &&
    was.here === now.here &&
    (now.stop !== 'tile' || was.focus === now.tile)
  return same ? was : { stop: now.stop, here: now.here, focus: now.tile }
}

/** One stop in (1) or out (-1), held at either end. */
export function stepStop(stop: Stop, dir: -1 | 1): Stop {
  const i = STOPS.indexOf(stop) + dir
  return STOPS[Math.min(STOPS.length - 1, Math.max(0, i))]
}

/** A wheel gesture so far: its summed delta, its last event, and when the step lock lifts (ms). */
export type WheelGesture = { sum: number; at: number; lockedUntil: number }

export const WHEEL_IDLE: WheelGesture = { sum: 0, at: -Infinity, lockedUntil: -Infinity }

/** A pause longer than this starts a new gesture (ms). */
const GESTURE_GAP = 400
/** After a step, the wheel waits this long before it can step again (ms). */
const STEP_LOCK = 450
/** The summed delta that makes a step. */
const STEP_DELTA = 90
/** A trackpad pinch (Ctrl + wheel) sends small deltas: weigh them up. */
const PINCH_WEIGHT = 4

/**
 * One wheel event into the gesture: one stop per gesture, in for a scroll up or a pinch out, out
 * for a scroll down or a pinch in.
 */
export function stepFromWheel(
  gesture: WheelGesture,
  event: { deltaY: number; ctrlKey: boolean; time: number },
): { gesture: WheelGesture; step: -1 | 0 | 1 } {
  const fresh = event.time - gesture.at > GESTURE_GAP
  const sum = (fresh ? 0 : gesture.sum) + event.deltaY * (event.ctrlKey ? PINCH_WEIGHT : 1)
  if (Math.abs(sum) > STEP_DELTA && event.time >= gesture.lockedUntil) {
    return {
      gesture: { sum: 0, at: event.time, lockedUntil: event.time + STEP_LOCK },
      step: sum < 0 ? 1 : -1,
    }
  }
  return { gesture: { ...gesture, sum, at: event.time }, step: 0 }
}

/**
 * Two fingers on a touch screen: spread past 1.3 times the start steps in, close under 0.77 steps
 * out, and the next step measures from there.
 */
export function stepFromPinch(
  start: number,
  distance: number,
): { start: number; step: -1 | 0 | 1 } {
  if (distance / start > 1.3) return { start: distance, step: 1 }
  if (distance / start < 0.77) return { start: distance, step: -1 }
  return { start, step: 0 }
}
