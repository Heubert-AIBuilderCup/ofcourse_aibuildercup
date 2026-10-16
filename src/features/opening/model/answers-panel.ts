// "Your answers" over the board: the onboarding answers that draw one roadmap, grouped by the step
// that asked it, with what each would change on the road before it is saved. Pure and client-safe. The
// rows come from the question model (questions.ts, onboarding.ts); the effects are the design's two
// mock ones (board.js `ANS`/`eff`), read from the road passed in, whose types alone are imported:
// the opening never loads the road's code, nor the roads' (the board passes its re-match rule in).

import type { Road } from '@/features/road'
import type { AnswerValue, QuestionKey, Relative, StoredAnswers } from '@/shared/types/student'
import { englishMeets, NOT_TAKEN } from './english'
import { askedQuestions, ONBOARDING_STEPS, PERSON } from './onboarding'
import {
  DEFAULTS,
  display,
  effective,
  isAssumed,
  NOT_SURE,
  parseAnswer,
  questionOf,
  SCREENS,
} from './questions'

/** A row: a question's stored answer, or her person. */
export type RowKey = QuestionKey | typeof PERSON

export type AnswerOption = { value: AnswerValue; label: string }

export type AnswerRow = {
  key: RowKey
  question: string
  /** Her answer as it reads; '' when there is none. */
  shown: string
  /** What an answer left open says ("Skipped"); null when answered. */
  open: string | null
  /** Changed inline from the panel. */
  editable: boolean
  why: string
  options: AnswerOption[]
}

export type AnswerGroup = { n: string; name: string; rows: AnswerRow[] }

/** What an answer would change: in words, and on the tiles it names ("If you save"). */
export type Effect = { lines: string[]; prev: Record<string, string> }

/**
 * Whether changing her answers from `before` to `after` would move her to another road, in the
 * words to show ("Your road changes to …"); null when her road stays. The board passes it in (its
 * road feature matches roads), so the opening never loads the roads.
 */
export type RoadChangeOf = (before: StoredAnswers, after: StoredAnswers) => string | null

const NOTHING: Effect = { lines: ['Nothing on your roadmap changes.'], prev: {} }
/** Re-matching on: neither her road nor a tile on it moves. */
const ROAD_STAYS: Effect = { lines: ['Nothing on your road moves.'], prev: {} }

const ASSUMED = ' · assumed'
const SKIPPED = 'Skipped'

/** An amount reads "AUD 30k"; any other answer as itself, areas joined. */
export function answerLabel(key: QuestionKey, value: AnswerValue): string {
  return key === 'amount' && typeof value === 'number' ? `AUD ${value}k` : display(value)
}

/** The question's options, labelled, with "Not sure" last where the question offers it. */
export function optionsFor(key: QuestionKey): AnswerOption[] {
  const question = questionOf(key)
  const options = question.options.map((value) => ({ value, label: answerLabel(key, value) }))
  return question.notSure ? [...options, { value: NOT_SURE, label: NOT_SURE }] : options
}

/** Item titles by id, for an item that asks several questions ("Your budget per year"). */
const ITEM_TITLES = new Map(
  SCREENS.flatMap((screen) =>
    screen.items.filter((item) => item.questions.length > 1).map((item) => [item.id, item.title]),
  ),
)

/** Her answer, or the default it counts as (" · assumed"), or "Skipped" for one with none. */
function questionRow(
  key: QuestionKey,
  question: string,
  why: string,
  answers: StoredAnswers,
): AnswerRow {
  const value = effective(answers, key)
  const row = { key, question, editable: true, why, options: optionsFor(key) }
  if (value === undefined) return { ...row, shown: '', open: SKIPPED }
  const assumed = isAssumed(answers, key) ? ASSUMED : ''
  return { ...row, shown: `${answerLabel(key, value)}${assumed}`, open: null }
}

/** "Anjali, cousin · Cannington, Perth"; any part may be blank. */
function personShown(relative: Relative | null): string {
  if (!relative) return ''
  const who = [relative.name, relative.relationship?.toLowerCase()].filter(Boolean).join(', ')
  return [who, relative.place].filter(Boolean).join(' · ')
}

/** A question step's rows: the questions asked for these answers (onboarding's own rule). */
function stepRows(
  step: 1 | 2 | 3 | 4,
  answers: StoredAnswers,
  relative: Relative | null,
): AnswerRow[] {
  return askedQuestions(step, answers).map((q) => {
    if (q.key === PERSON) {
      const shown = personShown(relative)
      return {
        key: PERSON,
        question: q.question,
        shown,
        open: shown ? null : SKIPPED,
        editable: false,
        why: q.why,
        options: [],
      }
    }
    const title = ITEM_TITLES.get(q.itemId)
    const question = title && q.group === title ? `${title} · ${q.question}` : q.question
    return questionRow(q.key, question, q.why, answers)
  })
}

