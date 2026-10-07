// The development-only sign-in behind /api/dev-login, for Playwright (Google sign-in cannot run
// in tests). Closed in production and whenever DEV_LOGIN_SECRET is unset; open only to a request
// carrying that secret in the `x-dev-login-secret` header.

import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { SURFACES } from './access'

export const DEV_LOGIN_HEADER = 'x-dev-login-secret'

const digest = (value: string) => createHash('sha256').update(value).digest()

/** True only outside production, with a configured secret, for a request that carries it. */
export function devLoginAllowed(
  env: { nodeEnv: string | undefined; secret: string | undefined },
  provided: string | null,
): boolean {
  if (env.nodeEnv === 'production') return false
  const secret = env.secret?.trim()
  if (!secret || provided == null) return false
  // Equal-length digests, so the comparison takes the same time whatever was sent.
  return timingSafeEqual(digest(secret), digest(provided))
}

/** The request body: who to sign in as, and optionally on which sign-in page. */
export const devLoginInput = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  name: z.string().trim().min(1).max(80).optional(),
  surface: z.enum(SURFACES).optional(),
})
