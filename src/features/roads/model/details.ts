// What each card adds beyond its why (criteria 29 to 33): a course's majors and units, the work
// beside a course, the graduate jobs and occupations after it, whether its occupation is on the
// state's list, and, on the stack and the alternative, the field next to hers its course is in.
// With the course detail on (COURSE_DETAIL_ON), every course card (the road's, the alternative
// and the stack) also has the fields near its course's and its occupations' sample job market in
// that course's city. The options beside the road's steps (options.ts) add their own: another
// course its jobs, a job its market, lists and way to PR. Nothing is ranked: catalogue order. Pure.

import { cityById, cityOf } from '@/features/engine/catalogue'
import type { StoredAnswers } from '@/shared/types/student'
import { courseById } from '../data/courses'
import { FIELDS, relatedFields } from '../data/fields'
import { jobMarketFor } from '../data/job-market'
import { CITY_STATE, occupationsFor, routeFor, type StayingRoute } from '../data/occupations'
import { opportunitiesIn } from '../data/opportunities'
import { subjectsOf } from '../data/subjects'
import {
  type Comparison,
  type CourseJob,
  type FieldNear,
  type JobMarketRow,
  type Occupation,
  type Opportunity,
  type RoadSpec,
  SLOTS,
  type SlotId,
  type StateId,
  type VisaId,
} from '../data/types'
import { VISAS } from '../data/visas'
import { pickedFields } from './match'
import { jobsAfter, jobTileId, otherCourses, otherCourseTileId } from './options'

/** A visa on the road as its step's card states it: its facts, and the visas it leads to. */
export type VisaFacts = {
  id: VisaId
  name: string
  years: string
  conditions: string[]
  /** "485 · Graduate visa" */
  leadsTo: string[]
  source: string
}

/**
 * A job beside the 485: its sample market in the road's city, whether it is on that state's 190
 * and 491 lists, and the way to PR it supports there.
 */
export type JobFacts = {
  code: string
  name: string
  /** The road's city, named. */
  city: string
  market: JobMarketRow | null
  lists: string[]
  prWay: string
}

/** The field next to the one she picked that a course is in, and what that field is. */
export type RelatedMark = { field: string; definition: string }

export type CardDetails = {
  subjects?: { majors: string[]; units: string[]; conditions: string[] }
  work?: {
    title: string
    employer: string
    kind: Opportunity['kind']
    demand: Opportunity['demand']
  }[]
  graduate?: { title: string; employer: string }[]
  /** With the course detail on, a course tile's occupations carry their sample market. */
  occupations?: CourseJob[]
  listStatus?: string[]
  related?: RelatedMark
  /** With the course detail on: the fields one step from its course's, on every course tile. */
  fieldsNear?: FieldNear[]
  /**
   * With compare on (COMPARE_ON), on the other-city, other-course and stack-course tiles: "What
   * changes" (the finder's compareByTile), with the roadmap a new one would start from.
   */
  compare?: Comparison & { roadmapId: string }
  /** On a step of the route that is a visa: its facts. */
  visa?: VisaFacts
  /** On a job beside the 485: its facts. */
  job?: JobFacts
}

const courseOf = (spec: RoadSpec, slot: 'course' | 'alt-course' | 'stack-course'): string =>
  slot === 'course' ? spec.courseId : slot === 'alt-course' ? spec.altCourseId : spec.stackCourseId

/** The fields she picked (her field, else her areas); the road's own when she picked none. */
export const herFields = (spec: RoadSpec, answers: StoredAnswers): readonly string[] =>
  pickedFields(answers) ?? [spec.field]

/**
 * The mark a course carries when its field is next to one she picked (one step on the field
 * graph), with that field's definition; none for a course in her own field or further away.
 */
export function relatedMark(courseId: string, fields: readonly string[]): RelatedMark | undefined {
  const course = courseById(courseId)
  if (!course || fields.includes(course.field)) return undefined
  if (!fields.some((f) => relatedFields(f).includes(course.field))) return undefined
  const field = FIELDS.find((f) => f.id === course.field)
  return field && { field: field.name, definition: field.definition }
}

