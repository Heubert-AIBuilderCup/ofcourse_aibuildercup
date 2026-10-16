// What each card adds beyond its why (criteria 29 to 33): a course's majors and units, the work
// beside a course, the graduate jobs and occupations after it, whether its occupation is on the
// state's list, and, on the stack and the alternative, the field next to hers its course is in.
// Nothing is ranked: catalogue order. Pure.

import { cityOf } from '@/features/engine/catalogue'
import type { StoredAnswers } from '@/shared/types/student'
import { courseById } from '../data/courses'
import { FIELDS, relatedFields } from '../data/fields'
import { CITY_STATE, occupationsFor } from '../data/occupations'
import { opportunitiesIn } from '../data/opportunities'
import { subjectsOf } from '../data/subjects'
import {
  type Occupation,
  type Opportunity,
  type RoadSpec,
  SLOTS,
  type SlotId,
  type StateId,
} from '../data/types'
import { pickedFields } from './match'

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
  occupations?: { code: string; name: string }[]
  listStatus?: string[]
  related?: RelatedMark
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

/** What the card of a slot adds, or null when it adds nothing. Her answers say what she picked. */
export function cardDetails(
  spec: RoadSpec,
  slot: SlotId,
  answers: StoredAnswers,
): CardDetails | null {
  switch (slot) {
    case 'course':
      return nonEmpty(subjectsFor(spec.courseId))
    case 'alt-course':
    case 'stack-course': {
      const courseId = courseOf(spec, slot)
      const related = relatedMark(courseId, herFields(spec, answers))
      return nonEmpty({ ...subjectsFor(courseId), related })
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

/** What each tile of the road adds, by tile id: only the tiles whose card has something to show. */
export function detailsByTile(spec: RoadSpec, answers: StoredAnswers): Record<string, CardDetails> {
  const byTile: Record<string, CardDetails> = {}
  for (const slot of SLOTS) {
    const details = cardDetails(spec, slot, answers)
    if (details) byTile[spec.slots[slot].id] = details
  }
  return byTile
}
