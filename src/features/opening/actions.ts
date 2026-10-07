'use server'

import { z } from 'zod/mini'
import { COURSES } from '@/features/engine'
import { ACCESS_ERRORS, canUseStudentApp } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import {
  coinsSchema,
  PERSONAS,
  QUESTION_KEYS,
  type QuestionKey,
  relativeSchema,
  reminderSchema,
  type StoredAnswers,
} from '@/shared/types/student'
import { SAVE_FAILED } from './model/messages'
import { parseAnswer } from './model/questions'
import { addReminder, saveAnswers, saveCoins, savePersona, saveRelative } from './server/profile'

// The student's writes, one per tap. Each reads the student from the session (never from the
// request), refuses anyone who is not a student, validates the browser's input against the
// shared model, and hands only what passed to the repository.

const SIGN_IN = 'Please sign in again.'
const INVALID = "That answer isn't one of the options."

const personaSchema = z.enum(PERSONAS)
/** Only which future and which course: the text is the catalogue's and `at` the server's. */
const reminderInputSchema = z.strictObject({
  futureId: reminderSchema.shape.futureId,
  courseId: reminderSchema.shape.courseId,
})

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

const isQuestionKey = (key: string): key is QuestionKey =>
  (QUESTION_KEYS as readonly string[]).includes(key)

/** Runs `run` for a signed-in student; a failed lookup or write is logged and said, never thrown. */
async function asStudent<T extends object>(
  name: string,
  run: (userId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const session = await getSession()
    if (!session) return fail(SIGN_IN)
    if (!canUseStudentApp(session.user.role)) return fail(ACCESS_ERRORS.notAuthorised)
    return await run(session.user.id)
  } catch (err) {
    // The cause, not the wrapper: a failed query's message carries her answers as parameters.
    console.error(`[opening.${name}]`, err instanceof Error && err.cause ? err.cause : err)
    return fail(SAVE_FAILED)
  }
}

/**
 * Saves answers: an object of question → an option, "Not sure", or a stored answer (Undo). Every
 * entry must parse, or nothing is saved. Returns the answers as stored.
 */
export async function saveAnswersAction(
  patch: unknown,
): Promise<ActionResult<{ answers: StoredAnswers }>> {
  return asStudent('saveAnswers', async (userId) => {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return fail(INVALID)
    const answers: StoredAnswers = {}
    for (const [key, raw] of Object.entries(patch)) {
      if (!isQuestionKey(key)) return fail(INVALID)
      const answer = parseAnswer(key, raw)
      if (!answer) return fail(INVALID)
      answers[key] = answer
    }
    await saveAnswers(userId, answers)
    return { ok: true, answers }
  })
}

/** How she'd like to be pictured: one of PERSONAS ("Prefer not to say" and Skip are neutral). */
export async function savePersonaAction(persona: unknown): Promise<ActionResult> {
  return asStudent('savePersona', async (userId) => {
    const parsed = personaSchema.safeParse(persona)
    if (!parsed.success) return fail(INVALID)
    await savePersona(userId, parsed.data)
    return { ok: true }
  })
}

/** Someone she knows in Australia, or null for nobody. */
export async function saveRelativeAction(relative: unknown): Promise<ActionResult> {
  return asStudent('saveRelative', async (userId) => {
    if (relative === null) {
      await saveRelative(userId, null)
      return { ok: true }
    }
    const parsed = relativeSchema.safeParse(relative)
    if (!parsed.success) return fail(INVALID)
    await saveRelative(userId, parsed.data)
    return { ok: true }
  })
}

/** Ten coins across the life values, or spent later. */
export async function saveCoinsAction(coins: unknown): Promise<ActionResult> {
  return asStudent('saveCoins', async (userId) => {
    const parsed = coinsSchema.safeParse(coins)
    if (!parsed.success) return fail(INVALID)
    await saveCoins(userId, parsed.data)
    return { ok: true }
  })
}

/**
 * "Remind me" on a keep-options-open action: `{ futureId, courseId }` for a course in the
 * catalogue, stored with that course's own action, set now.
 */
export async function addReminderAction(reminder: unknown): Promise<ActionResult> {
  return asStudent('addReminder', async (userId) => {
    const parsed = reminderInputSchema.safeParse(reminder)
    if (!parsed.success) return fail(INVALID)
    const { futureId, courseId } = parsed.data
    const course = COURSES.find((c) => c.id === courseId)
    if (!course) return fail(INVALID)
    const { text } = course.keepOpen
    await addReminder(userId, { futureId, courseId, text, at: new Date().toISOString() })
    return { ok: true }
  })
}
