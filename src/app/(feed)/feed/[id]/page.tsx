import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { FeedChips } from '@/features/content/components/feed/FeedChips'
import { FeedPostView } from '@/features/content/components/feed/FeedPostView'
import { FollowPages } from '@/features/content/components/feed/FollowPages'
import { type FeedPost, parseFilters } from '@/features/content/lib/feed'
import { chipsFromProfile } from '@/features/content/lib/profile-contract'
import { relatedTo } from '@/features/content/lib/related'
import { liveById, relatedCandidates } from '@/features/content/server/store'
import { loadStudentProfile } from '@/features/content/server/student-profile'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { getSession, requireSession } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'

/** The live post with this id, read by its id, or null. Cached per request, so the metadata and the page share one read. */
const livePost = cache((id: string): Promise<FeedPost | null> => liveById(id))

export async function generateMetadata({ params }: PageProps<'/feed/[id]'>): Promise<Metadata> {
  if (!(await getSession())) return { title: SITE_NAME }
  const post = await livePost((await params).id)
  return { title: `${post?.title ?? 'Not found'} · ${SITE_NAME}` }
}

/**
 * A live post's page for any signed-in account, with the version the home chip asks for
 * (criterion 82) and the chips kept from the feed (criterion 81).
 */
export default async function FeedPostPage({ params, searchParams }: PageProps<'/feed/[id]'>) {
  const session = await requireSession()
  const [{ id }, query, profile] = await Promise.all([
    params,
    searchParams,
    loadStudentProfile(session.user.id),
  ])
  const post = await livePost(id)
  if (!post) notFound()
  const filters = chipsFromProfile(profile, parseFilters(query))
  // Only the live, unexpired posts sharing its source or a tag are read (criteria 73, 91, SR10).
  const related = relatedTo(post, await relatedCandidates(post))
  return (
    <div className="flex flex-col gap-block">
      <FeedChips pathname={`${FEED_PATH}/${encodeURIComponent(id)}`} filters={filters} />
      <FeedPostView post={post} filters={filters} related={related} />
      <FollowPages />
    </div>
  )
}
