import 'server-only'
import { rateLimiter } from '@/shared/lib/rate-limit'

// How many whys one student may ask the model for in an hour (security-llm §3): past it she still
// gets the template, never an error, and the model is not called. Counted in this process's memory
// (shared/lib/rate-limit.ts), right for the one Cloud Run instance.

export const WHY_PER_HOUR = 60

const HOUR_MS = 60 * 60 * 1000

const hit = rateLimiter({ limit: WHY_PER_HOUR, windowMs: HOUR_MS, maxKeys: 10_000 })

/** Counts one why for this student, and says whether the model may write it. */
export function whyAllowed(userId: string): boolean {
  return hit(userId).ok
}
