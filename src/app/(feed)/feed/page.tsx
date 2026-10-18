import type { Metadata } from 'next'
import { FeedFilters } from '@/features/content/components/feed/FeedFilters'
import { FeedFiltersSheet } from '@/features/content/components/feed/FeedFiltersSheet'
import { FeedList, type FeedQuery } from '@/features/content/components/feed/FeedList'
import { loadFeedPageAction } from '@/features/content/feed-actions'
import { FEED_PAGE_SIZE, feedCardOf, feedPage } from '@/features/content/lib/feed'
import { readFeed } from '@/features/content/server/feed'
import { UpdateCard } from '@/features/updates/components/UpdateCard'
import { feedWords } from '@/features/updates/lib/update'
import { readFeedUpdates } from '@/features/updates/server/feed-updates'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { requireSession } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'
import { roadmapPath } from '@/shared/lib/student-paths'

export const metadata: Metadata = { title: `Feed · ${SITE_NAME}` }

/**
 * The student feed: every live post, and every live blog as a blog card (BR11), pinned Featured
 * first then newest approval first, to any (criteria 81–83), one per screen, a page at a time
 * (FeedList asks loadFeedPageAction for each next one); with no filter in the URL, her roadmaps
 * fill the filters (84), which match blogs as they match posts. First come the live updates that
 * target her through one of her roadmaps, a screen each, each opening that roadmap (none for a
 * visitor without roadmaps, an admin); the Show group (`show`, absent is all) drops her updates,
 * the posts or the blogs, and its Updates box counts hers.
 */
export default async function FeedPage({ searchParams }: PageProps<'/feed'>) {
  const session = await requireSession()
  const params = await searchParams
  // The query as the next pages ask for it: the URL's keys, without the absent ones.
  const query: FeedQuery = Object.fromEntries(
    Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, v]])),
  )
  const [{ filters, ordered, roadmaps }, updates] = await Promise.all([
    readFeed(session.user.id, query),
    readFeedUpdates(session.user.id),
  ])
  const first = feedPage(ordered, filters, 0, FEED_PAGE_SIZE).map((item) =>
    feedCardOf(item, filters.home, roadmaps),
  )
  return (
    // One screen under the bar (the layout grows it to fill, data-feed-shell): from 64rem the title
    // and the filters in a side column that stays put beside the posts; below, a slim bar with the
    // title and a Filters button for the sheet. Only the posts scroll, their scrollbar at the window's
    // right edge, each post centred in its own frame. --feed-side is the side column's whole share,
    // the gap to the posts (its right padding) included: FeedPostCard reads it to centre a slide
    // on the window, so the two never drift apart.
    <div
      data-feed-shell
      className="flex min-h-0 w-full flex-1 flex-col [--feed-side:20rem] @5xl:flex-row"
    >
      <aside
        aria-label="Filters"
        className="flex w-(--feed-side) min-w-0 shrink-0 flex-col gap-stack overflow-x-hidden overflow-y-auto py-stack pr-stack pl-gutter @max-5xl:hidden"
      >
        <h1 className="text-h2 font-semibold tracking-tight">Feed</h1>
        <FeedFilters pathname={FEED_PATH} filters={filters} updateCount={updates.length} />
      </aside>
      <div className="flex items-center justify-between gap-stack px-gutter py-stack @5xl:hidden">
        <h1 className="text-h3 font-semibold tracking-tight">Feed</h1>
        <FeedFiltersSheet pathname={FEED_PATH} filters={filters} updateCount={updates.length} />
      </div>
      <div className="min-h-0 min-w-0 flex-1">
        <FeedList
          cards={first}
          filters={filters}
          query={query}
          liveCount={ordered.length}
          loadPage={loadFeedPageAction}
          // Targeted already: neither the filters nor the search narrow them.
          updates={updates.map(({ update, roadmapId, why }) => ({
            id: update.id,
            card: <UpdateCard update={update} {...feedWords(why)} href={roadmapPath(roadmapId)} />,
          }))}
        />
      </div>
    </div>
  )
}
