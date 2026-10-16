// Ask about a tile (criteria 23–26): code decides which tiles take a typed question and which
// catalogue rows the model may answer from; the model only answers from them, and every answer
// passes askProblems (the why's ranking and figure checks) or she is told there is no data. Pure.

import { cityById, cityOf } from '@/features/engine/catalogue'
import { effective } from '@/features/opening/model/questions'
import type { RoadmapTag, StoredAnswers } from '@/shared/types/student'
import { asksFor } from '../data/asks'
import { courseById } from '../data/courses'
import { CITY_STATE } from '../data/occupations'
import { OPPORTUNITIES } from '../data/opportunities'
import { subjectsOf } from '../data/subjects'
import type { AskSubject, RoadSpec, SlotId, TileAsk } from '../data/types'
import { type AnswerLine, answerLines } from './answer-lines'
import { NO_DATA } from './ask-words'
import { slotOf } from './build'
import { courseConditions } from './conditions'
import { courseFacts, numbersIn, opportunityFact, rankingWords } from './why'

/** The tiles with a catalogue of their own to answer from: the cities and the courses. */
export const ASK_SLOTS = [
  'city',
  'alt-city',
  'course',
  'alt-course',
  'stack-course',
] as const satisfies readonly SlotId[]
export type AskSlot = (typeof ASK_SLOTS)[number]

export const isAskSlot = (slot: SlotId | null): slot is AskSlot =>
  ASK_SLOTS.includes(slot as AskSlot)

export const ASK_MAX = 700
const DEFAULT_CAP = 20
const MOCK = ' (mock)'

export type AskRow = { id: string; text: string }
/** What the model is given: the tile, her answers by question, the tile's rows, her tags. */
export type AskFacts = {
  tile: { slot: AskSlot; name: string }
  rows: AskRow[]
  answers: AnswerLine[]
  tags: string[]
}
export type AskAnswer = { answerable: boolean; reply: string; cited: string[] }

const askRows = (subject: AskSubject): AskRow[] =>
  asksFor(subject).map((ask: TileAsk, i) => ({
    id: `ask-${i + 1}`,
    text: `${ask.question} ${ask.answer}${MOCK}`,
  }))

function cityRows(cityId: string): AskRow[] {
  const city = cityById(cityId)
  return [
    {
      id: 'city-living',
      text: `Living costs in ${city.name} about AUD ${city.livingK}k a year${MOCK}`,
    },
    {
      id: 'city-regional',
      text: city.regional
        ? `${city.name} counts as regional for visas${MOCK}`
        : `${city.name} does not count as regional for visas${MOCK}`,
    },
    { id: 'city-state', text: `${city.name} is in ${CITY_STATE[city.id]}${MOCK}` },
    ...OPPORTUNITIES.filter((o) => o.cityId === city.id).map(opportunityFact),
    ...askRows({ kind: 'city', cityId: city.id }),
  ]
}

function courseRows(courseId: string): AskRow[] {
  const course = courseById(courseId)
  if (!course) return []
  const named = `${course.name} at ${course.university}`
  const subjects = subjectsOf(course.id)
  return [
    ...courseFacts(course.id),
    ...(subjects
      ? [
          { id: 'course-majors', text: `${named} majors: ${subjects.majors.join(' and ')}${MOCK}` },
          { id: 'course-units', text: `${named} units: ${subjects.units.join(', ')}${MOCK}` },
          ...subjects.conditions.map((condition, i) => ({
            id: `course-condition-${i + 1}`,
            text: `${named} entry: ${condition}${MOCK}`,
          })),
        ]
      : []),
    // What the card's entry conditions say, read from the same rule (conditions.ts).
    ...courseConditions(course.id, {}).map((c) => ({
      id: `course-entry-${c.id}`,
      text: `${named} entry: ${c.text.charAt(0).toLowerCase()}${c.text.slice(1)}${MOCK}`,
    })),
    ...askRows({ kind: 'course', courseId: course.id }),
  ]
}

/** The city or course a tile is about, from the road's ids; null for every other slot. */
export function askSubject(spec: RoadSpec, slot: SlotId | null): AskSubject | null {
  switch (slot) {
    case 'city':
      return { kind: 'city', cityId: spec.cityId }
    case 'alt-city':
      return { kind: 'city', cityId: spec.altCityId }
    case 'course':
      return { kind: 'course', courseId: spec.courseId }
    case 'alt-course':
      return { kind: 'course', courseId: spec.altCourseId }
    case 'stack-course':
      return { kind: 'course', courseId: spec.stackCourseId }
    default:
      return null
  }
}

/** A tile's suggested questions (21, 22): its city's or course's asks; none for any other tile. */
export function suggestedAsks(spec: RoadSpec, tileId: string): TileAsk[] {
  const subject = askSubject(spec, slotOf(spec, tileId))
  return subject ? asksFor(subject) : []
}

