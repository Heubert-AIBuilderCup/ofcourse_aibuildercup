// The images planned in words (GD12), with the fake provider and an in-memory call log and cache:
// no network, no database. Code checks one scene per art box, each short and free of what the
// art prompt guard refuses.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog } from './client'

process.env.AI_PROVIDER = 'fake'

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
mock.module('./calls', () => ({ dbCallLog: memoryCalls }))
mock.module('./cache', () => ({ dbCache: memoryCache }))

const client = await import('./client')
const { aiConfig } = await import('./config')
const { makeFake } = await import('./fake')
const fake = makeFake()
/** The DATA of every scene plan call that reached the model, in order. */
const sent: unknown[] = []
const memoryAi = client.makeAi({
  provider: {
    json: (req) => {
      if (req.useCase === 'scene_plan') sent.push(req.data)
      return fake.json(req)
    },
    image: (req) => fake.image(req),
  },
  config: aiConfig(process.env),
  calls: memoryCalls,
  cache: memoryCache,
  sleep: async () => {},
})
mock.module('./client', () => ({ ...client, ai: memoryAi }))

const { planScenes, SCENE_MAX, scenePlanProblems } = await import('./scene-plan')
const { NATIVE_IDS, nativeOf } = await import('../text/native-fixtures')
const { SCENE_PLAN } = await import('./prompts')
const { toModelSchema } = await import('./schema-guard')
const { guidelineFor } = await import('../brands/guideline')
const { templateById } = await import('../templates')

type Template = import('../model/types').Template
type Structure = import('../model/types').Structure

function look(id: string): Template {
  const t = templateById(id)
  if (!t) throw new Error(`${id} missing`)
  return t
}

const KIND = { cover: 'cover', takeaway: 'take' } as Record<string, 'cover' | 'take'>
const structure = (id: string, layouts: string[]): Structure => ({
  templateId: id,
  artPrompt: '',
  slides: layouts.map((layout, i) => ({
    kind: KIND[layout] ?? 'body',
    layout: layout as Structure['slides'][number]['layout'],
    slots: { heading: { text: `Heading of slide ${i + 1}`, factIds: [], factual: false } },
  })),
})

const scene = (slide: number, text = 'A student reading at a desk by a window.') => ({
  slide,
  scene: text,
})

beforeEach(() => {
  store.clear()
  sent.length = 0
})

describe('the scene plan spec', () => {
  it('has an example that parses with its own schema, passes the schema guard and its own checks', () => {
    expect(SCENE_PLAN.schema.safeParse(SCENE_PLAN.example.answer).success).toBe(true)
    expect(() => toModelSchema(SCENE_PLAN.schema)).not.toThrow()
    expect(SCENE_PLAN).toMatchObject({
      useCase: 'scene_plan',
      version: 'scene_plan.v1',
      tier: 'lite',
    })
    const data = SCENE_PLAN.example.data as { slides: { slide: number }[]; panorama: boolean }
    const answer = SCENE_PLAN.schema.parse(SCENE_PLAN.example.answer)
    const expected = { slides: data.slides.map((s) => s.slide), panorama: data.panorama }
    expect(scenePlanProblems(answer, expected)).toEqual([])
  })
})

