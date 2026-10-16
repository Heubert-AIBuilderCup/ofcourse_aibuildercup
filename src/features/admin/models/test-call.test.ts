// The Models page's test calls (criteria 93, 94): each one through a client of its own around a
// stub or the fake provider, with an in-memory log, cache and settings. No network, no database.

import { describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from '@/features/content/ai/client'
import type { AiSettings } from '@/features/content/ai/settings'

mock.module('server-only', () => ({}))

const { makeTestCalls } = await import('./test-call')
const { aiConfig } = await import('@/features/content/ai/config')
const { makeFake } = await import('@/features/content/ai/fake')
const { EXTRACT } = await import('@/features/content/ai/prompts')
const { CHECK_CASES } = await import('@/features/roads/evals/check-cases')

type JsonReq = Parameters<Provider['json']>[0]
type ImageReq = Parameters<Provider['image']>[0]
type Row = Parameters<CallLog['record']>[0]

const config = aiConfig({
  AI_PROVIDER: 'fake',
  GEMINI_LITE_MODEL: 'lite-model',
  GEMINI_FLASH_MODEL: 'flash-model',
  GEMINI_PRO_MODEL: 'pro-model',
  GEMINI_IMAGE_MODEL: 'image-model',
  AI_DAILY_CAP_PRO: '5',
  AI_DAILY_CAP_IMAGE: '5',
})

const EXTRACT_ANSWER = JSON.stringify(EXTRACT.example.answer)

function setup(
  opts: {
    answers?: Array<string | Error>
    images?: Array<Uint8Array | Error>
    saved?: Partial<AiSettings>
    provider?: Provider
  } = {},
) {
  const answers = [...(opts.answers ?? [])]
  const images = [...(opts.images ?? [])]
  const reqs: JsonReq[] = []
  const imageReqs: ImageReq[] = []
  const inner: Provider = opts.provider ?? {
    json: async () => {
      const next = answers.shift()
      if (next === undefined) throw new Error('no answer left')
      if (next instanceof Error) throw next
      return next
    },
    image: async () => {
      const next = images.shift()
      if (next === undefined) throw new Error('no image left')
      if (next instanceof Error) throw next
      return next
    },
  }
  const provider: Provider = {
    json: (req) => {
      reqs.push(req)
      return inner.json(req)
    },
    image: (req) => {
      imageReqs.push(req)
      return inner.image(req)
    },
  }
  const rows: Row[] = []
  const calls: CallLog = {
    countToday: async () => 0,
    record: async (row) => {
      rows.push(row)
    },
    reserve: async ({ day: _day, cap: _cap, useCases: _useCases, ...row }) => {
      rows.push({ ...row, ok: false, cached: false, ms: 0, fallback: null })
      return String(rows.length - 1)
    },
    settle: async (id, outcome) => {
      Object.assign(rows[Number(id)], outcome)
    },
  }
  const cacheGet = mock(async (_key: string) => null)
  const cachePut = mock(async () => {})
  const cache: Cache = { get: cacheGet, put: cachePut }
  const saved: AiSettings = { tierModels: {}, useCaseTiers: {}, failing: {}, ...opts.saved }
  const marked: string[] = []
  const tests = makeTestCalls({
    provider,
    config,
    calls,
    cache,
    settings: {
      readSettings: async () => saved,
      markFailing: async (tier) => {
        marked.push(tier)
      },
    },
    logCall: () => {},
  })
  return { ...tests, reqs, imageReqs, rows, cacheGet, cachePut, marked }
}

describe('testUseCase', () => {
  it('runs one generateJson on the spec’s example data with the cache off, and says ok, the model and the time', async () => {
    const t = setup({ answers: [EXTRACT_ANSWER] })
    const result = await t.testUseCase('extract')
    expect(result.ok).toBe(true)
    expect(result.model).toBe('flash-model')
    expect(typeof result.ms).toBe('number')
    expect(result.error).toBeUndefined()
    expect(t.reqs.length).toBe(1)
    expect(t.reqs[0].useCase).toBe('extract')
    expect(JSON.stringify(t.reqs[0].data)).toBe(JSON.stringify(EXTRACT.example.data))
    expect(t.cacheGet).not.toHaveBeenCalled()
    expect(t.cachePut).not.toHaveBeenCalled()
    expect(t.rows.length).toBe(1)
  })

  it('runs one generateImage for art, and no JSON call', async () => {
    const t = setup({ images: [new Uint8Array([7])] })
    const result = await t.testUseCase('art')
    expect(result.ok).toBe(true)
    expect(result.model).toBe('image-model')
    expect(t.imageReqs.length).toBe(1)
    expect(t.imageReqs[0].useCase).toBe('art')
    expect(t.reqs.length).toBe(0)
  })

  it('makes exactly one live call on the use case’s own tier: an invalid answer is not retried, nothing climbs to Pro (criterion 93)', async () => {
    const t = setup({ answers: ['nope', EXTRACT_ANSWER, EXTRACT_ANSWER] })
    const result = await t.testUseCase('extract')
    expect(result.ok).toBe(false)
    expect(result.model).toBe('flash-model')
    expect(t.reqs.map((r) => [r.tier, r.model])).toEqual([['flash', 'flash-model']])
    expect(t.rows.length).toBe(1)
  })

  it('fails on a saved model that is not found, in that one call: no fallback', async () => {
    const t = setup({
      answers: [Object.assign(new Error('not found'), { status: 404 }), EXTRACT_ANSWER],
      saved: { tierModels: { flash: 'gemini-3.8-flash' } },
    })
    const result = await t.testUseCase('extract')
    expect(result.ok).toBe(false)
    expect(result.model).toBe('gemini-3.8-flash')
    expect(result.error).toBe('not found')
    expect(t.reqs.map((r) => r.model)).toEqual(['gemini-3.8-flash'])
    expect(t.rows.length).toBe(1)
  })

  it('says failed with the model and the first 500 characters of the error', async () => {
    const long = () => new Error(`model said no ${'x'.repeat(800)}`)
    const t = setup({ answers: [long()], images: [long()] })
    const text = await t.testUseCase('extract')
    expect(text.ok).toBe(false)
    expect(text.model).toBe('flash-model')
    expect(text.error?.startsWith('model said no')).toBe(true)
    expect(text.error?.length).toBe(500)

    const art = await t.testUseCase('art')
    expect(art.ok).toBe(false)
    expect(art.model).toBe('image-model')
    expect(art.error?.startsWith('model said no')).toBe(true)
    expect(art.error?.length).toBe(500)
  })

  it('runs a model not yet saved on its tier for this call only: one live call, never falling back', async () => {
    const t = setup({
      answers: [Object.assign(new Error('not found'), { status: 404 }), EXTRACT_ANSWER],
      saved: { useCaseTiers: { extract: 'lite' }, tierModels: { pro: 'gemini-3.1-pro-preview' } },
    })
    const tried = await t.testUseCase('extract', { tier: 'pro', model: 'pro-next' })
    expect(tried.ok).toBe(false)
    expect(tried.model).toBe('pro-next')
    expect(t.reqs.map((r) => [r.tier, r.model])).toEqual([['pro', 'pro-next']])
    // One attempt: no second Pro slot reserved, no failed row for a model never called.
    expect(t.rows.map((r) => [r.tier, r.model])).toEqual([['pro', 'pro-next']])
    expect(t.marked.length).toBe(0)

    const after = await t.testUseCase('extract')
    expect(after.ok).toBe(true)
    expect(t.reqs.map((r) => r.model)).toEqual(['pro-next', 'lite-model'])
  })

  it('passes with the model not yet saved when that model answers', async () => {
    const t = setup({ answers: [EXTRACT_ANSWER] })
    const result = await t.testUseCase('extract', { tier: 'lite', model: 'gemini-3.8-flash' })
    expect(result.ok).toBe(true)
    expect(result.model).toBe('gemini-3.8-flash')
    expect(t.reqs.map((r) => [r.tier, r.model])).toEqual([['lite', 'gemini-3.8-flash']])
  })

  it('draws with an image model not yet saved for this call only', async () => {
    const t = setup({ images: [new Uint8Array([1]), new Uint8Array([2])] })
    const result = await t.testUseCase('art', { tier: 'image', model: 'image-next' })
    await t.testUseCase('art')
    expect(result.ok).toBe(true)
    expect(result.model).toBe('image-next')
    expect(t.imageReqs.map((r) => r.model)).toEqual(['image-next', 'image-model'])
  })
})

describe('testStudentCalls', () => {
  it('runs every check case once, on the tiers the page chose, one row each', async () => {
    const t = setup({
      provider: makeFake(),
      saved: { useCaseTiers: { student_why: 'flash', student_ask: 'flash' } },
    })
    const rows = await t.testStudentCalls()
    expect(rows.length).toBe(CHECK_CASES.length)
    expect(rows.map((r) => r.label)).toEqual(CHECK_CASES.map((c) => c.label))
    expect(rows.every((r) => typeof r.ok === 'boolean' && typeof r.ms === 'number')).toBe(true)
    expect(rows.map((r) => r.model)).toEqual(CHECK_CASES.map(() => 'flash-model'))
    expect(t.reqs.length).toBeGreaterThanOrEqual(CHECK_CASES.length)
    expect(new Set(t.reqs.map((r) => r.tier))).toEqual(new Set(['flash']))
  })

  it('makes one live call per case, even when the answer is invalid', async () => {
    const t = setup({ answers: CHECK_CASES.flatMap(() => ['nope', 'nope', 'nope']) })
    const rows = await t.testStudentCalls()
    expect(rows.map((r) => r.ok)).toEqual(CHECK_CASES.map(() => false))
    expect(t.reqs.length).toBe(CHECK_CASES.length)
  })
})
