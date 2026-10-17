import type { Metadata } from 'next'
import { FeedFilters } from '@/features/content/components/feed/FeedFilters'
import { FeedList, type FeedQuery } from '@/features/content/components/feed/FeedList'
import { FollowPages } from '@/features/content/components/feed/FollowPages'
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
 * first then newest approval first, to any (criteria 81–83), one column of cards a page at a time
 * (FeedList asks loadFeedPageAction for each next one); with no filter in the URL, the student's
 * profile fills the filters (84), which match blogs as they match posts. Above the posts, the live
 * updates that target her through one of her roadmaps, each opening that roadmap; none for a
 * visitor without roadmaps (an admin).
 */
export default async function FeedPage({ searchParams }: PageProps<'/feed'>) {
  const session = await requireSession()
  const params = await searchParams
  // The query as the next pages ask for it: the URL's keys, without the absent ones.
  const query: FeedQuery = Object.fromEntries(
    Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, v]])),
  )
  const [{ filters, ordered }, updates] = await Promise.all([
    readFeed(session.user.id, query),
    readFeedUpdates(session.user.id),
  ])
  const first = feedPage(ordered, filters, 0, FEED_PAGE_SIZE).map((item) =>
    feedCardOf(item, filters.home),
  )
  return (
    <div className="flex flex-col gap-block">
      <div className="flex flex-col gap-stack">
        <h1 className="text-h1 font-semibold tracking-tight">Feed</h1>
        <FeedFilters pathname={FEED_PATH} filters={filters} />
      </div>
      {updates.length > 0 && (
        // Targeted already: neither the filters nor the search narrow them.
        <section aria-labelledby="updates-for-you" className="flex flex-col gap-stack">
          <h2 id="updates-for-you" className="text-h3">
            Updates for you
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-stack">
            {updates.map(({ update, roadmapId, why }) => (
              <li key={update.id}>
                <UpdateCard update={update} {...feedWords(why)} href={roadmapPath(roadmapId)} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <FeedList
        cards={first}
        filters={filters}
        query={query}
        liveCount={ordered.length}
        loadPage={loadFeedPageAction}
      />
      <FollowPages />
    </div>
  )
}
