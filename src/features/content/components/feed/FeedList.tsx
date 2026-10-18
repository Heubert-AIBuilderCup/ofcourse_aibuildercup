'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { FEED_PAGE_SIZE, type FeedCard, type Filters, filterHref, shows } from '../../lib/feed'
import { BlogFeedCard } from './BlogFeedCard'
import { FeedPostCard } from './FeedPostCard'
import { nestedScroll, wheelGate } from './wheel'

/** A post's page in the feed, with every filter kept (criterion 81). */
export function postHref(id: string, filters: Filters): string {
  return filterHref(`${FEED_PATH}/${encodeURIComponent(id)}`, filters, {})
}

/** A blog's page in the feed, with every filter kept (criterion 81, BR11). */
export function blogHref(id: string, filters: Filters): string {
  return filterHref(`${FEED_PATH}/blog/${encodeURIComponent(id)}`, filters, {})
}

/** The feed's URL query, as the page received it. */
export type FeedQuery = Record<string, string | string[]>

/** The next page of cards after `offset` for `query` (loadFeedPageAction). */
export type LoadFeedPage = (input: {
  query: FeedQuery
  offset: number
}) => Promise<ActionResult<{ cards: FeedCard[] }>>

/** What the list says when a page could not be fetched at all. */
const LOAD_FAILED = 'We couldn’t load more posts.'

type Status = 'more' | 'loading' | 'failed' | 'end'
type Paging = { key: string; cards: FeedCard[]; status: Status; error: string }

/** A list's paging from its first page: more to ask for only when that page was full. */
const start = (key: string, cards: FeedCard[]): Paging => ({
  key,
  cards,
  status: cards.length < FEED_PAGE_SIZE ? 'end' : 'more',
  error: '',
})

const keyOf = (card: FeedCard) => `${card.kind}-${card.id}`

/** A screen of the feed: exactly as tall as the scroller, where its scroll comes to rest. */
const SCREEN = 'h-full snap-start snap-always'
/** A screen of the feed that is not a post (the empty line under her updates): its words centred, scrolling inside it when long. */
const TEXT_SCREEN = cn(
  SCREEN,
  'mx-auto flex w-full max-w-7xl flex-col overflow-y-auto px-gutter py-stack',
)

/** One of her updates, drawn by the page (UpdateCard), for a screen of its own. */
export type UpdateScreen = { id: string; card: ReactNode }

/** What the list says with only Updates ticked and none of hers. */
const NO_UPDATES = 'No updates for your roadmaps right now.'

/** What the list says with nothing ticked in the Show group. */
const NOTHING_SHOWN = 'Tick Updates, Posts or Blogs to see them.'

/** Why no post or blog is left, under her updates if any; none when her updates are all there is to show. */
function emptyLine(f: Filters, liveCount: number, updateCount: number): string | null {
  if (shows(f, 'posts') || shows(f, 'blogs'))
    return liveCount === 0 ? 'Nothing in the feed yet.' : 'No posts match.'
  if (!shows(f, 'updates')) return NOTHING_SHOWN
  return updateCount === 0 ? NO_UPDATES : null
}

/**
 * The live posts and blogs one per screen (criteria 71, BR11), in feed order and filtered: the
 * server's first page, then a page at a time as the end comes into view (`loadPage`), until one
 * comes back short. The list is its own scroller, filling the space it is given, that snaps one
 * screen at a time and never past one (wheel, trackpad, a swipe, and Page Down, Space and the
 * arrow keys once she tabs to it; it takes no focus on load), smoothly only when she allows motion;
 * a long panel or update under the wheel scrolls first. Her updates always first, a screen each
 * (none once Updates is unticked), then each post or blog the Show group leaves ticked one screen,
 * the loading line last. A page that fails says so with Try again; new filters start again from
 * their first page, and a page asked for under the old ones is dropped. With nothing to show: "Nothing
 * in the feed yet." when nothing is live, "No posts match." when the filters left none (criterion
 * 83), "No updates for your roadmaps right now." with only Updates ticked and none of hers.
 */
