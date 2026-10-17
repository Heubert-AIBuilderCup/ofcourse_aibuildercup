import { describe, expect, test } from 'bun:test'
import { OCCUPATIONS, routeFor } from '@/features/roads/data/occupations'
import { workRightsLine } from '@/features/roads/model/compose'
import { FIELD_OCCUPATIONS } from '../data/field-occupations'
import type { RawCourse } from '../data/schema'
import { buildCatalogue } from './build'

const raw = (over: Partial<RawCourse> = {}): RawCourse => ({
  name: 'Master of Cyber Security',
  campusId: 'ecu-joondalup',
  level: "Master's",
  years: 2,
  feeK: 38,
  field: 'cyber',
  graphField: 'cyber',
  niche: false,
  placements: true,
  description:
    'This course builds the skills to defend networks, systems and data. Students work through lab exercises on attack and defence.',
  majors: ['Network Defence'],
  units: ['Network Security', 'Ethical Hacking', 'Incident Response'],
  ...over,
})

const one = (over: Partial<RawCourse> = {}) => {
  const { courses, extras } = buildCatalogue([raw(over)])
  return { course: courses[0], extra: extras[0] }
}

const occupationsOf = (field: RawCourse['field']) =>
  OCCUPATIONS.filter((o) => FIELD_OCCUPATIONS[field].includes(o.code))

describe('buildCatalogue', () => {
  test('ids are f-<slug of name>-<campus>, with a -2 suffix when two names slug alike', () => {
    const { courses } = buildCatalogue([
      raw({ name: 'Master of Cyber Security' }),
      raw({ name: 'Master of Cyber-Security!' }),
      raw({ name: 'Master of Cyber Security', campusId: 'uts-ultimo' }),
    ])
    expect(courses.map((c) => c.id)).toEqual([
      'f-master-of-cyber-security-ecu-joondalup',
      'f-master-of-cyber-security-ecu-joondalup-2',
      'f-master-of-cyber-security-uts-ultimo',
    ])
  })

  test('the university is the one the catalogue names for the campus and level', () => {
    const university = (campusId: RawCourse['campusId'], level: RawCourse['level']) =>
      one({ campusId, level }).course.university
    expect(university('ecu-joondalup', "Master's")).toBe('ECU')
    expect(university('unisa-city-west', 'Diploma')).toBe('UniSA College')
    expect(university('unisa-city-west', "Master's")).toBe('UniSA')
    expect(university('monash-clayton', 'Diploma')).toBe('Monash College')
    expect(university('monash-clayton', "Master's")).toBe('Monash')
    expect(university('deakin-waurn-ponds', 'Diploma')).toBe('Deakin College')
    expect(university('deakin-waurn-ponds', "Master's")).toBe('Deakin')
    // No Diploma at the campus in the catalogue: the other name.
    expect(university('ecu-joondalup', 'Diploma')).toBe('ECU')
    expect(university('uts-ultimo', 'Diploma')).toBe('UTS')
    // TAFE Perth is Diploma only: a Master's there falls back to it.
    expect(university('tafe-perth', "Master's")).toBe('North Metropolitan TAFE')
  })

  test('a cyber course in Perth gets the existing route and work-rights rules', () => {
    const { course } = one({ field: 'cyber', campusId: 'curtin-bentley', level: "Master's" })
    const route = routeFor(occupationsOf('cyber'), 'perth', undefined)
    expect(route).toBe('190')
    expect(course.route).toBe('190, then PR')
    expect(course.lines.pr.text).toContain('190')
    expect(course.lines.pr.effect).toBe('gives')
    expect(course.lines.work.text).toBe(workRightsLine('perth', "Master's", 2))
    expect(course.lines.work.effect).toBe('gives')
    expect(course.prScore).toBe(3)
  })

  test('prScore is 3, 2, 1, 0 for 190, 491, 186 and none', () => {
    // data in Perth: 190; cyber in Sydney: 491; data in Sydney: 186 (employer); psych: none.
    const score = (field: RawCourse['field'], campusId: RawCourse['campusId']) => {
      const { course } = one({ field, campusId })
      return [course.route, course.prScore]
    }
    expect(score('data', 'ecu-joondalup')).toEqual(['190, then PR', 3])
    expect(score('cyber', 'uts-ultimo')).toEqual(['491, then PR', 2])
    expect(score('data', 'uts-ultimo')).toEqual(['186, then PR', 1])
    expect(score('psych', 'swinburne-hawthorn')).toEqual(['no clear PR', 0])
    const none = one({ field: 'psych', campusId: 'swinburne-hawthorn' }).course
    expect(none.lines.pr.text).toContain('no clear PR')
    expect(none.lines.pr.effect).toBe('costs')
  })

  test('a one-year course gets the one-year work-rights sentence', () => {
    const { course } = one({ years: 1, level: 'Diploma', campusId: 'tafe-perth' })
    expect(course.lines.work.text).toBe(
      'One year of study alone does not open the Temporary Graduate visa (485)',
    )
    expect(course.lines.work.effect).toBe('costs')
    expect(course.lines.time.text).toBe('1 year, Diploma')
  })

  test('career names the field occupations; careerScore follows them', () => {
    const { course } = one({ field: 'data' })
    expect(course.lines.career.text).toBe('Data Scientist')
    expect(course.careerScore).toBe(3)
    expect(course.lines.time.text).toBe("2 years, Master's")
  })

  test('every claim is labelled sample, and the fee claim names the fee', () => {
    const { course } = one({ feeK: 38 })
    const claims = [course.feeClaim, ...Object.values(course.lines).map((l) => l.claim)]
    expect(claims.every((c) => c.source.endsWith(' · sample'))).toBe(true)
    expect(course.feeClaim.detail[0]).toContain('AUD 38k')
    expect(course.keepOpen.text).toBe('Ask ECU about the next intake')
  })

  test('extras carry the field occupations and the raw description unchanged', () => {
    const description = raw().description
    const { course, extra } = one({ field: 'health', graphField: 'nursing', niche: true })
    expect(extra.courseId).toBe(course.id)
    expect(extra.occupationCodes).toEqual([...FIELD_OCCUPATIONS.health])
    expect(extra.description).toBe(description)
    expect(extra.graphField).toBe('nursing')
    expect(extra.niche).toBe(true)
    expect(extra.subjects).toEqual({ majors: raw().majors, units: raw().units })
  })
})

