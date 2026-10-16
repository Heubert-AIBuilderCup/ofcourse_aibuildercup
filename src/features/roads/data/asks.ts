// The suggested questions on a city or course tile. Each answer is built from the catalogue's own
// rows (the engine's city and course, the roads' subjects, occupations and opportunities), so it
// cannot say more than the data does, and cites the row it came from.

import { COURSES, cityById, cityOf } from '@/features/engine/catalogue'
import type { Claim, Course } from '@/features/engine/types'
import { courseById, EXTRA_COURSES } from './courses'
import { CITY_STATE, occupationsFor } from './occupations'
import { OPPORTUNITIES } from './opportunities'
import { ROADS } from './roads'
import { subjectsOf } from './subjects'
import type { AskSubject, Source, TileAsk, TileAsks } from './types'

const fromClaim = (c: Claim): Source => ({ title: c.source, date: c.date })
const CATALOGUE: Source = { title: 'OfCourse mock catalogue · mock', date: 'Sep 2026' }

/** Every course the roads can use, and the cities they are taught in and the roads name. */
const ASK_COURSE_IDS = [...COURSES, ...EXTRA_COURSES].map((c) => c.id)
const ASK_CITY_IDS = [
  ...new Set([
    ...[...COURSES, ...EXTRA_COURSES].map((c) => cityOf(c).id),
    ...ROADS.flatMap((r) => [r.cityId, r.altCityId]),
  ]),
]

const list = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

function cityAsks(cityId: string): TileAsk[] {
  const city = cityById(cityId)
  const courses = [...COURSES, ...EXTRA_COURSES].filter((c) => cityOf(c).id === cityId)
  const named = courses.slice(0, 3).map((c) => `${c.name} at ${c.university}`)
  const more = courses.length > 3 ? `${courses.length - 3} more` : ''
  const partTime = OPPORTUNITIES.find((o) => o.cityId === cityId && o.kind === 'part-time')
  const rentDetail = city.location.claim.source.startsWith('Rental')
    ? ` ${city.location.claim.detail[0]}.`
    : ''
  const asks: TileAsk[] = [
    {
      question: `How much does it cost to live in ${city.name}?`,
      answer: `The catalogue puts living costs in ${city.name} at about AUD ${city.livingK}k a year.${rentDetail}`,
      source: fromClaim(city.location.claim),
    },
    {
      question: `Does ${city.name} count as regional for visas?`,
      answer: city.regional
        ? `Yes. ${city.location.text}.`
        : `No, ${city.name} is not regional. ${city.location.text}.`,
      source: fromClaim(city.location.claim),
    },
    {
      question: `What courses can I study in ${city.name}?`,
      answer: `${list(more ? [...named, more] : named)}.`,
      source: CATALOGUE,
    },
  ]
  if (partTime) {
    asks.push({
      question: `Can I find part-time work in ${city.name}?`,
      answer: `One listing in the catalogue: ${partTime.title} at ${partTime.employer}, with ${partTime.demand} demand.`,
      source: partTime.source,
    })
  }
  return asks
}

/** "WA 190 and 491 lists" or "neither the 190 nor the 491 list in NSW". */
function listText(course: Course): string {
  const state = CITY_STATE[cityOf(course).id]
  const parts = occupationsFor(course.id)
    .slice(0, 2)
    .map((o) => {
      const lists = o.lists[state] ?? []
      return lists.length
        ? `${o.name} (${o.code}) is on the ${state} list for ${list(lists)}`
        : `${o.name} (${o.code}) is on neither the 190 nor the 491 list in ${state}`
    })
  return `${parts.join('. ')}. A state list is the set of jobs the state can nominate; it is not a promise.`
}

function courseAsks(courseId: string): TileAsk[] {
  const course = courseById(courseId)
  if (!course) return []
  const city = cityOf(course)
  const subjects = subjectsOf(courseId)
  const occupations = occupationsFor(courseId)
  const asks: TileAsk[] = [
    {
      question: 'What does it cost?',
      answer: `Tuition is about AUD ${course.feeK}k a year for ${course.years} years. Living costs in ${city.name} are about AUD ${city.livingK}k a year.`,
      source: fromClaim(course.feeClaim),
    },
    {
      question: 'When can I start, and how long until PR?',
      answer: `${course.lines.time.text}. ${course.lines.time.claim.detail[0]}.`,
      source: fromClaim(course.lines.time.claim),
    },
  ]
  if (occupations[0]) {
    asks.push({
      question: 'Is my occupation on the state list?',
      answer: listText(course),
      source: occupations[0].source,
    })
  }
  if (subjects) {
    asks.push({
      question: 'What will I study?',
      answer: `Majors: ${list(subjects.majors)}. Units include ${list(subjects.units.slice(0, 3))}. Entry: ${subjects.conditions[0]}.`,
      source: subjects.source,
    })
  }
  return asks
}

export const TILE_ASKS: readonly TileAsks[] = [
  ...ASK_CITY_IDS.map(
    (cityId): TileAsks => ({ subject: { kind: 'city', cityId }, asks: cityAsks(cityId) }),
  ),
  ...ASK_COURSE_IDS.map(
    (courseId): TileAsks => ({ subject: { kind: 'course', courseId }, asks: courseAsks(courseId) }),
  ),
]

/** The suggested questions for a city or course; none for one the catalogue has no asks for. */
export function asksFor(subject: AskSubject): TileAsk[] {
  const found = TILE_ASKS.find((t) =>
    subject.kind === 'city'
      ? t.subject.kind === 'city' && t.subject.cityId === subject.cityId
      : t.subject.kind === 'course' && t.subject.courseId === subject.courseId,
  )
  return found ? found.asks : []
}
