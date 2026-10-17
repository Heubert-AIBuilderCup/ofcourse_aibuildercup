// The feed's updates for one student, read from the live updates and her roadmaps: each roadmap's
// courses come from the road its answers match, and a failing read gives none rather than a broken
// feed. The two reads are fakes: no database.

import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { DRAWN_TO_AREAS } from '@/features/opening/model/questions'
import { courseById } from '@/features/roads/data/courses'
import { roadById } from '@/features/roads/data/roads'
import { DEMO_PROFILES } from '@/features/roads/model/demo-profiles'
import type { Roadmap, StoredAnswers } from '@/shared/types/student'
import { ALL_INSTITUTIONS, ALL_TOPICS, topicName } from '../lib/audience'
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

const update = (
  id: string,
  institution: string,
  homeCountry: string | null = null,
  topic: string = ALL_TOPICS,
) =>
  ({
    ...DEMO_DRAFT,
    id,
    status: 'live',
    institution,
    audience: { institution, homeCountry, topic },
  }) as StoredUpdate

/** Her answers saying she is drawn to `areas` (stated, or stored as assumed), with no field named. */
const { field: _field, ...unnamed } = PERTH.answers
const drawnTo = (areas: string[], state: 'stated' | 'assumed' = 'stated'): StoredAnswers => ({
  ...unnamed,
  know: { value: DRAWN_TO_AREAS, state },
  areas: { value: areas, state },
})

const roadmapOf = (id: string, name: string | null, answers = PERTH.answers, choices = {}) =>
  ({ id, name, answers, relative: PERTH.relative, choices }) as Roadmap

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

  it('reads a pinned roadmap’s institutions from the road around its pinned course', async () => {
    const pinned = university('uts-cyber')
    const perth = university(SPEC.courseId)
    updates = [update('pinned', pinned), update('perth', perth)]
    roadmaps = [
      roadmapOf('r1', 'Mine', PERTH.answers, {
        pinned: { courseId: 'uts-cyber', cityId: 'sydney' },
      }),
    ]
    const found = await readFeedUpdates('u-1', sources())
    expect(found.map((f) => f.update.id)).toEqual(['pinned'])
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

  it("reads a roadmap's course topics from its course, alternative and stacked course", async () => {
    // perth-cyber: a cyber course with IT alternatives; her own answers name only Cyber security.
    updates = [
      update('it', ALL_INSTITUTIONS, null, 'it'),
      update('cyber', ALL_INSTITUTIONS, null, 'cyber'),
      update('health', ALL_INSTITUTIONS, null, 'health'),
    ]
    roadmaps = [roadmapOf('r1', 'Mine')]
    const found = await readFeedUpdates('u-1', sources())
    expect(found.map((f) => [f.update.id, f.why])).toEqual([
      ['it', `Because ${topicName('it')} is on your roadmap "Mine"`],
      ['cyber', `Because ${topicName('cyber')} is on your roadmap "Mine"`],
    ])
  })

  it('reads the fields she said she is drawn to, never an assumed answer', async () => {
    // IT and Health: the road is perth-cyber, so Health reaches her only as an interest.
    updates = [update('health', ALL_INSTITUTIONS, null, 'health')]
    roadmaps = [roadmapOf('r1', 'Mine', drawnTo(['IT and computing', 'Health']))]
    const [found] = await readFeedUpdates('u-1', sources())
    expect(found?.why).toBe(`Because you said you're drawn to ${topicName('health')}`)

    roadmaps = [roadmapOf('r1', 'Mine', drawnTo(['IT and computing', 'Health'], 'assumed'))]
    expect((await readFeedUpdates('u-1', sources())).length).toBe(0)
  })

  it('keeps a roadmap with no matched road, reached only through her stated interests', async () => {
    updates = [
      update('health', ALL_INSTITUTIONS, null, 'health'),
      update('all', ALL_INSTITUTIONS),
      update('main', university(SPEC.courseId)),
      update('cyber', ALL_INSTITUTIONS, null, 'cyber'),
    ]
    roadmaps = [roadmapOf('r1', 'Mine', drawnTo(['Health']))]
    const off = sources({ STUDENT_ROADS_OFF: '1' })
    const found = await readFeedUpdates('u-1', off)
    expect(found.map((f) => [f.update.id, f.roadmapId, f.why])).toEqual([
      ['health', 'r1', `Because you said you're drawn to ${topicName('health')}`],
    ])

    roadmaps = [roadmapOf('r1', 'Mine', drawnTo(['Health'], 'assumed'))]
    expect(await readFeedUpdates('u-1', off)).toEqual([])
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

describe('readFeedUpdates with a roadmap pinned to a finder course', () => {
  // Finder courses resolve only once the server module has registered them; loaded under a key of
  // its own (Bun caches a module by its specifier, query included), so it registers here whichever
  // test file loaded it first.
  const key = 'feed-updates=1'
  beforeAll(() => import(`@/features/finder/server/road-courses?${key}`))

  it("reads its course topics from the pinned course's road, so a topic update reaches it", async () => {
    // Her answers draw perth-cyber (cyber and IT); only the pin brings Psychology onto the road.
    updates = [update('psych', ALL_INSTITUTIONS, null, 'psych')]
    roadmaps = [roadmapOf('r1', 'Mine')]
    expect((await readFeedUpdates('u-1', sources())).length).toBe(0)

    roadmaps = [
      roadmapOf('r1', 'Mine', PERTH.answers, {
        pinned: { courseId: 'f-master-of-cyber-psychology-utas-sandy-bay', cityId: 'hobart' },
      }),
    ]
    const found = await readFeedUpdates('u-1', sources())
    expect(found.map((f) => [f.update.id, f.roadmapId, f.why])).toEqual([
      ['psych', 'r1', `Because ${topicName('psych')} is on your roadmap "Mine"`],
    ])
  })
})
