import 'server-only'
import { eq, sql } from 'drizzle-orm'
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { COURSES } from '@/features/engine'
import { db } from '@/shared/lib/db'
import { studentProfile } from '@/shared/lib/db/schema'
import {
  type Coins,
  coinsSchema,
  FUTURE_IDS,
  type Persona,
  type Profile,
  type Relative,
  type Reminder,
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

export async function getProfile(userId: string): Promise<Profile> {
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
  }
}

/** Merges the patch into the stored answers, key by key (Postgres `jsonb || jsonb`). */
export async function saveAnswers(userId: string, patch: StoredAnswers): Promise<void> {
  const valid = storedAnswersSchema.parse(patch)
  await write(userId, {
    answers: sql`${studentProfile.answers} || ${JSON.stringify(valid)}::jsonb`,
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

/** One reminder per future and course at most, so the list never outgrows the catalogue. */
export const REMINDERS_MAX = FUTURE_IDS.length * COURSES.length

/**
 * Adds the reminder at the end, replacing any earlier one for the same future and course, and
 * drops the oldest beyond REMINDERS_MAX.
 */
export async function addReminder(userId: string, reminder: Reminder): Promise<void> {
  const r = reminderSchema.parse(reminder)
  await write(userId, {
    reminders: sql`coalesce(
      (select jsonb_agg(kept.value order by kept.idx)
         from (select e.value, e.idx
                 from jsonb_array_elements(${studentProfile.reminders}) with ordinality as e(value, idx)
                where not (e.value->>'futureId' = ${r.futureId} and e.value->>'courseId' = ${r.courseId})
                order by e.idx desc
                limit ${REMINDERS_MAX - 1}) as kept),
      '[]'::jsonb
    ) || ${JSON.stringify([r])}::jsonb`,
  })
}

/** Where she left off. Reaching the futures marks them seen, for good. */
export async function markStep(userId: string, step: Step): Promise<void> {
  await write(
    userId,
    step === 'futures' ? { lastStep: step, seenFutures: true } : { lastStep: step },
  )
}
