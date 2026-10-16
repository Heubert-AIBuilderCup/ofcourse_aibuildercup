// The approved layout drawn with its art: the same svgSlides call as the preview, plus the art in
// the art boxes. No text box overlaps the artBox, so no word moves. Server side (resvg).

import type { Preset, Surface } from '../brands/guideline'
import type { Brand, LaidSlide, Theme } from '../model/types'
import { toPng } from './png'
import { svgSlides } from './svg'

function mimeOf(b: Uint8Array): 'png' | 'jpeg' | 'webp' {
  const at = (i: number, s: string) => s.split('').every((c, k) => b[i + k] === c.charCodeAt(0))
  if (b[0] === 0x89 && at(1, 'PNG')) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg'
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'webp'
  throw new Error('Art must be a PNG, JPEG or WebP image')
}

const uriOf = (b: Uint8Array) =>
  `data:image/${mimeOf(b)};base64,${Buffer.from(b).toString('base64')}`

/** `arts` (an image per slide) and `panorama` (one wide PNG across the slides) as in svgSlides. */
export function renderSlides(input: {
  layout: LaidSlide[]
  theme: Theme
  brand: Brand
  art: Uint8Array | null
  arts?: (Uint8Array | null)[]
  panorama?: Uint8Array | null
  rateLines?: Record<number, string>
  surfaces?: Record<Surface, Theme>
  preset?: Preset
}): { svgs: string[]; pngs: Uint8Array[] } {
  const { layout, theme, brand, art, arts, panorama, rateLines, surfaces, preset } = input
  const svgs = svgSlides({
    layout,
    theme,
    brand,
    art: art ? uriOf(art) : null,
    arts: arts?.map((b) => (b ? uriOf(b) : null)),
    panorama: panorama ? uriOf(panorama) : undefined,
    rateLines,
    surfaces,
    preset,
  })
  return { svgs, pngs: svgs.map((svg) => toPng(svg, brand)) }
}
