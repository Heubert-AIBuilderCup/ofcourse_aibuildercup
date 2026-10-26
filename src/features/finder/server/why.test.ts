// A finder card's why, written by the model (criterion 6), with the fake provider and an in-memory
// call log and cache: no network, no database. Code checks the answer; anything else, a failure
// or a late answer, gives the template.

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from '@/features/content/ai/client'

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
mock.module('@/features/content/ai/client', () => ({ ...client, ai: memoryAi }))

const { writeFinderWhy } = await import('./why')
const { FINDER_EXTRAS } = await import('../data/catalogue')
const { finderWhyProblems, finderWhyTemplate, quoteFound } = await import('../model/why')
const { STUDENT_FINDER_WHY } = await import('@/features/content/ai/prompts')
const { toModelSchema } = await import('@/features/content/ai/schema-guard')

const EXTRA = FINDER_EXTRAS[0]
let seen: { useCase: string; data: unknown }[] = []

beforeEach(() => {
  store.clear()
  seen = []
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

describe('writeFinderWhy (criterion 6)', () => {
  it("returns the model's why with a quote found in that course's description", async () => {
    const res = await writeFinderWhy('I like puzzles', EXTRA.courseId)
    expect(res?.source).toBe('model')
    expect(res?.courseId).toBe(EXTRA.courseId)
    expect(quoteFound(res?.quote ?? '', EXTRA.description)).toBe(true)
    expect(typeof res?.ms).toBe('number')
    expect(seen.map((s) => s.useCase)).toEqual(['student_finder_why'])
  })

  it('stores none of her words in the cache', async () => {
    await writeFinderWhy('I like puzzles', EXTRA.courseId)
    expect(store.size).toBe(0)
  })

  it('gives the template when the model fails', async () => {
    const said = 'I like puzzles [fake:fail-student_finder_why]'
    const res = await writeFinderWhy(said, EXTRA.courseId)
    expect(res?.source).toBe('template')
    expect(res?.text).toBe(finderWhyTemplate(said, EXTRA.description))
    expect(res?.quote).toBeNull()
  })

  it('returns null for a course the catalogue does not have, with no model call', async () => {
    expect(await writeFinderWhy('I like puzzles', 'no-such-course')).toBeNull()
    expect(seen.length).toBe(0)
  })

  it('gives the template once its deadline passes, and ignores the late answer', async () => {
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
    const res = await writeFinderWhy('I like puzzles', EXTRA.courseId, 1)
    expect(res?.source).toBe('template')
    expect(res?.text).toBe(finderWhyTemplate('I like puzzles', EXTRA.description))
    // A late answer that fails the checks would send the ladder to its next rung.
    answer('not json')
    await Bun.sleep(20)
    expect(seen.length).toBe(1)
  })
})

describe('STUDENT_FINDER_WHY', () => {
  it('has an example its schema accepts and its checks pass, and passes the schema guard', () => {
    const answer = STUDENT_FINDER_WHY.schema.parse(STUDENT_FINDER_WHY.example.answer)
    expect(() => toModelSchema(STUDENT_FINDER_WHY.schema)).not.toThrow()
    const data = STUDENT_FINDER_WHY.example.data as { course: { description: string } }
    expect(finderWhyProblems(answer, data.course.description)).toEqual([])
  })
})
