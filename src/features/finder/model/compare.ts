// What changes (criteria 26–28): her road beside another city's or another course's, row by row.
// Every row reads the rules the roads already use (the fee filter, the work rights, the staying
// route, the job market), so an alternative that is on a road says what that road says. Pure.

import { cityById, cityOf } from '@/features/engine/catalogue'
import { ALL_PICKS, type RoadPick } from '@/features/roads/data/candidates'
import { courseById } from '@/features/roads/data/courses'
import { jobMarketFor } from '@/features/roads/data/job-market'
import { occupationsFor, routeWord } from '@/features/roads/data/occupations'
import { subjectsOf } from '@/features/roads/data/subjects'
import type { CompareRow, Comparison, RoadSpec } from '@/features/roads/data/types'
import { composeRoad, workRightsLine } from '@/features/roads/model/compose'
import { nextRoad } from '@/features/roads/model/next-road'
import { otherCourses, otherCourseTileId } from '@/features/roads/model/options'
import type { Pinned, StoredAnswers } from '@/shared/types/student'
import { failedFilters } from './filters'

type Key = CompareRow['key']

const LABELS: Record<Key, string> = {
  money: 'Money',
  time: 'Time and work rights',
  pr: 'Staying or home',
  career: 'Career',
  subjects: 'Subjects',
  city: 'City',
}

const NO_COURSE = 'No course of your field there in our catalogue'

const cityLine = (cityId: string): string => {
  const city = cityById(cityId)
  return `${city.name} · ${city.regional ? 'counts as regional' : 'not regional'}`
}

/** The rows a road's course decides, in order, with its words for each. */
function courseLines(spec: RoadSpec, answers: StoredAnswers): Record<Exclude<Key, 'city'>, string> {
  const course = courseById(spec.courseId)
  if (!course) throw new Error(`No course "${spec.courseId}"`)
  const { feeK, years, level } = course
  const city = cityById(spec.cityId)

  const budget = answers.amount?.state === 'stated' && typeof answers.amount.value === 'number'
  const verdict = budget
    ? failedFilters(answers, { level, feeK, cityId: spec.cityId }).includes('fee')
      ? ' · over your budget'
      : ' · fits your budget'
    : ''

  const jobs = occupationsFor(spec.courseId).map((o) => {
    const market = jobMarketFor(o.code, spec.cityId)
    return market
      ? `${o.name} · AUD ${market.payLowK}–${market.payHighK}k · ${market.openings} openings in ${city.name} (sample)`
      : o.name
  })
  const subjects = subjectsOf(spec.courseId)

  return {
    money: `AUD ${feeK}k a year · AUD ${feeK * years}k in all · living about AUD ${city.livingK}k a year${verdict}`,
    time: `${years} ${years === 1 ? 'year' : 'years'} · ${workRightsLine(spec.cityId, level, years)}`,
    pr: spec.stays ? routeWord(spec.prRoute) : 'Home',
    career: jobs.join('; '),
    subjects: subjects ? [...subjects.majors, ...subjects.units].slice(0, 3).join(', ') : '',
  }
}

/**
 * Her road beside an alternative: money, time, PR, career, subjects and city. A null alternative
 * (no course of her field in that city) still compares the city.
 */
export function compareRows(
  current: RoadSpec,
  alternative: RoadSpec | null,
  answers: StoredAnswers,
  alternativeCityId: string,
): CompareRow[] {
  const mine = { ...courseLines(current, answers), city: cityLine(current.cityId) }
  const theirs = alternative
    ? { ...courseLines(alternative, answers), city: cityLine(alternativeCityId) }
    : {
        money: NO_COURSE,
        time: NO_COURSE,
        pr: NO_COURSE,
        career: NO_COURSE,
        subjects: NO_COURSE,
        city: cityLine(alternativeCityId),
      }
  return (Object.keys(LABELS) as Key[]).map((key) => ({
    key,
    label: LABELS[key],
    current: mine[key],
    alternative: theirs[key],
    changed: mine[key] !== theirs[key],
  }))
}

