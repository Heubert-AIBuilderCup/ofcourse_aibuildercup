import { NextResponse } from 'next/server'
import { adminSigninErrorTarget } from '@/shared/lib/auth/gate'

/**
 * Where Better Auth sends a failed Google sign-in from the admin sign-in page (its
 * errorCallbackURL), appending `?error=<code>&error_description=<text>`. A suspended account goes
 * on to /suspended, an account without admin access back to the admin sign-in page with that
 * message, any other failure back there with its message; nothing from the query is shown or
 * followed. Public: the proxy's matcher leaves it out, as a refused sign-in has no session.
 */
export function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('error')
  return NextResponse.redirect(new URL(adminSigninErrorTarget(code), request.url))
}
