// The three futures: one route built around cost, one around staying, one around career, picked
// by rules over the mock catalogue and read against her answers. Pure and deterministic (no
// clock, no randomness), so the browser redraws a chip change with the same futures the server
// first drew. Coins are deliberately not an input (DS-R7).

import { effective, fieldsChosen, isAssumed } from '@/features/opening'
import {
  type AnswerValue,
  type FutureId,
  QUESTION_KEYS,
  type QuestionKey,
  type Relative,
  type StoredAnswers,
} from '@/shared/types/student'
import { AREA_FIELDS, COURSES, cityOf, FIELD_LABELS, FIELD_OF_OPTION } from './catalogue'
import { feelOf } from './feel'
import { distanceLine } from './geo'
import {
  type Claim,
  type Course,
  DIMENSIONS,
  type Dimension,
  type Effect,
  type Feel,
  type FieldId,
  type Weights,
} from './types'
import { deriveWeights } from './weights'

export type EngineInput = { answers: StoredAnswers; relative: Relative | null }
export type FutureLine = {
  dim: Dimension
  effect: Effect
  text: string
  feel: Feel
  claim: Claim
  weighMost: boolean
}
export type Future = {
  id: FutureId
  heading: string
  courseId: string
  route: string
  distance: string | null
  strongOn: Dimension[]
  costsOn: Dimension[]
  lines: FutureLine[]
  chips: QuestionKey[]
  keepOpen: { text: string; doors: string }
}
export type Notice = {
  kind: 'field-substituted' | 'level-substituted' | 'fewer' | 'australia-only'
  text: string
  chip?: QuestionKey
}
export type SealedRoute = { courseId: string; route: string; overByK: number }
export type FuturesResult =
  | {
      kind: 'futures'
      weights: Weights
      reasons: Record<Dimension, string>
      futures: Future[]
      notices: Notice[]
    }
  | {
      kind: 'sealed'
      weights: Weights
      reasons: Record<Dimension, string>
      budgetK: number
      nearest: SealedRoute[]
      notices: Notice[]
    }

export const FUTURE_HEADINGS: Record<FutureId, string> = {
  cost: 'Built around cost',
  staying: 'Built around staying',
  career: 'Built around career',
}

/** The answers each future rests on, shown as chips she can correct. */
export const FUTURE_CHIPS: Record<FutureId, QuestionKey[]> = {
  cost: ['amount', 'hard', 'place', 'field', 'latest'],
  staying: ['amount', 'stay', 'earn', 'level', 'field'],
  career: ['amount', 'dest', 'field', 'earn'],
}

/**
 * Every answer buildFutures and deriveWeights read ('field' stands for know, field and areas). One
 * that rests on an assumption is a chip on every future too, so she can see and correct it.
 */
const READS: ReadonlySet<QuestionKey> = new Set<QuestionKey>([
  'amount',
  'covers',
  'who',
  'hard',
  'latest',
  'field',
  'level',
  'learn',
  'length',
  'dest',
  'place',
  'community',
  'stay',
  'focus',
  'earn',
])

/** The future's fixed chips, then each other answer it reads that is assumed, in question order. */
function chipsOf(id: FutureId, answers: StoredAnswers): QuestionKey[] {
  const fixed = FUTURE_CHIPS[id]
  const assumed = QUESTION_KEYS.filter(
    (key) => READS.has(key) && !fixed.includes(key) && isAssumed(answers, key),
  )
  return [...fixed, ...assumed]
}

/** The order the futures are picked in; each picks from what the earlier ones left. */
const PICK_ORDER: readonly FutureId[] = ['cost', 'staying', 'career']
const ALL_FIELDS = Object.keys(FIELD_LABELS) as FieldId[]
/** At least this much spare reads as a gift; less is neutral. */
const SPARE_K = 5
/** Up to this much over a rough budget reads as a stretch. */
const STRETCH_K = 6
const NEAREST = 3

/** A course and what it costs her a year: fees, plus living when her budget covers it. */
type Candidate = { course: Course; total: number }

type Context = {
  weights: Weights
  /** Her highest weight. */
  top: number
  budgetK: number
  withLiving: boolean
  /** Her kind of place; undefined when assumed, which counts as no preference. */
  place: AnswerValue | undefined
  stay: AnswerValue | undefined
  relative: Relative | null
  answers: StoredAnswers
}

/** Plain comparison, never locale-aware, so the server and every browser order alike. */
const byId = (a: Candidate, b: Candidate) =>
  a.course.id < b.course.id ? -1 : a.course.id > b.course.id ? 1 : 0
const byTotal = (a: Candidate, b: Candidate) => a.total - b.total || byId(a, b)

