import type { FeedSlide } from '../../lib/feed'

/** The 1080 × 1350 canvas every slide was drawn on, so the strip keeps each slide's shape while it loads. */
const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1350

/** The feed's image route for a stored PNG: behind the session, live posts' slides only. */
export function feedAssetHref(assetId: string): string {
  return `/feed/assets/${encodeURIComponent(assetId)}`
}

/**
 * Every slide of the approved render in order (criterion 75): a phone-wide image each, one per
 * swipe at phone width (a snapping row), side by side on a wider screen (the same row wrapping).
 * The browser shows the stored PNGs and draws nothing itself, from the feed's image route behind the
 * session or, on a post's public page, from the public one (`assetHref`, criterion 107).
 */
export function SlideStrip({
  slides,
  assetHref = feedAssetHref,
}: {
  slides: FeedSlide[]
  assetHref?: (assetId: string) => string
}) {
  return (
    // Its own container: one per swipe below 36rem of its own width, wrapping above, wherever it is placed.
    <div className="@container min-w-0">
      <ol className="flex snap-x snap-mandatory gap-3 overflow-x-auto @xl:flex-wrap">
        {slides.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a slide is its position; two may share bytes.
          <li key={i} className="w-90 max-w-full shrink-0 snap-start">
            {/* The PNG is the final render, served as stored: nothing to optimise. */}
            {/* biome-ignore lint/performance/noImgElement: next/image would re-encode the exact render. */}
            <img
              src={assetHref(s.pngAssetId)}
              alt={s.alt}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              loading={i === 0 ? undefined : 'lazy'}
              className="block h-auto w-full border"
            />
          </li>
        ))}
      </ol>
    </div>
  )
}
