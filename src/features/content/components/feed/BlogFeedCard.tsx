import Link from 'next/link'
import { Blueprint } from '@/shared/components/Blueprint'
import { cn } from '@/shared/lib/utils'
import type { FeedCard } from '../../lib/feed'
import { blogAssetPath } from '../../lib/public-blog'
import { tag } from '../classes'
import { LanguageTag } from '../PhoneFeedCard'

/** The 16:9 shape a blog's cover is drawn at, so the card keeps its place while it loads. */
const COVER = { width: 1600, height: 900 } as const

/**
 * A live blog as a student meets it in the feed (BR11): a frame as wide as the post cards' column
 * with "Guide", its language when it is not English (GD40), its cover from the blog image route,
 * its title linked to its page in the feed and its reading time. Only what the reviewer published.
 */
export function BlogFeedCard({
  blog,
  href,
}: {
  blog: Extract<FeedCard, { kind: 'blog' }>
  href: string
}) {
  return (
    <Blueprint className="flex w-full flex-col gap-3 p-3 wrap-anywhere">
      <p className={cn(tag, 'self-start')}>Guide</p>
      <LanguageTag language={blog.language} />
      {blog.cover && (
        // The PNG is the stored, tinted cover: nothing to optimise.
        // biome-ignore lint/performance/noImgElement: next/image would re-encode the stored picture.
        <img
          src={blogAssetPath(blog.cover.assetId)}
          alt={blog.cover.alt}
          {...COVER}
          className="block h-auto w-full border"
        />
      )}
      <h2 className="text-h4">
        <Link href={href} className="underline-offset-4 hover:underline">
          {blog.title}
        </Link>
      </h2>
      <p className="text-caption text-muted-foreground">{`${blog.minutes} min read`}</p>
    </Blueprint>
  )
}
