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
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { requireSession } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'

export const metadata: Metadata = { title: `Feed · ${SITE_NAME}` }

/**
 * The student feed: every live post, and every live blog as a blog card (BR11), pinned Featured
 * first then newest approval first, to any (criteria 81–83); with no filter in the URL, the
 * student's profile fills the chips (84), which match blogs as they match posts.
 */
export default async function FeedPage({ searchParams }: PageProps<'/feed'>) {
  const session = await requireSession()
  const [query, live, blogs, profile] = await Promise.all([
    searchParams,
    listLive(),
    liveBlogs(),
    loadStudentProfile(session.user.id),
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
      <FeedList posts={posts} filters={filters} liveCount={ordered.length} />
      <FollowPages />
    </div>
  )
}