/**
 * The four question steps, 01 to 04, each with its rows: every question asked for these answers (a
 * hidden one is left out) and her person. Only what draws the board: her character is her
 * profile's, and her coins never change the road.
 */
export function answerGroups(answers: StoredAnswers, relative: Relative | null): AnswerGroup[] {
  return ([1, 2, 3, 4] as const).map((step) => ({
    n: `0${step}`,
    name: ONBOARDING_STEPS[step] ?? '',
    rows: stepRows(step, answers, relative),
  }))
}

/** AUD thousands to one decimal, as the mock's figures read: 3.5, 9.5, 1. */
const thousands = (n: number) => String(Math.round(n * 10) / 10)

/**
 * The budget's effect on the course on her road (the first on its course line) and its city: under
 * the course's fees, the city is a stretch and the course goes over; covering them again after a
 * budget under them was saved lifts both marks; else nothing moves.
 */
function budgetEffect(road: Road, value: AnswerValue, answers: StoredAnswers): Effect {
  const course = road.tiles.find((t) => t.id === road.walk.courseLine[0])
  const city = road.tiles.find((t) => t.id === road.walk.cityLine[0])
  const amount = value === NOT_SURE ? DEFAULTS.amount : value
  if (!course || !city || course.fees === undefined || typeof amount !== 'number') return NOTHING
  const over = course.fees - amount
  if (over > 0) {
    return {
      lines: [
        `${city.name} is marked as a stretch on your budget.`,
        `${course.name} goes AUD ${thousands(over)}k a year over it.`,
      ],
      prev: {
        [city.id]: 'A stretch on your budget',
        [course.id]: `AUD ${thousands(over)}k a year over budget`,
      },
    }
  }
  const saved = answers.amount?.value
  if (typeof saved === 'number' && saved < course.fees) {
    return {
      lines: [
        `${city.name} is no longer a stretch on your budget.`,
        `${course.name} fits your budget.`,
      ],
      prev: { [city.id]: 'No longer a stretch', [course.id]: 'Within your budget' },
    }
  }
  return { lines: ['Nothing on your roadmap moves.'], prev: {} }
}

/**
 * An English answer that falls short of the course on her road: "Not taken yet", or a score under
 * the course's own (its tile's `ielts`, read through `englishMeets`). A road whose course carries
 * no score (Priya's) reads "Not taken yet" alone, against its badge. When her saved answer already
 * fell short, the condition is still not met: nothing is lost.
 */
function englishEffect(road: Road, value: AnswerValue, answers: StoredAnswers): Effect {
  const course = road.tiles.find((t) => t.id === road.walk.courseLine[0])
  if (!course?.badges?.includes('ielts')) return NOTHING
  const required = course.ielts
  const shortOf = (answer: AnswerValue): boolean =>
    required === undefined
      ? answer === NOT_TAKEN
      : englishMeets({ value: answer, state: 'stated' }, required) === false
  if (!shortOf(value)) return NOTHING
  const saved = answers.eng
  const was = saved?.state === 'stated' && shortOf(saved.value) ? 'still not met' : 'no longer met'
  const condition =
    required === undefined ? road.badges.ielts.value : `IELTS ${required.toFixed(1)} overall`
  return {
    lines: [`${course.name}’s entry condition is ${was}: it asks for ${condition}.`],
    prev: { [course.id]: `Needs ${condition}` },
  }
}

/**
 * What picking this answer would change on the road, before it is saved: the budget and the
 * English test move tiles (the design's two mock effects); every other answer changes nothing.
 * `answers` are the roadmap's saved ones. With `rematch` (the board draws the road her answers
 * match, and passes its rule), a pick that would move her to another road says so first, and one
 * that moves nothing says her road stays.
 */
export function effectOf(
  road: Road,
  key: RowKey,
  value: AnswerValue,
  answers: StoredAnswers,
  rematch?: RoadChangeOf,
): Effect {
  const own =
    key === 'amount'
      ? budgetEffect(road, value, answers)
      : key === 'eng'
        ? englishEffect(road, value, answers)
        : NOTHING
  if (!rematch || key === PERSON) return own
  const answer = parseAnswer(key, value)
  const after = answer ? { ...answers, [key]: answer } : answers
  const change = rematch(answers, after)
  if (change) return { lines: [change, ...(own === NOTHING ? [] : own.lines)], prev: own.prev }
  return own === NOTHING ? ROAD_STAYS : own
}
