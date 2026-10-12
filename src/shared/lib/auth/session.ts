import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from '@/shared/lib/auth'
import { canUseAdmin, canUseStudentApp } from './access'
import { ADMIN_PATH, ADMIN_SIGNIN_PATH, HOME_PATH, SIGNIN_PATH, SUSPENDED_PATH } from './gate'

// The stored session, suspended or not. React cache() dedupes it within one server render, so
// the layout and the page share a single lookup per request.
const readSession = cache(async () => auth.api.getSession({ headers: await headers() }))

/**
 * The signed-in session, or null. A session made before its account was suspended counts as
 * signed out; no new one is ever made while it is suspended (auth/index.ts).
 */
export async function getSession() {
  const session = await readSession()
  return session?.user.suspendedAt ? null : session
}

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>

/**
 * The session, or a redirect: the sign-in page at / signed out, /suspended for a suspended account.
 * For pages and layouts; server actions should return an error instead.
 */
export async function requireSession(): Promise<Session> {
  const session = await readSession()
  if (!session) redirect(SIGNIN_PATH)
  if (session.user.suspendedAt) redirect(SUSPENDED_PATH)
  return session
}

/**
 * The session of a student (role user), or a redirect: as requireSession, else the admin for an
 * admin or a superadmin, who have no student app.
 */
export async function requireStudent(): Promise<Session> {
  const session = await requireSession()
  if (!canUseStudentApp(session.user.role)) redirect(ADMIN_PATH)
  return session
}

/**
 * The session of an admin or a superadmin, or a redirect: the admin sign-in page signed out,
 * /suspended for a suspended account, else the student app's home.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await readSession()
  if (!session) redirect(ADMIN_SIGNIN_PATH)
  if (session.user.suspendedAt) redirect(SUSPENDED_PATH)
  if (!canUseAdmin(session.user.role)) redirect(HOME_PATH)
  return session
}
