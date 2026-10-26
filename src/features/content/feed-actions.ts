'use server'

import { z } from 'zod'
import { ACCESS_ERRORS } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import { FEED_PAGE_SIZE, type FeedCard, feedCardOf, feedPage } from './lib/feed'
import { readFeedPage } from './server/feed'

// The feed's infinite scroll (src/app/(feed)/feed): the next page of cards for the URL the page
// was opened with. Read-only. Any account that is not suspended reads the feed, as the page lets
// it, so the session is the only check; the account is the session's, never the caller's.
// The live list behind each page is reused for a short while (server/feed.ts readFeedPage).
// Nothing here throws: a failure is a message.

/** A URL query as the page received it: short values, a few keys; parseFilters keeps the known ones. */
const Value = z.string().max(500)
const Input = z.object({
  query: z
    .record(z.string().max(32), z.union([Value, z.array(Value).max(8)]))
    .refine((q) => Object.keys(q).length <= 16),
  offset: z.number().int().min(0).max(10_000),
})

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** The `FEED_PAGE_SIZE` cards after the first `offset` of the feed for `query`; fewer at its end. */
export async function loadFeedPageAction(
  input: unknown,
): Promise<ActionResult<{ cards: FeedCard[] }>> {
  const session = await getSession()
  if (!session) return fail(ACCESS_ERRORS.notAuthorised)
  const parsed = Input.safeParse(input)
  if (!parsed.success) return fail('Unknown page.')
  const { query, offset } = parsed.data
  try {
    const { filters, ordered, roadmaps } = await readFeedPage(session.user.id, query)
    const cards = feedPage(ordered, filters, offset, FEED_PAGE_SIZE).map((item) =>
      feedCardOf(item, filters.home, roadmaps),
    )
    return { ok: true, cards }
  } catch (error) {
    console.error('loadFeedPageAction', error)
    return fail('We couldn’t load more posts.')
  }
}
