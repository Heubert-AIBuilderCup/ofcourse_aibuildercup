import { beforeEach, describe, expect, mock, test } from 'bun:test'

// A live post's slide on the public image route, with the store mocked and no session: anyone gets
// a PNG that a live, unexpired post pins, so the public page and its share image show (criterion
// 107); a draft's, a post's in review, an expired post's (isLiveAsset answers false for them) or an
// unknown id is "not found", and so is a live id whose bytes are not a PNG.

const BYTES = new Uint8Array([1, 2, 3])
const asked: string[] = []

const LIVE = new Set(['png-live', 'svg-live'])
const ASSETS: Record<string, { mime: string; bytes: Uint8Array }> = {
  'png-live': { mime: 'image/png', bytes: BYTES },
  'svg-live': { mime: 'image/svg+xml', bytes: new TextEncoder().encode('<svg/>') },
  'png-draft': { mime: 'image/png', bytes: BYTES },
  'png-expired': { mime: 'image/png', bytes: BYTES },
}

// Nobody is signed in. The feed's image route test mocks this module too, with the same name.
mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => null }))
// src/features/content/routes.test.ts and the feed's image route test mock this module too: a
// mocked module keeps the export names of whichever mock runs first, so all three name the same set.
mock.module('@/features/content/server/store', () => ({
  isLiveAsset: async (id: string) => {
    asked.push(id)
    return LIVE.has(id)
  },
  getAsset: async (id: string) => ASSETS[id] ?? null,
  loadPost: async () => null,
  getAssets: async () => new Map(),
  // The blog routes' tests name these too (src/app/(public)/blog).
  isLiveBlogAsset: async () => false,
  liveBlogBySlug: async () => null,
  liveBlogs: async () => [],
}))

const { GET } = await import('./route')

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never
const get = (id: string) => GET(new Request('http://localhost/x') as never, ctx(id))

beforeEach(() => {
  asked.length = 0
})

describe('GET /posts/assets/[id]', () => {
  test('anyone, signed out, gets a live PNG, public and nosniff', async () => {
    const res = await get('png-live')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES)
    expect(asked).toEqual(['png-live'])
  })

  test("a draft's or an expired post's image is 404, and so is an unknown id", async () => {
    expect((await get('png-draft')).status).toBe(404)
    expect((await get('png-expired')).status).toBe(404)
    expect((await get('nope')).status).toBe(404)
  })

  test('a live id whose bytes are not a PNG is 404: the route serves PNG only', async () => {
    expect((await get('svg-live')).status).toBe(404)
  })
})
