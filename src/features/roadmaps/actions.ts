'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { pinOf } from '@/features/finder/model/compare'
// For its side effect: a finder course resolves as a road course, so one can be pinned and named.
import '@/features/finder/server/road-courses'
import { compareOn } from '@/features/finder/switch'
import { parseAnswer } from '@/features/opening/model/questions'
import { getProfile } from '@/features/opening/server/profile'
import { roadFor } from '@/features/roads'
import { asStudent, fail } from '@/shared/lib/auth/as-student'
import type { ActionResult } from '@/shared/types/action-result'
import {
  type BoardChoices,
  boardChoicesSchema,
  type Pinned,
  QUESTION_KEYS,
  type QuestionKey,
  ROADMAP_NAME_MAX,
  type StoredAnswers,
} from '@/shared/types/student'
import { copyName, roadmapName, roadNames } from './model/roadmap'
import {
  archiveRoadmap,
  createRoadmap,
  ensureDraft,
  finishRoadmap,
  getDraft,
  getRoadmap,
  hasArchived,
  renameRoadmap,
  restoreArchived,
  restoreRoadmap,
  saveChoices,
  saveRoadmapAnswers,
  softDeleteRoadmap,
} from './server/roadmaps'

// The student's writes to her roadmaps. Each reads the student from the session (never from the
// request) and refuses anyone who is not a student (asStudent); the repository acts on her own
// rows only.

const COINS_FIRST = 'Place your coins, or leave them for later, first.'
const NOT_FOUND = "We couldn't find that roadmap. Reload the page and try again."
const NAME_RULE = `A name has 1 to ${ROADMAP_NAME_MAX} characters.`
const ONLY_ONE = 'Your only roadmap stays. Make another before you delete this one.'
const KEEP_ONE = 'Keep one roadmap out of the archive.'
const BAD_CHOICES = "We couldn't save that change. Reload the page and try again."
const BAD_ANSWERS = "We couldn't save your answers. Reload the page and try again."
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
 * "Start from scratch": an empty roadmap for her to answer through onboarding, one question a
 * screen. Refused while she is answering another (one at a time).
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

/**
 * Delete, undoable (restoreRoadmapAction). Her only roadmap out of the archive is never deleted
 * (with archived ones beside it, she is told to keep one out of the archive); an archived one may
 * always go.
 */
export async function deleteRoadmapAction(id: string): Promise<ActionResult> {
  return asStudent('roadmaps.deleteRoadmap', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    const deleted = await softDeleteRoadmap(userId, roadmapId.data)
    if (deleted === 'not-found') return fail(NOT_FOUND)
    if (deleted === 'kept-one') return fail((await hasArchived(userId)) ? KEEP_ONE : ONLY_ONE)
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

/** Archive, undoable (restoreArchivedAction). One of her roadmaps always stays out of the archive. */
export async function archiveRoadmapAction(id: string): Promise<ActionResult> {
  return asStudent('roadmaps.archiveRoadmap', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    const archived = await archiveRoadmap(userId, roadmapId.data)
    if (archived === 'not-found') return fail(NOT_FOUND)
    if (archived === 'kept-one') return fail(KEEP_ONE)
    return { ok: true }
  })
}

/** Back into her list from Archived, and the Undo of an archive. */
export async function restoreArchivedAction(id: string): Promise<ActionResult> {
  return asStudent('roadmaps.restoreArchived', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    if (!(await restoreArchived(userId, roadmapId.data))) return fail(NOT_FOUND)
    return { ok: true }
  })
}

/** What she did on one of her roadmaps' boards, kept with it; a key a board does not have is dropped. */
export async function saveChoicesAction(id: string, choices: BoardChoices): Promise<ActionResult> {
  return asStudent('roadmaps.saveChoices', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    const parsed = boardChoicesSchema.safeParse(choices)
    if (!parsed.success) return fail(BAD_CHOICES)
    if (!(await saveChoices(userId, roadmapId.data, parsed.data))) return fail(NOT_FOUND)
    return { ok: true }
  })
}

const isQuestionKey = (key: string): key is QuestionKey =>
  (QUESTION_KEYS as readonly string[]).includes(key)

/**
 * Each entry parsed against its question as onboarding's own write parses it (an option, "Not
 * sure" or a stored answer), or null when one is not an answer to its question.
 */
