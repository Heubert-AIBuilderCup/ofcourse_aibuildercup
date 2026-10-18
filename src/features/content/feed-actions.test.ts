import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import type { FeedItem, FeedPost, Filters } from './lib/feed'
import type { FeedRoadmap } from './lib/roadmap-lines'

// The feed's next page with the session and the feed read mocked: who it refuses, what it passes
// to the read, and the page it shapes. The read is server/feed.ts; the paging rule lib/feed.ts.

let session: { user: { id: string } } | null = { user: { id: 'st-1' } }
const reads: { userId: string; query: unknown }[] = []
let filters: Filters = { destination: [], home: null, theme: [], age: [], q: '' }
let ordered: FeedItem[] = []
let roadmaps: FeedRoadmap[] = []
let failRead = false

mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))
mock.module('./server/feed', () => ({
  readFeedPage: async (userId: string, query: unknown) => {
    reads.push({ userId, query })
    if (failRead) throw new Error('connection refused at 127.0.0.1:5433')
    return { filters, ordered, roadmaps }
  },
}))

const { loadFeedPageAction } = await import('./feed-actions')

const post = (id: string, over: Partial<FeedPost> = {}): FeedPost => ({
  id,
  title: id,
  approvedAt: '2026-10-07T09:00:00.000Z',
  settings: {
    layer: 'general',
    audience: { mode: 'everyone', rules: [] },
    whyLine: null,
    expiry: { kind: 'none' },
    studioLink: null,
    tags: [],
    sourcesAt: 'caption',
  },
  sourceLine: null,
  sourceId: null,
  courseId: null,
  tags: [],
  main: { excerpt: `${id} excerpt`, slides: [{ pngAssetId: `png-${id}`, alt: 'Slide 1' }] },
  market: null,
  instagram: null,
  ...over,
})

const TWENTY = Array.from({ length: 20 }, (_, i) => post(`p${i}`))
const ids = (r: Awaited<ReturnType<typeof loadFeedPageAction>>) =>
  r.ok ? r.cards.map((c) => c.id) : r

beforeEach(() => {
  session = { user: { id: 'st-1' } }
  reads.length = 0
  filters = { destination: [], home: null, theme: [], age: [], q: '' }
  ordered = TWENTY
  roadmaps = []
  failRead = false
})

describe('loadFeedPageAction', () => {
  test('refuses a caller with no session (signed out or suspended) and reads nothing', async () => {
    session = null
    expect(await loadFeedPageAction({ query: {}, offset: 8 })).toEqual({
      ok: false,
      error: 'Not authorised.',
    })
    expect(reads).toEqual([])
  })

  test('reads the feed for the session’s account with the URL’s query, never an id from the call', async () => {
    const query = { theme: 'books-movies', q: 'rent' }
    await loadFeedPageAction({ query, offset: 8, userId: 'someone-else' })
    expect(reads).toEqual([{ userId: 'st-1', query }])
  })

  test('returns the page at the offset, as cards, and a short last page', async () => {
    expect(ids(await loadFeedPageAction({ query: {}, offset: 8 }))).toEqual(
      TWENTY.slice(8, 16).map((p) => p.id),
    )
    expect(ids(await loadFeedPageAction({ query: {}, offset: 16 }))).toEqual([
      'p16',
      'p17',
      'p18',
      'p19',
    ])
    const r = await loadFeedPageAction({ query: {}, offset: 19 })
    expect(r.ok && r.cards[0]).toEqual({
      kind: 'post',
      id: 'p19',
      title: 'p19',
      accounts: ['@ofcourse_ai'],
      layer: 'general',
      whyLine: null,
      language: undefined,
      caption: 'p19 excerpt',
      slides: [{ pngAssetId: 'png-p19', alt: 'Slide 1' }],
      sourceLine: null,
      roadmapLinks: null,
    })
  })

  test('links each card to the roadmaps the read found for her', async () => {
    roadmaps = [{ name: 'Sydney · Data science', destinations: ['AU'] }]
    ordered = [post('au', { tags: ['destination:AU'] })]
    const r = await loadFeedPageAction({ query: {}, offset: 0 })
    expect(r.ok && r.cards[0]?.kind === 'post' && r.cards[0].roadmapLinks).toMatchObject({
      all: false,
      names: ['Sydney · Data science'],
    })
  })

  test('slices what the filters leave, in the version the home filter asks for', async () => {
    filters = { ...filters, theme: ['books-movies'], home: 'NP' }
    ordered = [
      post('a', { tags: ['theme:work-study-life'] }),
      post('b'),
      post('c', {
        market: { id: 'NP', version: { excerpt: 'Nepal', slides: [] } },
      }),
    ]
    const r = await loadFeedPageAction({ query: { theme: 'books-movies' }, offset: 1 })
    expect(ids(r)).toEqual(['c'])
    expect(r.ok && r.cards[0]).toMatchObject({ caption: 'Nepal' })
  })

  test('refuses a malformed call before reading', async () => {
    for (const bad of [
      null,
      'offset=8',
      { query: {}, offset: -1 },
      { query: {}, offset: 1.5 },
      { query: {}, offset: 100_000 },
      { query: { q: 'x'.repeat(2_000) }, offset: 8 },
      { query: { q: 3 }, offset: 8 },
      { offset: 8 },
    ]) {
      expect(await loadFeedPageAction(bad)).toEqual({ ok: false, error: 'Unknown page.' })
    }
    expect(reads).toEqual([])
  })

  test('says so in plain words when the read fails, and never throws or leaks the cause', async () => {
    failRead = true
    const logged = spyOn(console, 'error').mockImplementation(() => {})
    expect(await loadFeedPageAction({ query: {}, offset: 8 })).toEqual({
      ok: false,
      error: 'We couldn’t load more posts.',
    })
    // The cause is logged for us, not shown to her.
    expect(logged).toHaveBeenCalledTimes(1)
    logged.mockRestore()
  })
})
