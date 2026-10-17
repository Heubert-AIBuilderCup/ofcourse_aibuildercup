import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { ACCESS_ERRORS, canEdit, canReview, type Staff } from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import { adminUpdate } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import { audienceOf } from '../lib/audience'
import { parseUpdateInput, type StoredUpdate, type UpdateStatus } from '../lib/update'

// Targeted updates (ADR-057): an editor writes one as a draft and sends it to review; a reviewer
// approves it, which makes it live. Editors and superadmins write (canEdit); reviewers and
// superadmins approve (canReview). A live one reaches the students it targets on their feed and
// course tiles; email is not built.

type Actor = Staff & { id: string }

const DB_ERROR = 'Could not save. Please try again.'
/** More updates than the team writes in the demo's life; the list is never unbounded. */
const LIST_LIMIT = 50

export const UPDATE_FLOW_ERRORS = {
  notAuthorised: ACCESS_ERRORS.notAuthorised,
  notDraft: 'Only a draft can be sent to review.',
  notInReview: 'Only an update in review can be approved.',
} as const

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

const COLUMNS = {
  id: adminUpdate.id,
  status: adminUpdate.status,
  kind: adminUpdate.kind,
  category: adminUpdate.category,
  institution: adminUpdate.institution,
  title: adminUpdate.title,
  body: adminUpdate.body,
  applyBy: adminUpdate.applyBy,
  sourceTitle: adminUpdate.sourceTitle,
  sourceCheckedAt: adminUpdate.sourceCheckedAt,
  audience: adminUpdate.audience,
}

/** A row as an update: an audience stored before topics reads as all topics. */
const stored = <T extends { audience: Parameters<typeof audienceOf>[0] }>(row: T) => ({
  ...row,
  audience: audienceOf(row.audience),
})

/** The updates, latest change first, at most LIST_LIMIT. */
export async function listUpdates(): Promise<StoredUpdate[]> {
  const rows = await db
    .select(COLUMNS)
    .from(adminUpdate)
    .orderBy(desc(adminUpdate.updatedAt))
    .limit(LIST_LIMIT)
  return rows.map(stored)
}

/** The update made live most recently, or none. */
export async function latestLiveUpdate(): Promise<StoredUpdate | null> {
  const [row] = await db
    .select(COLUMNS)
    .from(adminUpdate)
    .where(eq(adminUpdate.status, 'live'))
    .orderBy(desc(adminUpdate.updatedAt))
    .limit(1)
  return row ? stored(row) : null
}

/** A live update as the students' boards and feed read it: all its fields, the card draws them. */
export type LiveUpdateRow = StoredUpdate

/** The live updates, latest change first, at most LIST_LIMIT; never a draft or one in review. */
export async function listLiveUpdates(): Promise<LiveUpdateRow[]> {
  const rows = await db
    .select(COLUMNS)
    .from(adminUpdate)
    .where(eq(adminUpdate.status, 'live'))
    .orderBy(desc(adminUpdate.updatedAt))
    .limit(LIST_LIMIT)
  return rows.map(stored)
}

/** A new draft from the form's fields, each checked; answers with its id. Never throws. */
export async function createUpdate(
  actor: Actor,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!canEdit(actor)) return fail(UPDATE_FLOW_ERRORS.notAuthorised)
  const parsed = parseUpdateInput(input)
  if (!parsed.ok) return parsed
  const id = randomUUID()
  try {
    await db
      .insert(adminUpdate)
      .values({ id, ...parsed.value, status: 'draft', createdByUserId: actor.id })
    return { ok: true, id }
  } catch (error) {
    console.error('[updates.create]', error)
    return fail(DB_ERROR)
  }
}

/** Moves an update from `from` to `to` when it is at `from`; otherwise refuses with `refusal`. */
async function move(
  id: string,
  from: UpdateStatus,
  to: UpdateStatus,
  refusal: string,
  approver: string | null,
): Promise<ActionResult> {
  try {
    const moved = await db
      .update(adminUpdate)
      .set({
        status: to,
        updatedAt: new Date(),
        ...(approver ? { approvedByUserId: approver } : {}),
      })
      .where(and(eq(adminUpdate.id, id), eq(adminUpdate.status, from)))
      .returning({ id: adminUpdate.id })
    return moved.length === 0 ? fail(refusal) : { ok: true }
  } catch (error) {
    console.error('[updates.move]', error)
    return fail(DB_ERROR)
  }
}

/** "Send to review": a draft goes to the reviewers. Editors only. */
export async function sendUpdateToReview(actor: Actor, id: string): Promise<ActionResult> {
  if (!canEdit(actor)) return fail(UPDATE_FLOW_ERRORS.notAuthorised)
  return move(id, 'draft', 'in_review', UPDATE_FLOW_ERRORS.notDraft, null)
}

/** "Approve": an update in review goes live, its approver recorded. Reviewers only. */
export async function approveUpdate(actor: Actor, id: string): Promise<ActionResult> {
  if (!canReview(actor)) return fail(UPDATE_FLOW_ERRORS.notAuthorised)
  return move(id, 'in_review', 'live', UPDATE_FLOW_ERRORS.notInReview, actor.id)
}