function rowsFor(spec: RoadSpec, slot: AskSlot): AskRow[] {
  const subject = askSubject(spec, slot)
  if (!subject) return []
  return subject.kind === 'city' ? cityRows(subject.cityId) : courseRows(subject.courseId)
}

/** Her own course's rows, ids prefixed yours-, so an alternative or stack course compares (69). */
const yoursRows = (spec: RoadSpec, slot: AskSlot): AskRow[] =>
  slot === 'alt-course' || slot === 'stack-course'
    ? courseRows(spec.courseId).map((r) => ({ id: `yours-${r.id}`, text: r.text }))
    : []

const aud = (k: number) => `AUD ${k}k`

/**
 * Her stated budget against the catalogue, the sum done here (82): a course's fees, or on a city
 * tile her road's course's fees, plus the city's living costs when her budget covers living. None
 * unless she stated an amount.
 */
function budgetRows(spec: RoadSpec, slot: AskSlot, answers: StoredAnswers): AskRow[] {
  const amount = answers.amount
  if (amount?.state !== 'stated' || typeof amount.value !== 'number') return []
  const subject = askSubject(spec, slot)
  const course = courseById(subject?.kind === 'course' ? subject.courseId : spec.courseId)
  if (!subject || !course) return []
  const city = cityById(subject.kind === 'city' ? subject.cityId : cityOf(course).id)
  const living = effective(answers, 'covers') === 'Fees and living'
  const fees =
    subject.kind === 'course' ? 'the fees' : `the fees of ${course.name} at ${course.university}`
  const cost = course.feeK + (living ? city.livingK : 0)
  const costs = living
    ? `${fees} (${aud(course.feeK)}) and living costs in ${city.name} (${aud(city.livingK)}) are`
    : `${fees} are`
  const gap =
    cost > amount.value
      ? `${aud(cost - amount.value)} over`
      : cost < amount.value
        ? `${aud(amount.value - cost)} to spare`
        : 'exactly your budget'
  const covers = living ? 'fees and living' : 'fees only'
  return [
    {
      id: 'budget',
      text: `Your budget, ${aud(amount.value)} a year for ${covers}: ${costs} ${aud(cost)} a year, ${gap}.`,
    },
  ]
}

/**
 * The one tile's rows from the catalogue, her answers and her tags: all the model may answer from.
 * An alternative or stack course adds her own course's rows; a stated budget adds its sum. A
 * wellbeing tag never reaches it (ADR-088: those are for support content only).
 */
export function askFacts(
  spec: RoadSpec,
  slot: AskSlot,
  answers: StoredAnswers,
  tags: readonly RoadmapTag[],
): AskFacts {
  return {
    tile: { slot, name: spec.slots[slot].name },
    rows: [...rowsFor(spec, slot), ...yoursRows(spec, slot), ...budgetRows(spec, slot, answers)],
    answers: answerLines(answers),
    tags: tags.filter((t) => !t.wellbeing).map((t) => t.text),
  }
}

/**
 * Every problem in an answer, one line each, for the model to fix; [] when it may be shown. Its
 * figures come from the rows or her answers, as a why's do.
 */
export function askProblems(v: AskAnswer, facts: Pick<AskFacts, 'rows' | 'answers'>): string[] {
  const problems: string[] = []
  if (!v.answerable) {
    if (v.reply.trim() !== NO_DATA)
      problems.push(`reply: when answerable is false, reply exactly "${NO_DATA}".`)
    return problems
  }
  if (v.reply.trim() === '') problems.push('reply: answer the question from the rows.')
  if (v.reply.length > ASK_MAX) problems.push(`reply: at most ${ASK_MAX} characters.`)
  for (const word of rankingWords(v.reply)) {
    problems.push(`reply: never say "${word}"; nothing is ranked or recommended.`)
  }
  const known = new Set(
    [...facts.rows.map((r) => r.text), ...facts.answers.map((a) => a.answer)].flatMap(numbersIn),
  )
  for (const n of new Set(numbersIn(v.reply))) {
    if (!known.has(n))
      problems.push(`reply: ${n} is in no row nor her answers; use only their figures.`)
  }
  if (v.cited.length === 0) problems.push('cited: list the id of every row the reply uses.')
  const ids = new Set(facts.rows.map((r) => r.id))
  for (const id of v.cited) {
    if (!ids.has(id)) problems.push(`cited: "${id}" is not an id in DATA.rows.`)
  }
  return problems
}

/** Typed questions a student may send a day: STUDENT_ASK_DAILY_CAP when a whole number, else 20. */
export function askCap(env: Record<string, string | undefined>): number {
  const value = env.STUDENT_ASK_DAILY_CAP?.trim()
  return value && /^\d+$/.test(value) ? Number(value) : DEFAULT_CAP
}
