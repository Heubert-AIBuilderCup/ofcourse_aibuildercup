import 'server-only'
import { and, asc, desc, eq, exists, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/shared/lib/db'
import { roadmap } from '@/shared/lib/db/schema'
import {
  coinsSchema,
  ROADMAP_NAME_MAX,
  type Roadmap,
  type RoadmapChoices,
  relativeSchema,
  roadmapChoicesSchema,
  storedAnswersSchema,
} from '@/shared/types/student'

// Server-only reads and writes of one student's roadmaps. Every caller has already passed
// requireStudent() and passes that session's own user id first; every query filters by it, so a
// roadmap id from a request reaches only her own rows. A deleted roadmap is never returned (only
// restore reaches it). The functions taking an id act on finished roadmaps only: the one she is
// answering is reached through getDraft, ensureDraft and finishRoadmap. The JSON goes through the
// contract's schemas both ways, as the profile's does.

/** Far above any student's count; the list stops here rather than grow. */
const LIST_MAX = 200

// Never userId or deletedAt: what is returned is always hers and alive.
const fields = {
  id: roadmap.id,
  name: roadmap.name,
  answers: roadmap.answers,
  relative: roadmap.relative,
  coins: roadmap.coins,
  choices: roadmap.choices,
  lastStep: roadmap.lastStep,
  copiedFrom: roadmap.copiedFrom,
  createdAt: roadmap.createdAt,
  finishedAt: roadmap.finishedAt,
  lastOpenedAt: roadmap.lastOpenedAt,
}
type Row = Omit<typeof roadmap.$inferSelect, 'userId' | 'deletedAt'>

/** Drops what no longer fits the contract rather than fail the page. */
const toRoadmap = (row: Row): Roadmap => ({
  ...row,
  answers: storedAnswersSchema.safeParse(row.answers).data ?? {},
  relative: relativeSchema.safeParse(row.relative).data ?? null,
  coins: coinsSchema.safeParse(row.coins).data ?? null,
  choices: roadmapChoicesSchema.safeParse(row.choices).data ?? {},
})

const alive = isNull(roadmap.deletedAt)
const finished = isNotNull(roadmap.finishedAt)
const unfinished = isNull(roadmap.finishedAt)
/** Her finished roadmap with this id, alive. */
const hers = (userId: string, id: string) =>
  and(eq(roadmap.userId, userId), eq(roadmap.id, id), finished, alive)

/** The roadmap she is answering, or null. */
export async function getDraft(userId: string): Promise<Roadmap | null> {
  const [row] = await db
    .select(fields)
    .from(roadmap)
    .where(and(eq(roadmap.userId, userId), unfinished, alive))
    .limit(1)
  return row ? toRoadmap(row) : null
}

/** The roadmap she is answering, made empty when there is none; never a second (a unique index). */
export async function ensureDraft(userId: string): Promise<Roadmap> {
  const draft = await getDraft(userId)
  if (draft) return draft
  await db.insert(roadmap).values({ userId }).onConflictDoNothing()
  const made = await getDraft(userId)
  if (!made) throw new Error('roadmaps: the draft was not made')
  return made
}

/** She pressed "Go to your roadmaps": the roadmap she was answering is finished. Null when none. */
export async function finishRoadmap(userId: string): Promise<Roadmap | null> {
  const [row] = await db
    .update(roadmap)
    .set({ finishedAt: sql`now()` })
    .where(and(eq(roadmap.userId, userId), unfinished, alive))
    .returning(fields)
  return row ? toRoadmap(row) : null
}

/**
 * Her finished roadmaps, last opened first, a never opened one by when it was made: a roadmap just
 * made comes first (orderRoadmaps' 'opened' is the same rule).
 */
export async function listRoadmaps(userId: string): Promise<Roadmap[]> {
  const rows = await db
    .select(fields)
    .from(roadmap)
    .where(and(eq(roadmap.userId, userId), finished, alive))
    .orderBy(
      sql`coalesce(${roadmap.lastOpenedAt}, ${roadmap.createdAt}) desc`,
      desc(roadmap.createdAt),
      asc(roadmap.id),
    )
    .limit(LIST_MAX)
  return rows.map(toRoadmap)
}

/** Her finished roadmap with this id; null when it is another student's, deleted or unknown. */
export async function getRoadmap(userId: string, id: string): Promise<Roadmap | null> {
  const [row] = await db.select(fields).from(roadmap).where(hers(userId, id)).limit(1)
  return row ? toRoadmap(row) : null
}

/** Trimmed, 1 to 60 characters; false when refused or not hers. */
export async function renameRoadmap(userId: string, id: string, name: string): Promise<boolean> {
  const trimmed = name.trim()
  // Characters as Postgres counts them (char_length), not UTF-16 units.
  const length = [...trimmed].length
  if (length < 1 || length > ROADMAP_NAME_MAX) return false
  const rows = await db
    .update(roadmap)
    .set({ name: trimmed })
    .where(hers(userId, id))
    .returning({ id: roadmap.id })
  return rows.length > 0
}

/**
 * Hidden from everything but restore (Undo). False when not hers, already deleted, or her only
 * roadmap: the update itself asks for another of hers, finished and alive. Her roadmaps are locked
 * first, so two deletes sent at once take turns and the second sees the first; without the lock
 * each would see the other's roadmap still there, and both would go.
 */
export async function softDeleteRoadmap(userId: string, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: roadmap.id })
      .from(roadmap)
      .where(and(eq(roadmap.userId, userId), finished, alive))
      .orderBy(asc(roadmap.id))
      .for('update')
    const other = alias(roadmap, 'other')
    const another = exists(
      tx
        .select({ id: other.id })
        .from(other)
        .where(
          and(
            eq(other.userId, userId),
            ne(other.id, id),
            isNotNull(other.finishedAt),
            isNull(other.deletedAt),
          ),
        ),
    )
    const rows = await tx
      .update(roadmap)
      .set({ deletedAt: sql`now()` })
      .where(and(hers(userId, id), another))
      .returning({ id: roadmap.id })
    return rows.length > 0
  })
}

