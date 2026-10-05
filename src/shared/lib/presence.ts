// A user is "online" if their last page load was within this window; also the label threshold.
export const ONLINE_WINDOW_MS = 3 * 60_000

// Don't rewrite last_seen_at more than once per this window (see presence-server.ts). Kept
// tighter than ONLINE_WINDOW_MS so an actively-browsing user never ages out of "online".
export const LAST_SEEN_THROTTLE_MS = 2 * 60_000

/** `lastSeenMs` is epoch milliseconds (never a Date — avoids server→client rehydration bugs). */
export function isOnline(lastSeenMs: number | null, now: number): boolean {
  return lastSeenMs !== null && now - lastSeenMs < ONLINE_WINDOW_MS
}

/** Human "last seen": Never | Online | Nm ago | Nh ago | Nd ago. */
export function lastSeenLabel(lastSeenMs: number | null, now: number): string {
  if (lastSeenMs === null) return 'Never'
  const diff = now - lastSeenMs
  if (diff < ONLINE_WINDOW_MS) return 'Online'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
