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

/** Give an e2e account the content capabilities straight in the database (ADR-108). */
export async function setCapabilities(
  email: string,
  caps: { editor: boolean; reviewer: boolean },
): Promise<void> {
  if (!email.endsWith(`@${E2E_DOMAIN}`)) throw new Error(`Not an e2e account: ${email}`)
  await sql`update "user" set editor = ${caps.editor}, reviewer = ${caps.reviewer}
    where email = ${email}`
}

/** An account's role and content capabilities; null when there is no account. */
export async function accountOf(
  email: string,
): Promise<{ role: string; editor: boolean; reviewer: boolean } | null> {
  const [row] = await sql<{ role: string; editor: boolean; reviewer: boolean }[]>`
    select role, editor, reviewer from "user" where email = ${email}`
  return row ?? null
}

/** How many posts an account has made. */
export async function countPostsBy(email: string): Promise<number> {
  const [row] = await sql<{ c: number }[]>`
    select count(*)::int as c from content_post p
    join "user" u on u.id = p.created_by_user_id
    where u.email = ${email}`
  return row?.c ?? 0
}

/**
 * Delete the posts e2e accounts made (their records, steps and social versions go by cascade).
 * Run before deleteUsers: deleting an account only clears its posts' creator.
 */
export async function deletePostsBy(emails: string[]): Promise<void> {
  const own = emails.filter((e) => e.endsWith(`@${E2E_DOMAIN}`))
  if (own.length === 0) return
  await sql`delete from content_post p using "user" u
    where u.id = p.created_by_user_id and u.email in ${sql(own)}`
}

/** The art prompt of a post's current render, or null when it has none. */
export async function renderedArtPrompt(postId: string): Promise<string | null> {
  const [row] = await sql<{ prompt: string | null }[]>`
    select a.body->'art'->>'prompt' as prompt from content_post p
    join content_artifact a on a.id = p.pointers->>'renderId'
    where p.id = ${postId}`
  return row?.prompt ?? null
}

/** A post's public page slug (content_post.slug), set when it first goes live; null before. */
export async function postSlug(postId: string): Promise<string | null> {
  const [row] = await sql<{ slug: string | null }[]>`
    select slug from content_post where id = ${postId}`
  return row?.slug ?? null
}

/** Whether a post's current render has art on its cover. */
export async function renderHasArt(postId: string): Promise<boolean> {
  const [row] = await sql<{ art: boolean }[]>`
    select a.body->'art'->>'assetId' is not null as art from content_post p
    join content_artifact a on a.id = p.pointers->>'renderId'
    where p.id = ${postId}`
  return row?.art ?? false
}

/**
 * Stand in for the image model answering at last: an image cached under `key` (an art cache key,
 * computed as src/features/content/ai/art.ts does), so the next art call for that prompt gets it.
 * Remove both with forgetCachedArt.
 */
export async function cacheArt(key: string, assetId: string, png: Uint8Array): Promise<void> {
  await sql`insert into content_asset (id, mime, bytes) values (${assetId}, 'image/png', ${png})
    on conflict do nothing`
  await sql`insert into ai_cache (key, use_case, model, prompt_version, value)
    values (${key}, 'art', 'e2e', 'image.v1', ${sql.json({ assetId })})
    on conflict (key) do nothing`
}

export async function forgetCachedArt(key: string, assetId: string): Promise<void> {
  await sql`delete from ai_cache where key = ${key}`
  await sql`delete from content_asset where id = ${assetId}`
}

/**
 * Turn a post at its idea cards into a post from before the looks (GD8), as no screen makes one
 * any more: no idea cards, no versions, and `templates` (legacy template ids, the-line first)
 * ticked, so its Text step offers the legacy templates and "Draft versions". The version moves
 * on, so a page opened before reloads instead of saving over it.
 */
export async function makeLegacy(postId: string, templates: string[]): Promise<void> {
  const pointers = { ideasId: null, draftsId: null, picked: null, themeId: null, ticked: templates }
  const done = await sql`update content_post
    set pointers = pointers || ${sql.json(pointers)}::jsonb, version = version + 1
    where id = ${postId} and stage = 'structures' and kind = 'feed'`
  if (done.count !== 1) throw new Error(`Post ${postId} is not a feed post at its text`)
}
