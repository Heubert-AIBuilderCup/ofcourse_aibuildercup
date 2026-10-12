// The onboarding shell's model: the six steps, the panel's words per step, and the questions of
// steps 01 to 04 one per screen. Pure and client-safe. The questions, their order and their texts
// come from questions.ts (SCREENS[0] to SCREENS[3]); the "why" lines, the slugs, step 02's groups
// and step 03's person screen are new here.

import type { QuestionKey, Relative, StoredAnswers } from '@/shared/types/student'
import { DRAWN_TO_AREAS, isVisible, PARTICULAR, SCREENS } from './questions'

/** Step 00 first, step 05 last; the panel shows all six (criterion 11). */
export const ONBOARDING_STEPS: readonly string[] = [
  'Your comic character',
  'Facts about you',
  "What you'd study",
  "Where and how you'd live",
  'After you graduate',
  'Your attention',
]

/** The onboarding steps, 00 to 05. */
type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5

/** The steps that ask one question per screen. */
export type QuestionStep = 1 | 2 | 3 | 4

/**
 * Step 03's "Who, and where?": a step question that is not a stored answer. It reads and writes
 * the stored person (`relative`).
 */
export const PERSON = 'person'
/** What a step question asks: a stored answer, or her person. */
export type StepKey = QuestionKey | typeof PERSON

/** What the panel can show: a step, or the welcome before step 00 (every step listed, none current). */
export type PanelState = OnboardingStep | 'welcome'

/** The panel's words from step 00 to step 04. */
const FIVE_STEPS = {
  title: 'Five short steps',
  lead: 'Each step says why it asks, and “Not sure” is always a fine answer.',
}

/** The panel's words on step 05 and the end screen after it. */
const LAST_STEP = {
  title: 'The last step',
  lead: 'Optional. It never changes your routes; it shapes what we show you on them later.',
}

export const PANEL_COPY: Readonly<Record<PanelState, { title: string; lead: string }>> = {
  welcome: {
    title: 'Before we start',
    lead: "Here's the whole way through. Each step says why it asks.",
  },
  // The welcome says "Before we start"; steps 00 to 04 speak of the five short steps, step 05
  // of the last one.
  0: FIVE_STEPS,
  1: FIVE_STEPS,
  2: FIVE_STEPS,
  3: FIVE_STEPS,
  4: FIVE_STEPS,
  5: LAST_STEP,
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
const FACT_SLUGS: Readonly<Record<FactKey, string>> = {
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

type AfterKey = 'stay' | 'focus' | 'earn' | 'settle'

/** What step 04 adds to each question of SCREENS[3]: its why and slug. */
const AFTER: Readonly<Record<AfterKey, Pick<StepQuestion, 'why' | 'slug'>>> = {
  stay: { why: 'It decides whether PR counts in your futures, and how much.', slug: 'stay' },
  focus: {
    why: 'It sets how much career outcomes weigh against cost, time and the rest.',
    slug: 'focus',
  },
  earn: {
    why: 'It sets how much part-time work weighs, and whether its rules show on every route.',
    slug: 'earning',
  },
  settle: {
    why: "It doesn't change your routes now. It shapes what we show you later.",
    slug: 'long-term',
  },
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
/** Steps 00 to 04 hold 24 to 27 one-tap questions, about 15 seconds each; step 05 is optional. */
export const WELCOME_MINUTES = 6
export const PICTURE_PATH = `${ONBOARDING_PATH}/character`
export const FACTS_PATH = `${ONBOARDING_PATH}/facts`
export const STUDY_PATH = `${ONBOARDING_PATH}/study`
export const LIVING_PATH = `${ONBOARDING_PATH}/living`
export const AFTER_PATH = `${ONBOARDING_PATH}/after`
export const ATTENTION_PATH = `${ONBOARDING_PATH}/attention`
/** The end screen after step 05: still step 05 on the panel. */
export const DONE_PATH = `${ONBOARDING_PATH}/done`

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
  4: {
    title: 'After you graduate',
    path: AFTER_PATH,
    questions: (SCREENS[3]?.items ?? []).flatMap((item) =>
      item.questions.map(
        (question): StepQuestion => ({
          key: question.key,
          itemId: item.id,
          group: '',
          question: question.label || item.title,
          opensWithLine: false,
          ...AFTER[question.key as AfterKey],
        }),
      ),
    ),
    back: `${LIVING_PATH}/${LIVING.climate.slug}`,
    nextName: 'Your attention',
  },
}

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
 * and step 03 to step 04 (each page opens her first open question); step 04 to step 05.
 */
export function forwardPath(step: QuestionStep, answers: StoredAnswers): string {
  if (step === 1) return questionPath(2, firstOpenQuestion(2, answers))
  if (step === 2) return LIVING_PATH
  return step === 3 ? AFTER_PATH : ATTENTION_PATH
}

export function stepOfPath(pathname: string): PanelState | null {
  if (pathname === WELCOME_PATH) return 'welcome'
  if (pathname === PICTURE_PATH) return 0
  if (pathname === FACTS_PATH || pathname.startsWith(`${FACTS_PATH}/`)) return 1
  if (pathname === STUDY_PATH || pathname.startsWith(`${STUDY_PATH}/`)) return 2
  if (pathname === LIVING_PATH || pathname.startsWith(`${LIVING_PATH}/`)) return 3
  if (pathname === AFTER_PATH || pathname.startsWith(`${AFTER_PATH}/`)) return 4
  if (pathname === ATTENTION_PATH || pathname === DONE_PATH) return 5
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
  if (step === null || step === 'welcome' || step === 0 || step === 5) return null
  const asked = askedQuestions(step, answers)
  const { key } = shownQuestion(step, pathname, answers)
  return { question: asked.findIndex((q) => q.key === key) + 1, total: asked.length }
}
