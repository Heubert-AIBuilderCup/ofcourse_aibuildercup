/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ActionResult } from '@/shared/types/action-result'
import type { FeedCard, Filters } from '../../lib/feed'
import { FeedList } from './FeedList'
import { slideAt } from './FeedPostCard'

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: [],
  home: null,
  theme: [],
  age: [],
  q: '',
  ...over,
})

const postCard = (id: string, over: Partial<Extract<FeedCard, { kind: 'post' }>> = {}) =>
  ({
    kind: 'post',
    id,
    title: `Post ${id}`,
    accounts: ['@ofcourse_ai'],
    layer: 'general',
    whyLine: null,
    caption: `${id} first line.`,
    slides: [
      { pngAssetId: `png-${id}-1`, alt: `Slide 1: ${id}` },
      { pngAssetId: `png-${id}-2`, alt: `Slide 2: ${id}` },
    ],
    sourceLine: null,
    roadmapLinks: null,
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
// next/image (the page's mark beside a post) resolves its src against the page's URL; happy-dom starts on about:blank.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/feed'))
afterAll(() => dom.setURL(startUrl))

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
            accounts: ['@ofcourse.main'],
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
    expect(screen.getAllByText('@ofcourse_ai')).toHaveLength(1)
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
    render(list({ cards: [blog, postCard('p1')], filters: F({ theme: ['work-study-life'] }) }))
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

describe('FeedList: the Show group', () => {
  const updates = [
    { id: 'u1', card: <h2>Update u1</h2> },
    { id: 'u2', card: <h2>Update u2</h2> },
  ]
  const blog: FeedCard = {
    kind: 'blog',
    id: 'b1',
    title: 'Blog b1',
    cover: null,
    minutes: 3,
  }

  it('puts her updates first, a screen each, before the posts', () => {
    render(list({ cards: [postCard('p1'), postCard('p2')], updates }))
    expect(titles()).toEqual(['Update u1', 'Update u2', 'Post p1', 'Post p2'])
  })

  it('drops the update screens when Updates is unticked', () => {
    render(list({ cards: [postCard('p1')], updates, filters: F({ show: ['posts', 'blogs'] }) }))
    expect(titles()).toEqual(['Post p1'])
  })

  it('drops the posts, or the blogs, the Show group unticked', () => {
    render(list({ cards: [blog, postCard('p1')], filters: F({ show: ['updates', 'blogs'] }) }))
    expect(screen.queryAllByRole('link', { name: 'Post p1' })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: 'Blog b1' })).toHaveLength(1)
    cleanup()
    render(list({ cards: [blog, postCard('p1')], filters: F({ show: ['updates', 'posts'] }) }))
    expect(screen.queryAllByRole('link', { name: 'Post p1' })).toHaveLength(1)
    expect(screen.queryAllByRole('link', { name: 'Blog b1' })).toHaveLength(0)
  })

  it('says "No updates for your roadmaps right now." with only Updates ticked and none for her', () => {
    render(list({ cards: [], updates: [], filters: F({ show: ['updates'] }) }))
    expect(screen.queryAllByText('No updates for your roadmaps right now.')).toHaveLength(1)
    expect(screen.queryAllByText('No posts match.')).toHaveLength(0)
    cleanup()
    // With some, her updates alone, and no line about posts.
    render(list({ cards: [], updates, filters: F({ show: ['updates'] }) }))
    expect(titles()).toEqual(['Update u1', 'Update u2'])
    expect(screen.queryAllByText('No posts match.')).toHaveLength(0)
    expect(screen.queryAllByText('No updates for your roadmaps right now.')).toHaveLength(0)
  })

  it('keeps her updates when no post matches, then says so', () => {
    render(list({ cards: [], updates, liveCount: 3 }))
    expect(titles()).toEqual(['Update u1', 'Update u2'])
    expect(screen.queryAllByText('No posts match.')).toHaveLength(1)
  })
})

