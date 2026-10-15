import { FEED_PATH } from '@/shared/lib/auth/gate'
import { type FeedItem, type Filters, filterHref, isFeedBlog, versionOf } from '../../lib/feed'
import { PhoneFeedCard } from '../PhoneFeedCard'
import { BlogFeedCard } from './BlogFeedCard'
import { feedAssetHref } from './SlideStrip'

/** A post's page in the feed, with every filter kept (criterion 81). */
export function postHref(id: string, filters: Filters): string {
  return filterHref(`${FEED_PATH}/${encodeURIComponent(id)}`, filters, {})
}

/** A blog's page in the feed, with every filter kept (criterion 81, BR11). */
export function blogHref(id: string, filters: Filters): string {
  return filterHref(`${FEED_PATH}/blog/${encodeURIComponent(id)}`, filters, {})
}

/**
 * The live posts as phone-sized cards (criterion 71) and the live blogs as blog cards (BR11),
 * already in feed order and filtered, each post with the version the home chip asks for (criterion
 * 82). Stacked at phone width, a wrapping row on a desktop. With nothing to show: "Nothing in the
 * feed yet." when nothing is live, "No posts match." when the filters left none (criterion 83).
 */
export function FeedList({
  posts,
  filters,
  liveCount,
}: {
  posts: FeedItem[]
  filters: Filters
  /** How many posts and blogs are live before the filters, so the empty state says which it is. */
  liveCount: number
}) {
  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground">
        {liveCount === 0 ? 'Nothing in the feed yet.' : 'No posts match.'}
      </p>
    )
  }
  return (
    <ul className="flex flex-wrap gap-stack">
      {posts.map((item) => {
        if (isFeedBlog(item)) {
          return (
            <li key={`blog-${item.id}`}>
              <BlogFeedCard blog={item} href={blogHref(item.id, filters)} />
            </li>
          )
        }
        const version = versionOf(item, filters.home)
        return (
          <li key={item.id}>
            <PhoneFeedCard
              coverSrc={feedAssetHref(version.slides[0]?.pngAssetId ?? '')}
              href={postHref(item.id, filters)}
              title={item.title}
              excerpt={version.excerpt}
              settings={item.settings}
              sourceLine={item.sourceLine}
              language={item.language}
            />
          </li>
        )
      })}
    </ul>
  )
}
