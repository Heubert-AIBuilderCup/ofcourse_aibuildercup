import { beforeEach, describe, expect, mock, test } from 'bun:test'

// The student feed's image route with the session and the store mocked: any signed-in account gets
// a PNG that a live post's approved render or market version names; no session, a draft's image, a
// social version's image or anything unknown gets a 404 (criterion 77).

type User = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }
const STUDENT: User = { id: 'u2', role: 'user', editor: false, reviewer: false, name: 'Stu' }
const EDITOR: User = { id: 'u3', role: 'user', editor: true, reviewer: false, name: 'Ed' }
const ADMIN: User = { id: 'u4', role: 'admin', editor: false, reviewer: false, name: 'Ada' }

let session: { user: User } | null = null
const BYTES = new Uint8Array([1, 2, 3])
const asked: string[] = []

/** What the store answers: live PNGs, a live id whose bytes are not a PNG, and a draft's PNG. */
const LIVE = new Set(['png-live', 'svg-live'])
const ASSETS: Record<string, { mime: string; bytes: Uint8Array }> = {
  'png-live': { mime: 'image/png', bytes: BYTES },
  'svg-live': { mime: 'image/svg+xml', bytes: new TextEncoder().encode('<svg/>') },
  'png-draft': { mime: 'image/png', bytes: BYTES },
}

mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))
// src/features/content/routes.test.ts mocks this module too: a mocked module keeps the export
// names of whichever mock runs first, so both name the same set.
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

const CACHE = 'private, max-age=31536000, immutable'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never
const get = (id: string) => GET(new Request('http://localhost/x') as never, ctx(id))

beforeEach(() => {
  session = null
  asked.length = 0
})

describe('GET /feed/assets/[id]', () => {
  test('no session gets 404 before the store is asked', async () => {
    const res = await get('png-live')
    expect(res.status).toBe(404)
    expect(asked).toEqual([])
  })

  test('an image no live post names is 404, and so is an unknown id', async () => {
    session = { user: STUDENT }
    expect((await get('png-draft')).status).toBe(404)
    expect((await get('nope')).status).toBe(404)
  })

  test('a live id whose bytes are not a PNG is 404: the route serves PNG only', async () => {
    session = { user: STUDENT }
    expect((await get('svg-live')).status).toBe(404)
  })

  test('a signed-in account gets a live PNG with nosniff and a year-long private cache', async () => {
    session = { user: STUDENT }
    const res = await get('png-live')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe(CACHE)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES)
    expect(asked).toEqual(['png-live'])
  })

  test('a staff account gets a live PNG too: the feed is for every signed-in account (71)', async () => {
    for (const user of [EDITOR, ADMIN]) {
      session = { user }
      expect((await get('png-live')).status).toBe(200)
    }
  })
})
