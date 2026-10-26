// The onboarding shell's model: the six steps, the panel's words per step, and the questions of
// steps 01 to 04 one per screen. Pure and client-safe. The questions, their order and their texts
// come from questions.ts (SCREENS[0] to SCREENS[3]); the "why" lines, the slugs, step 02's groups
// and step 03's person screen are new here.

import { PICTURE_PATH } from '@/shared/lib/student-paths'
import type { OwnWordsStep, QuestionKey, Relative, StoredAnswers } from '@/shared/types/student'
import { DRAWN_TO_AREAS, isAsked, isVisible, PARTICULAR, SCREENS } from './questions'

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

/** The question step each "Tell me in your own words" box sits on. */
export const OWN_WORDS_STEP_OF: Readonly<Record<OwnWordsStep, QuestionStep>> = {
  facts: 1,
  study: 2,
  living: 3,
  after: 4,
}

/**
 * The own-words box a question step offers: OWN_WORDS_STEP_OF read the other way, less step 01,
 * whose answers are objective facts (where she is, the budget, dates, scores), so it offers none
 * (16 Oct 2026). Words read earlier on step 01 keep their step name.
 */
export const OWN_WORDS_STEP_AT: Readonly<Partial<Record<QuestionStep, OwnWordsStep>>> = {
  2: 'study',
  3: 'living',
  4: 'after',
}

/**
 * Step 03's "Who, and where?": a step question that is not a stored answer. It reads and writes
 * the stored person (`relative`).
 */
export const PERSON = 'person'
/** What a step question asks: a stored answer, or her person. */
export type StepKey = QuestionKey | typeof PERSON

/** What the panel can show: a step, the welcome before step 00 (every step listed, none current), or the end (every step done). */
export type PanelState = OnboardingStep | 'welcome' | 'done'

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
  // The end screen keeps step 05's words; the steps all read Done.
  done: LAST_STEP,
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
  where: 'It lets updates meant for students from your country reach you.',
  amount:
    'A course on your road that costs more is marked over budget, and its city a stretch. A rough number is fine.',
  covers: 'It tells me whether living costs come out of this amount or sit on top of it.',
  who: 'It shapes how each route shows the money a visa asks you to have.',
  hard: 'Roughly adds “roughly” where your road says a course is over your budget; a hard limit leaves it out.',
  earliest: "It shows in the timing line below; your road doesn't change with it.",
  latest:
    "The timing line below counts the intakes up to it, from mock data; your road doesn't change with it.",
  years: "It shows in the timing line below; your road doesn't change with it.",
  dep: 'This preview shows costs for you alone, and says so if someone comes with you.',
  qual: 'It decides which course levels you can enter.',
  eng: "It decides whether your road shows its course's English score as met.",
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
    why: 'Your road is matched to a course in one of the areas you pick.',
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
    why: 'This preview covers Australia only, so every future is drawn there.',
    slug: 'destination',
  },
  place: {
    why: 'Regional points your road to a regional city; city and suburban leave it as it is.',
    slug: 'place',
  },
  community: {
    why: "If it matters, I'll ask whether you know anyone in Australia.",
    slug: 'community',
  },
  knows: { why: 'If you do, your road can lean to the city they live in.', slug: 'know-anyone' },
  climate: { why: 'Some people settle better in one climate or another.', slug: 'climate' },
}

type AfterKey = 'stay' | 'focus' | 'earn' | 'settle'

/** What step 04 adds to each question of SCREENS[3]: its why and slug. */
const AFTER: Readonly<Record<AfterKey, Pick<StepQuestion, 'why' | 'slug'>>> = {
  stay: {
    why: 'It decides whether your road stays in Australia after you graduate or goes home.',
    slug: 'stay',
  },
  focus: {
    why: 'Career-focused can point your road to Sydney, for its job market; academic leaves it as it is.',
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
  why: 'With a city or suburb, your road can lean to where they live. Leave any part blank.',
  slug: 'who-and-where',
  opensWithLine: false,
}

export const ONBOARDING_PATH = '/onboarding'
export const WELCOME_PATH = `${ONBOARDING_PATH}/welcome`
/** Steps 00 to 04 hold 18 to 21 one-tap questions, about 15 seconds each; step 05 is optional. */
export const WELCOME_MINUTES = 5
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
 * "Do you know anyone…" only after community is not No, her person only after its Yes; a hidden
 * question never (HIDDEN_QUESTIONS). Its slug still names it, so an old link opens her first open
 * question instead.
 */
export function askedQuestions(step: QuestionStep, answers: StoredAnswers): StepQuestion[] {
  return QUESTION_STEPS[step].questions.filter((q) =>
    q.key === PERSON ? asksPerson(answers) : isAsked(q.key, answers),
  )
}

/**
 * Where Back goes from the step's first question: step 00's picture from step 01, else the last
 * question the step before asks for these answers (step 03 ends at community, "Do you know
 * anyone…" or her person).
 */
export function backPath(step: QuestionStep, answers: StoredAnswers): string {
  if (step === 1) return PICTURE_PATH
  const before = (step - 1) as QuestionStep
  const asked = askedQuestions(before, answers)
  const last = asked[asked.length - 1]
  return last ? questionPath(before, last.key) : QUESTION_STEPS[before].path
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
  const open = asked.find((q) => isOpen(q.key, answers, relative))
  return (open ?? asked[asked.length - 1])?.key ?? 'where'
}

/**
 * The first asked question after `from` with no stored answer (her person: none stored), else
 * null, when the step is done. Next goes there once her own words answered some of the step.
 */
export function nextOpenQuestion(
  step: QuestionStep,
  answers: StoredAnswers,
  from: StepKey,
  relative: Relative | null = null,
): StepKey | null {
  const asked = askedQuestions(step, answers)
  const after = asked.slice(asked.findIndex((q) => q.key === from) + 1)
  return after.find((q) => isOpen(q.key, answers, relative))?.key ?? null
}

/**
 * Where Continue on `from` goes for these answers: the next question asked (once her own words
 * answered some of the step, the next open one), or the step's forward path from its last.
 * Called with the answer just tapped already in `answers`, so a pick that changes what is asked
 * (the field after "Something particular") is counted.
 */
export function nextPath(
  step: QuestionStep,
  answers: StoredAnswers,
  from: StepKey,
  relative: Relative | null = null,
  wordsUsed = false,
): { path: string; leaves: boolean } {
  const asked = askedQuestions(step, answers)
  const next = wordsUsed
    ? nextOpenQuestion(step, answers, from, relative)
    : (asked[asked.findIndex((q) => q.key === from) + 1]?.key ?? null)
  return next === null
    ? { path: forwardPath(step, answers), leaves: true }
    : { path: questionPath(step, next), leaves: false }
}

const isOpen = (key: StepKey, answers: StoredAnswers, relative: Relative | null): boolean =>
  key === PERSON ? relative === null : answers[key] === undefined

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
  if (pathname === ATTENTION_PATH) return 5
  if (pathname === DONE_PATH) return 'done'
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
  if (step === null || step === 'welcome' || step === 'done' || step === 0 || step === 5)
    return null
  const asked = askedQuestions(step, answers)
  const { key } = shownQuestion(step, pathname, answers)
  return { question: asked.findIndex((q) => q.key === key) + 1, total: asked.length }
}
