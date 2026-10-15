import Link from 'next/link'
import type { ComicCover } from '../lib/public-post'

/** The 1080 × 1350 canvas every panel was drawn on, so the cover keeps its shape while it loads. */
const CANVAS = { width: 1080, height: 1350 } as const

/**
 * A live comic on a futures card (RC16): its first panel and "Read the comic: <title>", one link
 * to its public page. Client-safe and presentational: the card decides whether to show it.
 */
export function ComicCoverLink({ comic }: { comic: ComicCover }) {
  return (
    <Link
      href={comic.href}
      className="flex items-center gap-3 self-start underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* The PNG is the stored panel, public at its asset path: nothing to optimise. */}
      {/* biome-ignore lint/performance/noImgElement: next/image would re-encode the stored picture. */}
      <img
        src={comic.coverSrc}
        alt=""
        {...CANVAS}
        loading="lazy"
        className="block h-auto w-16 border"
      />
      <span>{`Read the comic: ${comic.title}`}</span>
    </Link>
  )
}
