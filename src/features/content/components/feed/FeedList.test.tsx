/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ActionResult } from '@/shared/types/action-result'
import type { FeedCard, Filters } from '../../lib/feed'
import { FeedList } from './FeedList'
import { slideAt } from './FeedPostCard'

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: null,
  home: null,
  theme: null,
  age: null,
  q: '',
  ...over,
})

const postCard = (id: string, over: Partial<Extract<FeedCard, { kind: 'post' }>> = {}) =>
  ({
    kind: 'post',
    id,
    title: `Post ${id}`,
    page: 'OfCourse',
    layer: 'general',
    whyLine: null,
    line: `${id} first line.`,
    slides: [
      { pngAssetId: `png-${id}-1`, alt: `Slide 1: ${id}` },
      { pngAssetId: `png-${id}-2`, alt: `Slide 2: ${id}` },
    ],
    sourceLine: null,
    ...over,
  }) satisfies FeedCard as FeedCard

const cards = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => postCard(`${prefix}${i + 1}`))

type Load = (input: {
  query: Record<string, string | string[]>
  offset: number
}) => Promise<ActionResult<{ cards: FeedCard[] }>>

// The scroll's sentinel: each IntersectionObserver the list makes, and what it watches.
type Watcher = { callback: IntersectionObserverCallback; watched: Element[]; live: boolean }
let watchers: Watcher[] = []
const RealObserver = window.IntersectionObserver
beforeAll(() => {
  window.IntersectionObserver = class {
    w: Watcher
    constructor(callback: IntersectionObserverCallback) {
      this.w = { callback, watched: [], live: true }
      watchers.push(this.w)
    }
    observe(el: Element) {
      this.w.watched.push(el)
    }
    unobserve() {}
    disconnect() {
      this.w.live = false
    }
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
})
afterAll(() => {
  window.IntersectionObserver = RealObserver
})
afterEach(() => {
  cleanup()
  watchers = []
})

/** The sentinel scrolls into view: every live observer hears it. */
const reach = () =>
  act(async () => {
    for (const w of watchers.filter((x) => x.live && x.watched.length > 0)) {
      w.callback(
        w.watched.map((target) => ({
          isIntersecting: true,
          target,
        })) as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      )
    }
  })
const titles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')

const list = (props: Partial<Parameters<typeof FeedList>[0]> = {}) => (
  <FeedList
    cards={cards('a', 8)}
    filters={F()}
    query={{}}
    liveCount={20}
    loadPage={mock<Load>(async () => ({ ok: true, cards: [] }))}
    {...props}
  />
)

describe('FeedList: the cards', () => {
  it('opens each post from its whole card, named by its title, the filters kept', () => {
    render(list({ cards: [postCard('p1')], filters: F({ home: 'NP', q: 'rent' }) }))
    expect(screen.getByRole('link', { name: 'Post p1' }).getAttribute('href')).toBe(
      '/feed/p1?home=NP&q=rent',
    )
  })

  it('shows every slide from the feed image route with its alt, the page, the first line and the tags', () => {
    render(
      list({
        cards: [
          postCard('p1', {
            layer: 'personal',
            page: '@ofcourse.main',
            language: 'ne',
            whyLine: 'You weighted work rights.',
          }),
          postCard('p2'),
        ],
      }),
    )
    const images = screen.getAllByRole('img').filter((i) => i.getAttribute('alt')?.endsWith('p1'))
    expect(images.map((i) => [i.getAttribute('alt'), i.getAttribute('src')])).toEqual([
      ['Slide 1: p1', '/feed/assets/png-p1-1'],
      ['Slide 2: p1', '/feed/assets/png-p1-2'],
    ])
    expect(screen.queryByText('@ofcourse.main') !== null).toBe(true)
    expect(screen.getAllByText('OfCourse')).toHaveLength(1)
    expect(screen.queryByText('p1 first line.') !== null).toBe(true)
    expect(screen.getAllByText('For you')).toHaveLength(1)
    expect(screen.getByText('नेपाली').getAttribute('lang')).toBe('ne')
    expect(screen.queryByText('You weighted work rights.') !== null).toBe(true)
  })

  it('shows a blog as a blog card: its cover from the blog image route, its reading time, its page in the feed (BR11)', () => {
    const blog: FeedCard = {
      kind: 'blog',
      id: 'b1',
      title: 'How many hours can I work?',
      cover: { assetId: 'png-cover', alt: 'A student at a café counter' },
      minutes: 6,
      language: 'th',
    }
    render(list({ cards: [blog, postCard('p1')], filters: F({ theme: 'work-study-life' }) }))
    expect(
      screen.getByRole('link', { name: 'How many hours can I work?' }).getAttribute('href'),
    ).toBe('/feed/blog/b1?theme=work-study-life')
    expect(
      screen.getByRole('img', { name: 'A student at a café counter' }).getAttribute('src'),
    ).toBe('/blog/assets/png-cover')
    expect(screen.queryByText('6 min read') !== null).toBe(true)
    expect(screen.getByText('ไทย').getAttribute('lang')).toBe('th')
  })

  it('reads "Nothing in the feed yet." with no live posts, "No posts match." when the filters left none (83)', () => {
    render(list({ cards: [], liveCount: 0 }))
    expect(screen.getByText('Nothing in the feed yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
    cleanup()
    render(list({ cards: [], liveCount: 2, filters: F({ q: 'nothing' }) }))
    expect(screen.getByText('No posts match.')).toBeInTheDocument()
    expect(screen.queryByText('Nothing in the feed yet.')).toBeNull()
  })
})

describe('FeedPostCard: the slide buttons', () => {
  const slides = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ pngAssetId: `png-${i + 1}`, alt: `Slide ${i + 1}` }))
  /** The dot marking the slide shown, by its position. */
  const shownDot = () =>
    [...document.querySelectorAll('[data-dot]')].findIndex(
      (d) => d.getAttribute('aria-current') === 'true',
    )
  const press = (name: string) =>
    act(() => {
      fireEvent.click(screen.getByRole('button', { name }))
    })

  it('moves the slide shown, wrapping at the ends, from buttons outside the card’s link', () => {
    render(list({ cards: [postCard('p1', { slides: slides(3) })] }))
    expect(shownDot()).toBe(0)
    for (const name of ['Previous slide', 'Next slide']) {
      expect(screen.getByRole('button', { name }).closest('a') === null).toBe(true)
    }
    press('Next slide')
    expect(shownDot()).toBe(1)
    press('Next slide')
    press('Next slide')
    expect(shownDot()).toBe(0)
    press('Previous slide')
    expect(shownDot()).toBe(2)
  })

  it('offers no buttons for a single slide', () => {
    render(list({ cards: [postCard('p1', { slides: slides(1) })] }))
    expect(screen.queryAllByRole('button', { name: /slide$/ })).toHaveLength(0)
  })
})

