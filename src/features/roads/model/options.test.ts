// The other options beside two steps of the road: other courses beside the study step, the jobs the
// course leads to beside the 485. Built on the server into the road, its details and "What changes".

import { describe, expect, it } from 'bun:test'
import { frame, project, TILE_SIZE } from '@/features/road/model/camera'
import { roadLines } from '@/features/road/model/drawing'
import { phoneRows } from '@/features/road/model/phone-road'
import { cardFor, primaryAction } from '@/features/road/model/press'
import type { Tile } from '@/features/road/model/road-data'
import { buildScene, NEW_SESSION, type Scene } from '@/features/road/model/scene'
import { courseById } from '../data/courses'
import { jobMarketFor } from '../data/job-market'
import { occupationsFor } from '../data/occupations'
import { ROADS, roadById } from '../data/roads'
import type { RoadSpec } from '../data/types'
import { buildRoad } from './build'
import { workRightsLine } from './compose'
import { detailsByTile } from './details'
import { jobsAfter, jobTileId, otherCourses, otherCourseTileId } from './options'

const spec = (id: string): RoadSpec => {
  const s = roadById(id)
  if (!s) throw new Error(`${id} road missing`)
  return s
}
const ADELAIDE = spec('adelaide-it')
const PERTH = spec('perth-cyber')

describe('otherCourses: the courses beside the study step', () => {
  it('are up to 3 of the road’s field and level, none already on the board', () => {
    for (const s of ROADS) {
      const ids = otherCourses(s)
      expect(ids.length).toBeGreaterThan(0)
      expect(ids.length).toBeLessThanOrEqual(3)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect([s.courseId, s.altCourseId, s.stackCourseId]).not.toContain(id)
        expect(courseById(id)?.field).toBe(s.field)
        expect(courseById(id)?.level).toBe(s.level)
      }
    }
  })

  it('prefer her city, then the road’s other city, then the rest', () => {
    // Adelaide's own Software Engineering, then Hobart's (the road's other city).
    expect(otherCourses(ADELAIDE)).toEqual(['unisa-software', 'utas-infosys', 'utas-computing'])
    // No other cyber master's in Perth: Adelaide's first, then Sydney's.
    expect(otherCourses(PERTH)).toEqual(['unisa-cyber', 'uts-cyber', 'uts-infosec'])
  })
})

describe('jobsAfter: the jobs beside the 485', () => {
  it('are one per occupation the road’s course leads to', () => {
    for (const s of ROADS)
      expect(jobsAfter(s).map((o) => o.code)).toEqual(occupationsFor(s.courseId).map((o) => o.code))
    expect(jobsAfter(ADELAIDE).map((o) => o.code)).toEqual(['261313', '261112'])
  })
})

