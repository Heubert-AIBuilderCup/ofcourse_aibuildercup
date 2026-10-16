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

/** What she did on a roadmap's board, kept with it. A key that is absent is false. */
export type RoadmapChoices = {
  swapped?: boolean
  added?: boolean
  read?: boolean
  city?: boolean
  country?: boolean
}

/** The question screens where she may write in her own words, and the most she may write on one. */
export const OWN_WORDS_STEPS = ['facts', 'study', 'living', 'after'] as const
export type OwnWordsStep = (typeof OWN_WORDS_STEPS)[number]
export type OwnWords = Partial<Record<OwnWordsStep, string>>
export const OWN_WORDS_MAX = 1000
/** A tag read from her words, with the quote it came from; the most a roadmap keeps. */
export type RoadmapTag = { text: string; quote: string; step: OwnWordsStep; wellbeing: boolean }
export const TAGS_MAX = 30

/** The most characters in a roadmap's name. */
export const ROADMAP_NAME_MAX = 60

/**
 * One of the student's own roadmaps, alive (never another student's, never a deleted one).
 * `name` null: named from its road. `finishedAt` null: the one she is still answering.
 * `lastOpenedAt` null: never opened.
 */
export type Roadmap = {
  id: string
  name: string | null
  answers: StoredAnswers
  relative: Relative | null
  coins: Coins | null
  choices: RoadmapChoices
  /** Her own words per step; empty when she wrote none. */
  ownWords: OwnWords
  /** What was read in them; empty when none. */
  tags: RoadmapTag[]
  lastStep: Step
  copiedFrom: string | null
  createdAt: Date
  finishedAt: Date | null
  lastOpenedAt: Date | null
  /** Null: in her list; set: archived (not counted, not copied from the list, never `/road`'s). */
  archivedAt: Date | null
}

export type Profile = {
  userId: string
  persona: Persona | null
  reminders: Reminder[]
  seenFutures: boolean
  /** The roadmap she is answering; null when she is answering none. */
  draft: Roadmap | null
  /** How many finished roadmaps she has. */
  finished: number
  /** The draft's, for the onboarding screens: empty, null, null and 'picture' without a draft. */
  answers: StoredAnswers
  relative: Relative | null
  coins: Coins | null
  lastStep: Step
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

/** A board's choices; a key it does not know is dropped. */
export const roadmapChoicesSchema = z.object({
  swapped: z.optional(z.boolean()),
  added: z.optional(z.boolean()),
  read: z.optional(z.boolean()),
  city: z.optional(z.boolean()),
  country: z.optional(z.boolean()),
})

/** Her own words on a question screen (a key outside the four steps is refused, not dropped). */
export const ownWordsSchema = z.strictObject({
  facts: z.optional(z.string().check(z.maxLength(OWN_WORDS_MAX))),
  study: z.optional(z.string().check(z.maxLength(OWN_WORDS_MAX))),
  living: z.optional(z.string().check(z.maxLength(OWN_WORDS_MAX))),
  after: z.optional(z.string().check(z.maxLength(OWN_WORDS_MAX))),
})

/** What the model read in her words, each with the quote it came from. */
export const roadmapTagsSchema = z
  .array(
    z.object({
      text: z.string().check(z.maxLength(80)),
      quote: z.string().check(z.maxLength(200)),
      step: z.enum(OWN_WORDS_STEPS),
      wellbeing: z.boolean(),
    }),
  )
  .check(z.maxLength(TAGS_MAX))