/** Undo of a delete. False when not hers or not deleted. */
export async function restoreRoadmap(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(roadmap)
    .set({ deletedAt: null })
    .where(
      and(eq(roadmap.userId, userId), eq(roadmap.id, id), finished, isNotNull(roadmap.deletedAt)),
    )
    .returning({ id: roadmap.id })
  return rows.length > 0
}

/**
 * She opened it now. True only the first time (it was new); false after, and when not hers.
 * The first open is claimed by a conditional update, so two at once cannot both be first.
 */
export async function touchOpened(userId: string, id: string): Promise<boolean> {
  const first = await db
    .update(roadmap)
    .set({ lastOpenedAt: sql`now()` })
    .where(and(hers(userId, id), isNull(roadmap.lastOpenedAt)))
    .returning({ id: roadmap.id })
  if (first.length > 0) return true
  await db.update(roadmap).set({ lastOpenedAt: sql`now()` }).where(hers(userId, id))
  return false
}

/** What she did on its board; a key the schema does not know is dropped. False when not hers. */
export async function saveChoices(
  userId: string,
  id: string,
  choices: RoadmapChoices,
): Promise<boolean> {
  const rows = await db
    .update(roadmap)
    .set({ choices: roadmapChoicesSchema.parse(choices) })
    .where(hers(userId, id))
    .returning({ id: roadmap.id })
  return rows.length > 0
}

/**
 * A new finished roadmap with its own copy of the source's answers, relative and coins, unnamed,
 * its board untouched. Null when the source is not hers.
 */
export async function copyRoadmap(userId: string, fromId: string): Promise<Roadmap | null> {
  const source = await getRoadmap(userId, fromId)
  if (!source) return null
  const [row] = await db
    .insert(roadmap)
    .values({
      userId,
      answers: source.answers,
      relative: source.relative,
      coins: source.coins,
      lastStep: source.lastStep,
      copiedFrom: source.id,
      finishedAt: sql`now()`,
    })
    .returning(fields)
  return toRoadmap(row)
}
