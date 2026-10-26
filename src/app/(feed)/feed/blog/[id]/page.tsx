import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { BlogArticle, RelatedBlogs } from '@/features/content/components/feed/BlogArticle'
import { FeedChips } from '@/features/content/components/feed/FeedChips'
import { blogHref, postHref } from '@/features/content/components/feed/FeedList'
import { FollowPages } from '@/features/content/components/feed/FollowPages'
import { feedAssetHref } from '@/features/content/components/feed/SlideStrip'
import { filterHref, parseFilters } from '@/features/content/lib/feed'
import { chipsFromProfile } from '@/features/content/lib/profile-contract'
import { blogAssetPath, relatedBlogs } from '@/features/content/lib/public-blog'
import { liveBlogs } from '@/features/content/server/store'
import { loadStudentProfile } from '@/features/content/server/student-profile'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { getSession, requireSession } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'

/**
 * The live, unexpired blogs, read once per request: the blog this page shows is found among them by
 * its id, and its related blogs come from the same read. The metadata and the page share it.
 */
const readBlogs = cache(() => liveBlogs())

export async function generateMetadata({
  params,
}: PageProps<'/feed/blog/[id]'>): Promise<Metadata> {
  if (!(await getSession())) return { title: SITE_NAME }
  const { id } = await params
  const blog = (await readBlogs()).find((b) => b.id === id)
  return { title: `${blog?.title ?? 'Not found'} · ${SITE_NAME}` }
}

/**
 * A live blog inside the app, for any signed-in account (BR11): the article with its linked posts'
 * slides and its live posts in the feed (BR7), its related blogs and "Follow us", with the chips
 * kept from the feed (criterion 81). The pictures come from the blog image route, the embedded
 * slides from the feed's. A blog not live, expired or unknown is "not found".
 */
export default async function FeedBlogPage({ params, searchParams }: PageProps<'/feed/blog/[id]'>) {
  const session = await requireSession()
  const [{ id }, query, profile, blogs] = await Promise.all([
    params,
    searchParams,
    loadStudentProfile(session.user.id),
    readBlogs(),
  ])
  const blog = blogs.find((b) => b.id === id)
  if (!blog) notFound()
  const filters = chipsFromProfile(profile, parseFilters(query))
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-block px-gutter py-section">
      <FeedChips pathname={`${FEED_PATH}/blog/${encodeURIComponent(id)}`} filters={filters} />
      <Link
        href={filterHref(FEED_PATH, filters, {})}
        className="self-start text-caption text-muted-foreground underline-offset-4 hover:underline"
      >
        Feed
      </Link>
      <BlogArticle
        blog={blog}
        pictureHref={blogAssetPath}
        slideHref={feedAssetHref}
        postHref={(p) => postHref(p.id, filters)}
      />
      <RelatedBlogs blogs={relatedBlogs(blog, blogs)} href={(b) => blogHref(b.id, filters)} />
      <FollowPages linkedin />
    </div>
  )
}
