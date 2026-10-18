// One wheel gesture moves the feed one post, or a post's slides one slide (given the sideways delta),
// as TikTok's does: a mouse notch, a trackpad flick and
// its long tail of momentum events are each one gesture. A gesture ends after a quiet gap; a new
// one moves again only once the last move has had time to land. Pure: the caller passes the time.

/** Quiet longer than this ends a gesture; a trackpad's momentum events come closer together. */
const GESTURE_GAP_MS = 200
/** The least time between two moves: about how long the smooth scroll takes to land. */
const STEP_MS = 500
/** Smaller movements are noise (a resting finger on a trackpad), not a gesture. */
const MIN_DELTA = 4

/** A gate for wheel events: each call says whether to move one post down (1), up (-1) or not (0). */
export function wheelGate(): (at: number, deltaY: number) => -1 | 0 | 1 {
  let lastEvent = Number.NEGATIVE_INFINITY
  let lastStep = Number.NEGATIVE_INFINITY
  return (at, deltaY) => {
    if (Math.abs(deltaY) < MIN_DELTA) return 0
    const newGesture = at - lastEvent > GESTURE_GAP_MS
    lastEvent = at
    if (!newGesture || at - lastStep < STEP_MS) return 0
    lastStep = at
    return deltaY > 0 ? 1 : -1
  }
}