/** The fields one step from a field on the graph, named and defined, in FIELD_EDGES order. */
export const fieldsNear = (id: string): FieldNear[] =>
  relatedFields(id).flatMap((near) => {
    const field = FIELDS.find((f) => f.id === near)
    return field ? [{ name: field.name, definition: field.definition }] : []
  })

/** A course card's detail: the fields near its field, its occupations, their market in a city. */
function courseDetailFor(courseId: string, field: string, cityId: string): CardDetails {
  return {
    fieldsNear: fieldsNear(field),
    occupations: occupationsFor(courseId).map(({ code, name }) => ({
      code,
      name,
      market: jobMarketFor(code, cityId),
    })),
  }
}

/** The detail of a course on the stack or the alternative: its own field and its own city. */
function otherCourseDetail(courseId: string): CardDetails {
  const course = courseById(courseId)
  return course ? courseDetailFor(courseId, course.field, cityOf(course).id) : {}
}

function subjectsFor(courseId: string): CardDetails {
  const subjects = subjectsOf(courseId)
  if (!subjects) return {}
  const { majors, units, conditions } = subjects
  return { subjects: { majors, units, conditions } }
}

function workFor(spec: RoadSpec): CardDetails {
  const work = opportunitiesIn(spec.cityId, spec.field)
    .filter((o) => o.kind !== 'graduate-program')
    .map(({ title, employer, kind, demand }) => ({ title, employer, kind, demand }))
  return { work }
}

function graduateFor(spec: RoadSpec): CardDetails {
  return {
    graduate: opportunitiesIn(spec.cityId, spec.field)
      .filter((o) => o.kind === 'graduate-program')
      .map(({ title, employer }) => ({ title, employer })),
    occupations: occupationsFor(spec.courseId).map(({ code, name }) => ({ code, name })),
  }
}

/**
 * A line per occupation: whether it is where the visa looks. The state's 190 list for the 190,
 * its 491 list for the 491 and the 191, employer sponsorship for the 186 and the 482.
 */
export function listLines(occupations: Occupation[], visa: string, state: StateId): string[] {
  return occupations.flatMap((o) => {
    if (visa === '186' || visa === '482')
      return [
        o.employerSponsored
          ? `${o.name} can be employer-sponsored`
          : `${o.name} is not on the employer-sponsored list`,
      ]
    const list = visa === '190' ? '190' : visa === '491' || visa === '191' ? '491' : null
    if (!list) return []
    const on = (o.lists[state] ?? []).includes(list)
    return [`${o.name} is ${on ? 'on' : 'not on'} ${state}'s ${list} list`]
  })
}

/**
 * The list lines of the road's course, in the course's own state, for the visa its tile's slot
 * names (as why.ts reads it). None on a road home.
 */
function listStatusFor(spec: RoadSpec, slot: SlotId): CardDetails {
  const course = spec.stays ? courseById(spec.courseId) : undefined
  const visa = spec.slots[slot].visa
  if (!course || !visa) return {}
  return { listStatus: listLines(occupationsFor(course.id), visa, CITY_STATE[cityOf(course).id]) }
}

const nonEmpty = (details: CardDetails): CardDetails | null => {
  const kept = Object.entries(details).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v))
  return kept.length > 0 ? (Object.fromEntries(kept) as CardDetails) : null
}

/** What details add beyond today's: the course detail (COURSE_DETAIL_ON). */
export type DetailOptions = { detail?: boolean }

/**
 * What the card of a slot adds, or null when it adds nothing. Her answers say what she picked;
 * with the course detail on, every course card (the road's, the alternative and the stack) also
 * has the fields near its course and its jobs' market, each in its own course's city.
 */
export function cardDetails(
  spec: RoadSpec,
  slot: SlotId,
  answers: StoredAnswers,
  opts?: DetailOptions,
): CardDetails | null {
  const own = slotDetails(spec, slot, answers, opts)
  const visa = visaFacts(SLOT_VISA[slot] ?? spec.slots[slot].visa)
  return visa ? { ...own, visa } : own
}

