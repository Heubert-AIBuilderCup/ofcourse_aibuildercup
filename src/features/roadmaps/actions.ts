'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { getProfile } from '@/features/opening/server/profile'
import { asStudent, fail } from '@/shared/lib/auth/as-student'
import type { ActionResult } from '@/shared/types/action-result'
import { ROADMAP_NAME_MAX, type RoadmapChoices, roadmapChoicesSchema } from '@/shared/types/student'
import {
  ensureDraft,
  finishRoadmap,
  getDraft,
  renameRoadmap,
  restoreRoadmap,
  saveChoices,
  softDeleteRoadmap,
} from './server/roadmaps'

// The student's writes to her roadmaps. Each reads the student from the session (never from the
// request) and refuses anyone who is not a student (asStudent); the repository acts on her own
// rows only.

const COINS_FIRST = 'Place your coins, or leave them for later, first.'
const NOT_FOUND = "We couldn't find that roadmap. Reload the page and try again."
const NAME_RULE = `A name has 1 to ${ROADMAP_NAME_MAX} characters.`
const ONLY_ONE = 'Your only roadmap stays. Make another before you delete this one.'
const BAD_CHOICES = "We couldn't save that change. Reload the page and try again."
const ALREADY_ANSWERING =
  "You're already answering a new roadmap. Finish its questions, or pick up where you left off."

/** A roadmap id from the request: a claim, checked against her own rows by the repository. */
const idSchema = z.string().min(1).max(64)
/** Trimmed; counted in characters, as the repository and Postgres count them. */
const nameSchema = z
  .string()
  .transform((name) => name.trim())
  .refine((name) => {
    const length = [...name].length
    return length >= 1 && length <= ROADMAP_NAME_MAX
  })

/**
 * "Go to your roadmaps": finishes the roadmap she is answering, once its coins are stored, which
 * closes onboarding. Returns the finished roadmap's id. No refresh here: it would re-render the
 * end screen, which sends a finished student on to her roadmaps and so cuts the loader short; the
 * screen asks for one once the loader has run (refreshAfterOnboardingAction).
 */
export async function finishOnboardingAction(): Promise<ActionResult<{ id: string }>> {
  return asStudent('roadmaps.finishOnboarding', async (userId) => {
    const { coins } = await getProfile(userId)
    if (coins === null) return fail(COINS_FIRST)
    const finished = await finishRoadmap(userId)
    // Coins are stored only on the roadmap she is answering; none left means it was just finished.
    if (finished === null) return fail(COINS_FIRST)
    return { ok: true, id: finished.id }
  })
}

/**
 * "Start from scratch": an empty roadmap for her to answer from step 00. Refused while she is
 * answering another (one at a time).
 */
export async function startFromScratchAction(): Promise<ActionResult> {
  return asStudent('roadmaps.startFromScratch', async (userId) => {
    if (await getDraft(userId)) return fail(ALREADY_ANSWERING)
    await ensureDraft(userId)
    return { ok: true }
  })
}

/** Rename: her own name for one of her roadmaps. */
export async function renameRoadmapAction(id: string, name: string): Promise<ActionResult> {
  return asStudent('roadmaps.renameRoadmap', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    const trimmed = nameSchema.safeParse(name)
    if (!trimmed.success) return fail(NAME_RULE)
    if (!(await renameRoadmap(userId, roadmapId.data, trimmed.data))) return fail(NOT_FOUND)
    return { ok: true }
  })
}

/** Delete, undoable (restoreRoadmapAction). Her only roadmap is never deleted. */
export async function deleteRoadmapAction(id: string): Promise<ActionResult> {
  return asStudent('roadmaps.deleteRoadmap', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    const { finished } = await getProfile(userId)
    if (finished <= 1) return fail(ONLY_ONE)
    if (!(await softDeleteRoadmap(userId, roadmapId.data))) return fail(NOT_FOUND)
    return { ok: true }
  })
}

/** Undo of a delete: the same roadmap back. */
export async function restoreRoadmapAction(id: string): Promise<ActionResult> {
  return asStudent('roadmaps.restoreRoadmap', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    if (!(await restoreRoadmap(userId, roadmapId.data))) return fail(NOT_FOUND)
    return { ok: true }
  })
}

/** What she did on one of her roadmaps' boards, kept with it; a key a board does not have is dropped. */
export async function saveChoicesAction(
  id: string,
  choices: RoadmapChoices,
): Promise<ActionResult> {
  return asStudent('roadmaps.saveChoices', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    const parsed = roadmapChoicesSchema.safeParse(choices)
    if (!parsed.success) return fail(BAD_CHOICES)
    if (!(await saveChoices(userId, roadmapId.data, parsed.data))) return fail(NOT_FOUND)
    return { ok: true }
  })
}

/**
 * After the loader, before the end screen is replaced with her roadmaps: refreshes her whole client
 * router (the server's refresh; the client's clears the current route only), so Back from her
 * roadmaps never shows a cached onboarding page. Writes nothing.
 */
export async function refreshAfterOnboardingAction(): Promise<ActionResult> {
  return asStudent('roadmaps.refreshAfterOnboarding', async () => {
    refresh()
    return { ok: true }
  })
}