describe('slideAt (the dots under a card’s slides)', () => {
  it('is the slide the strip has snapped to, within the slides', () => {
    expect(slideAt(0, 400, 5)).toBe(0)
    expect(slideAt(800, 400, 5)).toBe(2)
    expect(slideAt(590, 400, 5)).toBe(1)
    expect(slideAt(5000, 400, 5)).toBe(4)
    expect(slideAt(0, 0, 5)).toBe(0)
  })
})

describe('FeedList: the infinite scroll', () => {
  it('asks for the next page at the sentinel, with the page’s query and the cards it has, and appends it', async () => {
    let answer: (r: ActionResult<{ cards: FeedCard[] }>) => void = () => {}
    const loadPage = mock<Load>(() => new Promise((resolve) => (answer = resolve)))
    render(list({ loadPage, query: { theme: 'books-movies' } }))
    await reach()
    expect(loadPage).toHaveBeenCalledWith({ query: { theme: 'books-movies' }, offset: 8 })
    expect(screen.queryByText('Loading more posts…') !== null).toBe(true)

    await act(async () => answer({ ok: true, cards: cards('b', 8) }))
    expect(titles()).toHaveLength(16)
    expect(titles().slice(7, 9)).toEqual(['Post a8', 'Post b1'])
    expect(screen.queryByText('Loading more posts…')).toBeNull()

    await reach()
    expect(loadPage).toHaveBeenLastCalledWith({ query: { theme: 'books-movies' }, offset: 16 })
  })

  it('stops once a page comes back short, and never asks when the first page was', async () => {
    const loadPage = mock<Load>(async () => ({ ok: true, cards: cards('b', 3) }))
    render(list({ loadPage }))
    await reach()
    expect(titles()).toHaveLength(11)
    await reach()
    expect(loadPage).toHaveBeenCalledTimes(1)
    cleanup()

    const never = mock<Load>(async () => ({ ok: true, cards: [] }))
    render(list({ loadPage: never, cards: cards('a', 5) }))
    await reach()
    expect(never).not.toHaveBeenCalled()
  })

  it('shows a line with Try again when a page fails, which asks for the same page again', async () => {
    const loadPage = mock<Load>(async () => ({ ok: false, error: 'We couldn’t load more posts.' }))
    render(list({ loadPage }))
    await reach()
    expect(screen.queryByText('We couldn’t load more posts.') !== null).toBe(true)
    await reach()
    expect(loadPage).toHaveBeenCalledTimes(1)

    loadPage.mockImplementation(async () => ({ ok: true, cards: cards('b', 2) }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(loadPage).toHaveBeenLastCalledWith({ query: {}, offset: 8 })
    expect(titles()).toHaveLength(10)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('shows the same line with Try again when the page call itself rejects (offline, a dropped action)', async () => {
    const loadPage = mock<Load>(async () => {
      throw new Error('Failed to fetch')
    })
    render(list({ loadPage }))
    await reach()
    expect(screen.queryByText('We couldn’t load more posts.') !== null).toBe(true)
    expect(screen.queryByText('Loading more posts…') === null).toBe(true)
    expect(screen.queryAllByRole('button', { name: 'Try again' })).toHaveLength(1)
  })

  it('starts again from the first page when the filters change, and drops a page asked for before', async () => {
    let answer: (r: ActionResult<{ cards: FeedCard[] }>) => void = () => {}
    const loadPage = mock<Load>(() => new Promise((resolve) => (answer = resolve)))
    const { rerender } = render(list({ loadPage }))
    await reach()

    rerender(
      list({
        loadPage,
        cards: cards('t', 8),
        filters: F({ theme: 'books-movies' }),
        query: { theme: 'books-movies' },
      }),
    )
    // The old filters' page arrives late: it is not theirs any more.
    await act(async () => answer({ ok: true, cards: cards('old', 8) }))
    expect(titles()).toEqual(cards('t', 8).map((c) => c.title))

    await reach()
    expect(loadPage).toHaveBeenLastCalledWith({ query: { theme: 'books-movies' }, offset: 8 })
  })
})
