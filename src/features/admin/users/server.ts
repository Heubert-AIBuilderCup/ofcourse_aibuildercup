import 'server-only'
import { and, desc, eq, gt, ilike, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { InviteRole, Role } from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import { roleInvite, session, user } from '@/shared/lib/db/schema'
import { ONLINE_WINDOW_MS } from '@/shared/lib/presence'
import {
  containsPattern,
  USERS_PAGE_SIZE,
  type UserStatusFilter,
  type UsersParams,
} from '../lib/params'

// Server-only reads for the users list and the page for one account. Every page that calls
// these has already passed requireAdmin(); the changes are in ./commands.ts, behind ./actions.ts.
// Personal data (names, emails) leaves here only for those admin pages.

/** Far above one person's open sessions; the page stops here rather than grow. */
const MAX_SESSIONS = 50
/** The addresses waiting on a first sign-in: a handful of invited addresses, capped all the same. */
const MAX_WAITING = 500

const statusCondition: Record<UserStatusFilter, SQL | undefined> = {
  all: undefined,
  active: isNull(user.suspendedAt),
  suspended: isNotNull(user.suspendedAt),
}

// Seen within the online window, by this server's clock (the labels use it too).
const seenSince = () => new Date(Date.now() - ONLINE_WINDOW_MS)

/** Part of the name or the email. */
function searchCondition(q: string): SQL | undefined {
  if (!q) return undefined
  const pattern = containsPattern(q)
  return or(ilike(user.name, pattern), ilike(user.email, pattern))
}

export type UserListRow = {
  id: string
  name: string
  email: string
  role: Role
  editor: boolean
  reviewer: boolean
  suspended: boolean
  lastSeenMs: number | null
  createdAt: Date
}

/**
 * One page of the users list, newest first, with the search and every filter combined. The rows
 * and their total come back in one query; who is online now is counted across every account,
 * whatever the filters, in one more.
 */
export async function getUsers(
  p: UsersParams,
): Promise<{ rows: UserListRow[]; total: number; onlineNow: number }> {
  const since = seenSince()
  const where = and(
    searchCondition(p.q),
    p.role === 'all' ? undefined : eq(user.role, p.role),
    statusCondition[p.status],
    p.online ? gt(user.lastSeenAt, since) : undefined,
  )
  const [rows, [counts]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        editor: user.editor,
        reviewer: user.reviewer,
        suspended: sql<boolean>`${user.suspendedAt} is not null`,
        lastSeenAt: user.lastSeenAt,
        createdAt: user.createdAt,
        // The count before LIMIT, so the rows and the total come back in one query.
        total: sql<number>`cast(count(*) over() as int)`,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(USERS_PAGE_SIZE)
      .offset(p.page * USERS_PAGE_SIZE),
    db
      .select({
        onlineNow: sql<number>`cast(count(*) filter (where ${gt(user.lastSeenAt, since)}) as int)`,
      })
      .from(user),
  ])
  return {
    total: rows[0]?.total ?? 0,
    onlineNow: counts?.onlineNow ?? 0,
    rows: rows.map(({ total: _total, lastSeenAt, ...r }) => ({
      ...r,
      lastSeenMs: lastSeenAt?.getTime() ?? null,
    })),
  }
}

export type UserDetail = {
  id: string
  email: string
  name: string
  role: Role
  editor: boolean
  reviewer: boolean
  suspendedAt: Date | null
  suspendReason: string | null
  createdAt: Date
  sessions: { id: string; createdAt: Date; userAgent: string | null }[]
  lastSeenMs: number | null
}

/** Everything the page for one account shows, or null for an unknown id. Two queries at once. */
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const [[u], sessions] = await Promise.all([
    db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        editor: user.editor,
        reviewer: user.reviewer,
        suspendedAt: user.suspendedAt,
        suspendReason: user.suspendReason,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1),
    db
      .select({ id: session.id, createdAt: session.createdAt, userAgent: session.userAgent })
      .from(session)
      .where(and(eq(session.userId, id), gt(session.expiresAt, new Date())))
      .orderBy(desc(session.createdAt))
      .limit(MAX_SESSIONS),
  ])
  if (!u) return null
  const { lastSeenAt, ...rest } = u
  return { ...rest, sessions, lastSeenMs: lastSeenAt?.getTime() ?? null }
}

export type WaitingInvite = {
  email: string
  // Null when only capabilities wait.
  role: InviteRole | null
  editor: boolean
  reviewer: boolean
  createdAt: Date
  createdByName: string | null
}

/** The addresses a superadmin gave a role or capabilities before their first sign-in, newest first. */
export async function getWaitingInvites(): Promise<WaitingInvite[]> {
  return db
    .select({
      email: roleInvite.email,
      role: roleInvite.role,
      editor: roleInvite.editor,
      reviewer: roleInvite.reviewer,
      createdAt: roleInvite.createdAt,
      createdByName: user.name,
    })
    .from(roleInvite)
    .leftJoin(user, eq(user.id, roleInvite.createdByUserId))
    .orderBy(desc(roleInvite.createdAt))
    .limit(MAX_WAITING)
}

/** Superadmins whose account is not suspended: the count the last-superadmin rules use. */
export async function countActiveSuperadmins(): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(user)
    .where(and(eq(user.role, 'superadmin'), isNull(user.suspendedAt)))
  return row?.c ?? 0
}
