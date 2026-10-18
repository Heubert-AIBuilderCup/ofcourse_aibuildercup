import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CAMPUSES, COURSES } from '@/features/engine/catalogue'
import { EXTRA_COURSES } from '@/features/roads/data/courses'
import { FIELDS } from '@/features/roads/data/fields'
import { FIELD_OCCUPATIONS } from './field-occupations'
import { FINDER_CAMPUSES, FINDER_CITIES, rawCourseSchema } from './schema'

const RAW = join(import.meta.dir, 'raw')
const FIELD_IDS = rawCourseSchema.shape.field.options

type Row = { name?: unknown; campusId?: unknown; graphField?: unknown }

/** The rows of one field's raw file, or none when the file is missing. */
function rowsOf(field: string): Row[] {
  const path = join(RAW, `${field}.json`)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Row[]) : []
}

const valid = {
  name: 'Master of Applied Testing',
  campusId: 'uts-ultimo',
  level: "Master's",
  years: 2,
  feeK: 40,
  field: 'it',
  graphField: 'it',
  niche: false,
  placements: true,
  description:
    'You learn how software is checked before it ships, from unit tests to whole systems. Most weeks pair a short lecture with a lab. The last term is a project with a real team.',
  majors: ['Automation'],
  units: ['Test design', 'Automation', 'Quality systems'],
}

describe('the raw course schema', () => {
  test('a description holds two to four sentences', () => {
    const say = (description: string) =>
      rawCourseSchema.safeParse({ ...valid, description }).success
    const sentence = 'You learn how software is checked before it ships, in labs and projects. '
    expect(say(valid.description)).toBe(true)
    expect(say(sentence.repeat(2).trim())).toBe(true)
    expect(say(sentence.repeat(4).trim())).toBe(true)
    expect(say(`${sentence}${sentence}${sentence}${sentence}${sentence}`.trim())).toBe(false)
    expect(say(`${'You learn how software is checked before it ships'.repeat(3)}.`)).toBe(false)
  })

  test('finder campuses are the used campuses in the finder cities', () => {
    const cities = new Set<string>(FINDER_CITIES)
    const used = new Set([...COURSES, ...EXTRA_COURSES].map((c) => c.campusId))
    const expected = CAMPUSES.filter((c) => cities.has(c.cityId) && used.has(c.id)).map((c) => c.id)
    expect(FINDER_CAMPUSES.map(String).sort()).toEqual(expected.sort())
  })
})

describe('the raw catalogue', () => {
  test('its fields are every broad field, the three new areas included', () => {
    expect(FIELD_IDS.map(String).sort()).toEqual(Object.keys(FIELD_OCCUPATIONS).sort())
  })

  test('there is one raw file per broad field', () => {
    const missing = FIELD_IDS.filter((field) => !existsSync(join(RAW, `${field}.json`)))
    expect(missing).toEqual([])
  })

  for (const field of FIELD_IDS) {
    test(`every row of ${field}.json passes the schema`, () => {
      const bad = rowsOf(field).flatMap((row, i) => {
        const parsed = rawCourseSchema.safeParse(row)
        return parsed.success
          ? []
          : [
              `${i} ${String(row.name)}: ${parsed.error.issues.map((x) => x.path.join('.')).join(', ')}`,
            ]
      })
      expect(bad).toEqual([])
    })
  }

  const all = () => FIELD_IDS.flatMap((field) => rowsOf(field))

  test('the eleven files hold 400 to 1,000 rows', () => {
    const count = all().length
    expect(count).toBeGreaterThanOrEqual(400)
    expect(count).toBeLessThanOrEqual(1000)
  })

  test('every graph field is a field of the graph', () => {
    const ids = new Set(FIELDS.map((f) => f.id))
    const loose = all()
      .map((row) => String(row.graphField))
      .filter((id) => !ids.has(id))
    expect(loose).toEqual([])
  })

  test('every campus is a finder campus', () => {
    const campuses = new Set<string>(FINDER_CAMPUSES)
    const loose = all()
      .map((row) => String(row.campusId))
      .filter((id) => !campuses.has(id))
    expect(loose).toEqual([])
  })

  test('no two rows share a name at one campus', () => {
    const seen = new Set<string>()
    const twice: string[] = []
    for (const row of all()) {
      const key = `${String(row.name)} @ ${String(row.campusId)}`
      if (seen.has(key)) twice.push(key)
      seen.add(key)
    }
    expect(twice).toEqual([])
  })
})
