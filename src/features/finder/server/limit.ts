import 'server-only'
import { type RateLimit, rateLimiter } from '@/shared/lib/rate-limit'
import { FINDER_PER_HOUR } from '../model/config'

// How many searches one student may make in an hour (criterion 10, security-llm §3): past it she
// is told when she can search again, and nothing is embedded. Counted in this process's memory
// (shared/lib/rate-limit.ts), right for the one Cloud Run instance.

const HOUR_MS = 60 * 60 * 1000

const hit = rateLimiter({ limit: FINDER_PER_HOUR, windowMs: HOUR_MS, maxKeys: 10_000 })

/** Counts one search for this student: ok, or how long until she may search again. */
export function finderAllowed(userId: string): RateLimit {
  return hit(userId)
}
