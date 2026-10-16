// What the cards' posts and updates are drawn from, read from the feed and the updates (criteria
// 44-47): only live updates, never an expired post, and a failing read gives none rather than a
// broken board. The two reads are fakes: no database.

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { FeedPost } from '@/features/content/lib/feed'
import type { StoredUpdate } from '@/features/updates/lib/update'

mock.module('server-only', () => ({}))

const { readTileFeed } = await import('./tile-posts')
const { roadById } = await import('../data/roads')
const { courseById } = await import('../data/courses')

const SPEC = roadById('perth-cyber')
if (!SPEC) throw new Error('perth-cyber road missing')
const UNIVERSITY = courseById(SPEC.courseId)?.university ?? ''
const NOW = new Date('2026-10-15T09:00:00Z')

const post = (id: string, over: Partial<FeedPost> = {}): FeedPost =>
  ({
    id,
    title: `Post ${id}`,
    approvedAt: '2026-10-10T09:00:00Z',
    settings: { expiry: { kind: 'none' } },
    courseId: SPEC.courseId,
    tags: [],
    ...over,
  }) as FeedPost

const update = (
  id: string,
  status: StoredUpdate['status'],
  homeCountry: string | null = null,
): StoredUpdate =>
  ({
    id,
    status,
    kind: 'opportunity',
    category: 'Scholarship',
    institution: UNIVERSITY,
    title: `Update ${id}`,
    body: `Body ${id}`,
    applyBy: null,
    sourceTitle: 'Its page',
    sourceCheckedAt: '2026-10-01',
    audience: { institution: UNIVERSITY, homeCountry },
  }) as StoredUpdate

let posts: FeedPost[] = []
let updates: StoredUpdate[] = []
const listLive = mock(async () => posts)
const listLiveUpdates = mock(async () => updates)
const sources = { listLive, listLiveUpdates, now: () => NOW }

let logged: ReturnType<typeof spyOn>
beforeEach(() => {
  posts = []
  updates = []
  listLive.mockClear()
  listLiveUpdates.mockClear()
  logged = spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  logged.mockRestore()
})

const NONE = { posts: [], updates: [] }

describe('readTileFeed', () => {
  it('keeps only the live updates, each as a tile needs it, whatever country it is for', async () => {
    updates = [
      update('live', 'live'),
      update('review', 'in_review'),
      update('draft', 'draft'),
      update('hers', 'live', 'Nepal'),
      update('other', 'live', 'India'),
    ]
    const feed = await readTileFeed(sources)
    expect(feed.updates.map((u) => u.id)).toEqual(['live', 'hers', 'other'])
    expect(feed.updates[0]).toEqual({
      id: 'live',
      status: 'live',
      institution: UNIVERSITY,
      title: 'Update live',
      body: 'Body live',
      audience: { institution: UNIVERSITY, homeCountry: null },
    })
  })

  it('leaves out a post that has expired', async () => {
    posts = [
      post('kept'),
      post('gone', { settings: { expiry: { kind: 'date', date: '2026-10-14' } } as never }),
    ]
    const feed = await readTileFeed(sources)
    expect(feed.posts.map((p) => p.id)).toEqual(['kept'])
  })

  it('gives nothing, and logs, when the feed cannot be read', async () => {
    updates = [update('live', 'live')]
    listLive.mockImplementationOnce(async () => {
      throw new Error('feed down')
    })
    expect(await readTileFeed(sources)).toEqual(NONE)
    expect(logged).toHaveBeenCalled()
  })

  it('gives nothing, and logs, when the updates cannot be read', async () => {
    posts = [post('kept')]
    listLiveUpdates.mockImplementationOnce(async () => {
      throw new Error('updates down')
    })
    expect(await readTileFeed(sources)).toEqual(NONE)
    expect(logged).toHaveBeenCalled()
  })
})
