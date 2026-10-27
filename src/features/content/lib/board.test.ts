import { describe, expect, it } from 'bun:test'
import type { BoardCard } from '../server/store'
import {
  ANY_BOARD,
  BOARD_FILTERS,
  type BoardParams,
  boardBackHref,
  boardFrom,
  boardView,
  parseAssignee,
  parseBoardParams,
  parseFilter,
  parseLang,
  parsePage,
  parseType,
} from './board'

const card = (over: Partial<BoardCard> & { id: string }): BoardCard => ({
  kind: 'feed',
  parentId: null,
  title: 'The 20-hour line',
  stage: 'structures',
  updatedAt: new Date('2026-10-05T09:12:00Z'),
  updatedByName: 'Maya R.',
  market: null,
  platform: null,
  brandName: null,
  liveLine: null,
  publishedApprovalId: null,
  courseId: null,
  pageId: null,
  language: 'en',
  assigneeId: null,
  assigneeName: null,
  assignmentNote: null,
  ...over,
})

const ME = 'u-me'
const ANY = ANY_BOARD
const view = (cards: BoardCard[], params: Partial<BoardParams> = {}) =>
  boardView(cards, { ...ANY, ...params }, ME)
const shown = (v: ReturnType<typeof boardView>) => v.columns.flatMap((c) => c.items)

const column = (v: ReturnType<typeof boardView>, id: string) => {
  const found = v.columns.find((c) => c.id === id)
  if (!found) throw new Error(`no column ${id}`)
  return found
}

describe('parseFilter', () => {
  it('keeps a known filter and turns anything else into all', () => {
    expect(BOARD_FILTERS.map((f) => f.id)).toEqual(['all', 'feed', 'social', 'comics'])
    expect(parseFilter('social')).toBe('social')
    expect(parseFilter('comics')).toBe('comics')
    expect(parseFilter('feed')).toBe('feed')
    expect(parseFilter('nonsense')).toBe('all')
    expect(parseFilter(['feed'])).toBe('all')
    expect(parseFilter(undefined)).toBe('all')
  })
})

describe('the board filters in the address', () => {
  it('keeps each known value and turns anything else into Any', () => {
    const staff = ['u-ed', ME]
    expect(parseAssignee('mine', staff)).toBe('mine')
    expect(parseAssignee('unassigned', staff)).toBe('unassigned')
    expect(parseAssignee('u-ed', staff)).toBe('u-ed')
    expect(parseAssignee('u-gone', staff)).toBe('any')
    expect(parseAssignee(['mine'], staff)).toBe('any')
    expect(parseAssignee(undefined, staff)).toBe('any')

    for (const t of ['feed', 'blog', 'comic', 'social'] as const) expect(parseType(t)).toBe(t)
    expect(parseType('market')).toBe('any')
    expect(parseType(undefined)).toBe('any')

    expect(parsePage('cerebral')).toBe('cerebral')
    expect(parsePage('main')).toBe('main')
    expect(parsePage('nowhere')).toBe('any')
    expect(parsePage(['main'])).toBe('any')

    for (const l of ['en', 'ne', 'hi', 'th'] as const) expect(parseLang(l)).toBe(l)
    expect(parseLang('fr')).toBe('any')
    expect(parseLang(undefined)).toBe('any')

    expect(parseBoardParams({}, [])).toEqual(ANY)
    expect(
      parseBoardParams(
        { filter: 'feed', assignee: 'u-ed', type: 'blog', page: 'main', lang: 'ne' },
        staff,
      ),
    ).toEqual({ filter: 'feed', assignee: 'u-ed', type: 'blog', page: 'main', lang: 'ne' })
    expect(
      parseBoardParams({ filter: 'x', assignee: 'x', type: 'x', page: 'x', lang: 'x' }, staff),
    ).toEqual(ANY)
  })
})

