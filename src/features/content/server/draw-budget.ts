/**
 * The time a background run may go on starting model calls: `ms` from when it is made, on
 * `now`. A run checks `allows()` before each call it would start; once it says no, the run
 * starts none and saves what it has.
 */
export function drawBudget(ms: number, now: () => number = Date.now) {
  const end = now() + ms
  return { allows: () => now() < end }
}
