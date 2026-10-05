import { NextResponse } from 'next/server'
import { signinErrorTarget } from '@/shared/lib/auth/gate'

/**
 * Where Better Auth sends a failed Google sign-in (GoogleSignIn's errorCallbackURL), appending
 * `?error=<code>&error_description=<text>`. A suspended account goes on to /suspended, any other
 * failure back to /welcome with its message; nothing from the query is shown or followed. Public:
 * the proxy's matcher leaves it out, as a refused sign-in has no session.
 */
export function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('error')
  return NextResponse.redirect(new URL(signinErrorTarget(code), request.url))
}
