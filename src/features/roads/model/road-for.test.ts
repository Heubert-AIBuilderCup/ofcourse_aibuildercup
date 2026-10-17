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
  describe('pinned to a course (criterion 30)', () => {
    const perth = DEMO_PROFILES[0]
    const home = DEMO_PROFILES.find((p) => p.roadId === 'melbourne-home')
    if (!home) throw new Error('melbourne-home profile missing')
    const pinned = { courseId: 'uts-cyber', cityId: 'sydney' }

    test('draws the road around the pinned course in its city, kind pinned', () => {
      const r = roadFor({ answers: perth.answers, relative: perth.relative, pinned }, {})
      expect(r.kind).toBe('pinned')
      expect(r.spec?.courseId).toBe('uts-cyber')
      expect(r.spec?.cityId).toBe('sydney')
      // The match stays with it, for the why.
      expect(r.match?.spec.id).toBe(perth.roadId)
    })
    test("its city and course cards' why say she chose it, not the rules of the road she matched", () => {
      const r = roadFor({ answers: perth.answers, relative: perth.relative, pinned }, {})
      for (const slot of ['city', 'course'] as const) {
        const why = r.road.cards[r.spec?.slots[slot].id ?? '']?.why ?? ''
        expect(why.startsWith('On your roadmap: you chose this course in Sydney. ')).toBe(true)
        expect(why.includes('the person you know')).toBe(false)
      }
    })
    test('ends as the road her answers match ends: staying or home', () => {
      for (const p of [perth, home]) {
        const matched = roadFor({ answers: p.answers, relative: p.relative }, {})
        const r = roadFor({ answers: p.answers, relative: p.relative, pinned }, {})
        expect(r.spec?.stays).toBe(matched.spec?.stays as boolean)
      }
      expect(roadFor({ answers: home.answers, relative: null, pinned }, {}).spec?.stays).toBe(false)
    })
    test('an unknown pinned course falls back to the road her answers match', () => {
      const matched = roadFor({ answers: perth.answers, relative: perth.relative }, {})
      const r = roadFor(
        {
          answers: perth.answers,
          relative: perth.relative,
          pinned: { courseId: 'no-such-course', cityId: 'sydney' },
        },
        {},
      )
      expect(r.kind).toBe('matched')
      expect(r.spec?.id).toBe(matched.spec?.id as string)
    })
    test('the switch still puts Priya back', () => {
      const r = roadFor(
        { answers: perth.answers, relative: null, pinned },
        { STUDENT_ROADS_OFF: '1' },
      )
      expect(r.kind).toBe('off')
      expect(r.road).toBe(PRIYA)
    })
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
