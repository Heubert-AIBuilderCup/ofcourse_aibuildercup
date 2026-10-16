// Why a tile is on her road, written by the model (criteria 15, 17, 18, 19, 20), with the fake
// provider and an in-memory call log and cache: no network, no database. Her roadmap comes from
// a mocked repository, so a roadmap that is not hers is the repository's null. The action is
// proven here too: who it refuses, and that a refusal makes no model call.

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from '@/features/content/ai/client'
import type { Roadmap } from '@/shared/types/student'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '1000'

const store = new Map<string, unknown>()
const memoryCache: Cache = {
  get: async (key) => store.get(key) ?? null,
  put: async (key, row) => {
    store.set(key, row.value)
  },
}
const memoryCalls: CallLog = {
  countToday: async () => 0,
  record: async () => {},
  reserve: async () => 'reserved',
  settle: async () => {},
}

mock.module('server-only', () => ({}))
mock.module('@/features/content/ai/calls', () => ({ dbCallLog: memoryCalls }))
mock.module('@/features/content/ai/cache', () => ({ dbCache: memoryCache }))

const client = await import('@/features/content/ai/client')
const { aiConfig } = await import('@/features/content/ai/config')
const { makeFake } = await import('@/features/content/ai/fake')
const fakeProvider = makeFake()
let provider: Provider = fakeProvider
const memoryAi = client.makeAi({
  provider: { json: (req) => provider.json(req), image: (req) => provider.image(req) },
  config: aiConfig(process.env),
  calls: memoryCalls,
  cache: memoryCache,
})
/** What each generateJson call answered: `cached` shows a cache hit. */
let results: { ok: boolean; cached?: boolean }[] = []
const recordingAi: typeof memoryAi = {
  ...memoryAi,
  generateJson: async (spec, req) => {
    const res = await memoryAi.generateJson(spec, req)
    results.push(res.ok ? { ok: true, cached: res.cached } : { ok: false })
    return res
  },
}
mock.module('@/features/content/ai/client', () => ({ ...client, ai: recordingAi }))

/** The roadmap the repository gives: null when it is not hers. */
let found: Roadmap | null = null
const getRoadmap = mock(async (_userId: string, _id: string) => found)
const none = async () => null
// Every export the module has, as Bun keeps one mock of a module for the whole run.
mock.module('@/features/roadmaps/server/roadmaps', () => ({
  getRoadmap,
  getDraft: none,
  ensureDraft: none,
  finishRoadmap: none,
  listRoadmaps: async () => [],
  renameRoadmap: none,
  softDeleteRoadmap: none,
  archiveRoadmap: none,
  hasArchived: none,
  restoreArchived: none,
  restoreRoadmap: none,
  touchOpened: none,
  saveChoices: none,
  saveRoadmapAnswers: none,
  createRoadmap: none,
  saveOwnWords: none,
  addTags: async () => {},
}))

type FakeSession = { user: { id: string; role: string | null } } | null
let session: FakeSession = null
mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))

const { writeWhy } = await import('./why')
const { roadWhyAction } = await import('../actions')
const { WHY_PER_HOUR } = await import('./why-limit')
const { DEMO_PROFILES } = await import('../model/demo-profiles')
const { roadById } = await import('../data/roads')
const { asksFor } = await import('../data/asks')
const { whyFacts, whyProblems, whyTemplate } = await import('../model/why')
const { STUDENT_WHY } = await import('@/features/content/ai/prompts')
const { toModelSchema } = await import('@/features/content/ai/schema-guard')

const PERTH = roadById('perth-cyber')
if (!PERTH) throw new Error('perth-cyber road missing')
const PROFILE_1 = DEMO_PROFILES[0]
const COURSE_TILE = PERTH.slots.course.id
const TEMPLATE = whyTemplate(PERTH, 'course', PROFILE_1.answers)