describe('boardView', () => {
  it('lists the six columns in order with their names and one-line subs', () => {
    expect(view([]).columns.map((c) => [c.label, c.sub])).toEqual([
      ['Structures', 'Pick one'],
      ['Approved', 'To render'],
      ['Rendered', 'Edit and check'],
      ['In review', 'A reviewer checks'],
      ['Ready', 'Publish or export'],
      ['Live', 'In the feed or exported'],
    ])
  })

  it('puts source and structures posts in the Text column', () => {
    const v = view([
      card({ id: 'a', stage: 'source' }),
      card({ id: 'b', stage: 'structures' }),
      card({ id: 'c', stage: 'live' }),
    ])
    expect(column(v, 'structures').items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(column(v, 'live').items.map((i) => i.id)).toEqual(['c'])
  })

  it('puts a social card right after its feed post, naming the post it hangs under', () => {
    const v = view([
      card({ id: 'p', stage: 'ready' }),
      card({
        id: 's',
        kind: 'social',
        parentId: 'p',
        title: 'Instagram cut',
        stage: 'ready',
        platform: 'instagram',
      }),
    ])
    const [parent, social] = column(v, 'ready').items
    expect(parent.parentId).toBeNull()
    expect(social.id).toBe('s')
    expect(social.kind).toBe('social')
    expect(social.parentId).toBe('p')
    expect(social.href).toBe('/admin/posts/s')
  })

  it("counts a feed post's social versions, whatever stage each is at", () => {
    const v = view([
      card({ id: 'p', stage: 'ready' }),
      card({ id: 's', kind: 'social', parentId: 'p', stage: 'in_review', platform: 'linkedin' }),
      card({ id: 't', kind: 'social', parentId: 'p', stage: 'ready', platform: 'instagram' }),
      card({ id: 'q', title: 'Other', stage: 'ready' }),
    ])
    const versions = (id: string) => shown(v).find((i) => i.id === id)?.versions
    expect(versions('p')).toBe(2)
    expect(versions('q')).toBe(0)
    expect(versions('s')).toBe(0)
  })

  it('hangs a social version under its feed post only when the post is above it in its column', () => {
    const cards = [
      card({ id: 'p', stage: 'ready', market: 'NP' }),
      card({ id: 's', kind: 'social', parentId: 'p', stage: 'ready', platform: 'instagram' }),
      card({ id: 't', kind: 'social', parentId: 'p', stage: 'in_review', platform: 'linkedin' }),
      card({ id: 'o', kind: 'social', parentId: 'gone', stage: 'ready' }),
    ]
    const hangs = (v: ReturnType<typeof boardView>) =>
      shown(v).map((i) => `${i.kind}:${i.id}:${i.hangs}`)
    expect(hangs(view(cards))).toEqual([
      'social:t:false',
      'feed:p:false',
      'market:p:false',
      'social:s:true',
      'social:o:false',
    ])
    // On the Social versions tab the post is not on the board: nothing hangs.
    expect(hangs(view(cards, { filter: 'social' }))).toEqual([
      'social:t:false',
      'social:s:false',
      'social:o:false',
    ])
  })

  it('names no parent for a social version whose feed post is gone', () => {
    const v = view([card({ id: 's', kind: 'social', parentId: 'gone', stage: 'ready' })])
    expect(column(v, 'ready').items[0].parentId).toBeNull()
  })

  it('adds a Nepal market item right after its post, in the same column', () => {
    const v = view([card({ id: 'p', market: 'NP' }), card({ id: 'q', title: 'Other' })])
    const items = column(v, 'structures').items
    expect(items.map((i) => i.title)).toEqual([
      'The 20-hour line',
      'The 20-hour line · Nepal',
      'Other',
    ])
    expect(items[1].kind).toBe('market')
    // The market version opens the post at its own step, which shows the Market switch on it.
    expect(items[1].href).toBe('/admin/posts/p?market=NP')
  })

  it("names the market item's market, never Nepal for another market (87)", () => {
    const items = column(view([card({ id: 'p', market: 'IN' })]), 'structures').items
    expect(items.map((i) => i.title)).toEqual(['The 20-hour line', 'The 20-hour line · India'])
    expect(items[1].href).toBe('/admin/posts/p?market=IN')
  })

  it('counts feed and market, social, and every item', () => {
    const cards = [
      card({ id: 'p', stage: 'ready', market: 'NP' }),
      card({ id: 's', kind: 'social', parentId: 'p', stage: 'ready', platform: 'instagram' }),
      card({ id: 'q', title: 'Other' }),
    ]
    expect(view(cards).counts).toEqual({ all: 4, feed: 3, social: 1, comics: 0 })
  })

  it('keeps the counts whichever tab is on, and the social tab shows only social items', () => {
    const cards = [
      card({ id: 'p', stage: 'ready', market: 'NP' }),
      card({ id: 's', kind: 'social', parentId: 'p', stage: 'ready', platform: 'instagram' }),
    ]
    const v = view(cards, { filter: 'social' })
    expect(v.counts).toEqual({ all: 3, feed: 2, social: 1, comics: 0 })
    expect(shown(v).map((i) => i.id)).toEqual(['s'])
    expect(shown(v)[0].href).toBe('/admin/posts/s?from=filter%3Dsocial')

    expect(shown(view(cards, { filter: 'feed' })).map((i) => i.kind)).toEqual(['feed', 'market'])
  })

  it('Route comics holds the posts that tell a path; Feed posts holds feed posts and blogs without them', () => {
    const cards = [
      card({ id: 'f' }),
      card({ id: 'b', kind: 'blog' }),
      card({ id: 'c', courseId: 'course-1', market: 'NP' }),
      card({ id: 's', kind: 'social', parentId: 'f' }),
    ]
    const ids = (v: ReturnType<typeof boardView>) => shown(v).map((i) => `${i.kind}:${i.id}`)
    expect(view(cards).counts).toEqual({ all: 5, feed: 2, social: 1, comics: 2 })
    expect(ids(view(cards, { filter: 'comics' }))).toEqual(['feed:c', 'market:c'])
    expect(ids(view(cards, { filter: 'feed' }))).toEqual(['feed:f', 'blog:b'])
  })

  it('names each card by its kind and its page in the overline', () => {
    const items = shown(
      view([
        card({ id: 'f', pageId: 'main', market: 'NP' }),
        card({ id: 'b', kind: 'blog' }),
        card({ id: 'c', courseId: 'course-1', pageId: 'comics' }),
        card({ id: 'l', kind: 'social', parentId: 'f', platform: 'linkedin', pageId: 'main' }),
        card({ id: 'i', kind: 'social', parentId: 'f', platform: 'instagram', pageId: 'cerebral' }),
      ]),
    )
    expect(items.map((i) => i.overline)).toEqual([
      'Feed post · Main',
      'Market · Main',
      'LinkedIn · Main',
      'Instagram · Cerebral',
      'Blog',
      'Route comic · OfCourse Comics',
    ])
  })

  it('says who changed a card and when', () => {
    const named = view([card({ id: 'p' })])
    expect(column(named, 'structures').items[0].changedLine).toBe(
      'Changed by Maya R. · 5 Oct 2026, 09:12',
    )
    const anonymous = view([card({ id: 'p', updatedByName: null })])
    expect(column(anonymous, 'structures').items[0].changedLine).toBe('Changed · 5 Oct 2026, 09:12')
  })

  it('passes a live line through', () => {
    const line = 'General · Everyone · Leaves the feed in 90 days'
    const v = view([card({ id: 'p', stage: 'live', liveLine: line })])
    expect(column(v, 'live').items[0].liveLine).toBe(line)
  })

  it('says there are no posts only when there are none at all, filters or not', () => {
    expect(view([]).noPosts).toBe(true)
    expect(view([], { lang: 'th' }).noPosts).toBe(true)
    expect(view([card({ id: 'p' })], { lang: 'th' }).noPosts).toBe(false)
  })
})

describe("boardView's count of the viewer's own posts", () => {
  it('counts the cards assigned to the viewer in Structures, In review and Ready', () => {
    const v = view([
      card({ id: 'a', stage: 'source', assigneeId: ME }),
      card({ id: 'b', stage: 'structures', assigneeId: ME }),
      card({ id: 'c', stage: 'structures', assigneeId: 'u-ed' }),
      card({ id: 'd', stage: 'in_review', assigneeId: ME }),
      card({ id: 'e', stage: 'ready', assigneeId: null }),
      card({ id: 'f', stage: 'rendered', assigneeId: ME }),
      card({ id: 'g', stage: 'live', assigneeId: ME }),
    ])
    expect(v.mine).toEqual({ structures: 2, in_review: 1, ready: 0 })
  })

  it("counts a post once, not its market version's card as a second post", () => {
    const v = view([
      card({ id: 'a', stage: 'structures', assigneeId: ME, market: 'NP' }),
      card({ id: 'b', stage: 'ready', assigneeId: ME, market: 'IN' }),
    ])
    expect(v.mine).toEqual({ structures: 1, in_review: 0, ready: 1 })
  })

  it('counts them whatever the tab and the filters show', () => {
    const cards = [
      card({ id: 'a', stage: 'structures', assigneeId: ME, language: 'ne' }),
      card({ id: 'b', kind: 'social', stage: 'ready', assigneeId: ME, platform: 'instagram' }),
    ]
    expect(view(cards, { filter: 'comics', assignee: 'u-ed', lang: 'en' }).mine).toEqual({
      structures: 1,
      in_review: 0,
      ready: 1,
    })
  })
})

describe('boardView with the filters', () => {
  const MINE = card({ id: 'm', title: 'Mine', assigneeId: ME, assigneeName: 'Me' })
  const THEIRS = card({ id: 't', title: 'Theirs', assigneeId: 'u-ed', assigneeName: 'Ed' })
  const NOBODY = card({ id: 'n', title: 'Nobody' })

  it('Mine shows only the posts assigned to the viewer, and a name only theirs', () => {
    const ids = (assignee: string) =>
      shown(view([MINE, THEIRS, NOBODY], { assignee })).map((i) => i.id)
    expect(ids('mine')).toEqual(['m'])
    expect(ids('u-ed')).toEqual(['t'])
  })

  it('Unassigned shows only the posts with no owner', () => {
    expect(
      shown(view([MINE, THEIRS, NOBODY], { assignee: 'unassigned' })).map((i) => i.id),
    ).toEqual(['n'])
  })

  it("a market item and a social version show their own post's assignment", () => {
    const items = shown(
      view([
        card({
          id: 'p',
          market: 'NP',
          assigneeId: 'u-ed',
          assigneeName: 'Ed',
          assignmentNote: 'Hi',
        }),
        card({ id: 's', kind: 'social', parentId: 'p', assigneeId: ME, assigneeName: 'Me' }),
      ]),
    )
    expect(items.map((i) => [i.kind, i.assigneeName, i.assignmentNote])).toEqual([
      ['feed', 'Ed', 'Hi'],
      ['market', 'Ed', 'Hi'],
      ['social', 'Me', null],
    ])
  })

  it('Type tells a blog, a comic, a feed post and a social version apart', () => {
    const cards = [
      card({ id: 'f', market: 'NP' }),
      card({ id: 'b', kind: 'blog' }),
      card({ id: 'c', courseId: 'course-1' }),
      card({ id: 's', kind: 'social', parentId: 'f' }),
    ]
    const ids = (type: BoardParams['type']) =>
      shown(view(cards, { type })).map((i) => `${i.kind}:${i.id}`)
    expect(ids('feed')).toEqual(['feed:f', 'market:f'])
    expect(ids('blog')).toEqual(['blog:b'])
    expect(ids('comic')).toEqual(['feed:c'])
    expect(ids('social')).toEqual(['social:s'])
  })

  it("Page matches a feed post's page and a social version's own, and lists the pages on the cards", () => {
    const cards = [
      card({ id: 'f', pageId: 'main', market: 'NP' }),
      card({ id: 'g' }),
      card({ id: 's', kind: 'social', parentId: 'g', pageId: 'cerebral' }),
    ]
    expect(shown(view(cards, { page: 'main' })).map((i) => `${i.kind}:${i.id}`)).toEqual([
      'feed:f',
      'market:f',
    ])
    expect(shown(view(cards, { page: 'cerebral' })).map((i) => i.id)).toEqual(['s'])
    expect(view(cards).pages).toEqual([
      { id: 'cerebral', name: 'Cerebral' },
      { id: 'main', name: 'Main' },
    ])
  })

  it("Language Nepali includes the post's social version and market item", () => {
    const cards = [
      card({ id: 'p', language: 'ne', market: 'NP' }),
      card({ id: 's', kind: 'social', parentId: 'p', language: 'en' }),
      card({ id: 'q', language: 'en' }),
    ]
    expect(shown(view(cards, { lang: 'ne' })).map((i) => `${i.kind}:${i.id}`)).toEqual([
      'feed:p',
      'market:p',
      'social:s',
    ])
    expect(shown(view(cards, { lang: 'en' })).map((i) => i.id)).toEqual(['q'])
  })

  it('applies every filter together', () => {
    const cards = [
      card({ id: 'a', assigneeId: ME, language: 'ne', kind: 'blog' }),
      card({ id: 'b', assigneeId: ME, language: 'ne' }),
      card({ id: 'c', assigneeId: ME, language: 'en', kind: 'blog' }),
      card({ id: 'd', assigneeId: 'u-ed', language: 'ne', kind: 'blog' }),
    ]
    const v = view(cards, { assignee: 'mine', lang: 'ne', type: 'blog' })
    expect(shown(v).map((i) => i.id)).toEqual(['a'])
    expect(v.empty).toBe(false)
    const none = view(cards, { assignee: 'mine', lang: 'th' })
    expect(shown(none)).toEqual([])
    expect(none.empty).toBe(true)
    // An empty board with no filter on is just empty, not hidden by filters.
    expect(view([]).empty).toBe(false)
  })

  it('counts each tab under the other filters', () => {
    const cards = [
      card({ id: 'p', assigneeId: ME, market: 'NP' }),
      card({ id: 's', kind: 'social', parentId: 'p', assigneeId: ME }),
      card({ id: 'q' }),
      card({ id: 'r', kind: 'social', parentId: 'q' }),
    ]
    const mine = { all: 3, feed: 2, social: 1, comics: 0 }
    expect(view(cards, { assignee: 'mine' }).counts).toEqual(mine)
    expect(view(cards, { assignee: 'mine', filter: 'social' }).counts).toEqual(mine)
    expect(view(cards, { assignee: 'unassigned' }).counts).toEqual({
      all: 2,
      feed: 1,
      social: 1,
      comics: 0,
    })
  })

  it("links a card with the board's whole address, and the way back keeps it", () => {
    const params: BoardParams = {
      filter: 'feed',
      assignee: 'mine',
      type: 'blog',
      page: 'main',
      lang: 'ne',
    }
    const [item] = shown(
      view(
        [card({ id: 'b', kind: 'blog', assigneeId: ME, pageId: 'main', language: 'ne' })],
        params,
      ),
    )
    const from = new URL(item.href, 'https://x.test').searchParams.get('from')
    expect(boardBackHref(boardFrom(from))).toBe(
      '/admin/board?filter=feed&assignee=mine&type=blog&page=main&lang=ne',
    )
    // Nothing on: no `from`, and the way back is the bare board.
    expect(shown(view([card({ id: 'p' })]))[0].href).toBe('/admin/posts/p')
    expect(boardBackHref(boardFrom(undefined))).toBe('/admin/board')
    // Only the board's own keys travel, whatever the address carried.
    expect(boardFrom('filter=social&evil=%3Cscript%3E&next=//x.test')).toBe('filter=social')
    expect(boardFrom(['filter=social'])).toBe('')
  })
})
