// The other options beside two steps of a road: beside the study step, other courses of its field
// and level that are not on the board (her city first, then the road's other city, then the rest
// of the roads' cities); beside the 485, a job per occupation its course leads to. Their tiles sit
// on Priya's shape across the road from their step, on the side away from the year ruler, off her
// road ("not visited": pressing one opens its card, nothing walks). Their words come from the
// catalogue, so they are built on the server. Pure.

import { cityById, cityOf } from '@/features/engine/catalogue'
import type { Level } from '@/features/engine/types'
import type { CardCopy, LabelPlace, Stop, Tile } from '@/features/road/model/road-data'
import { roadCoursesIn } from '../data/candidates'
import { courseById } from '../data/courses'
import { FIELDS } from '../data/fields'
import { feesOf } from '../data/figures'
import { occupationsFor } from '../data/occupations'
import { ROAD_KEYS } from '../data/road-keys'
import type { Occupation, RoadSpec } from '../data/types'
import { workRightsLine } from './compose'
import { shortName } from './course-words'

const MAX_COURSES = 3
/** A course leads to two occupations at most in the catalogue today; the 485 has room for four. */
const MAX_JOBS = 4

/** The cities with a road, in the hand-written roads' order. */
const ROAD_CITIES = [...new Set(ROAD_KEYS.map((k) => k.cityId))]

export const otherCourseTileId = (courseId: string): string => `other-${courseId}`
export const jobTileId = (code: string): string => `job-${code}`

/** The other courses beside the study step, by course id: up to three, never one on the board. */
export function otherCourses(spec: RoadSpec): string[] {
  const onBoard = new Set([spec.courseId, spec.altCourseId, spec.stackCourseId])
  const cities = [...new Set([spec.cityId, spec.altCityId, ...ROAD_CITIES])]
  const fits = (id: string) => {
    const c = courseById(id)
    return !!c && c.field === spec.field && c.level === spec.level && !onBoard.has(id)
  }
  return cities.flatMap((city) => roadCoursesIn(city).filter(fits)).slice(0, MAX_COURSES)
}

/** The jobs beside the 485: one per occupation the road's course leads to. */
export const jobsAfter = (spec: RoadSpec): Occupation[] =>
  occupationsFor(spec.courseId).slice(0, MAX_JOBS)

/** From the step's middle, the first option this far across the road, then one every gap. */
const FIRST = 2.4
const GAP = { course: 1.6, job: 1.4 } as const
/** Unnamed at Whole road; beside the tile at Level and Tile, as the alternative course is. */
const LAB: Record<Stop, LabelPlace> = { whole: 'none', level: 'right', tile: 'right' }

const placed = (step: Tile, i: number, kind: keyof typeof GAP) => ({
  gx: (step.gx + (step.gx1 ?? step.gx)) / 2,
  gy: step.gy - FIRST - i * GAP[kind],
})

const LEVEL_WORD: Record<Level, string> = {
  Diploma: 'diploma',
  "Bachelor's": 'bachelor’s',
  "Master's": 'master’s',
}

/** AUD thousands to one decimal. */
const thousands = (n: number) => String(Math.round(n * 10) / 10)

export type Options = { tiles: Tile[]; cards: Record<string, CardCopy> }

/**
 * The option tiles and their cards, beside the road's study step and its 485 among `tiles` (the
 * road's own). A course's card: its university and city, fees a year and in all, years and work
 * rights; its primary starts a new roadmap around it (drawn only where compare can pin it). A
 * job's card: its code; it has no primary.
 */
export function optionsBeside(spec: RoadSpec, tiles: Tile[]): Options {
  const step = (slot: 'course-years' | 'visa-485') =>
    tiles.find((t) => t.id === spec.slots[slot].id)
  const study = step('course-years')
  const work = step('visa-485')
  const out: Options = { tiles: [], cards: {} }
  const field = FIELDS.find((f) => f.id === spec.field)?.name ?? spec.field

  if (study) {
    otherCourses(spec).forEach((courseId, i) => {
      const c = courseById(courseId)
      if (!c) return
      const city = cityOf(c)
      const id = otherCourseTileId(courseId)
      const sub = `${c.university} · ${city.name}`
      out.tiles.push({
        id,
        kind: 'course',
        state: 'alt',
        ...placed(study, i, 'course'),
        lab: { ...LAB },
        name: shortName(c),
        sub,
        beside: study.id,
      })
      out.cards[id] = {
        kicker: `Not visited · Other ${LEVEL_WORD[c.level]}`,
        sub,
        guide: `${feesOf(courseId)} · AUD ${thousands(c.feeK * c.years)}k in all · ${c.years} years. ${workRightsLine(city.id, c.level, c.years)}.`,
        because: `Another ${LEVEL_WORD[c.level]} in ${field.toLowerCase()}, not on your board yet`,
        primary: 'Start a new roadmap from it',
      }
    })
  }

  if (work) {
    const course = courseById(spec.courseId)
    const name = course ? shortName(course) : 'The course'
    jobsAfter(spec).forEach((o, i) => {
      const id = jobTileId(o.code)
      out.tiles.push({
        id,
        kind: 'job',
        state: 'alt',
        ...placed(work, i, 'job'),
        lab: { ...LAB },
        name: o.name,
        sub: `ANZSCO ${o.code}`,
        beside: work.id,
      })
      out.cards[id] = {
        kicker: 'Not visited · Job',
        sub: `ANZSCO ${o.code}`,
        guide: `A job ${name} leads to, for the work years on the 485 in ${cityById(spec.cityId).name}.`,
        because: 'The course on your roadmap leads to it',
      }
    })
  }
  return out
}
