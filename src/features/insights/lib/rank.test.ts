import { describe, expect, it } from 'bun:test'
import type { Path } from '@/features/content/lib/path-facts'
import { COURSES } from '@/features/engine'
import { rankPaths, type ShowingStats } from './rank'

const path = (id: string, label: string): Path => ({
  id,
  label,
  city: 'City',
  course: 'Course',
  university: 'University',
})

const A = path('a', 'Adelaide · IT')
const B = path('b', 'Brisbane · Data')
const C = path('c', 'Cairns · Cyber')
const PATHS = [A, B, C]
const MOCK = { a: 12, b: 40, c: 7 }
const none = new Map<string, 'in_progress' | 'live'>()
const NO_SHOWINGS = new Map<string, ShowingStats>()
const zero = { cost: 0, time: 0, work: 0, pr: 0, location: 0, career: 0 }
const SHOWN: ShowingStats = {
  showings: 4,
  byFuture: { cost: 3, staying: 1, career: 0 },
  strongOn: { ...zero, cost: 75 },
  costsOn: { ...zero, pr: 50 },
  outOfReach: { count: 0, avgOverK: 0 },
}

const shown = (rows: ReturnType<typeof rankPaths>) =>
  rows.map((r) => [r.path.id, r.count, r.mock] as const)

describe('rankPaths', () => {
  it('shows every path with its mock count while no real view exists', () => {
    expect(shown(rankPaths(PATHS, new Map(), none, NO_SHOWINGS, MOCK))).toEqual([
      ['b', 40, true],
      ['a', 12, true],
      ['c', 7, true],
    ])
  })

  it('shows only real counts once they reach the threshold, and 0 for a path with none', () => {
    const real = new Map([
      ['a', 15],
      ['c', 10],
    ])
    expect(shown(rankPaths(PATHS, real, none, NO_SHOWINGS, MOCK))).toEqual([
      ['a', 15, false],
      ['c', 10, false],
      ['b', 0, false],
    ])
  })

  it('keeps a real count below the threshold and fills the paths without one from the mock', () => {
    const real = new Map([['c', 5]])
    expect(shown(rankPaths(PATHS, real, none, NO_SHOWINGS, MOCK))).toEqual([
      ['b', 40, true],
      ['a', 12, true],
      ['c', 5, false],
    ])
  })

  it('orders by count, then by label', () => {
    const real = new Map([
      ['c', 10],
      ['b', 10],
      ['a', 10],
    ])
    expect(rankPaths(PATHS, real, none, NO_SHOWINGS, MOCK).map((r) => r.path.label)).toEqual([
      'Adelaide · IT',
      'Brisbane · Data',
      'Cairns · Cyber',
    ])
  })

  it('takes each path’s comic status from the comics, none when it has no comic', () => {
    const comics = new Map<string, 'in_progress' | 'live'>([
      ['a', 'live'],
      ['c', 'in_progress'],
    ])
    const status = Object.fromEntries(
      rankPaths(PATHS, new Map(), comics, NO_SHOWINGS, MOCK).map((r) => [r.path.id, r.status]),
    )
    expect(status).toEqual({ a: 'live', b: 'none', c: 'in_progress' })
  })

  it('reads a path missing from the mock as 0', () => {
    expect(shown(rankPaths([A], new Map(), none, NO_SHOWINGS, {}))).toEqual([['a', 0, true]])
  })

  it('gives a path with real views how it was shown, and one with none no showing', () => {
    const real = new Map([
      ['a', 25],
      ['b', 3],
    ])
    const rows = rankPaths(PATHS, real, none, new Map([['a', SHOWN]]), MOCK)
    const showing = Object.fromEntries(rows.map((r) => [r.path.id, r.showing]))
    expect(showing).toEqual({ a: SHOWN, b: null, c: null })
  })

  it('never gives a mock-counted path a showing, even one recorded', () => {
    const [row] = rankPaths([A], new Map(), none, new Map([['a', SHOWN]]), MOCK)
    expect([row.mock, row.showing]).toEqual([true, null])
  })

  it('takes a path’s lines from the catalogue as time, work, PR and career; none off it', () => {
    const course = COURSES[0]
    const catalogued = path(course.id, 'Catalogued')
    const rows = rankPaths([catalogued, A], new Map(), none, NO_SHOWINGS, MOCK)
    const lines = Object.fromEntries(rows.map((r) => [r.path.id, r.lines]))
    expect(lines).toEqual({
      [course.id]: [
        { dim: 'time', text: course.lines.time.text },
        { dim: 'work', text: course.lines.work.text },
        { dim: 'pr', text: course.lines.pr.text },
        { dim: 'career', text: course.lines.career.text },
      ],
      a: [],
    })
  })
})
