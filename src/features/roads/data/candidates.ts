// Every road a student can be given: a city with a skeleton, a catalogue course taught there (a
// Master's or a Diploma) and whether she stays. The list is finite, so a test builds each one
// (criterion 55). Phase 1 takes only courses that run two years, the board's shape (criterion 56);
// the cities are the six the hand-written roads are in. Matching runs over ROAD_CANDIDATES, each
// pick's key and label, less the picks no answer can reach. Client-safe: reads the catalogue, the
// occupation lists and the roads' keys, never their copy. Pure.

import { COURSES, cityById, cityOf } from '@/features/engine/catalogue'
import { courseById, EXTRA_COURSES } from './courses'
import { openEntry } from './entry'
import { ANSWERED_FIELDS } from './fields'
import { routeWord, stayingRoute } from './occupations'
import { ROAD_KEYS } from './road-keys'
import type { RoadKey } from './types'

export type RoadPick = { cityId: string; courseId: string; stays: boolean }

/** The cities with a skeleton, in the hand-written roads' order. */
const CITIES = [...new Set(ROAD_KEYS.map((k) => k.cityId))]

/** The two-year courses a city teaches, at every level, in catalogue order. */
const coursesIn = (cityId: string): string[] =>
  [...COURSES, ...EXTRA_COURSES]
    .filter((c) => c.years === 2 && cityOf(c).id === cityId)
    .map((c) => c.id)

const same = (a: RoadPick, b: RoadPick) =>
  a.cityId === b.cityId && a.courseId === b.courseId && a.stays === b.stays

/** Every city × every course taught there × staying or going home; the six hand-written among them. */
export const ALL_PICKS: readonly RoadPick[] = CITIES.flatMap((cityId) =>
  coursesIn(cityId).flatMap((courseId) =>
    [true, false].map((stays) => ({ cityId, courseId, stays })),
  ),
)

/** The courses on a city's candidate roads: the ones a road there may put beside her course. */
export const roadCoursesIn = (cityId: string): string[] => [
  ...new Set(ALL_PICKS.filter((p) => p.cityId === cityId).map((p) => p.courseId)),
]

/** "perth-ecu-data-stay"; a hand-written combination keeps its road's id ("perth-cyber"). */
export function pickId(p: RoadPick): string {
  const key = ROAD_KEYS.find((k) => same(k, p))
  return key ? key.id : `${p.cityId}-${p.courseId}-${p.stays ? 'stay' : 'home'}`
}

/**
 * A pick as matching reads it: "Adelaide · Master of Nursing (graduate entry) · 491", "· no clear
 * PR" or "· home". Its way to stay is the composed road's (`stayingRoute`, which endings.ts reads).
 */
function candidateOf(p: RoadPick): RoadKey {
  const course = courseById(p.courseId)
  if (!course) throw new Error(`No course "${p.courseId}"`)
  const way = p.stays ? routeWord(stayingRoute(p.courseId, p.cityId)) : 'home'
  return {
    id: pickId(p),
    label: `${cityById(p.cityId).name} · ${course.name} · ${way}`,
    stays: p.stays,
    field: course.field,
    level: course.level,
    cityId: p.cityId,
    courseId: p.courseId,
  }
}

/** One per pick: the six hand-written first, in their order, then the rest in the catalogue's order. */
const EVERY_CANDIDATE: readonly RoadKey[] = [
  ...ROAD_KEYS,
  ...ALL_PICKS.filter((p) => !ROAD_KEYS.some((k) => same(k, p))).map(candidateOf),
]

/**
 * Whether matching prefers `a` to `b` whatever she answers, so `b`, later, is never chosen (a tie
 * goes to the earlier one): the same city, level and ending, a field as near any answer (the same
 * one, or `b`'s is one no answer names) and an entry as open.
 */
const covers = (a: RoadKey, b: RoadKey): boolean =>
  a.cityId === b.cityId &&
  a.level === b.level &&
  a.stays === b.stays &&
  (a.field === b.field || !ANSWERED_FIELDS.has(b.field)) &&
  (openEntry(a.courseId) || !openEntry(b.courseId))

/**
 * The roads matching chooses from: every pick an answer can reach, in EVERY_CANDIDATE's order. A
 * pick an earlier one covers is left out (its road is still composed and resolved, and its course
 * still an alternative or a stack). A tie goes to the earlier one.
 */
export const ROAD_CANDIDATES: readonly RoadKey[] = EVERY_CANDIDATE.filter(
  (b, i) => !EVERY_CANDIDATE.slice(0, i).some((a) => covers(a, b)),
)