/** The visa each fixed step of the route is; the ways to stay carry their own (`SlotCopy.visa`). */
const SLOT_VISA: Partial<Record<SlotId, VisaId>> = { 'visa-500': '500', 'visa-485': '485' }

const visaName = (id: VisaId): string => VISAS.find((v) => v.id === id)?.name ?? ''

function visaFacts(id: VisaId | undefined): VisaFacts | undefined {
  const visa = VISAS.find((v) => v.id === id)
  if (!visa) return undefined
  return {
    id: visa.id,
    name: visa.name,
    years: visa.years,
    conditions: [...visa.conditions],
    leadsTo: visa.leadsTo.map((to) => `${to} · ${visaName(to)}`),
    source: `${visa.source.title} · ${visa.source.date}`,
  }
}

function slotDetails(
  spec: RoadSpec,
  slot: SlotId,
  answers: StoredAnswers,
  opts?: DetailOptions,
): CardDetails | null {
  switch (slot) {
    case 'course':
      return nonEmpty({
        ...subjectsFor(spec.courseId),
        ...(opts?.detail ? courseDetailFor(spec.courseId, spec.field, spec.cityId) : {}),
      })
    case 'alt-course':
    case 'stack-course': {
      const courseId = courseOf(spec, slot)
      const related = relatedMark(courseId, herFields(spec, answers))
      return nonEmpty({
        ...subjectsFor(courseId),
        related,
        ...(opts?.detail ? otherCourseDetail(courseId) : {}),
      })
    }
    case 'course-years':
      return nonEmpty(workFor(spec))
    case 'visa-485':
      return nonEmpty(graduateFor(spec))
    case 'pr-straight':
    case 'pr-lane':
    case 'pr-lane-end':
      return nonEmpty(listStatusFor(spec, slot))
    default:
      return null
  }
}

/** The way to PR a job's route is, in its state. */
function prWayLine(route: StayingRoute, state: StateId): string {
  if (route === '190') return `Supports a 190 state nomination in ${state}`
  if (route === '491') return `Supports a 491 regional visa in ${state}, then the 191`
  if (route === '186') return 'Supports an employer’s 186: it can be employer-sponsored'
  return `No clear way to PR from it in ${state}`
}

/** A job's facts in the road's city, by the rules the PR steps use (listLines, routeFor). */
function jobFacts(spec: RoadSpec, o: Occupation): JobFacts {
  const state = CITY_STATE[spec.cityId]
  return {
    code: o.code,
    name: o.name,
    city: cityById(spec.cityId).name,
    market: jobMarketFor(o.code, spec.cityId),
    lists: [...listLines([o], '190', state), ...listLines([o], '491', state)],
    prWay: prWayLine(routeFor([o], spec.cityId, courseById(spec.courseId)?.prScore), state),
  }
}

/**
 * What the options beside the road's steps add: a course's jobs (with the course detail on, as the
 * other course cards have them: the fields near and the market in its own city); a job's facts.
 */
function optionDetails(spec: RoadSpec, opts?: DetailOptions): Record<string, CardDetails> {
  const byTile: Record<string, CardDetails> = {}
  for (const courseId of otherCourses(spec)) {
    const details = opts?.detail
      ? otherCourseDetail(courseId)
      : { occupations: occupationsFor(courseId).map(({ code, name }) => ({ code, name })) }
    const kept = nonEmpty(details)
    if (kept) byTile[otherCourseTileId(courseId)] = kept
  }
  for (const o of jobsAfter(spec)) byTile[jobTileId(o.code)] = { job: jobFacts(spec, o) }
  return byTile
}

/** What each tile of the road adds, by tile id: only the tiles whose card has something to show. */
export function detailsByTile(
  spec: RoadSpec,
  answers: StoredAnswers,
  opts?: DetailOptions,
): Record<string, CardDetails> {
  const byTile: Record<string, CardDetails> = optionDetails(spec, opts)
  for (const slot of SLOTS) {
    const details = cardDetails(spec, slot, answers, opts)
    if (details) byTile[spec.slots[slot].id] = details
  }
  return byTile
}
