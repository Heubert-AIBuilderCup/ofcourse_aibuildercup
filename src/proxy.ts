import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/shared/lib/auth'
import { canSeeBoard } from '@/shared/lib/auth/access'
import {
  HOME_PATH,
  isAdminPath,
  isAdminSignInPath,
  publicPathKind,
  SUSPENDED_PATH,
  welcomeUrl,
} from '@/shared/lib/auth/gate'
import { clientAddress, rateLimiter } from '@/shared/lib/rate-limit'

/**
 * Route protection. Signed-out visitors to the student app go to the sign-in page at /, to the
 * admin to the admin sign-in page, each remembering the page asked for; /admin also needs an
 * account that may see the Board (an editor, a reviewer, an admin or a superadmin) and is not
 * suspended. The admin sign-in page, /, /suspended, /signin-error, /api, a live post's page and
 * images under /posts (POSTS_PATH), a live blog's under /blog (BLOG_PATH), /sitemap.xml and
 * /robots.txt are public (proxy.test.ts). /posts and /blog are matched only to rate-limit them:
 * about 60 pages and 60 images a minute per client address, posts and blogs together, then 429
 * with Retry-After (criterion 107, BR9, security.md §8). The count is held in this
 * process (shared/lib/rate-limit.ts): right for the one Cloud Run instance, per instance beyond.
 *
 * The student app and feed check reads only the session cookie (the proxy runs on every matched
 * and prefetched request, so no database there); their layouts check the account
 * (appPageRedirect in auth/gate.ts: the student pages for students only, the feed for every
 * account). /admin, which only staff visit, validates the session and its role in full. Neither
 * replaces the checks in each page and server action (auth/session.ts).
 */
export default async function proxy(req: NextRequest) {
  const kind = publicPathKind(req.nextUrl.pathname)
  if (kind) return limitPublic(req, kind)
  if (isAdminSignInPath(req.nextUrl.pathname)) return NextResponse.next()
  if (!getSessionCookie(req)) {
    return NextResponse.redirect(welcomeUrl(req.nextUrl))
  }
  if (isAdminPath(req.nextUrl.pathname)) {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session) return NextResponse.redirect(welcomeUrl(req.nextUrl))
    if (session.user.suspendedAt) return NextResponse.redirect(new URL(SUSPENDED_PATH, req.nextUrl))
    if (!canSeeBoard(session.user)) return NextResponse.redirect(new URL(HOME_PATH, req.nextUrl))
  }
  return NextResponse.next()
}

/** The public post and blog pages and their images, each counted per client address and minute. */
const PUBLIC_LIMIT = { limit: 60, windowMs: 60_000, maxKeys: 10_000 }
const publicHit = rateLimiter(PUBLIC_LIMIT)

/** A public post or blog page or image goes through within its limit; past it, 429 with when to retry. */
function limitPublic(req: NextRequest, kind: 'page' | 'image'): NextResponse {
  const hit = publicHit(`${kind}:${clientAddress(req.headers)}`)
  if (hit.ok) return NextResponse.next()
  return new NextResponse('Too many requests. Please try again shortly.', {
    status: 429,
    headers: { 'Retry-After': String(hit.retryAfterSeconds) },
  })
}

// Keep in step with APP_PATHS in auth/gate.ts, plus /posts and /blog for their rate limit only. Matchers must
// be literals.
export const config = {
  matcher: [
    '/start/:path*',
    '/onboarding/:path*',
    '/roadmaps/:path*',
    '/road/:path*',
    '/feed/:path*',
    '/admin/:path*',
    '/posts/:path*',
    '/blog/:path*',
  ],
}
