import 'server-only'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { ACCESS_ERRORS, canEdit, type Staff } from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import { contentIdeaDecision } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import { IDEA_IDS, type IdeaDecision, ideaById, ideaStartHref } from '../ideas-queue'
import { DB_ERROR } from './commands/shared'

// The Ideas queue's decisions (ADR-042): an editor accepts or dismisses a suggestion, once. A
// dismissed idea leaves the queue for good. An accepted content idea opens New post started from
// it (lib/idea-start.ts), and the post made there is recorded on it; an accepted expansion idea is
// passed to the team, with no post. Editors and superadmins decide (canEdit); suggestions never
// publish anything.

type Actor = Staff & { id: string }

export const IDEA_ERRORS = {
  notAuthorised: ACCESS_ERRORS.notAuthorised,
  unknown: 'Unknown idea.',
} as const

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** The decisions on the file's ideas: at most one per idea, so bounded by the file. */
export async function listIdeaDecisions(): Promise<IdeaDecision[]> {
  return db
    .select({
      ideaId: contentIdeaDecision.ideaId,
      decision: contentIdeaDecision.decision,
      postId: contentIdeaDecision.postId,
    })
    .from(contentIdeaDecision)
    .where(inArray(contentIdeaDecision.ideaId, [...IDEA_IDS]))
}

/**
 * Accepts or dismisses an idea. The first decision stands: deciding again changes nothing. An
 * accepted content idea answers with the address of New post started from it; anything else with
 * no address. Never throws: a failure is a message.
 */
export async function decideIdea(
  actor: Actor,
  ideaId: string,
  decision: 'accepted' | 'dismissed',
): Promise<ActionResult<{ href: string | null }>> {
  if (!canEdit(actor)) return fail(IDEA_ERRORS.notAuthorised)
  const idea = ideaById(ideaId)
  if (!idea) return fail(IDEA_ERRORS.unknown)
  try {
    await db
      .insert(contentIdeaDecision)
      .values({ ideaId, decision, decidedByUserId: actor.id })
      .onConflictDoNothing({ target: contentIdeaDecision.ideaId })
    const href = decision === 'accepted' && idea.group === 'content' ? ideaStartHref(idea) : null
    return { ok: true, href }
  } catch (error) {
    console.error('[content.ideas-queue]', error)
    return fail(DB_ERROR)
  }
}

/**
 * Records the post made from an accepted idea, the first one only: New post sends the idea's id
 * with "Make post" when it was opened from the queue. An idea not accepted is left as it is.
 */
export async function recordIdeaPost(
  actor: Actor,
  ideaId: string,
  postId: string,
): Promise<ActionResult> {
  if (!canEdit(actor)) return fail(IDEA_ERRORS.notAuthorised)
  try {
    await db
      .update(contentIdeaDecision)
      .set({ postId })
      .where(
        and(
          eq(contentIdeaDecision.ideaId, ideaId),
          eq(contentIdeaDecision.decision, 'accepted'),
          isNull(contentIdeaDecision.postId),
        ),
      )
    return { ok: true }
  } catch (error) {
    console.error('[content.ideas-queue]', error)
    return fail(DB_ERROR)
  }
}
