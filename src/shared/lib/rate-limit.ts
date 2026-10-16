import { Lru } from './lru'

// A small fixed-window rate limiter held in this process's memory. Enough for one server instance
// (the one Cloud Run instance of ADR-120): with several, each counts on its own, so a client could
// make the limit times the instances, and a shared store would replace this. At most `maxKeys`
// counts are held, the oldest forgotten first, so memory stays bounded whoever calls.

export type RateLimit = { ok: true } | { ok: false; retryAfterSeconds: number }

/** A limiter: `hit(key)` counts one request for the key and says whether it is within the limit. */
export function rateLimiter(options: { limit: number; windowMs: number; maxKeys: number }) {
  const { limit, windowMs, maxKeys } = options
  const windows = new Lru<{ start: number; count: number }>(maxKeys)
  return function hit(key: string, now: number = Date.now()): RateLimit {
    const open = windows.get(key)
    const window = open && now - open.start < windowMs ? open : { start: now, count: 0 }
    window.count += 1
    windows.set(key, window)
    if (window.count <= limit) return { ok: true }
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((window.start + windowMs - now) / 1000)),
    }
  }
}

/**
 * The client's address to count by: the x-forwarded-for entry the platform appended, else
 * x-real-ip, else one key every such request shares (SR9).
 *
 * A browser can send its own x-forwarded-for, and Google's front end keeps it: the header
 * arrives as `[<supplied-value>,]<client-ip>[,<load-balancer-ip>]`, and "the load balancer does
 * not verify any IP addresses that precede <client-ip>" (Google Cloud, "External Application Load
 * Balancer overview", https://cloud.google.com/load-balancing/docs/https#x-forwarded-for_header).
 * So the left-most entry is a claim and the right-most entries are the platform's. The Cloud Run
 * container contract (https://cloud.google.com/run/docs/container-contract) does not list the
 * header for a service reached at its run.app URL (ADR-120, no load balancer), so the count is
 * taken from the right: TRUSTED_PROXY_HOPS (default 1, the one front end) entries in. Put a load
 * balancer in front and set it to 2.
 */
export function clientAddress(headers: Headers, hops: number = trustedProxyHops()): string {
  const entries =
    headers
      .get('x-forwarded-for')
      ?.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean) ?? []
  const forwarded = entries[Math.max(0, entries.length - hops)]
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}

/** How many x-forwarded-for entries, from the right, the platform appended: 1 unless set. */
function trustedProxyHops(): number {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10)
  return hops >= 1 ? hops : 1
}
