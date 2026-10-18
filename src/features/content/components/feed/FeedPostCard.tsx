'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Duck } from '@/shared/components/Duck'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { labelledLanguage } from '../../languages'
import type { FeedCard } from '../../lib/feed'
import { tag } from '../classes'
import { LAYER_TAGS, LanguageTag } from '../PhoneFeedCard'
import { feedAssetHref } from './SlideStrip'
import { wheelGate } from './wheel'

/** The 1080 × 1350 canvas every slide was drawn on, so each keeps its place while it loads. */
const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1350

type PostCard = Extract<FeedCard, { kind: 'post' }>

/** The slide a strip `width` wide has snapped to at `scrollLeft`, within its `count` slides. */
export function slideAt(scrollLeft: number, width: number, count: number): number {
  if (width <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)))
}

/**
 * A post in the feed, one screen tall (criterion 71): its slides as a 4:5 strip as large as the
 * space leaves in both directions, never cropped, that swipes one at a time (no scrollbar) with
 * dots for the one shown (75), and
 * beside it (from 64rem; below, under it, scrolling on its own when long) the panel: the layer's
 * and language's tags, the title linking to the post's page, the whole caption, the why line and
 * the source line, above them the account that posted it (lib/feed.ts postingAccounts), and
 * how it bears on her roadmaps, a sample (left out without roadmaps). With more than one slide,
 * Previous and Next sit over the strip's sides, so a keyboard or a mouse without a trackpad
 * reaches every slide; they wrap at the ends, so neither is ever disabled under her focus. Only
 * the first slide of the first post (`priority`) loads at once; every other slide waits until near.
 */
export function FeedPostCard({
  card,
  href,
  priority = false,
}: {
  card: PostCard
  href: string
  priority?: boolean
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

  // A sideways wheel or trackpad swipe moves one slide, as TikTok's carousel does (wheel.ts), and
  // stops at the ends; the feed's own handler leaves sideways gestures to the strip. Touch keeps the
  // strip's snapping, one slide at a time (snap-always).
  useEffect(() => {
    const el = strip.current
    if (!el || count < 2) return
    const gate = wheelGate()
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      const step = gate(e.timeStamp, e.deltaX)
      if (step === 0) return
      const next = Math.min(
        count - 1,
        Math.max(0, slideAt(el.scrollLeft, el.clientWidth, count) + step),
      )
      setShown(next)
      el.scrollTo({ left: next * el.clientWidth })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [count])

  return (
    <article
      aria-labelledby={titleId}
      className="flex h-full min-h-0 flex-col gap-3 wrap-anywhere @5xl/feed:grid @5xl/feed:grid-cols-[max(0rem,calc((100cqw-20rem)/2-min(55cqw,80cqh)/2))_auto_minmax(0,1fr)] @5xl/feed:items-center @5xl/feed:gap-0"
    >
      {/* Wide: the slide is centred on the window, not on the posts' column. The first column is what
          puts it there: half the posts' width less the side column's 20rem (page.tsx: w-72 and the
          gap-8 beside it), less half the slide. The panel is centred in what is left, between the
          slide and the scrollbar.
          A size container, so the strip takes the largest 4:5 box that fits it. */}
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center @container-size/slides @5xl/feed:col-start-2 @5xl/feed:h-full @5xl/feed:w-[min(55cqw,80cqh)]">
        <div className="relative aspect-4/5 w-[min(100cqw,80cqh)]">
          <ol
            ref={strip}
            className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain border motion-safe:scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(e) =>
              setShown(slideAt(e.currentTarget.scrollLeft, e.currentTarget.clientWidth, count))
            }
          >
            {card.slides.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position; two may share bytes.
              <li key={i} className="size-full shrink-0 snap-start snap-always bg-muted">
                {/* The PNG is the final render from a route behind the session: nothing to optimise. */}
                {/* biome-ignore lint/performance/noImgElement: next/image would re-encode the exact render. */}
                <img
                  src={feedAssetHref(s.pngAssetId)}
                  alt={s.alt}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  loading={priority && i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={priority && i === 0 ? 'high' : undefined}
                  decoding="async"
                  className="block size-full object-contain"
                />
              </li>
            ))}
          </ol>
          {count > 1 && (
            // Over the strip; only the buttons take a press, so a swipe between them still scrolls it.
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-3">
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
          {count > 1 && (
            <div
              aria-hidden="true"
              className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 bg-background/85 px-2 py-1.5"
            >
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
        </div>
      </div>
      {/* Beside the slide: centred in the space between the slide and the scrollbar, and against the slide's height. The
          layout follows the feed's width (@container/feed), not the post's own frame, which sizes the slide. */}
      <div className="flex min-h-0 shrink-0 flex-col gap-4 overflow-y-auto @max-5xl/feed:max-h-2/5 @5xl/feed:col-start-3 @5xl/feed:max-h-full @5xl/feed:w-full @5xl/feed:max-w-80 @5xl/feed:justify-self-center @5xl/feed:px-6">
        <Accounts accounts={card.accounts} />
        {(layer || labelledLanguage(card.language)) && (
          <div className="flex flex-wrap items-center gap-2">
            {layer && <p className={tag}>{layer}</p>}
            <LanguageTag language={card.language} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-h4">
            <Link href={href} className="underline-offset-4 hover:underline">
              {card.title}
            </Link>
          </h2>
          {card.caption && <p className="whitespace-pre-line text-caption">{card.caption}</p>}
          {card.whyLine && <p className="text-caption text-accent-700">{card.whyLine}</p>}
          {card.sourceLine && (
            <p className="text-caption text-muted-foreground">{card.sourceLine}</p>
          )}
        </div>
        {card.roadmapLinks && <RoadmapLinks links={card.roadmapLinks} />}
      </div>
    </article>
  )
}

/**
 * Who posted it, as Instagram shows it above a post: the page's mark and its handle, then "+N
 * more" (naming them on hover) when it went out on several accounts.
 */
function Accounts({ accounts }: { accounts: string[] }) {
  const [first, ...rest] = accounts
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
        <Duck size="1.5rem" className="size-6 object-contain" />
      </span>
      <p className="font-heading font-semibold">{first}</p>
      {rest.length > 0 && (
        <p title={rest.join(', ')} className="text-caption text-muted-foreground">
          {`+${rest.length} more`}
        </p>
      )}
    </div>
  )
}

/** One part of the panel: a region named by its small heading. */
function PanelSection({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <h3 id={id} className="text-overline uppercase text-muted-foreground">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** How the post bears on her roadmaps: a mock, so it says Sample; the effect once, then the roadmaps. */
function RoadmapLinks({ links }: { links: NonNullable<PostCard['roadmapLinks']> }) {
  const { effect, all, names, more } = links
  return (
    <PanelSection title="For your roadmaps" aside={<p className={tag}>Sample</p>}>
      {names.length === 0 ? (
        <p className="text-caption text-muted-foreground">Not linked to your roadmaps yet</p>
      ) : (
        <>
          <p className="text-caption">{effect}</p>
          {all && (
            <p className="text-caption text-muted-foreground">Applies to all your roadmaps</p>
          )}
          <ul className="flex flex-col gap-0.5 font-heading">
            {names.map((name) => (
              <li key={name}>{name}</li>
            ))}
            {more > 0 && (
              <li className="text-caption text-muted-foreground">{`and ${more} more`}</li>
            )}
          </ul>
        </>
      )}
    </PanelSection>
  )
}
