// The onboarding shell's model: the seven steps, the panel's words per step, and the questions of
// steps 01 to 03 one per screen. Pure and client-safe. The questions, their order and their texts
// come from questions.ts (SCREENS[0] to SCREENS[2]); the "why" lines, the slugs, step 02's groups
// and step 03's person screen are new here.

import type { QuestionKey, Relative, StoredAnswers } from '@/shared/types/student'
import { DRAWN_TO_AREAS, isVisible, PARTICULAR, SCREENS } from './questions'

/** Step 00 first; the panel shows all seven (criterion 22). */
export const ONBOARDING_STEPS: readonly string[] = [
  'Your comic character',
  'Facts about you',
  "What you'd study",
  "Where and how you'd live",
  'After you graduate',
  'Three futures',
  'Your attention',
]

/** The steps built on the onboarding shell so far. */
export type OnboardingStep = 0 | 1 | 2 | 3

/** The steps that ask one question per screen. */
export type QuestionStep = 1 | 2 | 3

/**
 * Step 03's "Who, and where?": a step question that is not a stored answer. It reads and writes
 * the stored person (`relative`).
 */
export const PERSON = 'person'
/** What a step question asks: a stored answer, or her person. */
export type StepKey = QuestionKey | typeof PERSON

/** What the panel can show: a step, or the welcome before step 00 (every step listed, none current). */
export type PanelState = OnboardingStep | 'welcome'

/** The panel's words from step 00 to step 03. */
const SIX_STEPS = {
  title: 'Six short steps',
  lead: 'Each step says why it asks. Nothing is ranked: at the end you see three futures side by side.',
}

export const PANEL_COPY: Readonly<Record<PanelState, { title: string; lead: string }>> = {
  welcome: {
    title: 'Before we start',
    lead: "Here's the whole way through. Each step says why it asks.",
  },
  // The welcome says "Before we start"; from step 00 on, the panel speaks of the six steps.
  0: SIX_STEPS,
  1: SIX_STEPS,
  2: SIX_STEPS,
  3: SIX_STEPS,
}

export type StepQuestion = {
  key: StepKey
  /** The Item.id in SCREENS whose impact line this question shows. */
  itemId: string
  /** Shown above the question, else ''. */
  group: string
  /** The screen's heading. */
  question: string
  why: string
  /** Its URL segment, as PRODUCT.md lists it. */
  slug: string
  /** Shows its item's line before it is answered (the field and the areas: the line asks for them). */
  opensWithLine: boolean
}

type FactKey =
  | 'where'
  | 'amount'
  | 'covers'
  | 'who'
  | 'hard'
  | 'earliest'
  | 'latest'
  | 'years'
  | 'dep'
  | 'qual'
  | 'eng'

const WHY: Record<FactKey, string> = {
  where:
    "It decides whether you'd apply for a visa from home or from inside Australia, and which fees apply.",
  amount: 'It decides which cities stay open on each route. A rough number is fine.',
  covers: 'It tells me whether living costs come out of this amount or sit on top of it.',
  who: 'It shapes how each route shows the money a visa asks you to have.',
  hard: 'A hard limit closes cities above it. Roughly keeps them open, marked as a stretch.',
  earliest: 'It sets the first intake each route can show.',
  latest: 'With your earliest start, it decides which intakes stay open.',
  years: 'It decides which course lengths each route shows.',
  dep: 'Who comes along changes the living costs on each route.',
  qual: 'It decides which course levels you can enter.',
  eng: 'It decides whether a route needs an English course or a pathway first.',
}

/**
 * Step 01's questions in the URL: one readable slug per stored key (CLAUDE.md, "Student URLs").
 * Keys never appear in a URL; renaming a slug breaks old links, renaming a key does not.
 */
export const FACT_SLUGS: Readonly<Record<FactKey, string>> = {
  where: 'where',
  amount: 'amount',
  covers: 'covers',
  who: 'who-pays',
  hard: 'limit',
  earliest: 'earliest',
  latest: 'latest',
  years: 'years',
  dep: 'coming',
  qual: 'qualification',
  eng: 'english',
}

type StudyKey = 'know' | 'field' | 'areas' | 'level' | 'learn' | 'length'

/** What step 02 adds to each question of SCREENS[1]: its group, why, slug and how it opens. */
const STUDY: Readonly<
  Record<StudyKey, Pick<StepQuestion, 'group' | 'why' | 'slug' | 'opensWithLine'>>
