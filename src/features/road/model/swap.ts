// The swap on the arc (spec §7, ADR-056): the tile arriving on the road and the one leaving it
// pass each other on short arcs bowed apart along the road, so they never overlap. Pure: a frame
// of the move between two scenes.

import type { Tile } from './road-data'
import type { Scene } from './scene'

/** A swap takes this long, in ms (spec §9). */
export const SWAP_MS = 600

/** How far each arc bows from the straight line at its middle, in grid units. */
const BOW = 1.1

/** The tiles on both scenes whose place changed. */
export function movedTiles(before: Scene, after: Scene): string[] {
  return after.tiles
    .filter((t) => {
      const was = before.tiles.find((b) => b.id === t.id)
      return !!was && (was.gx !== t.gx || was.gy !== t.gy)
    })
    .map((t) => t.id)
}

/**
 * The after scene with each moved tile k of the way along its arc (a quadratic curve whose middle
 * sits BOW off the line, the tile arriving at her road on one side and the one leaving on the
 * other). Everything else is the after scene's.
 */
export function swapFrame(before: Scene, after: Scene, k: number): Scene {
  const moved = new Set(movedTiles(before, after))
  const tiles = after.tiles.map((t): Tile => {
    const was = before.tiles.find((b) => b.id === t.id)
    if (!was || !moved.has(t.id)) return t
    const side = t.id === after.here ? 1 : -1
    // The control point sits twice the bow off the middle, so the curve's middle is BOW off.
    const cx = (was.gx + t.gx) / 2 + 2 * BOW * side
    const cy = (was.gy + t.gy) / 2
    const a = (1 - k) ** 2
    const b = 2 * (1 - k) * k
    const c = k ** 2
    return { ...t, gx: a * was.gx + b * cx + c * t.gx, gy: a * was.gy + b * cy + c * t.gy }
  })
  return { ...after, tiles }
}
