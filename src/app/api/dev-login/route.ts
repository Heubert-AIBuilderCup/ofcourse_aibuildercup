import { isAPIError } from 'better-auth/api'
import { makeSignature } from 'better-auth/crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/shared/lib/auth'
import { DEV_LOGIN_HEADER, devLoginAllowed, devLoginInput } from '@/shared/lib/auth/dev-login'
import { ACCOUNT_SUSPENDED } from '@/shared/lib/auth/gate'

const notFound = () => new Response('Not Found', { status: 404 })

/**
 * Development-only sign-in for Playwright: POST `{ email, name? }` with the `x-dev-login-secret`
 * header. Finds or creates the user through Better Auth's internal adapter (so the create hook
 * assigns the role), opens a session and sets the signed session cookie,
 * exactly as a Google sign-in would. A 404 in production, without DEV_LOGIN_SECRET, or with the
 * wrong secret, so the route does not reveal itself; a 403 for a suspended account, which the
 * session hook refuses as it refuses a Google sign-in.
 */
export async function POST(request: Request) {
  const allowed = devLoginAllowed(
    { nodeEnv: process.env.NODE_ENV, secret: process.env.DEV_LOGIN_SECRET },
    request.headers.get(DEV_LOGIN_HEADER),
  )
  if (!allowed) return notFound()

  const body = devLoginInput.safeParse(await request.json().catch(() => null))
  if (!body.success) return Response.json({ error: 'Send an email.' }, { status: 400 })
  const { email, name } = body.data

  const ctx = await auth.$context
  const found = await ctx.internalAdapter.findUserByEmail(email)
  const user =
    found?.user ??
    (await ctx.internalAdapter.createUser(
      { email, name: name ?? email.split('@')[0], emailVerified: true },
      { method: 'dev-login' },
    ))
  const session = await ctx.internalAdapter
    .createSession(user.id, false)
    .catch((error: unknown) => {
      if (isAPIError(error) && error.body?.code === ACCOUNT_SUSPENDED) return null
      throw error
    })
  if (!session) return Response.json({ error: ACCOUNT_SUSPENDED }, { status: 403 })

  const cookie = ctx.authCookies.sessionToken
  const value = `${session.token}.${await makeSignature(session.token, ctx.secret)}`
  const response = NextResponse.json({ userId: user.id })
  response.cookies.set(cookie.name, value, {
    path: cookie.attributes.path ?? '/',
    httpOnly: cookie.attributes.httpOnly ?? true,
    secure: cookie.attributes.secure ?? false,
    sameSite: 'lax',
    maxAge: cookie.attributes.maxAge,
  })
  return response
}
