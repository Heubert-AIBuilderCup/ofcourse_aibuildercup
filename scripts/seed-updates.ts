// Seeds the sample targeted updates in scripts/updates/samples.json, live, through the updates
// feature's own server functions (src/features/updates/server/updates.ts): each is created as a
// draft, sent to review and approved, as an account that may both write and approve (the first
// superadmin, or editor and reviewer, or the one --as names). Idempotent: an update is matched on
// its title, so one already live is kept, one left half way is finished, and none is added twice.
// Every title and source says "(mock)". Prints one line per update.
//   bun --conditions react-server scripts/seed-updates.ts [--as <email>] [--allow-remote]
// Only the local dev database unless --allow-remote is passed (as make-posts.ts): a shell with a
// production DATABASE_URL exported would otherwise put mock updates live.
// (react-server lets the server modules' `server-only` import load outside Next; Bun reads
// DATABASE_URL from .env.local and resolves `@/` from tsconfig.json, as for finder-seed.ts.)

import { readFileSync } from 'node:fs'
import {
  parseUpdateInput,
  type UpdateInput,
  type UpdateStatus,
} from '../src/features/updates/lib/update'
import { canEdit, canReview } from '../src/shared/lib/auth/access'

/** A sample: its stable name in the file, and the form's fields it fills. */
export type Sample = { id: string; value: UpdateInput }

/** The samples file read and checked by the form's own rules; throws naming the first it refuses. */
export function parseSamples(file: unknown): Sample[] {
  const { mock, updates } = (file ?? {}) as { mock?: unknown; updates?: unknown }
  if (mock !== true || !Array.isArray(updates)) throw new Error('Not a mock samples file.')
  return updates.map((u: { id?: unknown }, i) => {
    const id = typeof u?.id === 'string' && u.id ? u.id : `#${i + 1}`
    const parsed = parseUpdateInput(u)
    if (!parsed.ok) throw new Error(`${id}: ${parsed.error}`)
    return { id, value: parsed.value }
  })
}

type Step = 'create' | 'review' | 'approve'

/** What is left to make an update live, from the status of the one with its title (none: new). */
export function stepsFor(status: UpdateStatus | undefined): Step[] {
  if (status === undefined) return ['create', 'review', 'approve']
  if (status === 'draft') return ['review', 'approve']
  if (status === 'in_review') return ['approve']
  return []
}

export type SeedUser = {
  id: string
  email: string
  role: string
  editor: boolean
  reviewer: boolean
}

/**
 * Who publishes the samples: the account `asEmail` names, else the first of `users` (oldest
 * first) that may both write and approve an update. Refuses one that may not.
 */
export function pickActor(
  users: readonly SeedUser[],
  asEmail: string | null,
): { ok: true; actor: SeedUser } | { ok: false; error: string } {
  const publishes = (u: SeedUser) => canEdit(u) && canReview(u)
  if (asEmail !== null) {
    const named = users.find((u) => u.email === asEmail)
    if (!named) return { ok: false, error: `No account ${asEmail}.` }
    return publishes(named)
      ? { ok: true, actor: named }
      : { ok: false, error: `${asEmail} may not both write and approve updates.` }
  }
  const first = users.find(publishes)
  return first
    ? { ok: true, actor: first }
    : { ok: false, error: 'No account may both write and approve updates: pass --as <email>.' }
}

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]']

/** Why the database is refused (not this machine, and no --allow-remote), or null: its host only. */
export function remoteRefusal(databaseUrl: string, allowRemote: boolean): string | null {
  let host: string
  try {
    host = new URL(databaseUrl).hostname
  } catch {
    return 'DATABASE_URL is not a URL.'
  }
  if (LOCAL_HOSTS.includes(host) || allowRemote) return null
  return `Refusing ${host}: not a local database (pass --allow-remote to mean it).`
}

/** The most accounts read when looking for the publisher. */
const USERS_LIMIT = 50

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.')
    return 1
  }
  const refusal = remoteRefusal(process.env.DATABASE_URL, process.argv.includes('--allow-remote'))
  if (refusal) {
    console.error(refusal)
    return 1
  }
  const at = process.argv.indexOf('--as')
  const asEmail = at === -1 ? null : (process.argv[at + 1] ?? '')
  const samples = parseSamples(
    JSON.parse(readFileSync(new URL('./updates/samples.json', import.meta.url), 'utf8')),
  )

  const { and, asc, eq, or } = await import('drizzle-orm')
  const { db } = await import('../src/shared/lib/db')
  const { user } = await import('../src/shared/lib/db/schema')
  const { approveUpdate, createUpdate, listUpdates, sendUpdateToReview } = await import(
    '../src/features/updates/server/updates'
  )

  const users = await db
    .select({
      id: user.id,
      email: user.email,
      role: user.role,
      editor: user.editor,
      reviewer: user.reviewer,
    })
    .from(user)
    .where(
      asEmail !== null
        ? eq(user.email, asEmail)
        : or(eq(user.role, 'superadmin'), and(eq(user.editor, true), eq(user.reviewer, true))),
    )
    .orderBy(asc(user.createdAt))
    .limit(USERS_LIMIT)
  const picked = pickActor(users, asEmail)
  if (!picked.ok) {
    console.error(picked.error)
    return 1
  }
  const { actor } = picked

  // The latest updates (listUpdates' bound), by title; the newest of a repeated title.
  const existing = new Map<string, { id: string; status: UpdateStatus }>()
  for (const u of await listUpdates()) if (!existing.has(u.title)) existing.set(u.title, u)

  // Last first, so each goes live after the one below it and the feed reads them in file order.
  const lines = new Map<string, string>()
  let failed = 0
  for (const sample of [...samples].reverse()) {
    const found = existing.get(sample.value.title)
    const steps = stepsFor(found?.status)
    let id = found?.id ?? ''
    let error: string | null = null
    for (const step of steps) {
      const result =
        step === 'create'
          ? await createUpdate(actor, sample.value)
          : step === 'review'
            ? await sendUpdateToReview(actor, id)
            : await approveUpdate(actor, id)
      if (!result.ok) {
        error = result.error
        break
      }
      if ('id' in result && typeof result.id === 'string') id = result.id
    }
    if (error) failed++
    const outcome = error
      ? `failed: ${error}`
      : steps.length === 0
        ? 'already live'
        : found
          ? `live (was ${found.status})`
          : 'created, live'
    lines.set(sample.id, `${sample.id.padEnd(34)} ${outcome.padEnd(22)} ${sample.value.title}`)
  }
  for (const s of samples) console.log(lines.get(s.id))
  return failed === 0 ? 0 : 1
}

if (import.meta.main) process.exit(await main())
