import Link from 'next/link'
import type { Filters } from '../../lib/feed'
import type { Related } from '../../lib/related'
import { postHref } from './FeedList'

/**
 * "Related": up to four other live posts with the reason each is there, strongest first
 * (criterion 91). Every link keeps the current filters (criterion 81). With none, nothing.
 */
export function RelatedPosts({ related, filters }: { related: Related[]; filters: Filters }) {
  if (related.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h4 font-semibold">Related</h2>
      <ul className="flex flex-col gap-2">
        {related.map(({ post, why }) => (
          <li key={post.id} className="flex flex-col">
            <Link
              href={postHref(post.id, filters)}
              className="self-start font-heading underline-offset-4 hover:underline"
            >
              {post.title}
            </Link>
            <p className="text-caption text-muted-foreground">{why}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