describe('FeedPostCard: the panel beside the slides', () => {
  const region = (name: string) => screen.queryByRole('region', { name })
  const items = (el: HTMLElement | null) =>
    el ? [...el.querySelectorAll('li')].map((li) => li.textContent) : []

  it('names the account that posted it on one line, and how many more it went to', () => {
    const accounts = ['@ofcourse_ai', '@ofcourse_comics', '@ofcourse_selfhelp']
    render(list({ cards: [postCard('p1', { accounts }), postCard('p2')] }))
    expect(screen.getAllByText('@ofcourse_ai')).toHaveLength(2)
    expect(screen.queryByText('@ofcourse_comics')).toBeNull()
    expect(screen.getAllByText(/more$/).map((m) => m.textContent)).toEqual(['+2 more'])
    expect(screen.getByText('+2 more').getAttribute('title')).toBe(
      '@ofcourse_comics, @ofcourse_selfhelp',
    )
  })

  it('says the sample effect once, then the roadmaps it applies to and how many more', () => {
    const roadmapLinks = { effect: 'Adds background.', all: false, names: ['A', 'B', 'C'], more: 2 }
    render(list({ cards: [postCard('p1', { roadmapLinks })] }))
    const section = region('For your roadmaps')
    expect(section?.textContent).toContain('Sample')
    expect(section?.textContent?.split('Adds background.')).toHaveLength(2)
    expect(items(section)).toEqual(['A', 'B', 'C', 'and 2 more'])
  })

  it('says a general post applies to all her roadmaps', () => {
    const roadmapLinks = { effect: 'Adds background.', all: true, names: ['A'], more: 0 }
    render(list({ cards: [postCard('p1', { roadmapLinks })] }))
    expect(region('For your roadmaps')?.textContent).toContain('Applies to all your roadmaps')
    expect(items(region('For your roadmaps'))).toEqual(['A'])
  })

  it('says when the post is linked to none of her roadmaps, and leaves the section out without roadmaps', () => {
    const none = { effect: 'Adds background.', all: false, names: [], more: 0 }
    render(list({ cards: [postCard('p1', { roadmapLinks: none }), postCard('p2')] }))
    expect(screen.getAllByRole('region', { name: 'For your roadmaps' })).toHaveLength(1)
    expect(region('For your roadmaps')?.textContent).toContain('Not linked to your roadmaps yet')
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
        filters: F({ theme: ['books-movies'] }),
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

describe('FeedList: the wheel and the keys', () => {
  /** The posts' scroller, `screens` screens of 500 tall, its scrollTo recorded. */
  function feed(screens: number) {
    const el = screen.getByRole('region', { name: 'Posts' })
    Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: 500 * screens, configurable: true })
    const scrollTo = mock((_options: ScrollToOptions) => {})
    el.scrollTo = scrollTo as unknown as typeof el.scrollTo
    return { el, scrollTo }
  }
  /** The first post's panel, its long caption 800 tall in a 200 box, scrolled to `at`. */
  function longPanel(at: number) {
    const caption = screen.getByText('a1 first line.')
    const panel = caption.closest('.overflow-y-auto') as HTMLElement
    panel.style.overflowY = 'auto'
    Object.defineProperty(panel, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(panel, 'scrollHeight', { value: 800, configurable: true })
    Object.defineProperty(panel, 'scrollTop', { value: at, configurable: true, writable: true })
    return caption
  }
  const wheel = (target: Element, deltaY: number) => {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    return event
  }

  it('leaves the wheel to a long panel that can still scroll: the feed does not move', () => {
    render(list({ cards: cards('a', 2) }))
    const { scrollTo } = feed(2)
    const event = wheel(longPanel(0), 100)
    expect(event.defaultPrevented).toBe(false)
    expect(scrollTo).toHaveBeenCalledTimes(0)
  })

  it('moves one post once the panel is at its end', () => {
    render(list({ cards: cards('a', 2) }))
    const { scrollTo } = feed(2)
    const event = wheel(longPanel(600), 100)
    expect(event.defaultPrevented).toBe(true)
    expect(scrollTo.mock.calls.map(([o]) => o.top)).toEqual([500])
  })

  it('takes no focus on load, and stays reachable by Tab for the keys', () => {
    render(list({ cards: cards('a', 2) }))
    const posts = screen.getByRole('region', { name: 'Posts' })
    expect(document.activeElement === posts).toBe(false)
    expect(posts.getAttribute('tabindex')).toBe('0')
  })
})
