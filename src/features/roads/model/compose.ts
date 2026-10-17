// A road from a candidate pick: the city's skeleton, the course's words and the ending (staying or
// going home), on the board's one shape. A pick that is one of the six hand-written roads gets that
// road as written (criterion 57); any other combination gets the template's words, from the
// catalogue alone (criterion 58). The skeleton's cities keep only what holds for any course: their
// guides are the catalogue's (work rights after her course's level, living costs), and PR is
// weighed in their trade-offs only on a road that stays. Pure.

import { cityById } from '@/features/engine/catalogue'
import type { Level } from '@/features/engine/types'
import { ALL_PICKS, pickId, type RoadPick } from '../data/candidates'
import { courseById } from '../data/courses'
import { livingOf } from '../data/figures'
import { routeWord } from '../data/occupations'
import { OVER, overview, roadById } from '../data/roads'
import { SKELETONS } from '../data/skeletons'
import type { RoadSpec, SlotCopy } from '../data/types'
import { courseWords } from './course-words'
import { homeEnding, prEnding } from './endings'

/** The work rights a course of her level and length earns in a city: none from one year alone. */
export function workRightsLine(cityId: string, level: Level, years: number): string {
  if (years < 2) return 'One year of study alone does not open the Temporary Graduate visa (485)'
  const regional = cityById(cityId).regional
  return level === 'Diploma'
    ? regional
      ? 'Counts as regional, but a diploma earns about 18 months of post-study work rights anywhere'
      : 'Not regional: about 18 months of post-study work rights after a diploma'
    : regional
      ? 'Counts as regional: up to 5 years of post-study work rights after the course'
      : 'Not regional: 2 years of post-study work rights after a master’s'
}

/** A city's guide on a composed road: its work rights after a course of her level, and its living costs. */
function cityGuide(cityId: string, level: Level): string {
  return `${workRightsLine(cityId, level, 2)}. About ${livingOf(cityId)}.`
}

/** The board's trade-off words, in the order its cards say them. */
const WEIGHTS = ['cost', 'PR', 'work', 'career', 'time']

/**
 * A city's trade-offs with PR where staying puts it: a gain in a regional city, a cost in a big
 * one; on a road home PR weighs nothing. A side left with no words is left out.
 */
function weighPr<T extends { gains?: string; costs?: string }>(
  copy: T,
  regional: boolean,
  stays: boolean,
): T {
  const { gains, costs, ...rest } = copy
  if (gains === undefined && costs === undefined) return copy
  const words = (s: string | undefined, prefix: string) =>
    (s ? s.slice(prefix.length).split(', ') : []).filter((w) => w !== 'PR')
  const good = words(gains, 'Good for: ')
  const less = words(costs, 'Less good for: ')
  if (stays) (regional ? good : less).push('PR')
  const say = (prefix: string, list: string[]) =>
    list.length
      ? `${prefix}${list.sort((a, b) => WEIGHTS.indexOf(a) - WEIGHTS.indexOf(b)).join(', ')}`
      : undefined
  const g = say('Good for: ', good)
  const c = say('Less good for: ', less)
  return { ...rest, ...(g && { gains: g }), ...(c && { costs: c }) } as T
}

/** A skeleton's city on her road: the catalogue's guide, and PR weighed for staying or not. */
function cityOnRoad(copy: SlotCopy, cityId: string, level: Level, stays: boolean): SlotCopy {
  const guide = cityGuide(cityId, level)
  const { regional } = cityById(cityId)
  const weighed = weighPr(copy, regional, stays)
  return {
    ...weighed,
    card: weighPr({ ...copy.card, guide }, regional, stays),
    ...(copy.here && { here: weighPr({ ...copy.here, guide }, regional, stays) }),
  }
}

export function composeRoad(p: RoadPick): RoadSpec {
  const id = pickId(p)
  const written = roadById(id)
  if (written) return written

  const skeleton = SKELETONS[p.cityId]
  const course = courseById(p.courseId)
  if (!skeleton || !course) throw new Error(`No road for "${id}"`)
  const words = courseWords(p.cityId, p.courseId)
  const ending = p.stays ? prEnding(p.courseId, p.cityId) : homeEnding(p.cityId, course.level)
  const city = cityOnRoad(skeleton.slots.city, p.cityId, course.level, p.stays)

  return {
    id,
    label: `${cityById(p.cityId).name} · ${words.name} · ${p.stays ? routeWord(ending.prRoute) : 'home'}`,
    stays: p.stays,
    field: course.field,
    level: course.level,
    cityId: p.cityId,
    altCityId: skeleton.altCityId,
    courseId: p.courseId,
    altCourseId: words.altCourseId,
    stackCourseId: words.stackCourseId,
    prRoute: ending.prRoute,
    slots: {
      ...skeleton.slots,
      city: city.here
        ? { ...city, here: { ...city.here, primary: `Walk to ${words.name}` } }
        : city,
      'alt-city': cityOnRoad(skeleton.slots['alt-city'], skeleton.altCityId, course.level, p.stays),
      ...words.slots,
      ...ending.slots,
    },
    badges: { ...words.badges, fork: ending.fork, over: OVER },
    stackRows: words.stackRows,
    lesson: words.lesson,
    overview: overview(
      `${skeleton.slots.city.short} · 1 looked at`,
      words.courseRow,
      ending.endRow,
    ),
    arrivalLine: skeleton.arrivalLine,
  }
}

/** Every pick by its id, built once: the ids are looked up here, never parsed. */
const PICKS_BY_ID: ReadonlyMap<string, RoadPick> = new Map(ALL_PICKS.map((p) => [pickId(p), p]))

/**
 * The one lookup for any road a roadmap can show: a hand-written road by its id, or a pick's
 * composed road by `pickId`. Null for an id neither has.
 */
export function specById(id: string): RoadSpec | null {
  const written = roadById(id)
  if (written) return written
  const pick = PICKS_BY_ID.get(id)
  return pick ? composeRoad(pick) : null
}
