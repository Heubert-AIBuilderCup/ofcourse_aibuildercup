// Test-only database access for the e2e specs: read what a flow wrote, and clean up. Never
// imported by the app. Every query is parameterised by the postgres client's tagged template.

import postgres from 'postgres'
import { E2E_DOMAIN } from './accounts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set: the e2e db helpers read it from .env.')

// A small pool that lets the worker exit once idle.
export const sql = postgres(url, { max: 2, prepare: false, idle_timeout: 5, onnotice: () => {} })

export async function userIdByEmail(email: string): Promise<string | null> {
  const [row] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`
  return row?.id ?? null
}

/** How many accounts there are, e2e or not. */
export async function countUsers(): Promise<number> {
  const [row] = await sql<{ c: number }[]>`select count(*)::int as c from "user"`
  return row?.c ?? 0
}

/** Delete e2e users (and, by cascade, their sessions and accounts). */
export async function deleteUsers(emails: string[]): Promise<void> {
  const own = emails.filter((e) => e.endsWith(`@${E2E_DOMAIN}`))
  if (own.length > 0) await sql`delete from "user" where email in ${sql(own)}`
}

/** Give an e2e account a role straight in the database (user-management.e2e.ts covers the UI). */
export async function setRole(email: string, role: 'user' | 'admin' | 'superadmin'): Promise<void> {
  if (!email.endsWith(`@${E2E_DOMAIN}`)) throw new Error(`Not an e2e account: ${email}`)
  await sql`update "user" set role = ${role} where email = ${email}`
}

/** An account's role, suspension and open sessions; null when there is no account. */
export async function accountState(
  email: string,
): Promise<{ role: string; suspended: boolean; sessions: number } | null> {
  const [row] = await sql<{ role: string; suspended: boolean; sessions: number }[]>`
    select u.role, u.suspended_at is not null as suspended,
      (select count(*)::int from session s where s.user_id = u.id) as sessions
    from "user" u where u.email = ${email}`
  return row ?? null
}

/** Delete the roles waiting on e2e addresses. */
export async function deleteRoleInvites(emails: string[]): Promise<void> {
  const own = emails.filter((e) => e.endsWith(`@${E2E_DOMAIN}`))
  if (own.length > 0) await sql`delete from role_invite where email in ${sql(own)}`
}
