import { describe, expect, test } from 'bun:test'
import { COURSES, campusOf, cityById, cityOf } from '@/features/engine/catalogue'
import { asksFor, TILE_ASKS } from './asks'
import { courseById, EXTRA_COURSES } from './courses'
import { entryOf } from './entry'
import { FIELD_EDGES, FIELDS, relatedFields } from './fields'
import { CITY_STATE, OCCUPATIONS, occupationsFor } from './occupations'
import { OPPORTUNITIES, opportunitiesIn } from './opportunities'
import { ROADS } from './roads'
import { SUBJECTS, subjectsOf } from './subjects'
import type { Source, TileAsks } from './types'
import { VISAS, visaById } from './visas'

const SIX_CITIES = ['perth', 'adelaide', 'sydney', 'geelong', 'hobart', 'melbourne']
const ROAD_CITIES = [...new Set(ROADS.flatMap((r) => [r.cityId, r.altCityId]))]
const ROAD_COURSES = [
  ...new Set(ROADS.flatMap((r) => [r.courseId, r.altCourseId, r.stackCourseId])),
]
// Every course the roads can be composed from: the engine's and the roads' own.
const ALL_COURSES = [...COURSES, ...EXTRA_COURSES]
const cityIdOf = (c: (typeof ALL_COURSES)[number]) => cityOf(c).id
const SIX_CITY_COURSES = ALL_COURSES.filter((c) => SIX_CITIES.includes(cityIdOf(c)))

const allSources = (): Source[] => [
  ...VISAS.map((v) => v.source),
  ...OCCUPATIONS.map((o) => o.source),
  ...SUBJECTS.map((s) => s.source),
  ...OPPORTUNITIES.map((o) => o.source),
  ...TILE_ASKS.flatMap((t: TileAsks) => t.asks.map((a) => a.source)),
]

