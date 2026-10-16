'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ACCESS_ERRORS } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import { IDEAS_PATH } from './ideas-queue'
import { decideIdea, IDEA_ERRORS } from './server/ideas-queue'

// The Ideas queue's Accept and Dismiss (ADR-042). Each reads the actor from the session (the page
// only hides the buttons), keeps the idea id to its type, and hands both to server/ideas-queue.ts,
// which applies the access rule (editors and superadmins). Nothing here throws.

const IdeaId = z.string().min(1).max(64)

type Decided = ActionResult<{ href: string | null }>

async function decide(id: unknown, decision: 'accepted' | 'dismissed'): Promise<Decided> {
  const s = await getSession()
  if (!s) return { ok: false, error: ACCESS_ERRORS.notAuthorised }
  const parsed = IdeaId.safeParse(id)
  if (!parsed.success) return { ok: false, error: IDEA_ERRORS.unknown }
  const { id: userId, role, editor, reviewer } = s.user
  const actor = {
    id: userId,
    role: role ?? '',
    editor: editor === true,
    reviewer: reviewer === true,
  }
  const result = await decideIdea(actor, parsed.data, decision)
  if (result.ok) revalidatePath(IDEAS_PATH)
  return result
}

/** Accept: a content idea answers with New post started from it; an expansion idea is passed on. */
export async function acceptIdeaAction(id: unknown): Promise<Decided> {
  return decide(id, 'accepted')
}

/** Dismiss: the idea leaves the queue and is not suggested again. */
export async function dismissIdeaAction(id: unknown): Promise<Decided> {
  return decide(id, 'dismissed')
}
