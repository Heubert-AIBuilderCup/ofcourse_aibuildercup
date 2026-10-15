'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ACCESS_ERRORS } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import { UPDATES_PATH } from '.'
import { approveUpdate, createUpdate, sendUpdateToReview } from './server/updates'

// The Updates screen's actions. Each reads the actor from the session (the page only hides the
// buttons) and hands it to server/updates.ts, which applies the access rule and the field rules.
// Nothing here throws: a failure is a message.

const UpdateId = z.uuid()
const UNKNOWN = 'Unknown update.'

type Actor = { id: string; role: string; editor: boolean; reviewer: boolean }

async function asActor<T>(
  run: (actor: Actor) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const s = await getSession()
  if (!s) return { ok: false, error: ACCESS_ERRORS.notAuthorised }
  const { id, role, editor, reviewer } = s.user
  const result = await run({
    id,
    role: role ?? '',
    editor: editor === true,
    reviewer: reviewer === true,
  })
  if (result.ok) {
    revalidatePath(UPDATES_PATH)
    // The Insights overview shows the latest live update's reach.
    revalidatePath('/admin/insights')
  }
  return result
}

/** "Save draft": the form's fields, checked on the server. */
export async function createUpdateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return asActor((actor) => createUpdate(actor, input))
}

/** "Send to review" on a draft. */
export async function sendUpdateToReviewAction(id: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const parsed = UpdateId.safeParse(id)
    return parsed.success ? sendUpdateToReview(actor, parsed.data) : { ok: false, error: UNKNOWN }
  })
}

/** "Approve" on an update in review: it goes live. */
export async function approveUpdateAction(id: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const parsed = UpdateId.safeParse(id)
    return parsed.success ? approveUpdate(actor, parsed.data) : { ok: false, error: UNKNOWN }
  })
}
