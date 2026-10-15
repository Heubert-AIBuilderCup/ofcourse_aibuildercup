import 'server-only'
import { and, asc, desc, eq, exists, isNotNull, isNull, ne, or, type SQL, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/shared/lib/db'
import { roadmap } from '@/shared/lib/db/schema'
import {
  type Coins,
  coinsSchema,
  type Relative,
  ROADMAP_NAME_MAX,
  type Roadmap,
  type RoadmapChoices,
  relativeSchema,
  roadmapChoicesSchema,
  type StoredAnswers,
  storedAnswersSchema,
} from '@/shared/types/student'

// Server-only reads and writes of one student's roadmaps. Every caller has already passed
// requireStudent() and passes that session's own user id first; every query filters by it, so a
// roadmap id from a request reaches only her own rows. A deleted roadmap is never returned (only
// restore reaches it). An archived one is still hers and returned, flagged by archivedAt; the
// callers leave it out of what they count, copy from and open. The functions taking an id act on
// finished roadmaps only: the one she is
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
  archivedAt: roadmap.archivedAt,
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
/**
 * Locks her finished, alive roadmaps until the transaction ends: a delete and an archive, each
 * guarding her last roadmap, take turns rather than both see the other's still there.
 */
const lockHers = (tx: Tx, userId: string) =>
  tx
    .select({ id: roadmap.id })
    .from(roadmap)
    .where(and(eq(roadmap.userId, userId), finished, alive))
    .orderBy(asc(roadmap.id))
    .for('update')
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Another of her roadmaps than this one, finished, alive and out of the archive. */
const anotherOut = (tx: Tx, userId: string, id: string) => {
  const other = alias(roadmap, 'other')
  return exists(
    tx
      .select({ id: other.id })
      .from(other)
      .where(
        and(
          eq(other.userId, userId),
          ne(other.id, id),
          isNotNull(other.finishedAt),
          isNull(other.deletedAt),
          isNull(other.archivedAt),
        ),
      ),
  )
}

/** Her finished roadmap with this id, alive. */
const hers = (userId: string, id: string) =>
  and(eq(roadmap.userId, userId), eq(roadmap.id, id), finished, alive)

/** Why a delete or an archive was refused, or true when it was done. */
export type PutAway = true | 'kept-one' | 'not-found'

/**
 * Inside the transaction, after the guarded update changed nothing: still there to act on means
 * it was refused as the one kept out of the archive; else it is not hers, gone or unknown.
 */
async function refusal(tx: Tx, target: SQL | undefined): Promise<'kept-one' | 'not-found'> {
  const [row] = await tx.select({ id: roadmap.id }).from(roadmap).where(target).limit(1)
  return row ? 'kept-one' : 'not-found'
}

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
 * Her finished roadmaps, archived ones too (archivedAt set), last opened first, a never opened one
 * by when it was made: a roadmap just made comes first (orderRoadmaps' 'opened' is the same rule).
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
 * Hidden from everything but restore (Undo). 'not-found' when not hers or already deleted;
 * 'kept-one' when it is her only roadmap out of the archive: unless it is archived, the update
 * itself asks for another of hers, finished, alive and not archived (an archived one may always
 * go). Her roadmaps are locked first, so two deletes sent at once take turns and the second sees
 * the first; without the lock each would see the other's roadmap still there, and both would go.
 */
export async function softDeleteRoadmap(userId: string, id: string): Promise<PutAway> {
  return db.transaction(async (tx) => {
    await lockHers(tx, userId)
    // An archived one may always go; one out of the archive only while another is out too.
    const rows = await tx
      .update(roadmap)
      .set({ deletedAt: sql`now()` })
      .where(and(hers(userId, id), or(isNotNull(roadmap.archivedAt), anotherOut(tx, userId, id))))
      .returning({ id: roadmap.id })
    return rows.length > 0 || refusal(tx, hers(userId, id))
  })
}

/**
 * Folded away under Archived. 'not-found' when not hers, deleted or already archived; 'kept-one'
 * when it is her only roadmap out of the archive: the update asks for another of hers out of the
 * archive (anotherOut), under the same lock as a delete, so two sent at once take turns.
 */
export async function archiveRoadmap(userId: string, id: string): Promise<PutAway> {
  return db.transaction(async (tx) => {
    await lockHers(tx, userId)
    const target = and(hers(userId, id), isNull(roadmap.archivedAt))
    const rows = await tx
      .update(roadmap)
      .set({ archivedAt: sql`now()` })
      .where(and(target, anotherOut(tx, userId, id)))
      .returning({ id: roadmap.id })
    return rows.length > 0 || refusal(tx, target)
  })
}

/** Whether any of her finished, alive roadmaps is archived (what a refused delete says). */
export async function hasArchived(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: roadmap.id })
    .from(roadmap)
    .where(and(eq(roadmap.userId, userId), finished, alive, isNotNull(roadmap.archivedAt)))
    .limit(1)
  return row !== undefined
}