const roadmap = (over: Partial<Roadmap> = {}): Roadmap => ({
  id: 'rm-1',
  name: null,
  answers: PROFILE_1.answers,
  relative: PROFILE_1.relative,
  coins: { state: 'later' },
  choices: {},
  ownWords: {},
  tags: [],
  lastStep: 'attention',
  copiedFrom: null,
  createdAt: new Date('2026-10-14T09:00:00Z'),
  finishedAt: new Date('2026-10-14T09:10:00Z'),
  lastOpenedAt: null,
  archivedAt: null,
  ...over,
})

let seen: { useCase: string; data: unknown }[] = []
const ENV = {}

beforeEach(() => {
  store.clear()
  seen = []
  results = []
  found = roadmap()
  session = { user: { id: 'student-1', role: 'user' } }
  getRoadmap.mockClear()
  provider = {
    json: async (req) => {
      seen.push({ useCase: req.useCase, data: req.data })
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
})
afterEach(() => {
  provider = fakeProvider
})

describe('writeWhy (15, 17, 18, 20)', () => {
  it("returns the model's text for a why tile on her roadmap", async () => {
    const res = await writeWhy('student-1', 'rm-1', COURSE_TILE, ENV)
    expect(getRoadmap).toHaveBeenCalledWith('student-1', 'rm-1')
    expect(seen).toHaveLength(1)
    expect(seen[0].useCase).toBe('student_why')
    expect(seen[0].data).toEqual(
      whyFacts(PERTH, 'course', PROFILE_1.answers, [], {
        differences: [],
        relative: PROFILE_1.relative,
      }),
    )
    expect(res?.source).toBe('model')
    expect(res?.text).not.toBe(TEMPLATE)
    expect(res?.text.trim()).not.toBe('')
  })

  it('gives the tag texts to the model', async () => {
    found = roadmap({
      tags: [{ text: 'Near her cousin', quote: 'my cousin', step: 'living', wellbeing: false }],
    })
    await writeWhy('student-1', 'rm-1', COURSE_TILE, ENV)
    expect((seen[0].data as { tags: string[] }).tags).toEqual(['Near her cousin'])
  })

  it('never gives the model a wellbeing tag (ADR-088)', async () => {
    found = roadmap({
      tags: [
        { text: 'Near her cousin', quote: 'my cousin', step: 'living', wellbeing: false },
        {
          text: 'Worried about being lonely',
          quote: 'I get lonely',
          step: 'living',
          wellbeing: true,
        },
      ],
    })
    await writeWhy('student-1', 'rm-1', COURSE_TILE, ENV)
    expect(JSON.stringify(seen[0].data)).not.toContain('lonely')
    expect((seen[0].data as { tags: string[] }).tags).toEqual(['Near her cousin'])
  })

  it('answers the same card again from the cache, with no new model call', async () => {
    const first = await writeWhy('student-1', 'rm-1', COURSE_TILE, ENV)
    const size = store.size
    const second = await writeWhy('student-1', 'rm-1', COURSE_TILE, ENV)
    expect(second).toEqual(first)
    expect(seen).toHaveLength(1)
    expect(store.size).toBe(size)
    expect(results.map((r) => r.cached)).toEqual([false, true])
  })

  it('falls back to the template when every rung, lite then flash and never pro, calls a city best', async () => {
    provider = {
      json: async (req) => {
        seen.push({ useCase: req.useCase, data: req.data })
        return JSON.stringify({ why: 'Perth is the best city for you.', used: [] })
      },
      image: fakeProvider.image,
    }
    const res = await writeWhy('student-1', 'rm-1', COURSE_TILE, ENV)
    expect(res).toEqual({ text: TEMPLATE, source: 'template' })
    expect(seen).toHaveLength(2)
  })

  it('falls back to the template when every rung gives one of her tags as the reason (criterion 66)', async () => {
    found = roadmap({
      tags: [{ text: 'Near the beach', quote: 'the beach', step: 'living', wellbeing: false }],
    })
    provider = {
      json: async (req) => {
        seen.push({ useCase: req.useCase, data: req.data })
        return JSON.stringify({
          why: 'Perth is on your roadmap because you want to live near the beach.',
          used: [],
        })
      },
      image: fakeProvider.image,
    }
    const res = await writeWhy('student-1', 'rm-1', PERTH.slots.city.id, ENV)
    const match = { differences: [], relative: PROFILE_1.relative }
    expect(res).toEqual({
      text: whyTemplate(PERTH, 'city', PROFILE_1.answers, match),
      source: 'template',
    })
    expect(seen).toHaveLength(2)
  })

  it('gives the model the rules that chose the tile, from her match (criterion 64)', async () => {
    await writeWhy('student-1', 'rm-1', PERTH.slots.city.id, ENV)
    expect((seen[0].data as { chosenBy: string[] }).chosenBy).toEqual([
      "you said you'd stay",
      'Perth: where the person you know lives',
    ])
  })

  it('falls back to the template when the model fails', async () => {
    found = roadmap({
      tags: [{ text: '[fake:fail-student_why]', quote: 'x', step: 'facts', wellbeing: false }],
    })
    const res = await writeWhy('student-1', 'rm-1', COURSE_TILE, ENV)
    expect(res).toEqual({ text: TEMPLATE, source: 'template' })
  })

  it('writes nothing for a tile that is not a why slot', async () => {
    for (const slot of ['point-a', 'australia', 'visa-500', 'visa-485', 'fork'] as const) {
      expect(await writeWhy('student-1', 'rm-1', PERTH.slots[slot].id, ENV)).toBeNull()
    }
    expect(await writeWhy('student-1', 'rm-1', 'no-such-tile', ENV)).toBeNull()
    expect(seen).toHaveLength(0)
  })

  it('writes nothing for a roadmap that is not hers', async () => {
    found = null
    expect(await writeWhy('student-2', 'rm-1', COURSE_TILE, ENV)).toBeNull()
    expect(seen).toHaveLength(0)
  })

  for (const [i, profile] of DEMO_PROFILES.entries()) {
    it(`demo profile ${i + 1} gets its road's why from the model, and asks for its city and course (criterion 10)`, async () => {
      const spec = roadById(profile.roadId)
      if (!spec) throw new Error(`${profile.roadId} road missing`)
      found = roadmap({ answers: profile.answers, relative: profile.relative })
      const res = await writeWhy('student-1', 'rm-1', spec.slots.course.id, ENV)
      expect(res?.source).toBe('model')
      expect(res?.text.trim()).not.toBe('')
      expect(asksFor({ kind: 'city', cityId: spec.cityId }).length).toBeGreaterThan(0)
      expect(asksFor({ kind: 'course', courseId: spec.courseId }).length).toBeGreaterThan(0)
    })
  }

  it('gives the template once its deadline passes, ignores the late answer and starts no retry (criterion 80)', async () => {
    let answer: (text: string) => void = () => {}
    const late = new Promise<string>((resolve) => {
      answer = resolve
    })
    provider = {
      json: async (req) => {
        seen.push({ useCase: req.useCase, data: req.data })
        return late
      },
      image: fakeProvider.image,
    }
    const res = await writeWhy('student-1', 'rm-1', COURSE_TILE, ENV, true, 20)
    expect(res).toEqual({ text: TEMPLATE, source: 'template' })
    expect(seen).toHaveLength(1)
    // A late answer that fails the checks would send the ladder to its next rung.
    answer('not json')
    await Bun.sleep(20)
    expect(seen).toHaveLength(1)
  })

  it('gives the template with no model call when the student AI is off (criterion 81)', async () => {
    const res = await writeWhy('student-1', 'rm-1', COURSE_TILE, { STUDENT_AI_OFF: '1' })
    expect(res).toEqual({ text: TEMPLATE, source: 'template' })
    expect(seen).toHaveLength(0)
  })

  it('writes nothing with the student side switched off', async () => {
    const res = await writeWhy('student-1', 'rm-1', COURSE_TILE, { STUDENT_ROADS_OFF: '1' })
    expect(res).toBeNull()
    expect(seen).toHaveLength(0)
  })
})

describe('roadWhyAction', () => {
  it('returns the why for her own roadmap', async () => {
    const res = await roadWhyAction('rm-1', COURSE_TILE)
    expect(res).toMatchObject({ ok: true, source: 'model' })
    expect(getRoadmap).toHaveBeenCalledWith('student-1', 'rm-1')
  })

  it('refuses a visitor who is not signed in, and one who is not a student, with no model call', async () => {
    session = null
    expect(await roadWhyAction('rm-1', COURSE_TILE)).toMatchObject({ ok: false })
    session = { user: { id: 'admin-1', role: 'admin' } }
    expect(await roadWhyAction('rm-1', COURSE_TILE)).toMatchObject({ ok: false })
    expect(getRoadmap).not.toHaveBeenCalled()
    expect(seen).toHaveLength(0)
  })

  it("refuses another student's roadmap and a malformed id, with no model call", async () => {
    found = null
    expect(await roadWhyAction('rm-1', COURSE_TILE)).toEqual({ ok: false, error: 'Not found' })
    expect(await roadWhyAction('x'.repeat(65), COURSE_TILE)).toEqual({
      ok: false,
      error: 'Not found',
    })
    expect(seen).toHaveLength(0)
  })

  it('gives a student over her hourly limit the template, with no model call; others still ask', async () => {
    session = { user: { id: 'student-busy', role: 'user' } }
    for (let i = 0; i < WHY_PER_HOUR; i++) {
      expect(await roadWhyAction('rm-1', COURSE_TILE)).toMatchObject({ ok: true })
    }
    store.clear()
    seen = []
    expect(await roadWhyAction('rm-1', COURSE_TILE)).toEqual({
      ok: true,
      text: TEMPLATE,
      source: 'template',
    })
    expect(seen).toHaveLength(0)

    session = { user: { id: 'student-calm', role: 'user' } }
    expect(await roadWhyAction('rm-1', COURSE_TILE)).toMatchObject({ ok: true, source: 'model' })
    expect(seen).toHaveLength(1)
  })

  it('still refuses a roadmap that is not hers once she is over the limit', async () => {
    session = { user: { id: 'student-busier', role: 'user' } }
    for (let i = 0; i < WHY_PER_HOUR; i++) await roadWhyAction('rm-1', COURSE_TILE)
    found = null
    expect(await roadWhyAction('rm-1', COURSE_TILE)).toEqual({ ok: false, error: 'Not found' })
  })
})

describe('the student why spec', () => {
  it('the fake writes "your roadmap", never "your road", even with no fact to give', async () => {
    const { FAKE_ANSWERS } = await import('@/features/content/ai/fake')
    const fake = FAKE_ANSWERS.student_why
    if (!fake) throw new Error('the fake has no student_why')
    for (const data of [
      { answers: [], facts: [] },
      whyFacts(PERTH, 'course', PROFILE_1.answers, []),
    ]) {
      const { why } = fake(data) as { why: string }
      expect(why).not.toMatch(/your road(?!map)/i)
    }
  })

  it('has an example its schema accepts and its checks pass, and passes the schema guard', () => {
    const answer = STUDENT_WHY.schema.parse(STUDENT_WHY.example.answer)
    expect(() => toModelSchema(STUDENT_WHY.schema)).not.toThrow()
    expect(STUDENT_WHY).toMatchObject({
      useCase: 'student_why',
      version: 'student_why.v5',
      tier: 'lite',
      maxTier: 'flash',
      temperature: 0.2,
    })
    const data = STUDENT_WHY.example.data as Parameters<typeof whyProblems>[1]
    expect(whyProblems(answer.why, data, answer.used)).toEqual([])
  })
})
