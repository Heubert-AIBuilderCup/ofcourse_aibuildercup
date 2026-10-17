import 'server-only'
import { type FeedItem, type Filters, feedOrder, parseFilters } from '../lib/feed'
import { chipsFromProfile } from '../lib/profile-contract'
import { feedBlogOf } from '../lib/public-blog'
import { keptFor } from './kept-for'
import { listLive, liveBlogs } from './store'
import { loadStudentProfile } from './student-profile'

type Query = Record<string, string | string[] | undefined>
type Feed = { filters: Filters; ordered: FeedItem[] }

/**
 * Every live post and blog, before ordering. Each page of the infinite scroll slices this whole
 * list (up to FEED_LIMIT posts and BLOGS_LIMIT blogs) to return FEED_PAGE_SIZE cards, so the
 * pages reuse a read from the last 30 s instead of re-reading all of it per page. It is the same
 * for every account (her filters and profile apply after), so one copy serves all; a post
 * published or withdrawn reaches a scroll page within those 30 s, and the feed page's own first
 * render always reads afresh.
 */
const live = keptFor(30_000, async (now): Promise<FeedItem[]> => {
  const [posts, blogs] = await Promise.all([listLive(), liveBlogs(now)])
  return [...posts, ...blogs.map(feedBlogOf)]
})

async function feedOf(items: Promise<FeedItem[]>, userId: string, query: Query, now: Date) {
  const [all, profile] = await Promise.all([items, loadStudentProfile(userId)])
  const filters = chipsFromProfile(profile, parseFilters(query))
  return { filters, ordered: feedOrder(all, now) }
}

/**
 * One account's feed for a URL's query: its filters (the URL's, else her profile's, criterion
 * 84) and every live post and blog in feed order (criteria 71, 72, BR11), before the filters.
 * The feed page reads its first page from it, always from the store; loadFeedPageAction reads
 * each next one through readFeedPage, so both slice the same list.
 */
export function readFeed(userId: string, query: Query): Promise<Feed> {
  const now = new Date()
  return feedOf(live.fresh(now), userId, query, now)
}

/** As readFeed, for a scroll page: the live list read in the last 30 s is reused. */
export function readFeedPage(userId: string, query: Query): Promise<Feed> {
  const now = new Date()
  return feedOf(live.recent(now), userId, query, now)
}
