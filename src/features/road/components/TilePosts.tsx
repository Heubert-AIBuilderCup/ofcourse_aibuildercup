import Link from 'next/link'
import type { TilePost } from '@/features/roads/client'
import { buttonVariants } from '@/shared/components/ui/button'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'

/**
 * A card's "Posts and updates": each post or update about its tile, with the line saying why it is
 * there (a post opens in the feed; an update shows what it says), then "See all in the feed".
 */
export function TilePosts({ posts }: { posts: TilePost[] }) {
  return (
    <section aria-label="Posts and updates" className="flex flex-col gap-1.5 border-t pt-3">
      <span className="text-overline text-muted-foreground uppercase">Posts and updates</span>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {posts.map((p) => (
          <li key={`${p.kind}:${p.id}`} className="flex flex-col gap-0.5">
            {p.href ? (
              <Link
                href={p.href}
                className="font-medium underline-offset-3 hover:text-accent-800 hover:underline"
              >
                {p.title}
              </Link>
            ) : (
              <span className="font-medium">{p.title}</span>
            )}
            {p.body ? <span className="text-caption">{p.body}</span> : null}
            <span className="text-caption text-muted-foreground">{p.why}</span>
          </li>
        ))}
      </ul>
      <Link href={FEED_PATH} className={cn(buttonVariants({ variant: 'text' }), 'self-start')}>
        See all in the feed
      </Link>
    </section>
  )
}
