// One wheel gesture moves the feed one post, or a post's slides one slide (given the sideways delta),
// as TikTok's does: a mouse notch, a trackpad flick and
// its long tail of momentum events are each one gesture. A gesture ends after a quiet gap; a new
// one moves again only once the last move has had time to land. The gate is pure: the caller
// passes the time. A scroller inside the feed (a long panel, an update) takes the wheel first.

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

const SCROLLS = new Set(['auto', 'scroll', 'overlay'])

/** Whether `el` scrolls along `axis` and can still move by `delta` (not at that end). */
function canScroll(el: Element, axis: 'x' | 'y', delta: number): boolean {
  const style = getComputedStyle(el)
  if (!SCROLLS.has(axis === 'y' ? style.overflowY : style.overflowX)) return false
  const [pos, client, size] =
    axis === 'y'
      ? [el.scrollTop, el.clientHeight, el.scrollHeight]
      : [el.scrollLeft, el.clientWidth, el.scrollWidth]
  if (size <= client) return false
  // A pixel of slack: a zoomed page leaves the end a fraction short.
  return delta > 0 ? pos + client < size - 1 : pos > 0
}

/**
 * Whether an element between the wheel's `target` and `boundary` (the feed's scroller or a post's
 * slide strip, itself not asked) can still scroll by `delta` along `axis`: then its own scroll
 * takes the wheel, and the boundary's handler leaves the event alone.
 */
export function nestedScroll(
  target: EventTarget | null,
  boundary: Element,
  axis: 'x' | 'y',
  delta: number,
): boolean {
  for (
    let el = target instanceof Element ? target : null;
    el && el !== boundary;
    el = el.parentElement
  ) {
    if (canScroll(el, axis, delta)) return true
  }
  return false
}
