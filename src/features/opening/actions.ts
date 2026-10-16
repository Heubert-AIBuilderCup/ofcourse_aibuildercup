'use server'

import { z } from 'zod/mini'
import { studentAiOff } from '@/features/roads/switch'
import { asStudent, fail } from '@/shared/lib/auth/as-student'
import type { ActionResult } from '@/shared/types/action-result'
import {
  coinsSchema,
  OWN_WORDS_MAX,
  OWN_WORDS_STEPS,
  PERSONAS,
  QUESTION_KEYS,
  type QuestionKey,
  relativeSchema,
  type StoredAnswers,
} from '@/shared/types/student'
import { parseAnswer } from './model/questions'
import { type OwnWordsReading, readOwnWords } from './server/own-words'
import { ownWordsAllowed } from './server/own-words-limit'
import { saveAnswers, saveCoins, savePersona, saveRelative } from './server/profile'

// The student's writes, one per tap. Each reads the student from the session (never from the
// request), refuses anyone who is not a student (asStudent), validates the browser's input against
// the shared model, and hands only what passed to the repository.

const INVALID = "That answer isn't one of the options."
/** A write once onboarding is closed (a stale tab, another device): nothing is saved. */
const CLOSED = 'Onboarding is finished. Your roadmaps hold your answers now.'
const INVALID_WORDS = `Write something here, up to ${OWN_WORDS_MAX} characters.`

const personaSchema = z.enum(PERSONAS)
const ownWordsStepSchema = z.enum(OWN_WORDS_STEPS)
/** Her words on a step: some text once trimmed, at most OWN_WORDS_MAX characters. */
const ownWordsTextSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(OWN_WORDS_MAX))

const isQuestionKey = (key: string): key is QuestionKey =>
  (QUESTION_KEYS as readonly string[]).includes(key)

/**
 * Saves answers: an object of question → an option, "Not sure", or a stored answer (Undo); a
 * `null` clears that answer, as if it was never given. Every entry must parse, or nothing is
 * saved. Returns the answers it set (a cleared one is not among them).
 */
export async function saveAnswersAction(
  patch: unknown,
): Promise<ActionResult<{ answers: StoredAnswers }>> {
  return asStudent('opening.saveAnswers', async (userId) => {
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
    if (!(await saveAnswers(userId, answers, cleared))) return fail(CLOSED)
    return { ok: true, answers }
  })
}

/** How she'd like to be pictured: one of PERSONAS ("Prefer not to say" and Skip are neutral). */
export async function savePersonaAction(persona: unknown): Promise<ActionResult> {
  return asStudent('opening.savePersona', async (userId) => {
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
  return asStudent('opening.saveRelative', async (userId) => {
    if (relative === null) {
      if (!(await saveRelative(userId, null))) return fail(CLOSED)
      return { ok: true }
    }
    const parsed = relativeSchema.safeParse(relative)
    if (!parsed.success) return fail(INVALID)
    const blank = Object.values(parsed.data).every((part) => part === null)
    if (!(await saveRelative(userId, blank ? null : parsed.data))) return fail(CLOSED)
    return { ok: true }
  })
}

/** Ten coins across the life values, or spent later. */
export async function saveCoinsAction(coins: unknown): Promise<ActionResult> {
  return asStudent('opening.saveCoins', async (userId) => {
    const parsed = coinsSchema.safeParse(coins)
    if (!parsed.success) return fail(INVALID)
    if (!(await saveCoins(userId, parsed.data))) return fail(CLOSED)
    return { ok: true }
  })
}

/**
 * Her own words on a question step (facts, study, living, after), kept on the roadmap she is
 * answering and read into chips and tags. A reading that fails or finds nothing is `failed`, not
 * an error: the questions carry on as they are; so is every reading past OWN_WORDS_PER_HOUR in the
 * hour, and every reading while the student AI is off (STUDENT_AI_OFF, criterion 81), with no
 * model call.
 */
export async function readOwnWordsAction(
  step: unknown,
  text: unknown,
): Promise<ActionResult<OwnWordsReading>> {
  return asStudent('opening.ownWords', async (userId) => {
    const parsedStep = ownWordsStepSchema.safeParse(step)
    const parsedText = ownWordsTextSchema.safeParse(text)
    if (!parsedStep.success || !parsedText.success) return fail(INVALID_WORDS)
    const reading = await readOwnWords(
      userId,
      parsedStep.data,
      parsedText.data,
      !studentAiOff(process.env) && ownWordsAllowed(userId),
    )
    if (!reading) return fail(CLOSED)
    return { ok: true, ...reading }
  })
}
