// What the map draws for a camera, in px on the map: the roads, the year ruler, each tile's faces,
// rings, icon and hit area, its label, the duck and the road-ahead plate. The reference build's
// renderVals maths (road-logic.txt, board.js), pure; the map component only places what it returns.

import { type Camera, project, TILE_DEPTH, TILE_SIZE } from './camera'
import type { BadgeId, LabelPlace, Stop, Tile } from './road-data'
import type { Scene } from './scene'

export type Point = [number, number]

const f1 = (v: number) => v.toFixed(1)

/** An SVG polygon's points. */
const toPoints = (ps: Point[]) => ps.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')

/** An SVG path through the points. */
const toPath = (ps: Point[]) => ps.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`).join(' ')

/** Grid units to px on the map. */
export const toScreen =
  ({ u, ox, oy }: Camera) =>
  (gx: number, gy: number): Point => {
    const [x, y] = project(gx, gy)
    return [ox + x * u, oy + y * u]
  }

/** A tile's middle on the ground: a slab's is halfway along it (an angled one's too). */
const middle = (t: Tile): Point =>
  t.kind === 'slab' ? [(t.gx + (t.gx1 ?? t.gx)) / 2, (t.gy + (t.gy1 ?? t.gy)) / 2] : [t.gx, t.gy]

/** Where the road runs through these tiles, in grid units: a slab gives both its ends. */
function ends(ids: string[], byId: Map<string, Tile>): Point[] {
  return ids.flatMap((id): Point[] => {
    const t = byId.get(id)
    if (!t) return []
    return t.kind === 'slab'
      ? [
          [t.gx, t.gy],
          [t.gx1 ?? t.gx, t.gy1 ?? t.gy],
        ]
      : [[t.gx, t.gy]]
  })
}

/** level: a level's line, dashed · open: the open level's · fog: the road ahead · fork: its branch. */
export type RoadKind = 'level' | 'open' | 'fog' | 'fork' | 'next' | 'lit'
/** `id` names the line once on the map (two levels can share a kind). */
export type RoadLine = { id: string; kind: RoadKind; d: string; width: number }

/** The roads, drawn in this order under the tiles: the level lines, the road ahead, then the walked. */
export function roadLines(scene: Scene, cam: Camera): RoadLine[] {
  const at = toScreen(cam)
  const { u } = cam
  const byId = new Map(scene.tiles.map((t) => [t.id, t]))
  const line = (pts: Point[]) => toPath(pts.map(([gx, gy]) => at(gx, gy)))
  const out: RoadLine[] = []

  for (const [level, ids] of [
    ['city', scene.cityLine],
    ['course', scene.courseLine],
  ] as const) {
    if (ids.length < 2) continue
    const open = scene.openLevel === level
    out.push({
      id: level,
      kind: open ? 'open' : 'level',
      d: line(ends(ids, byId)),
      width: Math.max(1, u * (open ? 0.06 : 0.05)),
    })
  }
  if (scene.ahead.length > 1)
    out.push({ id: 'fog', kind: 'fog', d: line(ends(scene.ahead, byId)), width: u * 0.36 })

  // The thinner road off the trunk: from the step before the branch starts (the junction).
  const branch = scene.tiles.filter((t) => t.branch)
  const trunk = scene.ahead
    .map((id) => byId.get(id))
    .filter((t): t is Tile => !!t && branch.length > 0 && (t.gx1 ?? t.gx) < branch[0].gx)
    .at(-1)
  if (scene.fork && trunk) {
    const from: Point = [trunk.gx1 ?? trunk.gx, trunk.gy]
    const d = line([
      from,
      ...ends(
        branch.map((t) => t.id),
        byId,
      ),
    ])
    out.push({ id: 'fork', kind: 'fork', d, width: u * 0.3 })
  }

  if (scene.next.length > 1)
    out.push({ id: 'next', kind: 'next', d: line(ends(scene.next, byId)), width: u * 0.36 })
  if (scene.lit.length > 1)
    out.push({ id: 'lit', kind: 'lit', d: line(ends(scene.lit, byId)), width: u * 0.36 })
  return out
}

export type RulerDraw = {
  d: string
  width: number
  ticks: string[]
  /** The year labels: every other one at Whole road when the map is small. */
  years: { year: number; at: Point }[]
  now: Point
}

/** The year ruler, on the ground beside the road ahead. */
export function rulerOf(scene: Scene, cam: Camera, stop: Stop): RulerDraw {
  const at = toScreen(cam)
  const { ticks, now, from, to, gy } = scene.ruler
  const marks = ticks.map(({ year, gx }) => ({
    year,
    a0: at(gx, gy - 0.18),
    a1: at(gx, gy + 0.18),
  }))
  const every = stop === 'whole' && cam.u < 30 ? 2 : 1
  return {
    d: toPath([at(from, gy), at(to, gy)]),
    width: Math.max(1, cam.u * 0.04),
    ticks: marks.map(({ a0, a1 }) => toPath([a0, a1])),
    years: marks.filter((_, i) => i % every === 0).map(({ year, a0 }) => ({ year, at: a0 })),
    now: at(now, gy),
  }
}

/** A tile's three faces at one height; a stack draws three of these. */
export type Faces = { top: string; left: string; right: string }

export type TileDraw = {
  layers: Faces[]
  /** A ring around the tile's top, k times its size. */
  ring: (k: number) => string
  /** The invisible button over it: at least 44px each way. */
  hit: { x: number; y: number; width: number; height: number }
  /** Its middle on the map, before the lift. */
  centre: Point
  /** Its half-size in grid units, its depth and its stack's height in px. */
  size: number
  depth: number
  top: number
  /** How far it is lifted, in px. */
  lift: number
  /** The grid box it covers. */
  box: { x0: number; x1: number; y0: number; y1: number }
}

/** A tile's faces, rings and hit area, lifted `lift` px. */
export function drawTile(t: Tile, cam: Camera, lift: number): TileDraw {
  const at = toScreen(cam)
  const { u } = cam
  const size = t.sz ?? TILE_SIZE[t.kind]
  const depth = TILE_DEPTH[t.kind] * u
  const half = t.kind === 'slab' ? (t.w ?? size) : size
  const box =
    t.kind === 'slab'
      ? {
          x0: t.gx,
          x1: t.gx1 ?? t.gx,
          y0: Math.min(t.gy, t.gy1 ?? t.gy) - half,
          y1: Math.max(t.gy, t.gy1 ?? t.gy) + half,
        }
      : { x0: t.gx - size, x1: t.gx + size, y0: t.gy - size, y1: t.gy + size }
  const [mx, my] = middle(t)

  /** The top face's corners (back, right, front, left), k times its size about the middle; an angled slab runs along its own line. */
  const quad = (k: number): Point[] => {
    if (t.kind === 'slab' && t.gy1 !== undefined) {
      const dx = (t.gx1 ?? t.gx) - t.gx
      const dy = t.gy1 - t.gy
      const len = Math.hypot(dx, dy)
      const nx = (-dy / len) * half * k
      const ny = (dx / len) * half * k
      const ex = (dx / 2) * k
      const ey = (dy / 2) * k
      return [
        [mx - ex - nx, my - ey - ny],
        [mx + ex - nx, my + ey - ny],
        [mx + ex + nx, my + ey + ny],
        [mx - ex + nx, my - ey + ny],
      ]
    }
    const hx = ((box.x1 - box.x0) / 2) * k
    const hy = ((box.y1 - box.y0) / 2) * k
    return [
      [mx - hx, my - hy],
      [mx + hx, my - hy],
      [mx + hx, my + hy],
      [mx - hx, my + hy],
    ]
  }

  const layerAt = (up: number): Faces => {
    const [T, R, B, L] = quad(1).map(([gx, gy]): Point => {
      const [x, y] = at(gx, gy)
      return [x, y - up]
    })
    return {
      top: toPoints([T, R, B, L]),
      left: toPoints([L, B, [B[0], B[1] + depth], [L[0], L[1] + depth]]),
      right: toPoints([B, R, [R[0], R[1] + depth], [B[0], B[1] + depth]]),
    }
  }
  const stack = t.kind === 'stack'
  const layers = stack
    ? [layerAt(lift), layerAt(lift + depth * 1.6), layerAt(lift + depth * 3.2)]
    : [layerAt(lift)]
  const top = stack ? depth * 3.2 : 0
  const centre = at(mx, my)

  const ring = (k: number) =>
    toPoints(
      quad(k).map(([gx, gy]) => {
        const [x, y] = at(gx, gy)
        return [x, y - lift - top]
      }),
    )

  const width = Math.max(44, (t.kind === 'slab' ? box.x1 - box.x0 + 2 * size : 4 * size) * u)
  const height = Math.max(
    44,
    (t.kind === 'slab' ? (box.x1 - box.x0) / 2 + 2 * size : 2 * size) * u + depth + top,
  )
  return {
    layers,
    ring,
    hit: {
      x: centre[0] - width / 2,
      y: centre[1] - height / 2 - lift - top / 2,
      width,
      height,
    },
    centre,
    size,
    depth,
    top,
    lift,
    box,
  }
}

/**
 * The icon printed on a tile's top face, upright and flattened so it reads as a mark on the tile:
 * an SVG transform for a 24-unit icon (the reference's `icoM`). Two-thirds of the tile (half on a
 * stack, most of the junction); on a slab, near its start along its own line.
 */
export function iconOn(drawn: TileDraw, t: Tile, cam: Camera): string {
  let [gx, gy] = middle(t)
  let size = drawn.size * (t.kind === 'stack' ? 0.5 : t.kind === 'junction' ? 0.8 : 0.66)
  if (t.kind === 'slab') {
    const dx = (t.gx1 ?? t.gx) - t.gx
    const dy = (t.gy1 ?? t.gy) - t.gy
    const len = Math.hypot(dx, dy)
    const a = Math.min(0.55, len / 2)
    gx = t.gx + (dx / len) * a
    gy = t.gy + (dy / len) * a
    size = (t.w ?? drawn.size) * 0.8
  }
  const [x, y] = toScreen(cam)(gx, gy)
  const k = (size * cam.u * 2) / 24
  const m = [k, 0, 0, k * 0.56, x - 12 * k, y - drawn.lift - drawn.top - 12 * k * 0.56]
  return `matrix(${m.map((v) => v.toFixed(3)).join(',')})`
}

/** The duck standing on the tile she is on: as wide as 1.5 grid units, held between 34 and 76px. */
export function duckOn(t: Tile, cam: Camera, rs: number) {
  const [x, y] = toScreen(cam)(t.gx, t.gy)
  const width = Math.min(Math.max(cam.u * 1.5, 34 * rs), 76 * rs)
  return { x: x - width / 2, y: y - width * 0.95, width }
}

/** The order tiles are drawn in: back to front. */
export const depthOrder = (tiles: Tile[]) =>
  [...tiles].sort((a, b) => {
    const [ax, ay] = middle(a)
    const [bx, by] = middle(b)
    return ax + ay - (bx + by)
  })

export type LabelDraw = {
  place: Exclude<LabelPlace, 'none'>
  x: number
  y: number
  /** Shown only while hovered: an unlabelled tile's name. */
  hint: boolean
  /** Where she is at the Tile stop: the full label, with badges and the trade-off lines. */
  full: boolean
  /** The kind word, then the tile's own kicker: "Course · Visited". */
  kicker?: string
  when?: string
  name: string
  sub?: string
  /** "Good for: …" and "Less good for: …", each on its own line. */
  gains?: string
  costs?: string
  badges: BadgeId[]
}

export type LabelContext = {
  stop: Stop
  here: boolean
  hovered: boolean
  /** Looking at the road ahead: its steps carry their Whole road labels at Level. */
  ahead: boolean
  openLevel: Scene['openLevel']
  phone: boolean
  lift: number
  /** Pressed: open in the card. */
  pressed: boolean
  /** The root font size in px: labels hang 0.75rem from their tile. */
  rem: number
  /** The map's size in px: a name its edge would cut is hidden. Null: no edge. */
  map: { width: number; height: number } | null
  /** The tile's kind word (kindOf), worked out once per scene. */
  kind: string
}

/** A label's plate would cross the map's edge: 7rem beside, 3rem above, below and across. */
function cut(place: LabelDraw['place'], x: number, y: number, c: LabelContext): boolean {
  if (!c.map) return false
  const { width, height } = c.map
  const r = c.rem
  if (place === 'right') return x + 7 * r > width
  if (place === 'left') return x - 7 * r < 0
  if (x < 3 * r || x > width - 3 * r) return true
  return place === 'above' ? y < 3 * r : y > height - 3 * r
}

/** A tile's label at this stop, or null: its place, what it says, and where it sits in px. */
export function labelOf(t: Tile, drawn: TileDraw, cam: Camera, c: LabelContext): LabelDraw | null {
  const { stop, here } = c
  const looked = t.state === 'fog' || t.state === 'seen'
  let pos = stop === 'level' && c.ahead && looked ? t.lab.whole : t.lab[stop]
  // On a phone the icon says what a tile is, so names stay few: another city's name sits beside
  // it, and the steps ahead are named at Level only where she is or when pressed.
  if (c.phone && t.kind === 'place' && t.state === 'alt' && pos === 'above') pos = 'left'
  if (c.phone && stop === 'level' && t.state === 'fog' && !here && !c.pressed) pos = 'none'
  const hint = pos === 'none' && c.hovered && !here
  if (pos === 'none' && !hint) return null
  const place = pos === 'none' ? 'above' : pos

  const { u } = cam
  const { centre, size, depth, top, box } = drawn
  const hw = t.kind === 'slab' ? (box.x1 - box.x0) / 2 + size : 2 * size
  // The label hangs on a 0.75rem line from its tile.
  const hang = 0.75 * c.rem
  const x =
    place === 'left'
      ? centre[0] - hw * u - hang
      : place === 'right'
        ? centre[0] + hw * u + hang
        : centre[0]
  const y =
    place === 'below'
      ? centre[1] + size * u + depth + hang - c.lift
      : place === 'above'
        ? centre[1] - size * u - top - hang - c.lift
        : centre[1] - c.lift - top / 2
  // A name the map's edge would cut waits until the camera brings its tile in.
  if (!here && cut(place, x, y, c)) return null

  const full = here && stop === 'tile'
  const level = stop === 'level' && !c.phone
  const open = !!t.level && t.level === c.openLevel
  // The kind word first; "You" and "Point B" are kind words already.
  const own = t.kicker && t.kicker !== 'You' && t.kicker !== 'Point B' ? t.kicker : undefined
  const trade = (level && (open || (here && t.kind === 'course'))) || full
  return {
    place,
    x,
    y,
    hint,
    full,
    kicker: c.phone && !here ? undefined : [c.kind, own].filter(Boolean).join(' · '),
    when: t.when && stop !== 'whole' && t.kind !== 'step' ? t.when : undefined,
    name: stop === 'whole' ? (t.short ?? t.name) : t.name,
    sub:
      t.sub && ((t.kind === 'stack' && stop !== 'whole') || (level && here) || full)
        ? t.sub
        : undefined,
    gains: trade ? t.gains : undefined,
    costs: trade ? t.costs : undefined,
    badges: full ? (t.badges ?? []) : [],
  }
}
