import { describe, expect, test } from 'bun:test'
import { PRIYA } from '@/features/road/model/fixture'
import type { Relative } from '@/shared/types/student'
import { courseById } from '../data/courses'
import { studentRoadsOff } from '../switch'
import { specById } from './compose'
import { DEMO_PROFILES, stated } from './demo-profiles'
import { roadFor } from './road-for'
import { whyTemplate } from './why'

describe('roadFor', () => {
  test('an exact match is matched, built for her', () => {
    const p = DEMO_PROFILES[0]
    const r = roadFor({ answers: p.answers, relative: p.relative }, {})
    expect(r.kind).toBe('matched')
    expect(r.spec?.id).toBe(p.roadId)
    expect(r.differences).toEqual([])
    expect(r.road).not.toBe(PRIYA)
  })
  test('a health student gets her composed health road, matched (criterion 56)', () => {
    const r = roadFor(
      {
        answers: stated({
          stay: 'Yes',
          know: "A few areas I'm drawn to",
          areas: ['Health'],
          qual: "Bachelor's",
        }),
        relative: null,
      },
      {},
    )
    expect(r.kind).toBe('matched')
    expect(courseById(r.spec?.courseId ?? '')?.field).toBe('health')
    expect(r.road).not.toBe(PRIYA)
  })
  test('a match to a composed road draws that road, not the illustrative one', () => {
    const r = roadFor(
      {
        answers: stated({
          stay: 'No',
          field: 'Business analytics',
          know: 'Something particular',
          level: 'Diploma',
        }),
        relative: null,
      },
      {},
    )
    expect(r.kind).toBe('matched')
    expect(r.spec).toEqual(specById('geelong-deakin-dip-business-home'))
    expect(r.differences).toEqual([])
  })
  test('no exact match is the nearest, with its differences', () => {
    const r = roadFor(
      {
        answers: {
          stay: { value: 'Yes', state: 'stated' },
          field: { value: 'Data science', state: 'stated' },
          know: { value: 'Something particular', state: 'stated' },
          level: { value: 'Diploma', state: 'stated' },
        },
        relative: null,
      },
      {},
    )
    expect(r.kind).toBe('nearest')
    expect(r.differences.map((d) => d.key)).toEqual(['level'])
  })
  test("the board's why template names the rules of her match, as writeWhy's does (criterion 64)", () => {
    const p = DEMO_PROFILES[0]
    const relative: Relative = { ...(p.relative as Relative), relationship: 'Cousin' }
    const r = roadFor({ answers: p.answers, relative }, {})
    if (!r.spec || !r.match) throw new Error('no road matched')
    const cityTile = r.spec.slots.city.id
    const match = { differences: r.match.differences, relative }
    expect(r.road.cards[cityTile].why).toBe(whyTemplate(r.spec, 'city', p.answers, match))
    expect(r.road.cards[cityTile].why).toContain('Perth: where your cousin lives')
  })
  test('the switch puts Priya back, with no spec', () => {
    const r = roadFor(
      { answers: DEMO_PROFILES[0].answers, relative: null },
      { STUDENT_ROADS_OFF: '1' },
    )
    expect(r).toEqual({ road: PRIYA, kind: 'off', spec: null, match: null, differences: [] })
  })
  test('anything else in the switch leaves it on', () => {
    expect(studentRoadsOff({ STUDENT_ROADS_OFF: 'true' })).toBe(false)
    expect(studentRoadsOff({})).toBe(false)
    expect(studentRoadsOff({ STUDENT_ROADS_OFF: '1' })).toBe(true)
  })
  test('a road that cannot be built is the illustrative one', () => {
    const r = roadFor({ answers: {}, relative: null }, {}, () => {
      throw new Error('broken spec')
    })
    expect(r).toEqual({
      road: PRIYA,
      kind: 'illustrative',
      spec: null,
      match: null,
      differences: [],
    })
  })
})