describe('the mock catalogue', () => {
  test('every source is labelled mock and dated month and year', () => {
    expect(allSources().length).toBeGreaterThan(0)
    for (const s of allSources()) {
      expect(s.title.endsWith('· mock')).toBe(true)
      expect(s.date).toMatch(/^[A-Z][a-z]{2} 20\d\d$/)
    }
  })

  test('every course and city the data names exists', () => {
    const askCourses = TILE_ASKS.flatMap((t) =>
      t.subject.kind === 'course' ? [t.subject.courseId] : [],
    )
    const courseIds = [
      ...OCCUPATIONS.flatMap((o) => o.courseIds),
      ...SUBJECTS.map((s) => s.courseId),
      ...askCourses,
    ]
    for (const id of courseIds) expect(courseById(id)).toBeDefined()
    const cityIds = [
      ...OPPORTUNITIES.map((o) => o.cityId),
      ...TILE_ASKS.flatMap((t) => (t.subject.kind === 'city' ? [t.subject.cityId] : [])),
    ]
    for (const id of cityIds) expect(cityById(id).id).toBe(id)
  })

  test('the field graph is closed, defined and has no repeated edge', () => {
    const ids = new Set(FIELDS.map((f) => f.id))
    for (const e of FIELD_EDGES) {
      expect(ids.has(e.from)).toBe(true)
      expect(ids.has(e.to)).toBe(true)
    }
    for (const f of FIELDS) {
      expect(f.definition.length).toBeGreaterThan(0)
      expect(f.definition.length).toBeLessThan(160)
    }
    const keys = FIELD_EDGES.map((e) => `${e.from}>${e.to}>${e.kind}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const id of [
      'cyber',
      'data',
      'business',
      'it',
      'psych',
      'health',
      'engineering',
      'design',
    ])
      expect(ids.has(id)).toBe(true)
  })

  test('health, engineering and design are linked into the field graph', () => {
    expect(relatedFields('health')).toContain('data')
    expect(relatedFields('health')).toContain('health-informatics')
    expect(relatedFields('engineering')).toContain('it')
    expect(relatedFields('design')).toContain('it')
  })

  test('relatedFields reads an edge in both directions and over any kind', () => {
    const edge = FIELD_EDGES[0]
    expect(relatedFields(edge.from)).toContain(edge.to)
    expect(relatedFields(edge.to)).toContain(edge.from)
    expect(relatedFields('no-such-field')).toEqual([])
  })

  test('every visa leads only to visas that exist', () => {
    const ids = new Set(VISAS.map((v) => v.id))
    expect(ids.size).toBe(8)
    for (const v of VISAS) for (const next of v.leadsTo) expect(ids.has(next)).toBe(true)
    expect(visaById('491').leadsTo).toContain('191')
    expect(visaById('482').leadsTo).toContain('186')
  })

  test('every city and every course has three or four short asks', () => {
    for (const cityId of new Set([...SIX_CITIES, ...ROAD_CITIES])) {
      const asks = asksFor({ kind: 'city', cityId })
      expect(asks.length).toBeGreaterThanOrEqual(3)
      expect(asks.length).toBeLessThanOrEqual(4)
      for (const a of asks) expect(a.answer.length).toBeLessThan(400)
    }
    for (const { id: courseId } of ALL_COURSES) {
      const asks = asksFor({ kind: 'course', courseId })
      expect(asks.length).toBeGreaterThanOrEqual(3)
      expect(asks.length).toBeLessThanOrEqual(4)
      for (const a of asks) expect(a.answer.length).toBeLessThan(400)
    }
    expect(asksFor({ kind: 'city', cityId: 'nowhere' })).toEqual([])
  })

  test('asks are kept once per city and course, and cover the six cities, every course and the roads', () => {
    const cities = TILE_ASKS.flatMap((t) => (t.subject.kind === 'city' ? [t.subject.cityId] : []))
    const courses = TILE_ASKS.flatMap((t) =>
      t.subject.kind === 'course' ? [t.subject.courseId] : [],
    )
    expect(new Set(cities).size).toBe(cities.length)
    expect(new Set(courses).size).toBe(courses.length)
    for (const id of [...SIX_CITIES, ...ROAD_CITIES]) expect(cities).toContain(id)
    for (const c of ALL_COURSES) expect(courses).toContain(c.id)
    for (const id of ROAD_COURSES) expect(courses).toContain(id)
  })

  test('courseById reads the engine first, then the roads own courses', () => {
    expect(courseById('ecu-cyber')).toBe(COURSES.find((c) => c.id === 'ecu-cyber'))
    expect(EXTRA_COURSES.length).toBeGreaterThan(0)
    for (const c of EXTRA_COURSES) {
      expect(courseById(c.id)).toBe(c)
      expect(COURSES.some((e) => e.id === c.id)).toBe(false)
    }
    expect(courseById('nope')).toBeUndefined()
  })

  test('every course has subjects, and every city has all three kinds of opportunity', () => {
    for (const { id } of ALL_COURSES) {
      const subjects = subjectsOf(id)
      expect(subjects?.majors.length).toBeGreaterThan(0)
      expect(subjects?.units.length).toBeGreaterThan(0)
      expect(subjects?.conditions.length).toBeGreaterThan(0)
    }
    for (const cityId of new Set([...SIX_CITIES, ...ROAD_CITIES])) {
      const kinds = new Set(OPPORTUNITIES.filter((o) => o.cityId === cityId).map((o) => o.kind))
      expect(kinds).toEqual(new Set(['placement', 'part-time', 'graduate-program']))
    }
    const perthCyber = opportunitiesIn('perth', 'cyber')
    expect(perthCyber.length).toBeGreaterThan(0)
    for (const o of perthCyber) {
      expect(o.cityId).toBe('perth')
      expect(o.fields).toContain('cyber')
    }
  })

  test('every course has an opportunity of each kind in its city, for its field', () => {
    for (const c of SIX_CITY_COURSES) {
      for (const kind of ['placement', 'part-time', 'graduate-program']) {
        const found = opportunitiesIn(cityIdOf(c), c.field).filter((o) => o.kind === kind)
        expect(`${c.id} ${kind} ${found.length > 0}`).toBe(`${c.id} ${kind} true`)
      }
    }
  })

  test('every course leads to an occupation, and the lists are per state', () => {
    for (const { id } of ALL_COURSES) expect(occupationsFor(id).length).toBeGreaterThan(0)
    for (const c of ALL_COURSES) expect(CITY_STATE[cityIdOf(c)]).toBeDefined()
    const security = OCCUPATIONS.find((o) => o.code === '262112')
    expect(security?.lists.WA).toContain('190')
  })

  test('the nurse is on a list of every state that teaches nursing, the engineer on one, the UX designer on none', () => {
    const nursing = ALL_COURSES.filter((c) => c.name.startsWith('Master of Nursing'))
    const states = new Set(nursing.map((c) => CITY_STATE[cityIdOf(c)]))
    const nurse = OCCUPATIONS.find((o) => o.name === 'Registered Nurse')
    expect(nurse).toBeDefined()
    for (const c of nursing) expect(nurse?.courseIds).toContain(c.id)
    for (const state of states) expect(nurse?.lists[state]?.length).toBeGreaterThan(0)
    const civil = OCCUPATIONS.find((o) => o.name === 'Civil Engineer')
    expect(Object.values(civil?.lists ?? {}).some((l) => l.length > 0)).toBe(true)
    const ux = OCCUPATIONS.find((o) => o.name === 'UX Designer')
    expect(ux).toBeDefined()
    expect(Object.values(ux?.lists ?? {}).flat()).toEqual([])
  })
})

describe('the courses added for the roads', () => {
  const cityIds = (list: readonly (typeof EXTRA_COURSES)[number][]) => new Set(list.map(cityIdOf))
  const named = (part: string) => EXTRA_COURSES.filter((c) => c.name.includes(part))

  test('there are at least twelve more, all two years, in the six cities, in fields and levels that exist', () => {
    expect(EXTRA_COURSES.length).toBeGreaterThanOrEqual(15)
    const fieldIds = new Set(FIELDS.map((f) => f.id))
    for (const c of EXTRA_COURSES) {
      expect(c.years).toBe(2)
      expect(SIX_CITIES).toContain(cityIdOf(c))
      expect(campusOf(c).id).toBe(c.campusId)
      expect(fieldIds.has(c.field)).toBe(true)
      expect(['Diploma', "Bachelor's", "Master's"]).toContain(c.level)
      expect(c.feeClaim.source.endsWith('· mock')).toBe(true)
      for (const l of Object.values(c.lines)) expect(l.claim.source.endsWith('· mock')).toBe(true)
    }
  })

  test('nursing is graduate entry in two cities, public health in one, civil engineering in two, interaction design in one', () => {
    const nursing = named('Master of Nursing')
    expect(cityIds(nursing).size).toBe(2)
    for (const c of nursing) {
      expect([c.field, c.level]).toEqual(['health', "Master's"])
      expect(c.name).toContain('graduate entry')
    }
    const health = named('Master of Public Health')
    expect(cityIds(health).size).toBe(1)
    expect(health[0].field).toBe('health')
    const civil = named('Master of Engineering (civil)')
    expect(cityIds(civil).size).toBe(2)
    for (const c of civil) expect([c.field, c.level]).toEqual(['engineering', "Master's"])
    const design = named('Master of Interaction Design')
    expect(cityIds(design).size).toBe(1)
    expect([design[0].field, design[0].level]).toEqual(['design', "Master's"])
  })

  test('there are two-year diplomas in IT, business and health, across at least three cities', () => {
    const diplomas = EXTRA_COURSES.filter((c) => c.level === 'Diploma')
    expect(new Set(diplomas.map((c) => c.field))).toEqual(new Set(['it', 'business', 'health']))
    expect(cityIds(diplomas).size).toBeGreaterThanOrEqual(3)
  })

  test('every city has at least three two-year courses, and each one that had fewer got one here', () => {
    for (const cityId of SIX_CITIES) {
      const twoYear = SIX_CITY_COURSES.filter((c) => c.years === 2 && cityIdOf(c) === cityId)
      expect(twoYear.length).toBeGreaterThanOrEqual(3)
    }
    for (const cityId of ['adelaide', 'sydney', 'geelong', 'hobart', 'melbourne']) {
      expect(cityIds(EXTRA_COURSES).has(cityId)).toBe(true)
    }
  })

  test('no course or campus is at UWA', () => {
    for (const c of ALL_COURSES) {
      expect(`${c.name} ${c.university} ${campusOf(c).name}`).not.toMatch(/UWA/i)
    }
  })
})

describe('entry rules', () => {
  test('every course has one: a master needs a bachelor, a diploma needs high school, English between 6.0 and 7.5', () => {
    for (const c of ALL_COURSES) {
      const entry = entryOf(c.id)
      expect(entry).toBeDefined()
      expect(entry?.minQual).toBe(c.level === "Master's" ? "Bachelor's" : 'High school')
      expect(entry?.ielts).toBeGreaterThanOrEqual(6)
      expect(entry?.ielts).toBeLessThanOrEqual(7.5)
      expect((entry?.ielts ?? 0) * 2).toBe(Math.round((entry?.ielts ?? 0) * 2))
    }
    expect(entryOf('nope')).toBeUndefined()
  })

  test('only the master of engineering needs a degree in a field; nursing is open to any bachelor and needs 7.0', () => {
    const needing = ALL_COURSES.filter((c) => entryOf(c.id)?.needsDegreeIn !== null)
    expect(needing.length).toBeGreaterThan(0)
    for (const c of needing) {
      expect(c.name).toContain('Master of Engineering')
      expect(entryOf(c.id)?.needsDegreeIn).toBe('engineering')
    }
    const nursing = ALL_COURSES.filter((c) => c.name.startsWith('Master of Nursing'))
    expect(nursing.length).toBe(2)
    for (const c of nursing) {
      expect(entryOf(c.id)?.minQual).toBe("Bachelor's")
      expect(entryOf(c.id)?.needsDegreeIn).toBeNull()
      expect(entryOf(c.id)?.ielts).toBe(7)
    }
  })
})
