// The script's own pictures for a look post's slides (scripts/make-posts.ts `art`): an SVG drawn
// to PNG with the brand's fonts, as the slides are, and the art cache key "Draw images" reads for
// the slide (ai/art.ts coverArt), so the picture is kept under it the way a drawn one is
// (commands/shared.ts artDeps.remember) and the image model is never asked.

import { type ImageAspect, slidePrompt } from '../src/features/content/ai/art'
import { FEED_BRAND } from '../src/features/content/brands'
import { toPng } from '../src/features/content/layout/png'
import { canonicalJson, sha256Hex } from '../src/features/content/server/hash'

/**
 * The cache key coverArt looks a slide's first attempt up under, as commands/images.ts drawScene
 * calls it for a post with no page design language and no character sheet: the image model's
 * name, the prompt from the planned scene, the shape, the art version (`set`) and the slide.
 */
export function artKey(input: {
  scene: string
  emotion: string | null
  aspectRatio: ImageAspect
  set: number
  slide: number
}): string {
  const prompt = slidePrompt({
    scene: input.scene,
    emotion: input.emotion,
    nudge: null,
    artStyle: null,
    character: false,
  })
  return sha256Hex(
    canonicalJson({
      model: process.env.GEMINI_IMAGE_MODEL ?? '',
      prompt,
      aspectRatio: input.aspectRatio,
      set: input.set,
      option: input.slide,
      attempt: 1,
    }),
  )
}

/** The SVG as a PNG `width` wide, drawn with the feed brand's font files only. */
export function svgToPng(svg: string, width: number): Uint8Array {
  return toPng(svg, FEED_BRAND, width)
}
