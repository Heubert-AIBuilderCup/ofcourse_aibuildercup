// The feed's updates for one student, read from the live updates and her roadmaps: each roadmap's
// courses come from the road its answers match, and a failing read gives none rather than a broken
// feed. The two reads are fakes: no database.

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { courseById } from '@/features/roads/data/courses'
import { roadById } from '@/features/roads/data/roads'
import { DEMO_PROFILES } from '@/features/roads/model/demo-profiles'
import type { Roadmap } from '@/shared/types/student'
import { ALL_INSTITUTIONS } from '../lib/audience'
import { DEMO_DRAFT, type StoredUpdate } from '../lib/update'

let updates: StoredUpdate[] = []
let roadmaps: Roadmap[] = []
const listLiveUpdates = mock(async () => updates)
const listRoadmaps = mock(async (_userId: string) => roadmaps)

mock.module('server-only', () => ({}))

const { readFeedUpdates } = await import('./feed-updates')

const PERTH = DEMO_PROFILES.find((p) => p.roadId === 'perth-cyber')
const SPEC = roadById('perth-cyber')
if (!PERTH || !SPEC) throw new Error('perth-cyber road missing')
const university = (id: string) => courseById(id)?.university ?? ''

const update = (id: string, institution: string, homeCountry: string | null = null) =>
  ({
    ...DEMO_DRAFT,
    id,
    status: 'live',
    institution,
    audience: { institution, homeCountry },
  }) as StoredUpdate

const roadmapOf = (id: string, name: string | null, answers = PERTH.answers) =>
  ({ id, name, answers, relative: PERTH.relative }) as Roadmap

const sources = (env: Record<string, string | undefined> = {}) => ({
  listLiveUpdates,
  listRoadmaps,
  env,
})

let logged: ReturnType<typeof spyOn>
beforeEach(() => {
  updates = []
  roadmaps = []
  listLiveUpdates.mockClear()
  listRoadmaps.mockClear()
  logged = spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  logged.mockRestore()
})

describe('readFeedUpdates', () => {
  it("reads her roadmaps' institutions from the courses on their roads", async () => {
    const main = university(SPEC.courseId)
    const alt = university(SPEC.altCourseId)
    updates = [update('main', main), update('other', 'Monash'), update('alt', alt)]
    roadmaps = [roadmapOf('r1', 'Mine')]
    const found = await readFeedUpdates('u-1', sources())
    expect(listRoadmaps).toHaveBeenCalledWith('u-1')
    expect(found.map((f) => [f.update.id, f.roadmapId, f.why])).toEqual([
      ['main', 'r1', `Because ${main} is on your roadmap "Mine"`],
      ['alt', 'r1', `Because ${alt} is on your roadmap "Mine"`],
    ])
  })

  it('reads her country from the answers of the roadmap', async () => {
    updates = [update('india', ALL_INSTITUTIONS, 'India')]
    roadmaps = [roadmapOf('r1', 'Mine')]
    expect((await readFeedUpdates('u-1', sources())).length).toBe(0)
    roadmaps = [
      roadmapOf('r1', 'Mine', { ...PERTH.answers, where: { value: 'India', state: 'stated' } }),
    ]
    expect((await readFeedUpdates('u-1', sources())).length).toBe(1)
  })

  it('names a roadmap she has not named as her list does, from where she is on its road', async () => {
    updates = [update('main', university(SPEC.courseId))]
    roadmaps = [roadmapOf('r1', null)]
    const [found] = await readFeedUpdates('u-1', sources())
    expect(found?.why).not.toContain('"New roadmap"')
    expect(found?.why).toMatch(/is on your roadmap ".+ in .+"$/)
  })

  it('finds none through a roadmap with no matched road (the roads off)', async () => {
    updates = [update('all', ALL_INSTITUTIONS)]
    roadmaps = [roadmapOf('r1', 'Mine')]
    expect(await readFeedUpdates('u-1', sources({ STUDENT_ROADS_OFF: '1' }))).toEqual([])
  })

  it('gives none, and logs, when a read fails: never throws', async () => {
    roadmaps = [roadmapOf('r1', 'Mine')]
    listLiveUpdates.mockImplementationOnce(async () => {
      throw new Error('db down')
    })
    expect(await readFeedUpdates('u-1', sources())).toEqual([])
    expect(logged).toHaveBeenCalled()

    updates = [update('all', ALL_INSTITUTIONS)]
    listRoadmaps.mockImplementationOnce(async () => {
      throw new Error('db down')
    })
    expect(await readFeedUpdates('u-1', sources())).toEqual([])
  })
})
