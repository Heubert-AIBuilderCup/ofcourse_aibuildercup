// The student profile's shared contract: what a student's answers, relative, coins and reminders
// look like, and the schemas every read and write of the stored JSON goes through. The database
// schema, the engine and the opening all read it, so it lives in shared and imports no feature.
// Pure, so the server and the browser import the same types; every module imports from here,
// never retypes. The mini build of zod, as the browser loads this module through the question model.

import { z } from 'zod/mini'

export const QUESTION_KEYS = [
  'where',
  'amount',
  'covers',
  'who',
  'hard',
  'earliest',
  'latest',
  'years',
  'dep',
  'qual',
  'eng',
  'know',
  'field',
  'areas',
  'level',
  'learn',
  'length',
  'dest',
  'place',
  'community',
  'knows',
  'climate',
  'stay',
  'focus',
  'earn',
  'settle',
] as const
export type QuestionKey = (typeof QUESTION_KEYS)[number]
/** `amount` is a number (AUD thousands); `areas` is up to three strings. */
export type AnswerValue = string | number | string[]
/** 'assumed': she tapped "Not sure", and the default is stored. */
type AnswerState = 'stated' | 'assumed'
export type StoredAnswer = { value: AnswerValue; state: AnswerState }
export type StoredAnswers = Partial<Record<QuestionKey, StoredAnswer>>

/** "Prefer not to say" and Skip both store 'neutral'. */
export const PERSONAS = ['male', 'female', 'neutral'] as const
export type Persona = (typeof PERSONAS)[number]
/** Onboarding steps 01–04, also their URL segments. */
export const OPENING_STEPS = ['facts', 'study', 'living', 'after'] as const
export type OpeningStep = (typeof OPENING_STEPS)[number]
export const STEPS = ['picture', ...OPENING_STEPS, 'futures', 'attention'] as const
export type Step = (typeof STEPS)[number]

export const RELATIONSHIPS = ['Cousin', 'Sibling', 'Aunt or uncle', 'Friend', 'Other'] as const
export type Relationship = (typeof RELATIONSHIPS)[number]
/**
 * Someone she knows in Australia; any part may be blank. `placeId` set: a place in the catalogue,
 * `place` its name. `placeId` null and `place` a string: "Somewhere else", typed (`''` while
 * nothing is typed). Both null: no place yet.
 */
export type Relative = {
  placeId: string | null
  place: string | null
  relationship: Relationship | null
  name: string | null
}

/** Whether she gave her person a place: one from the catalogue, or "Somewhere else". */
export const hasPlace = (relative: Relative): boolean =>
  relative.placeId !== null || relative.place !== null

export const LIFE_VALUES = [
  'Health',
  'Social life',
  'Financial life',
  'Learning and growth',
  'Closeness to family',
  'Community and relatives nearby',
  'Independence',
  'Adventure',
] as const
/** `piles`: one per life value, each 0–5, ten coins in all. */
export type Coins = { state: 'later' } | { state: 'spent'; piles: number[]; assumed: boolean }

export const FUTURE_IDS = ['cost', 'staying', 'career'] as const
export type FutureId = (typeof FUTURE_IDS)[number]
/** `at`: an ISO time. */
export type Reminder = { futureId: FutureId; courseId: string; text: string; at: string }

export type Profile = {
  userId: string
  persona: Persona | null
  answers: StoredAnswers
  relative: Relative | null
  coins: Coins | null
  reminders: Reminder[]
  lastStep: Step
  seenFutures: boolean
}

// ── Schemas for the stored JSON ─────────────────────────────────────────────────────────────

/** The coins she places (step 05), and the most on one pile. */
export const COINS_TOTAL = 10
export const MAX_PER_PILE = 5
/** Far above any option's label; a stored answer stops here rather than grow. */
const ANSWER_TEXT_MAX = 80
/** The most areas she may pick (step 02). */
export const AREAS_MAX = 3

const answerText = z.string().check(z.maxLength(ANSWER_TEXT_MAX))

export const storedAnswerSchema = z.object({
  value: z.union([answerText, z.number(), z.array(answerText).check(z.maxLength(AREAS_MAX))]),
  state: z.enum(['stated', 'assumed'] satisfies AnswerState[]),
})

/**
 * The answers, keyed by question. An entry that is not a question or not a valid answer is
 * dropped, not thrown, so one bad entry never loses the rest.
 */
export const storedAnswersSchema = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((entries): StoredAnswers => {
    const kept: StoredAnswers = {}
    for (const key of QUESTION_KEYS) {
      const parsed = storedAnswerSchema.safeParse(entries[key])
      if (parsed.success) kept[key] = parsed.data
    }
    return kept
  }),
)

export const relativeSchema = z.object({
  placeId: z.nullable(z.string().check(z.minLength(1), z.maxLength(80))),
  // '' is "Somewhere else" before she types.
  place: z.nullable(z.string().check(z.trim(), z.maxLength(80))),
  relationship: z.nullable(z.enum(RELATIONSHIPS)),
  name: z.nullable(z.string().check(z.trim(), z.minLength(1), z.maxLength(40))),
})

export const coinsSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('later') }),
  z.object({
    state: z.literal('spent'),
    piles: z.array(z.int().check(z.minimum(0), z.maximum(MAX_PER_PILE))).check(
      z.length(LIFE_VALUES.length),
      z.refine((piles) => piles.reduce((sum, n) => sum + n, 0) === COINS_TOTAL),
    ),
    assumed: z.boolean(),
  }),
])

export const reminderSchema = z.object({
  futureId: z.enum(FUTURE_IDS),
  courseId: z.string().check(z.minLength(1), z.maxLength(80)),
  text: z.string().check(z.minLength(1), z.maxLength(300)),
  at: z.iso.datetime(),
})
