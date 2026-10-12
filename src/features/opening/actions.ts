'use server'

import { z } from 'zod/mini'
import { ACCESS_ERRORS, canUseStudentApp } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import {
  coinsSchema,
  PERSONAS,
  QUESTION_KEYS,
  type QuestionKey,
  relativeSchema,
  type StoredAnswers,
} from '@/shared/types/student'
import { SAVE_FAILED } from './model/messages'
import { parseAnswer } from './model/questions'
import { saveAnswers, saveCoins, savePersona, saveRelative } from './server/profile'

// The student's writes, one per tap. Each reads the student from the session (never from the
// request), refuses anyone who is not a student, validates the browser's input against the
// shared model, and hands only what passed to the repository.

const SIGN_IN = 'Please sign in again.'
const INVALID = "That answer isn't one of the options."

const personaSchema = z.enum(PERSONAS)

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
 * Saves answers: an object of question → an option, "Not sure", or a stored answer (Undo); a
 * `null` clears that answer, as if it was never given. Every entry must parse, or nothing is
 * saved. Returns the answers it set (a cleared one is not among them).
 */
export async function saveAnswersAction(
  patch: unknown,
): Promise<ActionResult<{ answers: StoredAnswers }>> {
  return asStudent('saveAnswers', async (userId) => {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return fail(INVALID)
    const answers: StoredAnswers = {}
    const cleared: QuestionKey[] = []
    for (const [key, raw] of Object.entries(patch)) {
      if (!isQuestionKey(key)) return fail(INVALID)
      if (raw === null) {
        cleared.push(key)
        continue
      }
      const answer = parseAnswer(key, raw)
      if (!answer) return fail(INVALID)
      answers[key] = answer
    }
    await saveAnswers(userId, answers, cleared)
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

/**
 * Someone she knows in Australia, any part blank, or null for nobody. A person whose every part
 * is blank is nobody ("Somewhere else" with nothing typed, `place: ''`, is a place).
 */
export async function saveRelativeAction(relative: unknown): Promise<ActionResult> {
  return asStudent('saveRelative', async (userId) => {
    if (relative === null) {
      await saveRelative(userId, null)
      return { ok: true }
    }
    const parsed = relativeSchema.safeParse(relative)
    if (!parsed.success) return fail(INVALID)
    const blank = Object.values(parsed.data).every((part) => part === null)
    await saveRelative(userId, blank ? null : parsed.data)
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
