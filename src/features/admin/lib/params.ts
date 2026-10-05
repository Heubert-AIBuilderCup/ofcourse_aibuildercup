// The admin lists' URL parameters: search, filter and page, read defensively from the URL.

import { ROLES, type Role } from '@/shared/lib/auth/access'

const MAX_QUERY = 100

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

const oneOf = <T extends string>(values: readonly T[], v: string, fallback: T): T =>
  (values as readonly string[]).includes(v) ? (v as T) : fallback

function page(v: string | string[] | undefined): number {
  const n = Number.parseInt(one(v), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const query = (v: string | string[] | undefined) => one(v).trim().slice(0, MAX_QUERY)

// ── The users list ──────────────────────────────────────────────────────────────────────────

export const USERS_PAGE_SIZE = 25

export const USER_STATUS_FILTERS = ['all', 'active', 'suspended'] as const
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number]

const USER_ROLE_FILTERS = ['all', ...ROLES] as const

export type UsersParams = {
  q: string
  role: Role | 'all'
  status: UserStatusFilter
  online: boolean
  page: number
}

/** The users list's search and filters; anything unknown falls back to everyone. */
export function parseUsersParams(sp: Record<string, string | string[] | undefined>): UsersParams {
  return {
    q: query(sp.q),
    role: oneOf(USER_ROLE_FILTERS, one(sp.role), 'all'),
    status: oneOf(USER_STATUS_FILTERS, one(sp.status), 'all'),
    online: one(sp.online) === '1',
    page: page(sp.page),
  }
}

/** An ilike pattern matching the search anywhere, with its own %, _ and \ taken literally. */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
