// The ai_call log and the ai_cache table against the development database (Docker, port 5433);
// off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/ai/store-backed.test.ts
// Every row here is the test's own (its id, post id or key starts `test-`) and is deleted after.
// The database is shared, so counts are compared before and after rather than absolutely.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'test-ai-'

describe.skipIf(!enabled)('the model call log and cache against the database', () => {
  let calls: typeof import('./calls').dbCallLog
  let cache: typeof import('./cache').dbCache
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db
      .delete(schema.aiCall)
      .where(orm.or(orm.like(schema.aiCall.id, `${P}%`), orm.like(schema.aiCall.postId, `${P}%`)))
    await db.delete(schema.aiCache).where(orm.like(schema.aiCache.key, `${P}%`))
  }

  beforeAll(async () => {
    ;({ dbCallLog: calls } = await import('./calls'))
    ;({ dbCache: cache } = await import('./cache'))
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
  })

  afterAll(cleanUp)

  const row = (tier: 'lite' | 'flash' | 'pro' | 'image', cached = false) => ({
    useCase: 'extract' as const,
    tier,
    model: 'test-model',
    promptVersion: 'test.v1',
    ok: true,
    cached,
    ms: 5,
    fallback: null,
    postId: `${P}post`,
  })

  test('countToday counts only the calls made today on that tier', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const proBefore = await calls.countToday('pro', today)
    const flashBefore = await calls.countToday('flash', today)
    const yesterdayBefore = await calls.countToday('pro', yesterday)

    await calls.record(row('pro'))
    await calls.record(row('pro'))
    await calls.record(row('flash'))
    // A cache hit costs nothing, so it does not count against the cap.
    await calls.record(row('pro', true))
    await db.insert(schema.aiCall).values({ id: `${P}yesterday`, day: yesterday, ...row('pro') })

    expect(await calls.countToday('pro', today)).toBe(proBefore + 2)
    expect(await calls.countToday('flash', today)).toBe(flashBefore + 1)
    expect(await calls.countToday('pro', yesterday)).toBe(yesterdayBefore + 1)
  })

  test('records a lite call: the tier check admits it (SR8)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const before = await calls.countToday('lite', today)
    await calls.record(row('lite'))
    expect(await calls.countToday('lite', today)).toBe(before + 1)
  })

  test('two image calls racing for the last slot of the cap make exactly one provider call (6)', async () => {
    const { makeAi } = await import('./client')
    const { aiConfig } = await import('./config')
    const today = new Date().toISOString().slice(0, 10)
    const used = await calls.countToday('image', today)
    let made = 0
    const ai = makeAi({
      provider: {
        json: async () => '{}',
        image: async () => {
          made++
          await new Promise((r) => setTimeout(r, 50))
          return new Uint8Array([1])
        },
      },
      config: aiConfig({ GEMINI_IMAGE_MODEL: 'test-model', AI_DAILY_CAP_IMAGE: String(used + 1) }),
      calls,
      cache,
    })
    const req = { prompt: 'a desk', aspectRatio: '4:5' as const, postId: `${P}post`, data: {} }
    const results = await Promise.all([ai.generateImage(req), ai.generateImage(req)])
    expect(made).toBe(1)
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.reason)).toEqual(['daily_limit'])
  })

  test('the search cap counts the search use cases only: other Flash calls never fill it', async () => {
    const { SEARCH_USE_CASES } = await import('./config')
    const day = new Date().toISOString().slice(0, 10)
    const [used] = await db
      .select({ n: orm.count() })
      .from(schema.aiCall)
      .where(
        orm.and(
          orm.eq(schema.aiCall.day, day),
          orm.inArray(schema.aiCall.useCase, [...SEARCH_USE_CASES]),
          orm.eq(schema.aiCall.cached, false),
        ),
      )
    await calls.record(row('flash'))
    await calls.record(row('flash'))
    const search = {
      useCase: 'suggest_sources' as const,
      tier: 'flash' as const,
      model: 'test-model',
      promptVersion: 'test.v1',
      postId: `${P}post`,
      day,
      cap: (used?.n ?? 0) + 1,
      useCases: SEARCH_USE_CASES,
    }
    expect(await calls.reserve(search)).not.toBeNull()
    expect(await calls.reserve({ ...search, useCase: 'research_claim' })).toBeNull()
  })

  test('put then get returns the value; an unknown key is null', async () => {
    const value = { facts: [{ text: 'Eleven points', ref: '¶3' }] }
    await cache.put(`${P}key`, {
      useCase: 'extract',
      model: 'test-model',
      promptVersion: 'test.v1',
      value,
    })
    expect(await cache.get(`${P}key`)).toEqual(value)
    expect(await cache.get(`${P}missing`)).toBeNull()
  })
})