export function FeedList({
  cards,
  filters,
  query,
  liveCount,
  loadPage,
  updates = [],
}: {
  /** The first page, shaped by the server (feedCardOf). */
  cards: FeedCard[]
  filters: Filters
  query: FeedQuery
  /** How many posts and blogs are live before the filters, so the empty state says which it is. */
  liveCount: number
  loadPage: LoadFeedPage
  /** Her updates, newest first, already targeted: the chips and the words never narrow them. */
  updates?: UpdateScreen[]
}) {
  // The filters as their URL: a new one is a new feed.
  const key = filterHref('', filters, {})
  const [paging, setPaging] = useState(() => start(key, cards))
  if (paging.key !== key) setPaging(start(key, cards))
  const sentinel = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLElement>(null)
  const offset = paging.cards.length

  const next = useCallback(async () => {
    setPaging((p) => ({ ...p, status: 'loading' }))
    let result: Awaited<ReturnType<LoadFeedPage>>
    try {
      result = await loadPage({ query, offset })
    } catch {
      // The action never throws, but its transport can (offline, a deploy that dropped it).
      result = { ok: false, error: LOAD_FAILED }
    }
    setPaging((p) => {
      // Asked under filters that have changed since: not this feed's page.
      if (p.key !== key) return p
      if (!result.ok) return { ...p, status: 'failed', error: result.error }
      const have = new Set(p.cards.map(keyOf))
      return {
        ...p,
        cards: [...p.cards, ...result.cards.filter((c) => !have.has(keyOf(c)))],
        status: result.cards.length < FEED_PAGE_SIZE ? 'end' : 'more',
      }
    })
  }, [key, query, offset, loadPage])

  // Watched afresh after each page, so a sentinel still in view asks again.
  useEffect(() => {
    const el = sentinel.current
    if (!el || paging.status !== 'more') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect()
          void next()
        }
      },
      // A screen ahead, inside the scroller: the next page lands below, so nothing she sees moves.
      { root: scroller.current, rootMargin: '0px 0px 100% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [paging.status, next])

  // A wheel or trackpad gesture moves exactly one screen (wheel.ts), as TikTok's feed does; a
  // sideways one is left to the slides, and ctrl + wheel to the browser's zoom. Touch keeps the
  // scroller's own snapping.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const gate = wheelGate()
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      // A long panel or update under the pointer scrolls first; the feed moves once it is at its end.
      if (nestedScroll(e.target, el, 'y', e.deltaY)) return
      e.preventDefault()
      const step = gate(e.timeStamp, e.deltaY)
      if (step === 0) return
      const height = el.clientHeight
      const top = Math.min(
        el.scrollHeight - height,
        Math.max(0, (Math.round(el.scrollTop / height) + step) * height),
      )
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const shown = paging.cards.filter((c) => shows(filters, c.kind === 'blog' ? 'blogs' : 'posts'))
  const updateScreens = shows(filters, 'updates') ? updates : []
  const empty = shown.length > 0 ? null : emptyLine(filters, liveCount, updateScreens.length)

  if (shown.length === 0 && updateScreens.length === 0) {
    return (
      <div className="flex h-full flex-col gap-block overflow-y-auto py-stack">
        <p className="text-muted-foreground">{empty}</p>
      </div>
    )
  }
  const status = (
    <>
      {paging.status === 'loading' && (
        <p role="status" className="text-center text-caption text-muted-foreground">
          Loading more posts…
        </p>
      )}
      {paging.status === 'failed' && (
        <p role="alert" className="flex items-center justify-center gap-3 text-caption">
          {paging.error}
          <Button type="button" variant="outline" size="sm" onClick={() => void next()}>
            Try again
          </Button>
        </p>
      )}
    </>
  )
  return (
    // The scroller is the only thing that scrolls: one screen per post, never skipping one (wheel,
    // trackpad, a swipe; Page Down, Space and the arrow keys once she has tabbed to it), held
    // inside it. Its ring shows on keyboard focus only (focus-visible), inset so it is not clipped.
    <section
      ref={scroller}
      aria-label="Posts"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region takes focus so the keys scroll it.
      tabIndex={0}
      className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-ring motion-safe:scroll-smooth"
    >
      {/* No box of its own, so each item's h-full is the scroller's height, one post per screen. */}
      <ul className="contents">
        {updateScreens.map((u) => (
          <li key={`update-${u.id}`} className={cn(SCREEN, 'px-gutter py-4')}>
            <div className="mx-auto flex h-full w-full max-w-lg flex-col overflow-y-auto">
              <div className="my-auto">{u.card}</div>
            </div>
          </li>
        ))}
        {shown.map((card, i) => (
          <li key={keyOf(card)} className={cn(SCREEN, 'px-gutter py-4 @container-size')}>
            {card.kind === 'blog' ? (
              <div className="mx-auto flex h-full w-full max-w-lg flex-col overflow-y-auto">
                <div className="my-auto">
                  <BlogFeedCard blog={card} href={blogHref(card.id, filters)} priority={i === 0} />
                </div>
              </div>
            ) : (
              <FeedPostCard card={card} href={postHref(card.id, filters)} priority={i === 0} />
            )}
          </li>
        ))}
      </ul>
      {paging.status === 'more' && <div ref={sentinel} aria-hidden="true" />}
      {empty ? (
        <div className={TEXT_SCREEN}>
          <div className="my-auto flex flex-col gap-block">
            {status}
            <p className="text-muted-foreground">{empty}</p>
          </div>
        </div>
      ) : (
        status
      )}
    </section>
  )
}
