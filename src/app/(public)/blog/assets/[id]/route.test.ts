import { beforeEach, describe, expect, mock, test } from 'bun:test'

// A live blog's picture on the public image route, with the store mocked and no session: anyone
// gets a PNG that a live, unexpired blog's published pictures name as a tinted copy, so the blog's
// page and its share image show (BR9, BR10); a draft's, an expired blog's, an original, a post's
// slide (isLiveBlogAsset answers false for them) or an unknown id is "not found", and so is a live
// id whose bytes are not a PNG.

const BYTES = new Uint8Array([1, 2, 3])
const asked: string[] = []

const LIVE = new Set(['png-blog', 'svg-blog'])
const ASSETS: Record<string, { mime: string; bytes: Uint8Array }> = {
  'png-blog': { mime: 'image/png', bytes: BYTES },
  'svg-blog': { mime: 'image/svg+xml', bytes: new TextEncoder().encode('<svg/>') },
  'png-draft': { mime: 'image/png', bytes: BYTES },
  'png-post-slide': { mime: 'image/png', bytes: BYTES },
}

// Nobody is signed in. Other route tests mock this module too, with the same name.
mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => null }))
// src/features/content/routes.test.ts, the posts' and the feed's image route tests and the blog
// page's test mock this module too: a mocked module keeps the export names of whichever mock runs
// first, so all of them name the same set.
mock.module('server-only', () => ({}))
// The store's other exports kept: Bun keeps the export names of the first mock of a module for
// the whole run, so a later test file that mocks it still finds them.
const store = { ...(await import('@/features/content/server/store')) }
mock.module('@/features/content/server/store', () => ({
  ...store,
  isLiveAsset: async () => true,
  isLiveBlogAsset: async (id: string) => {
    asked.push(id)
    return LIVE.has(id)
  },
  getAsset: async (id: string) => ASSETS[id] ?? null,
  loadPost: async () => null,
  getAssets: async () => new Map(),
  liveBlogBySlug: async () => null,
  liveBlogs: async () => [],
}))

const { GET } = await import('./route')

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never
const get = (id: string) => GET(new Request('http://localhost/x') as never, ctx(id))

beforeEach(() => {
  asked.length = 0
})

describe('GET /blog/assets/[id]', () => {
  test("anyone, signed out, gets a live blog's PNG, public and nosniff", async () => {
    const res = await get('png-blog')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES)
    expect(asked).toEqual(['png-blog'])
  })

  test("a draft blog's picture, a live post's slide and an unknown id are 404", async () => {
    expect((await get('png-draft')).status).toBe(404)
    expect((await get('png-post-slide')).status).toBe(404)
    expect((await get('nope')).status).toBe(404)
  })

  test('a live id whose bytes are not a PNG is 404: the route serves PNG only', async () => {
    expect((await get('svg-blog')).status).toBe(404)
  })
})
