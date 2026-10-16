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

/**
 * One slide as the server drew it: a draft or an approved layout from the preview route, or the
 * stored PNG after render. The browser never draws post text itself.
 */
export function SlidePreview(props: SlidePreviewProps) {
  return (
    // The PNGs are already the final pixels, from routes behind the session: nothing to optimise.
    // biome-ignore lint/performance/noImgElement: next/image would re-encode the exact render.
    <img
      src={srcOf(props)}
      alt={slideAlt(props.slide, props.text)}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      loading="lazy"
      className={cn('block h-auto w-full border', props.className)}
    />
  )
}
