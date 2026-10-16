import 'server-only'
import { rateLimiter } from '@/shared/lib/rate-limit'

// How many readings of her own words one student may ask the model for in an hour (security-llm
// §3): past it the reading is `failed`, so the questions carry on, and the model is not called.
// Counted in this process's memory (shared/lib/rate-limit.ts), right for the one Cloud Run
// instance, as the roads' why-limit is.

export const OWN_WORDS_PER_HOUR = 20

const HOUR_MS = 60 * 60 * 1000

const hit = rateLimiter({ limit: OWN_WORDS_PER_HOUR, windowMs: HOUR_MS, maxKeys: 10_000 })

/** Counts one reading for this student, and says whether the model may read it. */
export function ownWordsAllowed(userId: string): boolean {
  return hit(userId).ok
}
