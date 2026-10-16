import 'server-only'
import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { canEdit, canReview, type Staff } from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import { contentPost, user } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import { ASSIGN_ERRORS, type BoardStaff, NOTE_MAX } from '../lib/board'
import { charCount } from '../text/script'
import { DB_ERROR } from './commands/shared'

// A post's owner on the board and a note to them: someone who works on posts (an editor, a
// reviewer or a superadmin; never a plain admin, who only reads the board), or none. Editors and
// superadmins assign (canEdit). The owner is read from the database, never trusted from the
// request. An assignment is not an edit of the post: its version and `updated_*` stay as they are.

type Actor = Staff & { id: string }

/** More accounts than any team has; the list is never unbounded. */
const STAFF_LIMIT = 500

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Whether an account can own a post: it edits or reviews them (a superadmin does both). */
const canOwn = (s: Staff) => canEdit(s) || canReview(s)

/** Who a post can be assigned to: every active editor, reviewer and superadmin, by name; no email. */
export async function listBoardStaff(): Promise<BoardStaff[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      editor: user.editor,
      reviewer: user.reviewer,
    })
    .from(user)
    // Narrows the read to staff; canOwn below is the rule.
    .where(
      and(
        isNull(user.suspendedAt),
        or(eq(user.role, 'superadmin'), eq(user.editor, true), eq(user.reviewer, true)),
      ),
    )
    .orderBy(asc(user.name), asc(user.id))
    .limit(STAFF_LIMIT)
  return rows.filter(canOwn).map(({ id, name }) => ({ id, name }))
}

/**
 * Gives a post an owner and a note, or takes both away (`assigneeId` null). The note is trimmed,
 * at most NOTE_MAX characters as a reader counts them, and none when empty. Records who assigned
 * and when. Never throws: a failure is a message.
 */
export async function assignPost(
  actor: Actor,
  input: { postId: string; assigneeId: string | null; note: string },
): Promise<ActionResult> {
  if (!canEdit(actor)) return fail(ASSIGN_ERRORS.notAuthorised)
  const note = input.note.trim()
  if (charCount(note) > NOTE_MAX) return fail(ASSIGN_ERRORS.note)
  try {
    if (input.assigneeId !== null) {
      const [owner] = await db
        .select({
          role: user.role,
          editor: user.editor,
          reviewer: user.reviewer,
          suspendedAt: user.suspendedAt,
        })
        .from(user)
        .where(eq(user.id, input.assigneeId))
        .limit(1)
      if (!owner || owner.suspendedAt || !canOwn(owner)) return fail(ASSIGN_ERRORS.assignee)
    }
    const updated = await db
      .update(contentPost)
      .set({
        assigneeUserId: input.assigneeId,
        assignmentNote: input.assigneeId !== null && note !== '' ? note : null,
        assignedByUserId: actor.id,
        assignedAt: new Date(),
      })
      .where(eq(contentPost.id, input.postId))
      .returning({ id: contentPost.id })
    return updated.length === 0 ? fail(ASSIGN_ERRORS.unknown) : { ok: true }
  } catch (error) {
    console.error('[content.assign]', error)
    return fail(DB_ERROR)
  }
}
