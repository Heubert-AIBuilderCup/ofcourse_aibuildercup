// The onboarding shell's model: the seven steps, the panel's words per step, and step 01's
// questions one per screen. Pure and client-safe. The questions, their order and their groups
// come from questions.ts (SCREENS[0]); only the "why" lines are new here.

import type { QuestionKey, StoredAnswers } from '@/shared/types/student'
import { SCREENS } from './questions'

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
export type OnboardingStep = 0 | 1

/** What the panel can show: a step, or the welcome before step 00 (every step listed, none current). */
export type PanelState = OnboardingStep | 'welcome'

export const PANEL_COPY: Readonly<Record<PanelState, { title: string; lead: string }>> = {
  welcome: {
    title: 'Before we start',
    lead: "Here's the whole way through. Each step says why it asks.",
  },
  // The welcome says "Before we start"; from step 00 on, the panel speaks of the six steps.
  0: {
    title: 'Six short steps',
    lead: 'Each step says why it asks. Nothing is ranked: at the end you see three futures side by side.',
  },
  1: {
    title: 'Six short steps',
    lead: 'Each step says why it asks. Nothing is ranked: at the end you see three futures side by side.',
  },
}

export type FactQuestion = {
  key: QuestionKey
  /** The Item.id in SCREENS[0], whose impact line this question shows. */
  itemId: string
  /** The item's title when the item asks more than one question, else ''. */
  group: string
  /** The question's label, else the item's title. */
  question: string
  why: string
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

export const FACT_QUESTIONS: readonly FactQuestion[] = (SCREENS[0]?.items ?? []).flatMap((item) =>
  item.questions.map((question) => ({
    key: question.key,
    itemId: item.id,
    group: item.questions.length > 1 ? item.title : '',
    question: question.label || item.title,
    why: WHY[question.key as FactKey],
  })),
)

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

export const ONBOARDING_PATH = '/onboarding'
export const WELCOME_PATH = `${ONBOARDING_PATH}/welcome`
/** The canvas's placeholder until steps 04–06 are designed and timed. */
export const WELCOME_MINUTES = 10
export const PICTURE_PATH = `${ONBOARDING_PATH}/character`
export const FACTS_PATH = `${ONBOARDING_PATH}/facts`
export const STUDY_PATH = `${ONBOARDING_PATH}/study`

export function factPath(key: QuestionKey): string {
  return `${FACTS_PATH}/${FACT_SLUGS[key as FactKey]}`
}

/** The step 01 question a URL slug names, else null (a key is not a slug). */
export function factKey(slug: string | null | undefined): QuestionKey | null {
  return FACT_QUESTIONS.find((q) => FACT_SLUGS[q.key as FactKey] === slug)?.key ?? null
}

/** The question's place in FACT_QUESTIONS by its slug, else -1 (unknown, or none). */
export function factIndex(slug: string | null | undefined): number {
  const key = factKey(slug)
  return FACT_QUESTIONS.findIndex((q) => q.key === key)
}

/**
 * Where a returning student lands: the first question with no stored answer, else the last. A
 * question left blank (Skip) stores nothing and reads as its DS-D1 default everywhere downstream.
 */
export function firstUnanswered(answers: StoredAnswers): QuestionKey {
  const open = FACT_QUESTIONS.find((q) => answers[q.key] === undefined)
  return (open ?? FACT_QUESTIONS[FACT_QUESTIONS.length - 1])?.key ?? 'where'
}

export function stepOfPath(pathname: string): PanelState | null {
  if (pathname === WELCOME_PATH) return 'welcome'
  if (pathname === PICTURE_PATH) return 0
  if (pathname === FACTS_PATH || pathname.startsWith(`${FACTS_PATH}/`)) return 1
  return null
}

/** The place in FACT_QUESTIONS of the question a step 01 URL names, else -1. */
export function factIndexOfPath(pathname: string): number {
  const prefix = `${FACTS_PATH}/`
  return pathname.startsWith(prefix) ? factIndex(pathname.slice(prefix.length)) : -1
}
