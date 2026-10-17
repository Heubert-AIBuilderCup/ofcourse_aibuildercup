// Criterion 16: the generated sample catalogue keeps to its limits. Criterion 17: its committed
// visa and PR lines still equal what today's rules give, so a rule change cannot leave them stale.
import { describe, expect, test } from 'bun:test'
import { CAMPUSES, COURSES, cityOf } from '@/features/engine/catalogue'
import type { FieldId } from '@/features/engine/types'
import { EXTRA_COURSES } from '@/features/roads/data/courses'
import { FIELD_EDGES } from '@/features/roads/data/fields'
import {
  OCCUPATIONS,
  routeFor,
  routeWord,
  type StayingRoute,
} from '@/features/roads/data/occupations'
import { workRightsLine } from '@/features/roads/model/compose'
import { FINDER_COURSES, FINDER_EXTRAS } from './catalogue'
import { FIELD_OCCUPATIONS, occupationCodesFor } from './field-occupations'
import { FINDER_CITIES } from './schema'

const CITY_OF_CAMPUS = new Map(CAMPUSES.map((c) => [c.id, c.cityId]))
const GRAPH_FIELD_OF = new Map(FINDER_EXTRAS.map((e) => [e.courseId, e.graphField]))
/** A finder course's occupation codes, by the rule model/build.ts uses. */
const codesOf = (c: { id: string; field: FieldId }) =>
  occupationCodesFor(c.field, GRAPH_FIELD_OF.get(c.id) ?? c.field)
const sentences = (text: string) => text.match(/[.!?](\s|$)/g)?.length ?? 0
/** A staying route's PR score, as model/build.ts gives it. */
const PR_SCORE: Record<StayingRoute, number> = { '190': 3, '491': 2, '186': 1, none: 0 }

describe('the finder catalogue', () => {
  test('400 to 1,000 courses, each with its extra', () => {
    expect(FINDER_COURSES.length).toBeGreaterThanOrEqual(400)
    expect(FINDER_COURSES.length).toBeLessThanOrEqual(1000)
    expect(FINDER_EXTRAS.map((e) => e.courseId)).toEqual(FINDER_COURSES.map((c) => c.id))
  })

  test('every course is in a finder city, a Diploma or a Master’s, of 1 or 2 years', () => {
    const cities: readonly string[] = FINDER_CITIES
    const off = FINDER_COURSES.filter(
      (c) =>
        !cities.includes(CITY_OF_CAMPUS.get(c.campusId) ?? '') ||
        (c.level !== 'Diploma' && c.level !== "Master's") ||
        (c.years !== 1 && c.years !== 2),
    ).map((c) => c.id)
    expect(off).toEqual([])
  })

  test('every fee is marked as sample', () => {
    const off = FINDER_COURSES.filter((c) => !c.feeClaim.source.endsWith(' · sample'))
    expect(off.map((c) => c.id)).toEqual([])
  })

  test('every description has 2 to 4 sentences', () => {
    const off = FINDER_EXTRAS.filter(
      (e) => sentences(e.description) < 2 || sentences(e.description) > 4,
    )
    expect(off.map((e) => e.courseId)).toEqual([])
  })

  test('every work line, route and PR score is what the rules give today (criterion 17)', () => {
    const off = FINDER_COURSES.flatMap((c) => {
      const cityId = cityOf(c).id
      const codes = codesOf(c)
      const occupations = OCCUPATIONS.filter((o) => codes.includes(o.code))
      const staying = routeFor(occupations, cityId, undefined)
      const route = staying === 'none' ? routeWord(staying) : `${routeWord(staying)}, then PR`
      return [
        c.lines.work.text === workRightsLine(cityId, c.level, c.years) ? '' : `${c.id}: work`,
        c.route === route && c.lines.pr.text === route ? '' : `${c.id}: route`,
        c.prScore === PR_SCORE[staying] ? '' : `${c.id}: prScore`,
      ].filter(Boolean)
    })
    expect(off).toEqual([])
  })

  test('every occupation list and career line is what the field gives today', () => {
    const byId = new Map(FINDER_COURSES.map((c) => [c.id, c]))
    const off = FINDER_EXTRAS.flatMap((e) => {
      const course = byId.get(e.courseId)
      if (!course) return [`${e.courseId}: no course`]
      const codes = codesOf(course)
      const occupations = OCCUPATIONS.filter((o) => codes.includes(o.code))
      const career = occupations.length
        ? occupations.map((o) => o.name).join(', ')
        : 'No listed occupation for this field'
      return [
        e.occupationCodes.join() === codes.join() ? '' : `${e.courseId}: occupationCodes`,
        course.lines.career.text === career ? '' : `${e.courseId}: career`,
      ].filter(Boolean)
    })
    expect(off).toEqual([])
  })

  test('ids are unique and none collides with the road catalogue', () => {
    const ids = FINDER_COURSES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const known = new Set([...COURSES, ...EXTRA_COURSES].map((c) => c.id))
    expect(ids.filter((id) => known.has(id))).toEqual([])
  })

  test('every course’s fields are its own field, then the broad fields its niche field combines', () => {
    const broad = new Set<string>(Object.keys(FIELD_OCCUPATIONS))
    const byId = new Map(FINDER_COURSES.map((c) => [c.id, c]))
    const off = FINDER_EXTRAS.flatMap((e) => {
      const field = byId.get(e.courseId)?.field
      const joined = e.niche
        ? FIELD_EDGES.filter(
            (x) => x.from === e.graphField && x.kind !== 'related' && broad.has(x.to),
          ).map((x) => x.to)
        : []
      const expected = [...new Set([field, ...joined])]
      return [
        e.fields[0] === field ? '' : `${e.courseId}: first`,
        e.fields?.join() === expected.join() ? '' : `${e.courseId}: ${e.fields?.join()}`,
      ].filter(Boolean)
    })
    expect(off).toEqual([])
  })
})

