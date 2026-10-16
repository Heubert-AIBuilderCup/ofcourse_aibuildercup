'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { FeedCard } from '../../lib/feed'
import { tag } from '../classes'
import { LAYER_TAGS, LanguageTag } from '../PhoneFeedCard'
import { feedAssetHref } from './SlideStrip'

/** The 1080 × 1350 canvas every slide was drawn on, so each keeps its place while it loads. */
const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1350

/** The slide a strip `width` wide has snapped to at `scrollLeft`, within its `count` slides. */
export function slideAt(scrollLeft: number, width: number, count: number): number {
  if (width <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)))
}

/**
 * A post in the feed as Instagram shows one (criterion 71): a top line with the page it went out
 * under and its tags (the layer's, its language's), its slides as a square strip that swipes one
 * at a time with dots for the one shown (75), its title and the first line of its text, then the
 * why line and the source line. The whole card opens the post's page, named by its title. With
 * more than one slide, Previous and Next sit over the strip's sides, outside the link (a button
 * cannot sit in one), so a keyboard or a mouse without a trackpad reaches every slide; they wrap
 * at the ends, so neither is ever disabled under her focus. The card is a grid whose rows the
 * link shares (subgrid), so the buttons can lie over the strip's row while the strip still swipes
 * beneath them.
 */
export function FeedPostCard({
  card,
  href,
}: {
  card: Extract<FeedCard, { kind: 'post' }>
  href: string
}) {
  const titleId = useId()
  const strip = useRef<HTMLOListElement>(null)
  const [shown, setShown] = useState(0)
  const layer = LAYER_TAGS[card.layer]
  const count = card.slides.length

  /** Show slide `i` (wrapping), scrolled to as the strip's own snap would. */
  const show = (i: number) => {
    const next = (i + count) % count
    setShown(next)
    const el = strip.current
    el?.scrollTo?.({ left: next * el.clientWidth })
  }

  return (
    <article className="grid grid-rows-[auto_auto_1fr] gap-3 border bg-background wrap-anywhere">
      <Link
        href={href}
        aria-labelledby={titleId}
        className="col-start-1 row-span-3 row-start-1 grid grid-rows-subgrid p-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto font-heading font-semibold">{card.page}</p>
          {layer && <p className={tag}>{layer}</p>}
          <LanguageTag language={card.language} />
        </div>
        <ol
          ref={strip}
          className="flex snap-x snap-mandatory overflow-x-auto border motion-safe:scroll-smooth"
          onScroll={(e) =>
            setShown(slideAt(e.currentTarget.scrollLeft, e.currentTarget.clientWidth, count))
          }
        >
          {card.slides.map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position; two may share bytes.
            <li key={i} className="aspect-4/5 w-full shrink-0 snap-start bg-muted">
              {/* The PNG is the final render from a route behind the session: nothing to optimise. */}
              {/* biome-ignore lint/performance/noImgElement: next/image would re-encode the exact render. */}
              <img
                src={feedAssetHref(s.pngAssetId)}
                alt={s.alt}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                loading={i === 0 ? undefined : 'lazy'}
                className="block size-full object-cover"
              />
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-3">
          {count > 1 && (
            <div aria-hidden="true" className="flex justify-center gap-1.5">
              {card.slides.map((_, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: a dot is its slide's position.
                  key={i}
                  data-dot
                  aria-current={i === shown ? 'true' : undefined}
                  className={cn('size-1.5', i === shown ? 'bg-primary' : 'bg-foreground/25')}
                />
              ))}
            </div>
          )}
          <h2 id={titleId} className="text-h4">
            {card.title}
          </h2>
          {card.line && <p className="line-clamp-2 text-caption">{card.line}</p>}
          {card.whyLine && <p className="text-caption text-accent-700">{card.whyLine}</p>}
          {card.sourceLine && (
            <p className="text-caption text-muted-foreground">{card.sourceLine}</p>
          )}
        </div>
      </Link>
      {count > 1 && (
        // Over the strip's row; only the buttons take a press, so a swipe between them still scrolls it.
        <div className="pointer-events-none col-start-1 row-start-2 flex items-center justify-between self-center px-5">
          <Button
            type="button"
            variant="square"
            size="icon-lg"
            aria-label="Previous slide"
            onClick={() => show(shown - 1)}
            className="pointer-events-auto bg-background/85 hover:bg-background"
          >
            <ChevronLeft aria-hidden="true" className="size-icon" />
          </Button>
          <Button
            type="button"
            variant="square"
            size="icon-lg"
            aria-label="Next slide"
            onClick={() => show(shown + 1)}
            className="pointer-events-auto bg-background/85 hover:bg-background"
          >
            <ChevronRight aria-hidden="true" className="size-icon" />
          </Button>
        </div>
      )}
    </article>
  )
}
