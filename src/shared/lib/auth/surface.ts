// Which sign-in page a request to Better Auth came from: the student page or the admin page. The
// user and session hooks in ./index read it to decide who a sign-up becomes and which sessions a
// page refuses (the rules themselves are in ./access).
// Server code, but no 'server-only' import: ./index loads this module, and hooks.test.ts loads
// ./index under `bun test`, where 'server-only' throws.

import { AsyncLocalStorage } from 'node:async_hooks'
import { getOAuthState } from 'better-auth/api'
import { isSurface, type Surface } from './access'

/** 'any' is the dev login without a page: the starter's rules, no page checks. */
export type SurfaceOrAny = Surface | 'any'

/** The code of a new code asked for less than 30 seconds after the last one (./index). */
export const CODE_RECENTLY_SENT = 'CODE_RECENTLY_SENT'

/** The email-code paths. Only the student page offers codes. */
export const EMAIL_CODE_PATHS: readonly string[] = [
  '/sign-in/email-otp',
  '/email-otp/send-verification-otp',
]

const store = new AsyncLocalStorage<SurfaceOrAny>()

/**
 * Runs `fn` as a sign-in on `surface`, for callers that reach the hooks without an endpoint: the
 * dev login and the database tests.
 */
export function runWithSurface<T>(surface: SurfaceOrAny, fn: () => Promise<T>): Promise<T> {
  return store.run(surface, fn)
}

// The page a Google sign-in started on, put in the OAuth state by the `/sign-in/social` hook in
// ./index. Better Auth keeps the state on the server (or encrypted in a cookie) and fills that part
// only from the hook, so the client cannot change it. Outside a Better Auth request there is no
// state to read, and the call throws.
async function oauthSurface(): Promise<Surface | null> {
  try {
    const surface = (await getOAuthState())?.serverContext?.surface
    return isSurface(surface) ? surface : null
  } catch {
    return null
  }
}

/**
 * The page the current sign-in came from: the surface `runWithSurface` set, else the student page
 * for an email-code path, else the page the Google sign-in started on, else the student page,
 * which grants the least.
 */
export async function currentSurface(ctx: { path?: string } | null): Promise<SurfaceOrAny> {
  const set = store.getStore()
  if (set) return set
  if (ctx?.path && EMAIL_CODE_PATHS.includes(ctx.path)) return 'student'
  return (await oauthSurface()) ?? 'student'
}