/** Each future's order of preference; the first candidate wins. */
const RANKS: Record<FutureId, (a: Candidate, b: Candidate) => number> = {
  cost: (a, b) => a.total - b.total || b.course.careerScore - a.course.careerScore || byId(a, b),
  staying: (a, b) => b.course.prScore - a.course.prScore || byTotal(a, b),
  career: (a, b) =>
    b.course.careerScore - a.course.careerScore ||
    b.course.prScore - a.course.prScore ||
    byTotal(a, b),
}

const routeOf = (course: Course) =>
  `${cityOf(course).name} · ${course.name}, ${course.university} · ${course.route}`

const routes = (n: number) => (n === 1 ? 'one route' : `${n} routes`)

/** Rule 1: the fields she chose, and a notice for each area the preview stands in for. */
function fieldsOf(answers: StoredAnswers): { fields: FieldId[]; notices: Notice[] } {
  const { kind, values } = fieldsChosen(answers)
  if (kind === 'any') return { fields: ALL_FIELDS, notices: [] }
  if (kind === 'field') return { fields: [FIELD_OF_OPTION[values[0]]], notices: [] }
  const fields = new Set<FieldId>()
  const notices: Notice[] = []
  for (const value of values) {
    const area = AREA_FIELDS[value]
    if (!area) continue
    for (const field of area.fields) fields.add(field)
    if (area.substitutedFrom) {
      const uses = area.fields.map((field) => FIELD_LABELS[field]).join(' and ')
      notices.push({
        kind: 'field-substituted',
        text: `No ${area.substitutedFrom} courses in this preview, so these use ${uses}.`,
        chip: 'field',
      })
    }
  }
  return { fields: [...fields], notices }
}

/** Rule 6: why fewer than three futures show, naming the chip that would open more. */
function fewerNotice(n: number, hardCut: boolean, prCut: boolean, budgetK: number): Notice {
  if (hardCut) {
    const verb = n === 1 ? 'fits' : 'fit'
    return {
      kind: 'fewer',
      text: `Only ${routes(n)} ${verb} a hard limit of AUD ${budgetK}k`,
      chip: 'amount',
    }
  }
  if (prCut) {
    const text =
      n === 0
        ? 'No route in this preview has a road to permanent residency for these fields'
        : `Only ${routes(n)} with a road to permanent residency`
    return { kind: 'fewer', text, chip: 'stay' }
  }
  const text =
    n === 0
      ? 'No route in this preview for these fields'
      : `Only ${routes(n)} in this preview for these fields`
  return { kind: 'fewer', text, chip: 'field' }
}

function costLine({ course, total }: Candidate, ctx: Context): { effect: Effect; text: string } {
  const label = ctx.withLiving
    ? `Fees and living about AUD ${total}k a year`
    : `Fees about AUD ${course.feeK}k a year`
  const spare = ctx.budgetK - total
  if (spare >= SPARE_K) {
    return { effect: 'gives', text: `${label}: within your budget, AUD ${spare}k spare` }
  }
  if (spare >= 0) {
    return { effect: 'neutral', text: `${label}: within your budget, only AUD ${spare}k spare` }
  }
  if (-spare <= STRETCH_K) {
    return { effect: 'costs', text: `${label}: AUD ${-spare}k over, a stretch on a rough budget` }
  }
  return { effect: 'costs', text: `${label}: AUD ${-spare}k over your budget` }
}

function locationEffect(place: AnswerValue | undefined, regional: boolean): Effect {
  if (place === 'Regional') return regional ? 'gives' : 'costs'
  if (place === 'City') return regional ? 'neutral' : 'gives'
  return 'neutral'
}

function lineData(
  dim: Dimension,
  candidate: Candidate,
  ctx: Context,
): { effect: Effect; text: string; claim: Claim } {
  const { course } = candidate
  if (dim === 'cost') return { ...costLine(candidate, ctx), claim: course.feeClaim }
  if (dim === 'location') {
    const city = cityOf(course)
    return {
      effect: locationEffect(ctx.place, city.regional),
      text: city.location.text,
      claim: city.location.claim,
    }
  }
  if (dim === 'pr' && ctx.stay === 'No') {
    return {
      effect: 'neutral',
      text: "PR doesn't count here: you don't plan to stay",
      claim: course.lines.pr.claim,
    }
  }
  return course.lines[dim]
}

