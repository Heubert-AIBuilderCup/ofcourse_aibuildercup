import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from '@/shared/lib/auth'
import { canSeeBoard, canUseAdmin } from './access'
import {
  ADMIN_SIGNIN_PATH,
  appPageRedirect,
  BOARD_PATH,
  HOME_PATH,
  SIGNIN_PATH,
  SUSPENDED_PATH,
} from './gate'

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
 * The session for a page of the signed-in app (APP_PATHS), or a redirect: the sign-in page at /
 * signed out, else where appPageRedirect sends the account (/suspended, or their admin home for
 * staff on a student page). The feed takes every account that is not suspended.
 */
export async function requireAppPage(pathname: string): Promise<Session> {
  const session = await readSession()
  if (!session) redirect(SIGNIN_PATH)
  const to = appPageRedirect(pathname, session.user)
  if (to) redirect(to)
  return session
}

/**
 * The session of a student (isStudent: role user, no content capability), or a redirect: as
 * requireSession, else their admin home for staff (an admin, a superadmin, an editor or a
 * reviewer), who have no student app.
 */
export async function requireStudent(): Promise<Session> {
  return requireAppPage(HOME_PATH)
}

/** The session for an admin page, or a redirect: the admin sign-in page signed out, /suspended. */
async function requireAdminSession(): Promise<Session> {
  const session = await readSession()
  if (!session) redirect(ADMIN_SIGNIN_PATH)
  if (session.user.suspendedAt) redirect(SUSPENDED_PATH)
  return session
}

/**
 * The session of an admin or a superadmin, or a redirect: the admin sign-in page signed out,
 * /suspended for a suspended account, then the Board for an account that may see it without
 * being an admin (an editor or a reviewer), else the student app's home.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireAdminSession()
  if (!canUseAdmin(session.user.role)) redirect(canSeeBoard(session.user) ? BOARD_PATH : HOME_PATH)
  return session
}

/**
 * The session of anyone who may see the admin's Board (an editor, a reviewer, an admin or a
 * superadmin), or a redirect: as requireAdmin signed out or suspended, else the student app's home.
 */
export async function requireBoard(): Promise<Session> {
  const session = await requireAdminSession()
  if (!canSeeBoard(session.user)) redirect(HOME_PATH)
  return session
}