> = {
  know: {
    group: '',
    why: 'It sets how wide your futures start: one field, a few areas, or every field in this preview.',
    slug: 'know',
    opensWithLine: false,
  },
  field: {
    group: PARTICULAR,
    why: 'Your futures are drawn from courses in this field. You can change it on each one.',
    slug: 'field',
    opensWithLine: true,
  },
  areas: {
    group: DRAWN_TO_AREAS,
    why: 'Courses from each area you pick show side by side, so you can compare them.',
    slug: 'areas',
    opensWithLine: true,
  },
  level: {
    group: '',
    why: 'It sets the course length and entry each future is built on.',
    slug: 'level',
    opensWithLine: false,
  },
  learn: {
    group: '',
    why: "It shapes what each future is drawn around. It doesn't put one above another.",
    slug: 'learning',
    opensWithLine: false,
  },
  length: {
    group: '',
    why: 'Length changes the cost, and how long you could work in Australia after you finish.',
    slug: 'length',
    opensWithLine: false,
  },
}

type LivingKey = 'dest' | 'place' | 'community' | 'knows' | 'climate'

/** What step 03 adds to each question of SCREENS[2]: its why and slug. */
const LIVING: Readonly<Record<LivingKey, Pick<StepQuestion, 'why' | 'slug'>>> = {
  dest: {
    why: 'It sets the country each future is drawn in. This preview covers Australia.',
    slug: 'destination',
  },
  place: {
    why: 'It changes the rent, part-time work and migration points on each route.',
    slug: 'place',
  },
  community: {
    why: "It shapes where each future places you to live. It doesn't put one above another.",
    slug: 'community',
  },
  knows: { why: 'If you do, each route can show how far it is from them.', slug: 'know-anyone' },
  climate: { why: 'Some people settle better in one climate or another.', slug: 'climate' },
}

/** Step 03's person screen, asked after "Do you know anyone…" Yes. */
const PERSON_QUESTION: StepQuestion = {
  key: PERSON,
  itemId: PERSON,
  group: '',
  question: 'Who, and where?',
  why: 'Each route then shows its distance from them. Leave any part blank.',
  slug: 'who-and-where',
  opensWithLine: false,
}

export const ONBOARDING_PATH = '/onboarding'
export const WELCOME_PATH = `${ONBOARDING_PATH}/welcome`
/** The canvas's placeholder until steps 04–06 are designed and timed. */
export const WELCOME_MINUTES = 10
export const PICTURE_PATH = `${ONBOARDING_PATH}/character`
export const FACTS_PATH = `${ONBOARDING_PATH}/facts`
export const STUDY_PATH = `${ONBOARDING_PATH}/study`
export const LIVING_PATH = `${ONBOARDING_PATH}/living`
const AFTER_PATH = `${ONBOARDING_PATH}/after`

/** Per question step: the kicker's title, its questions in order, and its base path. */
export const QUESTION_STEPS: Readonly<
  Record<
    QuestionStep,
    {
      title: string
      path: string
      questions: readonly StepQuestion[]
      /** Where Back goes from the step's first question. */
      back: string
      /** The next step's name, for "Next: …" on the last question and "Leave the rest for now: go to …". */
      nextName: string
    }
  >
> = {
  1: {
    title: 'Facts about you',
    path: FACTS_PATH,
    questions: (SCREENS[0]?.items ?? []).flatMap((item) =>
      item.questions.map((question) => ({
        key: question.key,
        itemId: item.id,
        // The item's title when the item asks more than one question, else ''.
        group: item.questions.length > 1 ? item.title : '',
        // The question's label, else the item's title.
        question: question.label || item.title,
        why: WHY[question.key as FactKey],
        slug: FACT_SLUGS[question.key as FactKey],
        opensWithLine: false,
      })),
    ),
    back: PICTURE_PATH,
    nextName: "What you'd study",
  },
  2: {
    title: "What you'd study",
    path: STUDY_PATH,
    questions: (SCREENS[1]?.items ?? []).flatMap((item) =>
      item.questions.map((question) => ({
        key: question.key,
        itemId: item.id,
        question: question.label || item.title,
        ...STUDY[question.key as StudyKey],
      })),
    ),
    back: `${FACTS_PATH}/${FACT_SLUGS.eng}`,
    nextName: "Where and how you'd live",
  },
  3: {
    title: "Where and how you'd live",
    path: LIVING_PATH,
    // The person screen follows "Do you know anyone…".
    questions: (SCREENS[2]?.items ?? []).flatMap((item) =>
      item.questions.flatMap((question): StepQuestion[] => {
        const asked: StepQuestion = {
          key: question.key,
          itemId: item.id,
          group: '',
          question: question.label || item.title,
          opensWithLine: false,
          ...LIVING[question.key as LivingKey],
        }
        return question.key === 'knows' ? [asked, PERSON_QUESTION] : [asked]
      }),
    ),
    back: `${STUDY_PATH}/${STUDY.length.slug}`,
    nextName: 'After you graduate',
  },
}

/** Step 01's questions, in the model order: stored answers only, it never asks her person. */
export const FACT_QUESTIONS = QUESTION_STEPS[1].questions as readonly (StepQuestion & {
  key: QuestionKey
})[]

/**
 * The URL of a step's question. A key the step does not ask gives the step's own path, which
 * opens its first open question.
 */