function futureOf(id: FutureId, candidate: Candidate, ctx: Context): Future {
  const lines = DIMENSIONS.map((dim): FutureLine => {
    const { effect, text, claim } = lineData(dim, candidate, ctx)
    const weight = ctx.weights[dim]
    const cost = dim === 'cost' ? { budgetK: ctx.budgetK, totalK: candidate.total } : undefined
    return {
      dim,
      effect,
      text,
      feel: feelOf(effect, weight, cost),
      claim,
      weighMost: weight === ctx.top && weight >= 2,
    }
  })
  return {
    id,
    heading: FUTURE_HEADINGS[id],
    courseId: candidate.course.id,
    route: routeOf(candidate.course),
    distance: distanceLine(candidate.course, ctx.relative),
    strongOn: lines.filter((l) => l.effect === 'gives' && l.weighMost).map((l) => l.dim),
    costsOn: lines.filter((l) => l.effect === 'costs').map((l) => l.dim),
    lines,
    chips: chipsOf(id, ctx.answers),
    keepOpen: candidate.course.keepOpen,
  }
}

export function buildFutures({ answers, relative }: EngineInput): FuturesResult {
  const { weights, reasons } = deriveWeights(answers)

  const { fields, notices } = fieldsOf(answers)
  const inFields = COURSES.filter((course) => fields.includes(course.field))
  const level = effective(answers, 'level')
  const atLevel = inFields.filter((course) => course.level === level)
  if (atLevel.length === 0 && inFields.length > 0) {
    notices.push({
      kind: 'level-substituted',
      text: `No ${level} courses for these fields in this preview, so these show other levels.`,
      chip: 'level',
    })
  }
  const byLevel = atLevel.length > 0 ? atLevel : inFields

  const stay = effective(answers, 'stay')
  const staying = stay === 'Yes' ? byLevel.filter((course) => course.prScore > 0) : byLevel
  const prCut = staying.length < byLevel.length

  const budgetK = Number(effective(answers, 'amount'))
  const withLiving = effective(answers, 'covers') === 'Fees and living'
  const pool: Candidate[] = staying.map((course) => ({
    course,
    total: course.feeK + (withLiving ? cityOf(course).livingK : 0),
  }))
  const hard = effective(answers, 'hard') === 'Hard limit'
  const fits = hard ? pool.filter((c) => c.total <= budgetK) : pool
  const hardCut = fits.length < pool.length

  const australia: Notice[] =
    answers.dest?.value === 'Open to others'
      ? [
          {
            kind: 'australia-only',
            text: 'Only Australia is covered in this preview, so these futures are Australian.',
          },
        ]
      : []

  if (fits.length === 0 && pool.length > 0) {
    const nearest = [...pool]
      .sort(byTotal)
      .slice(0, NEAREST)
      .map((c) => ({ courseId: c.course.id, route: routeOf(c.course), overByK: c.total - budgetK }))
    return {
      kind: 'sealed',
      weights,
      reasons,
      budgetK,
      nearest,
      notices: [...notices, ...australia],
    }
  }

  const ctx: Context = {
    weights,
    top: Math.max(...DIMENSIONS.map((dim) => weights[dim])),
    budgetK,
    withLiving,
    place: isAssumed(answers, 'place') ? undefined : effective(answers, 'place'),
    stay,
    relative,
    answers,
  }
  const futures: Future[] = []
  let left = fits
  for (const id of PICK_ORDER) {
    if (left.length === 0) break
    const pick = left.reduce((best, c) => (RANKS[id](c, best) < 0 ? c : best))
    futures.push(futureOf(id, pick, ctx))
    left = left.filter((c) => c !== pick)
  }
  if (futures.length < PICK_ORDER.length) {
    notices.push(fewerNotice(futures.length, hardCut, prCut, budgetK))
  }

  return { kind: 'futures', weights, reasons, futures, notices: [...notices, ...australia] }
}

/** Whether a line reads differently: its effect, its words or its feel. */
const redrawn = (line: FutureLine, before: FutureLine | undefined) =>
  !before || line.effect !== before.effect || line.text !== before.text || line.feel !== before.feel

/**
 * What a redraw changed on each future it shows: every dimension when the course changed, else
 * the dimensions that read differently. A future with nothing changed is left out.
 */
export function diffFutures(
  prev: FuturesResult,
  next: FuturesResult,
): Partial<Record<FutureId, Dimension[]>> {
  const changed: Partial<Record<FutureId, Dimension[]>> = {}
  if (next.kind !== 'futures') return changed
  for (const future of next.futures) {
    const before =
      prev.kind === 'futures' ? prev.futures.find((f) => f.id === future.id) : undefined
    const dims =
      before?.courseId !== future.courseId
        ? [...DIMENSIONS]
        : future.lines
            .filter((l) =>
              redrawn(
                l,
                before.lines.find((b) => b.dim === l.dim),
              ),
            )
            .map((l) => l.dim)
    if (dims.length > 0) changed[future.id] = dims
  }
  return changed
}