describe('a course’s fields: its primary field, then every broad field its niche field combines', () => {
  const fieldsOf = (over: Partial<RawCourse>) => one(over).extra.fields

  test('a cyber-psychology course filed psych is psych, then cyber', () => {
    expect(fieldsOf({ field: 'psych', graphField: 'cyber-psychology', niche: true })).toEqual([
      'psych',
      'cyber',
    ])
  })

  test('an hci course filed it is it, then design; its related psych edge is ignored', () => {
    expect(fieldsOf({ field: 'it', graphField: 'hci', niche: true })).toEqual(['it', 'design'])
  })

  test('a health-informatics course filed health is health, then data and it in graph order', () => {
    expect(fieldsOf({ field: 'health', graphField: 'health-informatics', niche: true })).toEqual([
      'health',
      'data',
      'it',
    ])
  })

  test('an is-a edge counts; a target that is not a broad field (software) does not', () => {
    expect(fieldsOf({ field: 'design', graphField: 'game-development', niche: true })).toEqual([
      'design',
      'it',
    ])
  })

  test('a plain course, or a non-niche one whose graph field combines, is its field alone', () => {
    expect(fieldsOf({})).toEqual(['cyber'])
    expect(fieldsOf({ field: 'it', graphField: 'info-systems', niche: false })).toEqual(['it'])
  })

  test('route, PR score, lines and occupations follow the primary field alone', () => {
    const psych = one({ field: 'psych', campusId: 'utas-sandy-bay' }).course
    const { course, extra } = one({
      field: 'psych',
      graphField: 'cyber-psychology',
      niche: true,
      campusId: 'utas-sandy-bay',
    })
    expect(course.route).toBe(psych.route)
    expect(course.prScore).toBe(psych.prScore)
    expect(course.lines).toEqual(psych.lines)
    expect(extra.occupationCodes).toEqual([...FIELD_OCCUPATIONS.psych])
  })
})

describe('a niche field with its own occupations', () => {
  test('a health-informatics course leads to Health Information Manager and IT, not nursing', () => {
    const { course, extra } = one({
      field: 'health',
      graphField: 'health-informatics',
      niche: true,
      campusId: 'monash-clayton',
    })
    expect(extra.occupationCodes).toContain('224213')
    for (const code of FIELD_OCCUPATIONS.it) expect(extra.occupationCodes).toContain(code)
    expect(extra.occupationCodes).not.toContain('254499') // Registered Nurse
    expect(extra.occupationCodes).not.toContain('411611') // Community Worker
    expect(course.lines.career.text).toContain('Health Information Manager')
    expect(course.lines.career.text).not.toContain('Registered Nurse')
  })

  test('a niche field without its own list keeps its broad field’s', () => {
    const { extra } = one({ field: 'health', graphField: 'bioinformatics', niche: true })
    expect(extra.occupationCodes).toEqual([...FIELD_OCCUPATIONS.health])
  })
})

describe('FIELD_OCCUPATIONS', () => {
  test('every code is an existing occupation', () => {
    const known = new Set(OCCUPATIONS.map((o) => o.code))
    const unknown = Object.values(FIELD_OCCUPATIONS)
      .flat()
      .filter((code) => !known.has(code))
    expect(unknown).toEqual([])
  })

  test('a field maps to the occupations of its catalogue courses', () => {
    expect([...FIELD_OCCUPATIONS.data]).toEqual(['224115'])
    expect([...FIELD_OCCUPATIONS.cyber].sort()).toEqual(['262112', '313212'])
  })
})
