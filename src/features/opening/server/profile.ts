import 'server-only'
import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { cache } from 'react'
import { ensureDraft, getDraft } from '@/features/roadmaps/server/roadmaps'
import { db } from '@/shared/lib/db'
import { roadmap, studentProfile } from '@/shared/lib/db/schema'
import {
  type Coins,
  coinsSchema,
  type Persona,
  type Profile,
  type QuestionKey,
  type Relative,
  relativeSchema,
  reminderSchema,
  type Step,
  type StoredAnswers,
  storedAnswersSchema,
} from '@/shared/types/student'
import { onboardingClosed } from '../model/landing'

// Server-only reads and writes of one student's profile and the roadmap she is answering. Every
// caller has already passed requireStudent() and passes that session's own user id; nothing here
// takes an id from a request. Her picture, reminders and futures are the profile's; her answers,
// person, coins and step are the unfinished roadmap's (features/roadmaps/server/roadmaps.ts),
// made by the first write that needs one, never a finished one. The JSON goes through the
// contract's schemas both ways: a write refuses (or, for answers, drops) what does not fit, and a
// read drops what no longer fits rather than fail the page.

/** The row, created empty the first time any function here meets this student. */
const ensureRow = (userId: string) =>
  db.insert(studentProfile).values({ userId }).onConflictDoNothing()

/**
 * Writes the roadmap she is answering, made empty when there is none, only while onboarding is
 * open (one being answered, or none finished yet). Once it is closed, a write from a stale tab,
 * another device or a cached step starts nothing: only Start from scratch opens a new roadmap.
 * True when it wrote.
 */
async function writeDraft(
  userId: string,
  set: PgUpdateSetSource<typeof roadmap>,
): Promise<boolean> {
  const draft = await getDraft(userId)
  if (!draft && (await countFinished(userId)) > 0) return false
  const { id } = draft ?? (await ensureDraft(userId))
  // Only while it is unfinished: a roadmap finished in between is left as it was.
  const rows = await db
    .update(roadmap)
    .set(set)
    .where(and(eq(roadmap.id, id), eq(roadmap.userId, userId), isNull(roadmap.finishedAt)))
    .returning({ id: roadmap.id })
  return rows.length > 0
}

/** Her finished roadmaps, alive. */
async function countFinished(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(roadmap)
    .where(
      and(eq(roadmap.userId, userId), isNotNull(roadmap.finishedAt), isNull(roadmap.deletedAt)),
    )
  return row?.n ?? 0
}

/**
 * One read per request: the onboarding layout and its page both ask for the profile, and
 * `cache` makes them share it (per request, keyed by the id).
 */
export const getProfile = cache(async (userId: string): Promise<Profile> => {
  await ensureRow(userId)
  const [[row], draft, finished] = await Promise.all([
    db
      .select({
        persona: studentProfile.persona,
        reminders: studentProfile.reminders,
        seenFutures: studentProfile.seenFutures,
      })
      .from(studentProfile)
      .where(eq(studentProfile.userId, userId))
      .limit(1),
    getDraft(userId),
    countFinished(userId),
  ])
  return {
    userId,
    persona: row.persona,
    reminders: (Array.isArray(row.reminders) ? row.reminders : []).flatMap((r) => {
      const parsed = reminderSchema.safeParse(r)
      return parsed.success ? [parsed.data] : []
    }),
    seenFutures: row.seenFutures,
    draft,
    finished,
    answers: draft?.answers ?? {},
    relative: draft?.relative ?? null,
    coins: draft?.coins ?? null,
    lastStep: draft?.lastStep ?? 'picture',
  }
})

/**
 * Merges the patch into the stored answers, key by key (Postgres `jsonb || jsonb`), then removes
 * each cleared key (`jsonb - text`), so a key in both is cleared. A key that is not stored is left
 * as it is. False when onboarding is closed: nothing was written.
 */
export async function saveAnswers(
  userId: string,
  patch: StoredAnswers,
  cleared: readonly QuestionKey[] = [],
): Promise<boolean> {
  const valid = storedAnswersSchema.parse(patch)
  const merged = sql`${roadmap.answers} || ${JSON.stringify(valid)}::jsonb`
  // `-` binds tighter than `||`, so the merge is bracketed before the keys come off it.
  const removed = sql.join(cleared.map((key) => sql` - ${key}::text`))
  return writeDraft(userId, {
    answers: cleared.length === 0 ? merged : sql`(${merged})${removed}`,
  })
}

export async function savePersona(userId: string, persona: Persona): Promise<void> {
  await ensureRow(userId)
  await db
    .update(studentProfile)
    .set({ persona, updatedAt: sql`now()` })
    .where(eq(studentProfile.userId, userId))
}

/** False when onboarding is closed: nothing was written. */
export async function saveRelative(userId: string, relative: Relative | null): Promise<boolean> {
  return writeDraft(userId, { relative: relative === null ? null : relativeSchema.parse(relative) })
}

/** False when onboarding is closed: nothing was written. */
export async function saveCoins(userId: string, coins: Coins): Promise<boolean> {
  return writeDraft(userId, { coins: coinsSchema.parse(coins) })
}

/**
 * Where she left off. The step pages call it while their layout checks the lock, in parallel, so
 * it never starts a roadmap once onboarding is closed.
 */
export async function markStep(userId: string, step: Step): Promise<void> {
  if (onboardingClosed(await getProfile(userId))) return
  await writeDraft(userId, { lastStep: step })
}
