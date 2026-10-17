// The sample catalogue's Course rows and finder extras, built by rule from generated raw courses.
// Every line a card shows comes from the existing rules (routeFor, workRightsLine) for the course's
// city, level, length and its field's occupations (occupationCodesFor); nothing in `lines` comes
// from the raw rows.
// Pure.

import { CAMPUSES, COURSES } from '@/features/engine/catalogue'
import type { Claim, Course, Effect, FieldId, LineData, Pips } from '@/features/engine/types'
import { EXTRA_COURSES } from '@/features/roads/data/courses'
import { FIELD_EDGES } from '@/features/roads/data/fields'
import {
  OCCUPATIONS,
  routeFor,
  routeWord,
  type StayingRoute,
} from '@/features/roads/data/occupations'
import { workRightsLine } from '@/features/roads/model/compose'
import { FIELD_OCCUPATIONS, occupationCodesFor } from '../data/field-occupations'
import type { RawCourse } from '../data/schema'
import type { FinderExtra } from './types'

const SOURCE = 'OfCourse sample catalogue'
const DATE = 'Oct 2026'
const BAND = "A band, not a number: we don't predict this for you"

const claim = (pips: Pips, detail: string[]): Claim => ({
  pips,
  state: 'estimated',
  source: `${SOURCE} · sample`,
  date: DATE,
  detail,
  notSure: false,
})

const line = (effect: Effect, text: string, pips: Pips, detail: string[]): LineData => ({
  effect,
  text,
  claim: claim(pips, detail),
})

/** Fee strength, the engine catalogue's rule: the cheaper the course, the stronger on cost. */
const feePips = (feeK: number): Pips =>
  feeK <= 20 ? 5 : feeK <= 30 ? 4 : feeK <= 35 ? 3 : feeK <= 42 ? 2 : 1

const PR_SCORE: Record<StayingRoute, Course['prScore']> = { '190': 3, '491': 2, '186': 1, none: 0 }

const CITY_OF_CAMPUS = new Map(CAMPUSES.map((c) => [c.id, c.cityId]))
const KNOWN = [...COURSES, ...EXTRA_COURSES]

/**
 * The university the catalogue names at a campus: a course of the same level's, else another
 * course's there (UniSA City West is UniSA for a Master's, UniSA College for a Diploma).
 */
function universityAt(campusId: string, level: Course['level']): string {
  const here = KNOWN.filter((c) => c.campusId === campusId)
  const named = here.find((c) => c.level === level) ?? here[0]
  if (!named) throw new Error(`No university at ${campusId}`)
  return named.university
}

const isBroad = (id: string): id is FieldId => Object.hasOwn(FIELD_OCCUPATIONS, id)

/**
 * A course's subjects: its primary field, then each broad field its niche graph field combines or
 * is, in graph order, once each. `related` edges and narrower targets (software, networks) do not
 * count; a course that is not niche is its field alone.
 */
function fieldsOf(r: RawCourse): FieldId[] {
  if (!r.niche) return [r.field]
  const joined = FIELD_EDGES.filter((e) => e.from === r.graphField && e.kind !== 'related')
    .map((e) => e.to)
    .filter(isBroad)
  return [...new Set([r.field, ...joined])]
}

const slug = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** The catalogue's Course rows and their finder extras, one of each per raw course, in order. */
export function buildCatalogue(raw: readonly RawCourse[]): {
  courses: Course[]
  extras: FinderExtra[]
} {
  const taken = new Map<string, number>()
  const courses: Course[] = []
  const extras: FinderExtra[] = []

  for (const r of raw) {
    const base = `f-${slug(r.name)}-${r.campusId}`
    const seen = (taken.get(base) ?? 0) + 1
    taken.set(base, seen)
    const id = seen === 1 ? base : `${base}-${seen}`

    const cityId = CITY_OF_CAMPUS.get(r.campusId)
    if (!cityId) throw new Error(`No campus ${r.campusId}`)
    const university = universityAt(r.campusId, r.level)
    const codes = occupationCodesFor(r.field, r.graphField)
    const occupations = OCCUPATIONS.filter((o) => codes.includes(o.code))
    const staying = routeFor(occupations, cityId, undefined)
    const route = staying === 'none' ? routeWord(staying) : `${routeWord(staying)}, then PR`
    const careerText = occupations.length
      ? occupations.map((o) => o.name).join(', ')
      : 'No listed occupation for this field'

    courses.push({
      id,
      name: r.name,
      university,
      campusId: r.campusId,
      field: r.field,
      level: r.level,
      feeK: r.feeK,
      years: r.years,
      route,
      prScore: PR_SCORE[staying],
      careerScore: occupations.length ? 3 : 2,
      placements: r.placements,
      feeClaim: claim(feePips(r.feeK), [`Tuition about AUD ${r.feeK}k a year (sample figure)`]),
      lines: {
        time: line('neutral', `${r.years} year${r.years === 1 ? '' : 's'}, ${r.level}`, 3, [
          `A ${r.years}-year ${r.level}`,
        ]),
        work: line(r.years === 2 ? 'gives' : 'costs', workRightsLine(cityId, r.level, r.years), 3, [
          'Post-study work rights by city, level and length (subclass 485)',
        ]),
        pr: line(staying === 'none' ? 'costs' : 'gives', route, staying === 'none' ? 1 : 3, [
          BAND,
          `From the state lists for this field's occupations: ${routeWord(staying)}`,
        ]),
        career: line('neutral', careerText, 3, ['Occupations the catalogue links to this field']),
      },
      keepOpen: { text: `Ask ${university} about the next intake`, doors: 'keeps 1 door open' },
    })
    extras.push({
      courseId: id,
      description: r.description,
      graphField: r.graphField,
      niche: r.niche,
      fields: fieldsOf(r),
      subjects: { majors: [...r.majors], units: [...r.units] },
      occupationCodes: [...codes],
    })
  }
  return { courses, extras }
}
