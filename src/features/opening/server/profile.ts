import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { cache } from 'react'
import { db } from '@/shared/lib/db'
import { studentProfile } from '@/shared/lib/db/schema'
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

// Server-only reads and writes of one student's profile. Every caller has already passed
// requireStudent() and passes that session's own user id; nothing here takes an id from a request.
// The JSON goes through the contract's schemas both ways: a write refuses (or, for answers, drops)
// what does not fit, and a read drops what no longer fits rather than fail the page.

/** The row, created empty the first time any function here meets this student. */
const ensureRow = (userId: string) =>
  db.insert(studentProfile).values({ userId }).onConflictDoNothing()

async function write(userId: string, set: PgUpdateSetSource<typeof studentProfile>) {
  await ensureRow(userId)
  await db
    .update(studentProfile)
    .set({ ...set, updatedAt: sql`now()` })
    .where(eq(studentProfile.userId, userId))
}

/**
 * One read per request: the onboarding layout and its page both ask for the profile, and
 * `cache` makes them share it (per request, keyed by the id).
 */
export const getProfile = cache(async (userId: string): Promise<Profile> => {
  await ensureRow(userId)
  const [row] = await db
    .select({
      persona: studentProfile.persona,
      answers: studentProfile.answers,
      relative: studentProfile.relative,
      coins: studentProfile.coins,
      reminders: studentProfile.reminders,
      lastStep: studentProfile.lastStep,
      seenFutures: studentProfile.seenFutures,
      onboardedAt: studentProfile.onboardedAt,
    })
    .from(studentProfile)
    .where(eq(studentProfile.userId, userId))
    .limit(1)
  return {
    userId,
    persona: row.persona,
    answers: storedAnswersSchema.safeParse(row.answers).data ?? {},
    relative: relativeSchema.safeParse(row.relative).data ?? null,
    coins: coinsSchema.safeParse(row.coins).data ?? null,
    reminders: (Array.isArray(row.reminders) ? row.reminders : []).flatMap((r) => {
      const parsed = reminderSchema.safeParse(r)
      return parsed.success ? [parsed.data] : []
    }),
    lastStep: row.lastStep,
    seenFutures: row.seenFutures,
    onboardedAt: row.onboardedAt,
  }
})

/**
 * Merges the patch into the stored answers, key by key (Postgres `jsonb || jsonb`), then removes
 * each cleared key (`jsonb - text`), so a key in both is cleared. A key that is not stored is left
 * as it is.
 */
export async function saveAnswers(
  userId: string,
  patch: StoredAnswers,
  cleared: readonly QuestionKey[] = [],
): Promise<void> {
  const valid = storedAnswersSchema.parse(patch)
  const merged = sql`${studentProfile.answers} || ${JSON.stringify(valid)}::jsonb`
  // `-` binds tighter than `||`, so the merge is bracketed before the keys come off it.
  const removed = sql.join(cleared.map((key) => sql` - ${key}::text`))
  await write(userId, {
    answers: cleared.length === 0 ? merged : sql`(${merged})${removed}`,
  })
}

export async function savePersona(userId: string, persona: Persona): Promise<void> {
  await write(userId, { persona })
}

export async function saveRelative(userId: string, relative: Relative | null): Promise<void> {
  await write(userId, { relative: relative === null ? null : relativeSchema.parse(relative) })
}

export async function saveCoins(userId: string, coins: Coins): Promise<void> {
  await write(userId, { coins: coinsSchema.parse(coins) })
}

/** Where she left off. */
export async function markStep(userId: string, step: Step): Promise<void> {
  await write(userId, { lastStep: step })
}

/** She finished onboarding ("Go to your road"): the time is set once, and a later call keeps it. */
export async function markOnboarded(userId: string): Promise<void> {
  await db
    .update(studentProfile)
    .set({ onboardedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(studentProfile.userId, userId), isNull(studentProfile.onboardedAt)))
}
