'use client'

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { slideAlt, slideWords } from '../lib/feed'

// The slide's words and alt text live in lib/feed.ts, where the student feed reads them too.
export { slideWords }

/** The 1080 × 1350 canvas every template draws on, so the page keeps the slide's shape while it loads. */
export const CANVAS_WIDTH = 1080
export const CANVAS_HEIGHT = 1350

type SlidePreviewProps = {
  slide: number
  /** The words the slide draws, line by line: its alt, so a screen reader reads the slide. */
  text?: string[]
  className?: string
} & (
  | { draft: { postId: string; draftsId: string; index: number; themeId: string } }
  /** `planId`: the image plan whose scenes the art boxes name (GD12); it changes the URL with the plan. */
  | { layout: { postId: string; layoutId: string; planId?: string } }
  | { assetId: string }
)

/** Where the picture of this slide comes from: the layout engine's preview route or a stored PNG. */
function srcOf(props: SlidePreviewProps): string {
  if ('draft' in props) {
    const { postId, draftsId, index, themeId } = props.draft
    const query = new URLSearchParams({
      drafts: draftsId,
      i: String(index),
      slide: String(props.slide),
      theme: themeId,
    })
    return `/admin/posts/${encodeURIComponent(postId)}/preview?${query}`
  }
  if ('layout' in props) {
    const { postId, layoutId, planId } = props.layout
    const query = new URLSearchParams({ layout: layoutId, slide: String(props.slide) })
    if (planId) query.set('plan', planId)
    return `/admin/posts/${encodeURIComponent(postId)}/preview?${query}`
  }
  return `/admin/assets/${encodeURIComponent(props.assetId)}`
}

/** How long a picture that failed to load waits before it is asked for again, once (the route's Retry-After). */
const RETRY_AFTER_MS = 2000

/** The same URL with `retry=n` added, so the browser asks again instead of reusing the failure. */
function nthTry(src: string, attempt: number): string {
  if (attempt === 0) return src
  return `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`
}

/** Whether the slides inside are a filmstrip's thumbnails (stage.tsx): a failure there is a small "!". */
const InThumbnail = createContext(false)

/** Marks the slides inside as thumbnails, too small for words and a Retry. */
export function SlideThumbnail({ children }: { children: ReactNode }) {
  return <InThumbnail value>{children}</InThumbnail>
}

/**
 * One slide as the server drew it: a draft or an approved layout from the preview route, or the
 * stored PNG after render. The browser never draws post text itself.
 */
export function SlidePreview(props: SlidePreviewProps) {
  const src = srcOf(props)
  // Keyed by its URL: another slide, draft or plan starts with no failure.
  return (
    <SlideImage
      key={src}
      src={src}
      alt={slideAlt(props.slide, props.text)}
      className={props.className}
    />
  )
}

/**
 * The slide's picture. One that fails to load (the server busy, 18 Oct) is asked for again once
 * after two seconds; failing again, its place says so with a Retry for that one picture, or shows
 * a small "!" in a thumbnail. A failed picture stays in the page, hidden, for its alt.
 */
function SlideImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const thumbnail = useContext(InThumbnail)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<'shown' | 'waiting' | 'failed'>('shown')
  const again = () => {
    setAttempt((n) => n + 1)
    setState('shown')
  }

  useEffect(() => {
    if (state !== 'waiting') return
    const timer = setTimeout(() => {
      setAttempt((n) => n + 1)
      setState('shown')
    }, RETRY_AFTER_MS)
    return () => clearTimeout(timer)
  }, [state])

  return (
    <>
      {/* The PNGs are already the final pixels, from routes behind the session: nothing to optimise. */}
      {/* biome-ignore lint/performance/noImgElement: next/image would re-encode the exact render. */}
      <img
        src={nthTry(src, attempt)}
        alt={alt}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        loading="lazy"
        onError={() => setState(attempt === 0 ? 'waiting' : 'failed')}
        className={state === 'shown' ? cn('block h-auto w-full border', className) : 'sr-only'}
      />
      {state !== 'shown' && (
        <div
          className={cn(
            'flex aspect-4/5 w-full flex-col items-center justify-center gap-2 border text-center',
            !thumbnail && 'p-4',
            className,
          )}
        >
          {state === 'failed' &&
            (thumbnail ? (
              <span className="text-caption text-muted-foreground">!</span>
            ) : (
              <>
                <p className="text-caption text-muted-foreground">
                  This slide&apos;s preview didn&apos;t load.
                </p>
                <Button variant="outline" size="sm" onClick={again}>
                  Retry
                </Button>
              </>
            ))}
        </div>
      )}
    </>
  )
}