describe('the road built with its options', () => {
  const road = buildRoad(ADELAIDE, { answers: {} })
  const scene = buildScene(road, NEW_SESSION)
  const study = ADELAIDE.slots['course-years'].id
  const work = ADELAIDE.slots['visa-485'].id
  const courses = otherCourses(ADELAIDE).map(otherCourseTileId)
  const jobs = ['261313', '261112'].map(jobTileId)
  const tile = (id: string) => scene.tiles.find((t) => t.id === id) as Tile

  it('puts each other course beside the study step, not visited, with its card', () => {
    for (const id of courses) {
      expect(tile(id)).toMatchObject({ kind: 'course', state: 'alt', beside: study })
      expect(road.cards[id]).toBeDefined()
    }
    expect(tile(otherCourseTileId('unisa-software')).name).toBe('Software Engineering')
  })

  it('puts a job tile per occupation beside the 485, named by the job', () => {
    for (const id of jobs)
      expect(tile(id)).toMatchObject({ kind: 'job', state: 'alt', beside: work })
    expect(tile(jobTileId('261313')).name).toBe('Software Engineer')
  })

  it('a course’s card: university and city, fees a year and in all, years, work rights', () => {
    const card = road.cards[otherCourseTileId('unisa-software')]
    expect(card.sub).toBe('UniSA · Adelaide')
    expect(card.guide).toContain('AUD 30k a year in fees · AUD 60k in all · 2 years')
    expect(card.guide).toContain(workRightsLine('adelaide', "Master's", 2))
  })

  it('details: a course’s jobs; a job’s market in her city, its lists and its way to PR', () => {
    const details = detailsByTile(ADELAIDE, {})
    expect(details[otherCourseTileId('unisa-software')]?.occupations?.map((o) => o.code)).toEqual(
      occupationsFor('unisa-software').map((o) => o.code),
    )
    expect(details[jobTileId('261313')]?.job).toEqual({
      code: '261313',
      name: 'Software Engineer',
      city: 'Adelaide',
      market: jobMarketFor('261313', 'adelaide'),
      lists: ["Software Engineer is on SA's 190 list", "Software Engineer is on SA's 491 list"],
      prWay: 'Supports a 190 state nomination in SA',
    })
    expect(details[jobTileId('261112')]?.job).toMatchObject({
      market: { openings: 152, payLowK: 82, payHighK: 116 },
      lists: ["Systems Analyst is not on SA's 190 list", "Systems Analyst is on SA's 491 list"],
      prWay: 'Supports a 491 regional visa in SA, then the 191',
    })
  })

  it('places them where no other tile is, inside Whole road', () => {
    const box = (t: Tile) => {
      const h = t.kind === 'slab' ? (t.w ?? TILE_SIZE.slab) : (t.sz ?? TILE_SIZE[t.kind])
      const x1 = t.gx1 ?? t.gx
      const y1 = t.gy1 ?? t.gy
      return t.kind === 'slab'
        ? { x0: t.gx, x1, y0: Math.min(t.gy, y1) - h, y1: Math.max(t.gy, y1) + h }
        : { x0: t.gx - h, x1: t.gx + h, y0: t.gy - h, y1: t.gy + h }
    }
    const apart = (a: Tile, b: Tile) => {
      const p = box(a)
      const q = box(b)
      return p.x1 <= q.x0 || q.x1 <= p.x0 || p.y1 <= q.y0 || q.y1 <= p.y0
    }
    const whole = frame('whole', null, scene)
    for (const id of [...courses, ...jobs]) {
      const t = tile(id)
      for (const other of scene.tiles.filter((o) => o.id !== id))
        expect({ id, other: other.id, apart: apart(t, other) }).toEqual({
          id,
          other: other.id,
          apart: true,
        })
      const [x, y] = project(t.gx, t.gy)
      expect(x >= whole.x0 && x <= whole.x1 && y >= whole.y0 && y <= whole.y1).toBe(true)
    }
  })

  const inside = (sc: Scene, focus: string, ids: string[]) => {
    const f = frame('level', focus, sc)
    return ids.every((id) => {
      const t = sc.tiles.find((x) => x.id === id) as Tile
      const [x, y] = project(t.gx, t.gy)
      return x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1
    })
  }

  it('Level, on a step or one of its options, frames the step and all of them', () => {
    expect(inside(scene, study, courses)).toBe(true)
    expect(inside(scene, courses[2], [study, ...courses])).toBe(true)
    expect(inside(scene, work, jobs)).toBe(true)
    expect(inside(scene, jobs[0], jobs)).toBe(true)
  })

  it('draws a level line from each step through its options', () => {
    const ids = roadLines(scene, { u: 10, ox: 0, oy: 0 }).map((l) => l.id)
    expect(ids).toContain(`beside-${study}`)
    expect(ids).toContain(`beside-${work}`)
  })

  it('lists them under their step on the phone’s road', () => {
    const rows = phoneRows(road, scene)
    const alts = (id: string) => {
      const row = rows.find((r) => r.id === id)
      return row?.kind === 'step' ? row.alts.map((a) => a.id) : []
    }
    expect(alts(study)).toEqual(courses)
    expect(alts(work)).toEqual(jobs)
  })

  it('cards: a course offers a new roadmap from it, a job only closes; neither walks', () => {
    expect(cardFor(road, scene, courses[0])).toMatchObject({
      kind: 'course',
      kicker: 'Not visited · Other master’s',
      name: 'Software Engineering',
      primary: 'Start a new roadmap from it',
      starts: true,
      secondary: 'Cancel',
    })
    const job = cardFor(road, scene, jobs[0])
    expect(job).toMatchObject({
      kind: 'job',
      kicker: 'Not visited · Job',
      name: 'Software Engineer',
      sub: 'ANZSCO 261313',
      secondary: 'Close',
    })
    expect(job.primary).toBeUndefined()
    expect(primaryAction(road, scene, courses[0])).toBeNull()
    expect(primaryAction(road, scene, jobs[0])).toBeNull()
  })
})
