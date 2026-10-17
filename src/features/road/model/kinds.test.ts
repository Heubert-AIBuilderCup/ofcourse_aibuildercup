import { describe, expect, it } from 'bun:test'
import { ICONS, kindOf } from './kinds'
import { getRoad } from './road-data'
import { buildScene, NEW_SESSION, type Session } from './scene'

const road = getRoad()
const scene = (session: Partial<Session> = {}) => buildScene(road, { ...NEW_SESSION, ...session })
const kind = (id: string, session: Partial<Session> = {}) => {
  const sc = scene(session)
  const t = sc.tiles.find((x) => x.id === id)
  if (!t) throw new Error(`No tile ${id}`)
  return kindOf(t, sc)
}

describe('kindOf: what a tile is, in a word, and its icon', () => {
  it('names where she starts, the two ends of the road and the country', () => {
    expect(kind('point-a')).toEqual({ word: 'You', icon: 'you' })
    expect(kind('permanent-residency')).toEqual({ word: 'Point B', icon: 'flag' })
    expect(kind('permanent-191')).toEqual({ word: 'Point B', icon: 'flag' })
    expect(kind('australia')).toEqual({ word: 'Country', icon: 'globe' })
  })

  it('names the junction a fork and a stack not looked at', () => {
    expect(kind('two-ways-to-pr')).toEqual({ word: 'Fork', icon: 'fork' })
    expect(kind('more-cities')).toEqual({ word: 'Not looked at', icon: 'more' })
    expect(kind('more-courses-perth')).toEqual({ word: 'Not looked at', icon: 'more' })
  })

  it('tells a city or a course on her road from one beside it', () => {
    expect(kind('perth')).toEqual({ word: 'City', icon: 'city' })
    expect(kind('adelaide')).toEqual({ word: 'Other city', icon: 'city' })
    expect(kind('cyber-security-ecu-perth')).toEqual({ word: 'Course', icon: 'course' })
    expect(kind('data-science-uwa-perth')).toEqual({ word: 'Other course', icon: 'course' })
  })

  it('keeps a course on her road ahead a course, though it is not visited yet', () => {
    expect(kind('cyber-security-ecu-perth', { first: true })).toEqual({
      word: 'Course',
      icon: 'course',
    })
  })

  it('names the steps ahead: the study years, the work visa, the other visas', () => {
    expect(kind('masters-cyber-security-ecu')).toEqual({ word: 'Study', icon: 'study' })
    expect(kind('graduate-visa-485')).toEqual({ word: 'Work visa', icon: 'work' })
    for (const id of ['student-visa-500', 'state-nomination-190', 'regional-491'])
      expect(kind(id)).toEqual({ word: 'Visa', icon: 'visa' })
  })

  it('names the destination not picked yet on an empty road', () => {
    const sc = buildScene({ ...road, tiles: [] }, NEW_SESSION)
    const dest = sc.tiles.find((t) => t.id === 'destination')!
    expect(kindOf(dest, sc)).toEqual({ word: 'Not picked yet', icon: 'globe' })
  })
})

describe('ICONS', () => {
  it('has the paths for every icon a tile can carry', () => {
    for (const name of [
      'you',
      'flag',
      'globe',
      'city',
      'course',
      'visa',
      'study',
      'work',
      'fork',
      'more',
    ] as const) {
      expect(ICONS[name].length).toBeGreaterThan(0)
      for (const d of ICONS[name]) expect(d).toMatch(/^[Mm]/)
    }
  })

  it('carries the reference’s paths verbatim', () => {
    expect(ICONS.you).toEqual([
      'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2',
      'M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    ])
    expect(ICONS.more).toEqual(['M5 12h14', 'M12 5v14'])
  })
})

describe('kindOf: a job beside the 485', () => {
  it('is a job, with the work icon', () => {
    const sc = scene()
    const job = {
      id: 'job-261313',
      kind: 'job',
      state: 'alt',
      gx: 14,
      gy: -2,
      name: 'Software Engineer',
      lab: { whole: 'none', level: 'right', tile: 'right' },
    } as const
    expect(kindOf(job, sc)).toEqual({ word: 'Job', icon: 'work' })
  })
})