function parseAnswers(answers: unknown): StoredAnswers | null {
  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) return null
  const parsed: StoredAnswers = {}
  for (const [key, raw] of Object.entries(answers)) {
    if (!isQuestionKey(key)) return null
    const answer = parseAnswer(key, raw)
    if (!answer) return null
    parsed[key] = answer
  }
  return parsed
}

/**
 * "Save changes" in Your answers, and its Undo: the whole set of one of her roadmaps' answers,
 * never the profile's nor another roadmap's. Every entry must be an answer to its question, or
 * nothing is saved.
 */
export async function saveRoadmapAnswersAction(
  id: string,
  answers: StoredAnswers,
): Promise<ActionResult> {
  return asStudent('roadmaps.saveRoadmapAnswers', async (userId) => {
    const roadmapId = idSchema.safeParse(id)
    if (!roadmapId.success) return fail(NOT_FOUND)
    const parsed = parseAnswers(answers)
    if (!parsed) return fail(BAD_ANSWERS)
    const saved = await saveRoadmapAnswers(userId, roadmapId.data, parsed)
    if (saved === 'bad-answers') return fail(BAD_ANSWERS)
    if (saved === 'not-found') return fail(NOT_FOUND)
    return { ok: true }
  })
}

/** A pin from the request: a claim, checked against the catalogue by `pinOf`. */
const pinSchema = z.object({
  courseId: z.string().min(1).max(80),
  cityId: z.string().min(1).max(80),
})

/** The pin a request asks for, when `pinOf` resolves it. Null for anything else. */
function requestedPin(raw: unknown): Pinned | null {
  const pin = pinSchema.safeParse(raw)
  return pin.success ? pinOf(pin.data.courseId, pin.data.cityId) : null
}

/** Whether a pin is the one its source already carries (a copy keeping it), not a new one. */
const samePin = (pin: Pinned, stored: Pinned | undefined): boolean =>
  stored?.courseId === pin.courseId && stored.cityId === pin.cityId

/**
 * "Create roadmap" on a new roadmap's draft: a copy of one of hers (`fromId`), named "Copy of" its
 * source's name as her list shows it, or from scratch without one, unnamed, with the draft's answers, the whole set, each parsed against its question (or
 * nothing is made). With `pinned`, its road is drawn around that course (refused, as not found,
 * for a course that cannot be pinned, and for a new pin with the compare switch off); its source is never written. Returns its id, for the loader
 * to land on her roadmaps with it marked. No refresh: the list is read fresh when she lands on it.
 */
export async function createRoadmapAction(input: {
  fromId?: string
  answers: StoredAnswers
  pinned?: Pinned
}): Promise<ActionResult<{ id: string }>> {
  return asStudent('roadmaps.createRoadmap', async (userId) => {
    const fromId = input?.fromId === undefined ? null : idSchema.safeParse(input.fromId)
    if (fromId && !fromId.success) return fail(NOT_FOUND)
    const pinned = input?.pinned === undefined ? undefined : requestedPin(input.pinned)
    if (pinned === null) return fail(NOT_FOUND)
    const answers = parseAnswers(input?.answers)
    if (!answers) return fail(BAD_ANSWERS)
    let copy: { fromId: string; name: string } | null = null
    let sourcePin: Pinned | undefined
    if (fromId) {
      const source = await getRoadmap(userId, fromId.data)
      if (!source) return fail(NOT_FOUND)
      const { road } = roadFor(
        { answers: source.answers, relative: source.relative, pinned: source.choices.pinned },
        process.env,
      )
      copy = { fromId: source.id, name: copyName(roadmapName(source, roadNames(road))) }
      sourcePin = source.choices.pinned
    }
    // A new pin only with the compare switch on; a copy keeps its source's pin either way.
    if (pinned && !compareOn(process.env) && !samePin(pinned, sourcePin)) return fail(NOT_FOUND)
    const made = await createRoadmap(userId, {
      ...copy,
      answers,
      ...(pinned && { choices: { pinned } }),
    })
    if (made === 'not-found') return fail(NOT_FOUND)
    if (made === 'bad-answers') return fail(BAD_ANSWERS)
    return { ok: true, id: made.id }
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
