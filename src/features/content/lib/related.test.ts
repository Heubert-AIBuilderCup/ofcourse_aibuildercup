import { describe, expect, it } from 'bun:test'
import type { FeedSettings } from '../model/types'
import type { FeedPost } from './feed'
import { relatedTo } from './related'

const GENERAL: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
}

function post(id: string, over: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    title: id,
    approvedAt: '2026-10-07T09:00:00.000Z',
    settings: GENERAL,
    sourceLine: null,
    sourceId: null,
    courseId: null,
    tags: [],
    main: { excerpt: `${id} excerpt.`, slides: [] },
    market: null,
    instagram: null,
    ...over,
  }
}

/** The post whose page is shown: one source, one theme, one destination. */
const SELF = post('self', {
  sourceId: 'src-1',
  tags: ['theme:work-study-life', 'destination:AU'],
})

const ids = (related: ReturnType<typeof relatedTo>): string[] => related.map((r) => r.post.id)

describe('relatedTo (criterion 91)', () => {
  it('ranks the same source over a shared theme over a shared destination, whatever the input order', () => {
    const byDestination = post('d', { tags: ['destination:AU'] })
    const byTheme = post('t', { tags: ['theme:work-study-life'] })
    const bySource = post('s', { sourceId: 'src-1' })
    const related = relatedTo(SELF, [byDestination, byTheme, bySource, SELF])
    expect(related).toEqual([
      { post: bySource, why: 'built on the same source' },
      { post: byTheme, why: 'also about Work and study life' },
      { post: byDestination, why: 'also for Australia' },
    ])
  })

  it('lists a post matching two reasons once, with the stronger one', () => {
    const sourceAndTheme = post('st', { sourceId: 'src-1', tags: ['theme:work-study-life'] })
    const themeAndDestination = post('td', {
      tags: ['destination:AU', 'theme:work-study-life'],
    })
    const related = relatedTo(SELF, [themeAndDestination, sourceAndTheme])
    expect(related).toEqual([
      { post: sourceAndTheme, why: 'built on the same source' },
      { post: themeAndDestination, why: 'also about Work and study life' },
    ])
  })

  it('never lists the post itself', () => {
    expect(relatedTo(SELF, [SELF])).toEqual([])
    expect(ids(relatedTo(SELF, [SELF, post('s', { sourceId: 'src-1' })]))).toEqual(['s'])
  })

  it('stops at four, keeping the input order within a reason', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => post(id, { sourceId: 'src-1' }))
    expect(ids(relatedTo(SELF, [...five, SELF]))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('gives [] with no candidate: another source, other tags, no tags, or no source on either side', () => {
    const unrelated = [
      post('other-source', { sourceId: 'src-2' }),
      post('other-tags', { tags: ['theme:books-movies', 'destination:UK', 'home:NP'] }),
      post('bare'),
    ]
    expect(relatedTo(SELF, unrelated)).toEqual([])
    expect(relatedTo(post('no-source'), [post('also-no-source')])).toEqual([])
    expect(relatedTo(SELF, [])).toEqual([])
  })
})
