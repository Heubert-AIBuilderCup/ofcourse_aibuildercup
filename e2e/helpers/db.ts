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

// The email-code plugin's stored code for an address: one row keyed `sign-in-otp-<email>`, its
// value `<code>:<wrong tries>`.
const codeKey = (email: string) => `sign-in-otp-${email.toLowerCase()}`

/** The six-digit code last sent to `email` (read straight from the database, as no mail is sent). */
export async function latestSignInCode(email: string): Promise<string> {
  const [row] = await sql<{ value: string }[]>`
    select value from verification where identifier = ${codeKey(email)}
    order by created_at desc limit 1`
  if (!row) throw new Error(`No sign-in code stored for ${email}`)
  return row.value.slice(0, row.value.lastIndexOf(':'))
}

/** Make the code sent to `email` a minute past its expiry. */
export async function expireSignInCode(email: string): Promise<void> {
  await sql`update verification set expires_at = now() - interval '1 minute'
    where identifier = ${codeKey(email)}`
}

/** Move the code sent to `email` `seconds` into the past, as if it had been sent that much earlier. */
export async function ageSignInCode(email: string, seconds: number): Promise<void> {
  await sql`update verification set expires_at = expires_at - make_interval(secs => ${seconds})
    where identifier = ${codeKey(email)}`
}

/** Delete the codes stored for e2e addresses: an unused or voided code stays in the table. */
export async function deleteSignInCodes(emails: string[]): Promise<void> {
  const own = emails.filter((e) => e.endsWith(`@${E2E_DOMAIN}`)).map(codeKey)
  if (own.length > 0) await sql`delete from verification where identifier in ${sql(own)}`
}

/** Suspend an e2e account straight in the database (user-management.e2e.ts covers the UI). */
export async function suspend(email: string): Promise<void> {
  if (!email.endsWith(`@${E2E_DOMAIN}`)) throw new Error(`Not an e2e account: ${email}`)
  await sql`update "user" set suspended_at = now() where email = ${email}`
}

export type ProfileRow = {
  persona: string | null
  answers: Record<string, { value: unknown; state: string }>
  relative: {
    placeId: string | null
    place: string
    relationship: string
    name: string | null
  } | null
  coins: { state: 'later' } | { state: 'spent'; piles: number[]; assumed: boolean } | null
  reminders: { futureId: string; courseId: string; text: string; at: string }[]
  lastStep: string
  seenFutures: boolean
}

/**
 * A student's saved profile (student_profile) with the roadmap she is answering (the unfinished
 * one, alive), as stored and as the app mirrors it: without one, no answers, no person, no coins
 * and 'picture'. Null when she has no profile yet.
 */
export async function profileOf(email: string): Promise<ProfileRow | null> {
  const [row] = await sql<ProfileRow[]>`
    select p.persona, coalesce(r.answers, '{}'::jsonb) as answers, r.relative, r.coins,
      p.reminders, coalesce(r.last_step, 'picture') as "lastStep",
      p.seen_futures as "seenFutures"
    from student_profile p join "user" u on u.id = p.user_id
    left join roadmap r
      on r.user_id = p.user_id and r.finished_at is null and r.deleted_at is null
    where u.email = ${email}`
  return row ?? null
}

/** Delete the roles waiting on e2e addresses. */
export async function deleteRoleInvites(emails: string[]): Promise<void> {
  const own = emails.filter((e) => e.endsWith(`@${E2E_DOMAIN}`))
  if (own.length > 0) await sql`delete from role_invite where email in ${sql(own)}`
}