describe('scenePlanProblems (GD12)', () => {
  const expected = { slides: [1, 2, 4], panorama: false }

  it('passes one clean scene per art-box slide', () => {
    expect(scenePlanProblems({ scenes: [scene(1), scene(2), scene(4)] }, expected)).toEqual([])
  })

  it('fails a scene with a digit, a quote mark or a brand name', () => {
    for (const text of [
      'Three students and 2 laptops.',
      'A sign reading “open”.',
      'An OfCourse mug.',
    ]) {
      const problems = scenePlanProblems({ scenes: [scene(1), scene(2, text), scene(4)] }, expected)
      expect(problems.some((p) => p.startsWith('scenes.1.scene'))).toBe(true)
    }
  })

  it(`fails a scene over ${SCENE_MAX} characters, an empty one, a missing slide and a repeated one`, () => {
    const long = `A ${'very '.repeat(50)}long scene.`
    expect(scenePlanProblems({ scenes: [scene(1, long), scene(2), scene(4)] }, expected)).toEqual([
      `scenes.0.scene: ${long.length} characters; at most ${SCENE_MAX}.`,
    ])
    expect(
      scenePlanProblems({ scenes: [scene(1, ' '), scene(2), scene(4)] }, expected).length,
    ).toBeGreaterThan(0)
    expect(scenePlanProblems({ scenes: [scene(1), scene(2)] }, expected).length).toBeGreaterThan(0)
    expect(
      scenePlanProblems({ scenes: [scene(1), scene(2), scene(2)] }, expected).length,
    ).toBeGreaterThan(0)
    expect(
      scenePlanProblems({ scenes: [scene(1), scene(2), scene(3)] }, expected).length,
    ).toBeGreaterThan(0)
  })

  it('takes a Nepali, Hindi or Thai scene of 200 characters as a reader sees them (GD37)', () => {
    for (const id of NATIVE_IDS) {
      const native = nativeOf(id, SCENE_MAX)
      const plan = { scenes: [scene(1, native), scene(2), scene(4)] }
      expect(scenePlanProblems(plan, expected), id).toEqual([])
    }
  })

  it('wants exactly one scene, for slide 1, across a panorama', () => {
    const wide = { slides: [1], panorama: true }
    expect(scenePlanProblems({ scenes: [scene(1)] }, wide)).toEqual([])
    expect(scenePlanProblems({ scenes: [scene(1), scene(2)] }, wide).length).toBeGreaterThan(0)
    expect(scenePlanProblems({ scenes: [scene(2)] }, wide).length).toBeGreaterThan(0)
  })
})

describe('planScenes (GD12)', () => {
  it('plans one scene per art-box slide of a look, sending each slide’s text and layout, the idea, the look, the emotion and the guideline', async () => {
    const template = look('field-notes')
    const s = structure('field-notes', ['cover', 'picture', 'number', 'picture', 'takeaway'])
    const idea = [
      {
        angle: 'Late study',
        hook: 'The library stays open.',
        audience: 'Students',
        look: 'field-notes' as const,
        slides: 5,
      },
    ]
    const res = await planScenes({ template, structure: s, idea, emotion: 'calm', postId: 'p' })
    if (!res.ok) throw new Error(res.error)
    expect(res.panorama).toBe(false)
    expect(res.scenes.map((x) => x.slide)).toEqual([1, 2, 4])
    for (const x of res.scenes) expect(x.scene.length).toBeLessThanOrEqual(SCENE_MAX)

    const data = sent[0] as Record<string, unknown>
    expect(data.guideline).toBe(guidelineFor('image'))
    expect(data.look).toMatchObject({ id: 'field-notes', name: template.name })
    expect(data.idea).toEqual([{ angle: 'Late study', hook: 'The library stays open.' }])
    expect(data.emotion).toBe('Calm')
    expect(data.panorama).toBe(false)
    expect(data.slides).toEqual([
      { slide: 1, layout: 'cover', text: ['Heading of slide 1'] },
      { slide: 2, layout: 'picture', text: ['Heading of slide 2'] },
      { slide: 4, layout: 'picture', text: ['Heading of slide 4'] },
    ])
  })

  it('asks only for the slides it is given, when the others keep their scenes (story 14)', async () => {
    const s = structure('field-notes', ['cover', 'picture', 'picture', 'picture', 'takeaway'])
    const res = await planScenes({
      template: look('field-notes'),
      structure: s,
      idea: null,
      emotion: null,
      postId: 'p',
      slides: [3],
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.scenes.map((x) => x.slide)).toEqual([3])
    expect((sent[0] as { slides: unknown[] }).slides).toEqual([
      { slide: 3, layout: 'picture', text: ['Heading of slide 3'] },
    ])
  })

  it('plans one wide scene for Postcard, from every slide', async () => {
    const s = structure('postcard', ['cover', 'picture', 'number', 'takeaway'])
    const res = await planScenes({
      template: look('postcard'),
      structure: s,
      idea: null,
      emotion: null,
      postId: 'p',
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.panorama).toBe(true)
    expect(res.scenes).toHaveLength(1)
    expect(res.scenes[0].slide).toBe(1)
    const data = sent[0] as { panorama: boolean; slides: unknown[]; idea: unknown }
    expect(data.panorama).toBe(true)
    expect(data.slides).toHaveLength(4)
    expect(data.idea).toBeNull()
  })
})
