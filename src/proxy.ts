import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/shared/lib/auth'
import { canUseAdmin } from '@/shared/lib/auth/access'
import { HOME_PATH, isAdminPath, SUSPENDED_PATH, welcomeUrl } from '@/shared/lib/auth/gate'

/**
 * Route protection. Signed-out visitors to the app or the admin pages go to the sign-in page at
 * /; /admin also needs an admin role on an account that is not suspended. /, /suspended,
 * /signin-error and /api are not matched: public.
 *
 * The app check reads only the session cookie (the proxy runs on every matched and prefetched
 * request, so no database there). /admin, which only admins visit, validates the session and its
 * role in full. Neither replaces the checks in each page and server action (auth/session.ts).
 */
export default async function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) {
    return NextResponse.redirect(welcomeUrl(req.nextUrl))
  }
  if (isAdminPath(req.nextUrl.pathname)) {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session) return NextResponse.redirect(welcomeUrl(req.nextUrl))
    if (session.user.suspendedAt) return NextResponse.redirect(new URL(SUSPENDED_PATH, req.nextUrl))
    if (!canUseAdmin(session.user.role))
      return NextResponse.redirect(new URL(HOME_PATH, req.nextUrl))
  }
  return NextResponse.next()
}

// Keep in step with APP_PATHS in auth/gate.ts. Matchers must be literals.
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}