// Courses belong to every subject they combine (Nikhil, 17 Oct 2026): the 14 reclassified courses.
describe('the reclassified intersections', () => {
  const RECLASSIFIED: [id: string, field: string, graphField: string, niche: boolean][] = [
    ['f-master-of-cyber-psychology-utas-sandy-bay', 'psych', 'cyber-psychology', true],
    [
      'f-master-of-online-behaviour-and-digital-wellbeing-monash-clayton',
      'psych',
      'cyber-psychology',
      true,
    ],
    [
      'f-diploma-of-online-safety-and-digital-behaviour-tafe-perth',
      'psych',
      'cyber-psychology',
      true,
    ],
    [
      'f-master-of-cyber-behaviour-and-human-factors-swinburne-hawthorn',
      'cyber',
      'security-governance',
      false,
    ],
    [
      'f-master-of-social-engineering-and-human-risk-ecu-joondalup',
      'cyber',
      'security-governance',
      false,
    ],
    [
      'f-diploma-of-security-awareness-and-behaviour-curtin-bentley',
      'cyber',
      'security-governance',
      false,
    ],
    ['f-master-of-human-centred-security-uts-ultimo', 'cyber', 'security-governance', false],
    ['f-master-of-health-informatics-ecu-joondalup', 'health', 'health-informatics', true],
    ['f-master-of-digital-health-curtin-bentley', 'health', 'health-informatics', true],
    ['f-diploma-of-health-information-systems-tafe-perth', 'health', 'health-informatics', true],
    [
      'f-master-of-health-technology-and-informatics-uts-ultimo',
      'health',
      'health-informatics',
      true,
    ],
    [
      'f-master-of-health-data-and-informatics-monash-clayton',
      'health',
      'health-informatics',
      true,
    ],
    [
      'f-master-of-health-informatics-practice-swinburne-hawthorn',
      'health',
      'health-informatics',
      true,
    ],
    ['f-master-of-digital-health-systems-deakin-waurn-ponds', 'health', 'health-informatics', true],
  ]
  const courseOf = new Map(FINDER_COURSES.map((c) => [c.id, c]))
  const extraOf = new Map(FINDER_EXTRAS.map((e) => [e.courseId, e]))

  test('each has its primary field, its graph field and its niche flag', () => {
    const got = RECLASSIFIED.map(([id]) => [
      id,
      courseOf.get(id)?.field,
      extraOf.get(id)?.graphField,
      extraOf.get(id)?.niche,
    ])
    expect(got).toEqual(RECLASSIFIED)
  })

  test('each one’s route follows its own occupations (occupationCodesFor), not every field it combines', () => {
    const off = RECLASSIFIED.flatMap(([id, field, graphField]) => {
      const course = courseOf.get(id)
      if (!course) return [`${id}: missing`]
      const codes = occupationCodesFor(field as FieldId, graphField)
      const occupations = OCCUPATIONS.filter((o) => codes.includes(o.code))
      const staying = routeFor(occupations, cityOf(course).id, undefined)
      const route = staying === 'none' ? routeWord(staying) : `${routeWord(staying)}, then PR`
      return course.route === route ? [] : [`${id}: ${course.route}`]
    })
    expect(off).toEqual([])
  })

  test('every health-informatics course leads to Health Information Manager, not nursing', () => {
    const off = FINDER_EXTRAS.filter((e) => e.graphField === 'health-informatics')
      .filter((e) => !e.occupationCodes.includes('224213') || e.occupationCodes.includes('254499'))
      .map((e) => e.courseId)
    expect(off).toEqual([])
  })

  test('the UTAS Cyber Psychology route is psychology’s, no clear PR, and it combines cyber', () => {
    const id = 'f-master-of-cyber-psychology-utas-sandy-bay'
    expect(courseOf.get(id)?.route).toBe('no clear PR')
    expect(extraOf.get(id)?.fields).toEqual(['psych', 'cyber'])
  })
})