export function questionPath(step: QuestionStep, key: StepKey): string {
  const { path, questions } = QUESTION_STEPS[step]
  const slug = questions.find((q) => q.key === key)?.slug
  return slug === undefined ? path : `${path}/${slug}`
}

/** The step's question a slug names, else null (a key is not a slug). */
export function questionBySlug(
  step: QuestionStep,
  slug: string | null | undefined,
): StepQuestion | null {
  return QUESTION_STEPS[step].questions.find((q) => q.slug === slug) ?? null
}

/** The step's question a URL names (its last segment), else null. */
export function questionOfPath(step: QuestionStep, pathname: string): StepQuestion | null {
  const prefix = `${QUESTION_STEPS[step].path}/`
  return pathname.startsWith(prefix) ? questionBySlug(step, pathname.slice(prefix.length)) : null
}

/** Her person is asked only after a stated Yes to "Do you know anyone…", while that is asked. */
const asksPerson = (answers: StoredAnswers): boolean =>
  isVisible('knows', answers) && answers.knows?.value === 'Yes' && answers.knows.state === 'stated'

/**
 * The questions asked for these answers, in order: the field or the areas only after "know";
 * "Do you know anyone…" only after community is not No, her person only after its Yes.
 */
export function askedQuestions(step: QuestionStep, answers: StoredAnswers): StepQuestion[] {
  return QUESTION_STEPS[step].questions.filter((q) =>
    q.key === PERSON ? asksPerson(answers) : isVisible(q.key, answers),
  )
}

/**
 * Her first asked question with no stored answer, else the last asked. A question left blank
 * (Skip) stores nothing and reads as its DS-D1 default everywhere downstream; an answer stored
 * for a question no longer asked is not counted. Her person is open while none is stored.
 */
export function firstOpenQuestion(
  step: QuestionStep,
  answers: StoredAnswers,
  relative: Relative | null = null,
): StepKey {
  const asked = askedQuestions(step, answers)
  const open = asked.find((q) =>
    q.key === PERSON ? relative === null : answers[q.key] === undefined,
  )
  return (open ?? asked[asked.length - 1])?.key ?? 'where'
}

/**
 * Where leaving a step forward goes: step 01 to step 02's first open question; step 02 to step 03
 * (its page opens her first open question); step 03 to step 04.
 */
export function forwardPath(step: QuestionStep, answers: StoredAnswers): string {
  if (step === 1) return questionPath(2, firstOpenQuestion(2, answers))
  return step === 2 ? LIVING_PATH : AFTER_PATH
}

/** Step 01 never asks her person: the one place its question keys meet the helpers below. */
const questionKeyOf = (key: StepKey | undefined): QuestionKey | null =>
  key === undefined || key === PERSON ? null : key

export function factPath(key: QuestionKey): string {
  return questionPath(1, key)
}

/** The step 01 question a URL slug names, else null (a key is not a slug). */
export function factKey(slug: string | null | undefined): QuestionKey | null {
  return questionKeyOf(questionBySlug(1, slug)?.key)
}

/** Where a returning student lands in step 01: its first open question. */
export function firstUnanswered(answers: StoredAnswers): QuestionKey {
  return questionKeyOf(firstOpenQuestion(1, answers)) ?? 'where'
}

export function stepOfPath(pathname: string): PanelState | null {
  if (pathname === WELCOME_PATH) return 'welcome'
  if (pathname === PICTURE_PATH) return 0
  if (pathname === FACTS_PATH || pathname.startsWith(`${FACTS_PATH}/`)) return 1
  if (pathname === STUDY_PATH || pathname.startsWith(`${STUDY_PATH}/`)) return 2
  if (pathname === LIVING_PATH || pathname.startsWith(`${LIVING_PATH}/`)) return 3
  return null
}

/**
 * The question a URL shows: the one it names when it is asked for these answers, else her first
 * open one (a question not asked, or none named). One rule for the screen and the panel's count.
 */
export function shownQuestion(
  step: QuestionStep,
  pathname: string,
  answers: StoredAnswers,
): StepQuestion {
  const asked = askedQuestions(step, answers)
  const named = questionOfPath(step, pathname)
  if (named && asked.some((q) => q.key === named.key)) return named
  const open = firstOpenQuestion(step, answers)
  return asked.find((q) => q.key === open) ?? asked[0]
}

/**
 * The panel's count on a question step: the place of the question the URL shows among those
 * asked, and how many are asked; null elsewhere.
 */
export function stepProgress(
  pathname: string,
  answers: StoredAnswers,
): { question: number; total: number } | null {
  const step = stepOfPath(pathname)
  if (step === null || step === 'welcome' || step === 0) return null
  const asked = askedQuestions(step, answers)
  const { key } = shownQuestion(step, pathname, answers)
  return { question: asked.findIndex((q) => q.key === key) + 1, total: asked.length }
}