/**
 * Her road in another city: the first pick there of her field, level and ending, else of her field
 * and ending at any level; null when that city teaches nothing of her field.
 */
export function alternativeForCity(spec: RoadSpec, altCityId: string): RoadSpec | null {
  const there = ALL_PICKS.filter((p) => p.cityId === altCityId && p.stays === spec.stays)
  const ofField = (p: RoadPick) => courseById(p.courseId)?.field === spec.field
  const pick =
    there.find((p) => ofField(p) && courseById(p.courseId)?.level === spec.level) ??
    there.find(ofField)
  return pick ? composeRoad(pick) : null
}

/** Her road around another course, in its own city, ending as hers does; null for an unknown course. */
export function alternativeForCourse(spec: RoadSpec, courseId: string): RoadSpec | null {
  const course = courseById(courseId)
  return course ? composeRoad({ cityId: cityOf(course).id, courseId, stays: spec.stays }) : null
}

/** A course a new roadmap can be built around: a two-year one, until the one-year road shape. */
export const pinnable = (courseId: string): boolean => courseById(courseId)?.years === 2

/**
 * The pin a new roadmap can carry for a course: a known, pinnable one, in its own city (and, given
 * `cityId`, only when that is the city named). Null for anything else.
 */
export function pinOf(courseId: string, cityId?: string): Pinned | null {
  const course = courseById(courseId)
  if (!course || !pinnable(courseId)) return null
  const own = cityOf(course).id
  return cityId === undefined || cityId === own ? { courseId, cityId: own } : null
}

/**
 * The pin a new roadmap's draft carries: the course `?pin=` asks for (null, not found, for one that
 * cannot be pinned or with the compare switch off), else its source's own pin while it still
 * resolves, switch on or off; a stale one (its course gone from the catalogue) drafts unpinned.
 */
export function draftPin(
  asked: string | undefined,
  stored: Pinned | undefined,
  compare: boolean,
): Pinned | null | undefined {
  if (asked !== undefined) return compare ? pinOf(asked) : null
  return stored && pinOf(stored.courseId, stored.cityId) ? stored : undefined
}

/** With a course to pin, the road a new roadmap around it would draw, for the board to turn into. */
function comparison(
  spec: RoadSpec,
  alternative: RoadSpec | null,
  answers: StoredAnswers,
  cityId: string,
): Comparison {
  const rows = compareRows(spec, alternative, answers, cityId)
  if (!alternative || !pinnable(alternative.courseId)) return { rows, pin: null }
  return { rows, pin: alternative.courseId, next: nextRoad(spec, alternative, answers) }
}

/**
 * "What changes" on her board, by tile id: the other-city tile beside her road in that city, the
 * other-course tile, the course she puts on her board from the stack and each other course beside
 * the study step, each beside her road around that course. No other tile has one.
 */
export function compareByTile(spec: RoadSpec, answers: StoredAnswers): Record<string, Comparison> {
  const byCourse = (slot: 'alt-course' | 'stack-course', courseId: string) => {
    const course = alternativeForCourse(spec, courseId)
    return course ? { [spec.slots[slot].id]: comparison(spec, course, answers, course.cityId) } : {}
  }
  return {
    [spec.slots['alt-city'].id]: comparison(
      spec,
      alternativeForCity(spec, spec.altCityId),
      answers,
      spec.altCityId,
    ),
    ...byCourse('alt-course', spec.altCourseId),
    ...byCourse('stack-course', spec.stackCourseId),
    ...Object.fromEntries(
      otherCourses(spec).flatMap((courseId) => {
        const course = alternativeForCourse(spec, courseId)
        return course
          ? [[otherCourseTileId(courseId), comparison(spec, course, answers, course.cityId)]]
          : []
      }),
    ),
  }
}
