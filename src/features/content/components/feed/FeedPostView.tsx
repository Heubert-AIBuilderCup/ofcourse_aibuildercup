import Link from 'next/link'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'
import { linesOf } from '../../languages'
import { type FeedPost, type Filters, filterHref, versionOf } from '../../lib/feed'
import type { Related } from '../../lib/related'
import { tag } from '../classes'
import { ctaOf, LAYER_TAGS, LanguageTag } from '../PhoneFeedCard'
import { blogHref } from './FeedList'
import { PostSources } from './PostSources'
import { RelatedPosts } from './RelatedPosts'
import { SlideStrip } from './SlideStrip'

/**
 * A live post on its own page (criterion 75): the layer tag, its language when it is not English
 * (GD40), title, why line, every slide of the
 * version the home chip asks for (criterion 82), the Studio call to action, its sources with their
 * links (GD31; the source line of a post read before them), "Read the full guide" while its blog is
 * live (BR7), those lines in the post's language (GD39), the Instagram links when the post went out there (criterion 90) and the related
 * posts (criterion 91). Only what the reviewer approved or
 * the editor set; the call to action is text because no Studio exists yet. The way back to the
 * feed keeps every filter.
 */
export function FeedPostView({
  post,
  filters,
  related = [],
}: {
  post: FeedPost
  filters: Filters
  related?: Related[]
}) {
  const layer = LAYER_TAGS[post.settings.layer]
  const cta = ctaOf(post.settings.studioLink)
  const version = versionOf(post, filters.home)
  // The lines code writes, in the post's language (GD39).
  const fixed = linesOf(post.language)
  return (
    <article className="flex flex-col gap-stack">
      <Link
        href={filterHref(FEED_PATH, filters, {})}
        className="self-start text-caption text-muted-foreground underline-offset-4 hover:underline"
      >
        Feed
      </Link>
      <header className="flex flex-col gap-2">
        {layer && <p className={cn(tag, 'self-start')}>{layer}</p>}
        <LanguageTag language={post.language} />
        <h1 className="text-h1 font-semibold tracking-tight">{post.title}</h1>
        {post.settings.whyLine && <p className="text-accent-700">{post.settings.whyLine}</p>}
      </header>
      <SlideStrip slides={version.slides} />
      {cta && <p className="self-start border px-3 py-2 font-heading">{cta}</p>}
      {post.sources?.length ? (
        <PostSources sources={post.sources} heading={fixed.sources} />
      ) : (
        post.sourceLine && <p className="text-caption text-muted-foreground">{post.sourceLine}</p>
      )}
      {post.guide && (
        // The blog this post comes from or belongs to, while it is live (BR7), inside the app.
        <Link
          href={blogHref(post.guide.id, filters)}
          className="self-start font-heading underline-offset-4 hover:underline"
        >
          {fixed.guide}
        </Link>
      )}
      {post.instagram && (
        // The post as it went out on Instagram, and the page it went out under (criterion 90).
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={post.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading underline-offset-4 hover:underline"
          >
            See this post on Instagram
          </a>
          <a
            href={post.instagram.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading underline-offset-4 hover:underline"
          >
            {`Follow @${post.instagram.handle}`}
          </a>
        </p>
      )}
      <RelatedPosts related={related} filters={filters} />
    </article>
  )
}