/** Back into her list from Archived. False when not hers, deleted or not archived. */
export async function restoreArchived(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(roadmap)
    .set({ archivedAt: null })
    .where(and(hers(userId, id), isNotNull(roadmap.archivedAt)))
    .returning({ id: roadmap.id })
  return rows.length > 0
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

/** Every entry a question and a valid answer, or null: the schema drops a bad entry quietly. */
function wholeAnswers(answers: unknown): StoredAnswers | null {
  const parsed = storedAnswersSchema.safeParse(answers)
  return parsed.success && Object.keys(parsed.data).length === Object.keys(answers as object).length
    ? parsed.data
    : null
}

/** Why a roadmap's answers were not saved, or true when they were. */
export type AnswersSaved = true | 'bad-answers' | 'not-found'

/**
 * Her answers on one of her finished roadmaps, the whole set: what is not in it is no longer
 * answered. Every entry must be a question and a valid answer, or nothing is written
 * ('bad-answers'); 'not-found' when the roadmap is not hers, a draft, deleted or unknown.
 */
export async function saveRoadmapAnswers(
  userId: string,
  id: string,
  answers: unknown,
): Promise<AnswersSaved> {
  const parsed = wholeAnswers(answers)
  if (!parsed) return 'bad-answers'
  const rows = await db
    .update(roadmap)
    .set({ answers: parsed })
    .where(hers(userId, id))
    .returning({ id: roadmap.id })
  return rows.length > 0 || 'not-found'
}

/** Why a roadmap was not made, or the roadmap made. */
export type Created = Roadmap | 'bad-answers' | 'not-found'

/**
 * "Create roadmap": a new finished roadmap, never opened, with these answers (the whole set,
 * refused on one bad entry: 'bad-answers'), under the name given (a copy's "Copy of …"), else
 * unnamed. From one of hers (`fromId`) it is a copy
 * (copiedFrom) with the source's person, coins and last step unless given; 'not-found' when the
 * source is not hers, deleted or unknown. Its board's choices as given, else untouched.
 */
export async function createRoadmap(
  userId: string,
  {
    fromId,
    name = null,
    answers,
    relative,
    coins,
    choices = {},
  }: {
    fromId?: string
    /** 1 to ROADMAP_NAME_MAX characters (the roadmap_name_check). */
    name?: string | null
    answers: unknown
    relative?: Relative | null
    coins?: Coins | null
    choices?: RoadmapChoices
  },
): Promise<Created> {
  const parsed = wholeAnswers(answers)
  if (!parsed) return 'bad-answers'
  const source = fromId === undefined ? null : await getRoadmap(userId, fromId)
  if (fromId !== undefined && !source) return 'not-found'
  const [row] = await db
    .insert(roadmap)
    .values({
      userId,
      name,
      answers: parsed,
      relative: relative === undefined ? (source?.relative ?? null) : relative,
      coins: coins === undefined ? (source?.coins ?? null) : coins,
      choices: roadmapChoicesSchema.parse(choices),
      ...(source ? { lastStep: source.lastStep, copiedFrom: source.id } : {}),
      finishedAt: sql`now()`,
    })
    .returning(fields)
  return toRoadmap(row)
}
