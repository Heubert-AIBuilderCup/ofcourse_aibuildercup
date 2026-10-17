'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import type { ActionResult } from '@/shared/types/action-result'
import { FEED_PAGE_SIZE, type FeedCard, type Filters, filterHref } from '../../lib/feed'
import { BlogFeedCard } from './BlogFeedCard'
import { FeedPostCard } from './FeedPostCard'

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

/**
 * The live posts and blogs as one column of cards (criteria 71, BR11), in feed order and
 * filtered: the server's first page, then a page at a time as the end comes into view
 * (`loadPage`), until one comes back short. A page that fails says so with Try again; new filters
 * start again from their first page, and a page asked for under the old ones is dropped. With
 * nothing to show: "Nothing in the feed yet." when nothing is live, "No posts match." when the
 * filters left none (criterion 83).
 */
export function FeedList({
  cards,
  filters,
  query,
  liveCount,
  loadPage,
}: {
  /** The first page, shaped by the server (feedCardOf). */
  cards: FeedCard[]
  filters: Filters
  query: FeedQuery
  /** How many posts and blogs are live before the filters, so the empty state says which it is. */
  liveCount: number
  loadPage: LoadFeedPage
}) {
  // The filters as their URL: a new one is a new feed.
  const key = filterHref('', filters, {})
  const [paging, setPaging] = useState(() => start(key, cards))
  if (paging.key !== key) setPaging(start(key, cards))
  const sentinel = useRef<HTMLDivElement>(null)
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
      { rootMargin: '0px 0px 600px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [paging.status, next])

  if (paging.cards.length === 0) {
    return (
      <p className="text-muted-foreground">
        {liveCount === 0 ? 'Nothing in the feed yet.' : 'No posts match.'}
      </p>
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-stack">
      <ul className="flex flex-col gap-stack">
        {paging.cards.map((card) => (
          <li key={keyOf(card)}>
            {card.kind === 'blog' ? (
              <BlogFeedCard blog={card} href={blogHref(card.id, filters)} />
            ) : (
              <FeedPostCard card={card} href={postHref(card.id, filters)} />
            )}
          </li>
        ))}
      </ul>
      {paging.status === 'more' && <div ref={sentinel} aria-hidden="true" />}
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
    </div>
  )
}
