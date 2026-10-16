import type { Metadata } from 'next'
import { FeedChips } from '@/features/content/components/feed/FeedChips'
import { FeedList } from '@/features/content/components/feed/FeedList'
import { FollowPages } from '@/features/content/components/feed/FollowPages'
import { SearchBox } from '@/features/content/components/feed/SearchBox'
import { applyFilters, feedOrder, parseFilters } from '@/features/content/lib/feed'
import { chipsFromProfile } from '@/features/content/lib/profile-contract'
import { feedBlogOf } from '@/features/content/lib/public-blog'
import { listLive, liveBlogs } from '@/features/content/server/store'
import { loadStudentProfile } from '@/features/content/server/student-profile'
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
 * first then newest approval first, to any (criteria 81–83); with no filter in the URL, the
 * student's profile fills the chips (84), which match blogs as they match posts. Above the posts,
 * the live updates that target her through one of her roadmaps, each opening that roadmap; none
 * for a visitor without roadmaps (an admin).
 */
export default async function FeedPage({ searchParams }: PageProps<'/feed'>) {
  const session = await requireSession()
  const [query, live, blogs, profile, updates] = await Promise.all([
    searchParams,
    listLive(),
    liveBlogs(),
    loadStudentProfile(session.user.id),
    readFeedUpdates(session.user.id),
  ])
  const filters = chipsFromProfile(profile, parseFilters(query))
  const ordered = feedOrder([...live, ...blogs.map(feedBlogOf)], new Date())
  const posts = applyFilters(ordered, filters)
  return (
    <div className="flex flex-col gap-block">
      <div className="flex flex-col gap-stack">
        <h1 className="text-h1 font-semibold tracking-tight">Feed</h1>
        <SearchBox pathname={FEED_PATH} filters={filters} />
        <FeedChips pathname={FEED_PATH} filters={filters} />
      </div>
      {updates.length > 0 && (
        // Targeted already: neither the chips nor the search narrow them.
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
      <FeedList posts={posts} filters={filters} liveCount={ordered.length} />
      <FollowPages />
    </div>
  )
}
