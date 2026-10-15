// Slides drawn as SVG from a layout. Every line is a <text> at the position the engine measured,
// so drawing never re-wraps. The exported SVG keeps its <text> so it opens editable in a design
// tool; the PNG from toPng is the canonical image and the only thing the browser shows.

import { GUIDELINE, type Preset, presetThemes, type Surface } from '../brands/guideline'
import {
  type Box,
  type Brand,
  type LaidLine,
  type LaidSlide,
  SEARCH_SLOT,
  SOURCES_SLOT,
  type Template,
  type Theme,
} from '../model/types'
import { isLook } from '../templates'
import { contrastRatio } from '../text/contrast'
import { numbersIn } from '../text/numbers'
import { BULLET, CANVAS, FRAME, LEGIBILITY_FLOOR_PX, SOURCE_LINE, sourceLineY } from './engine'
import { runs, SCRIPT_FONTS, wrap } from './measure'
import { tintFilter } from './tint'

/** The card under a panel layout's slots: white at 90%, so the art shows through a little. */
const PANEL = { fill: '#FFFFFF', opacity: 0.9, radius: 14 } as const

/** Only an embedded image: an external or file reference would let the rasteriser read it. */
const ART_URI = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/

const n = (v: number) => String(Math.round(v * 100) / 100)

/** Escapes markup characters and drops control characters XML 1.0 cannot carry. */
export function escapeXml(text: string): string {
  return Array.from(text)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * A line's content, each Devanagari or Thai run in a <tspan> of its Noto family (GD38), the rest
 * in the line's brand font. The weight is the line's, so resvg picks the Noto file the engine
 * measured.
 */
function runsXml(content: string): string {
  return runs(content)
    .map((r) =>
      r.script === 'latin'
        ? escapeXml(r.text)
        : `<tspan font-family="${SCRIPT_FONTS[r.script].family}">${escapeXml(r.text)}</tspan>`,
    )
    .join('')
}

function text(input: {
  x: number
  y: number
  family: string
  weight: 400 | 700
  px: number
  fill: string
  content: string
}): string {
  return `<text x="${n(input.x)}" y="${n(input.y)}" font-family="${escapeXml(input.family)}" font-weight="${input.weight}" font-size="${n(input.px)}" fill="${input.fill}" xml:space="preserve">${runsXml(input.content)}</text>`
}

/** A checklist tick, as fractions of its line's size: its width and its stroke. */
const TICK = { size: 0.6, stroke: 0.1 } as const

function line(l: LaidLine, theme: Theme, brand: Brand): string {
  const parts: string[] = []
  if (l.mark === 'highlight') {
    parts.push(
      `<rect x="${n(l.x)}" y="${n(l.y - 0.8 * l.fontPx)}" width="${n(l.width)}" height="${n(l.fontPx)}" fill="${theme.highlight}"/>`,
    )
  } else if (l.mark === 'underline') {
    parts.push(
      `<rect x="${n(l.x)}" y="${n(l.y + 0.1 * l.fontPx)}" width="${n(l.width)}" height="6" fill="${theme.highlight}"/>`,
    )
  }
  // A point's bullet (GD34): a dot in the ink, centred in the indent and on the cap height.
  if (l.bullet) {
    parts.push(
      `<circle data-bullet="" cx="${n(l.x - BULLET.indent / 2)}" cy="${n(l.y - 0.35 * l.fontPx)}" r="${n(BULLET.radius * l.fontPx)}" fill="${theme.ink}"/>`,
    )
  }
  // A checklist item's tick: a stroked check in the ink, centred where a point's dot would be.
  if (l.tick) {
    const s = TICK.size * l.fontPx
    const left = l.x - BULLET.indent / 2 - s / 2
    const mid = l.y - 0.35 * l.fontPx
    parts.push(
      `<path data-tick="" d="M${n(left)} ${n(mid)}L${n(left + 0.36 * s)} ${n(mid + 0.36 * s)}L${n(left + s)} ${n(mid - 0.4 * s)}" fill="none" stroke="${theme.ink}" stroke-width="${n(TICK.stroke * l.fontPx)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
  }
  const heading = l.font === 'heading'
  parts.push(
    text({
      x: l.x,
      y: l.y,
      family: brand.fonts[l.font].family,
      weight: heading ? 700 : 400,
      px: l.fontPx,
      // The search line's rows, and the sources above them, are small print like the source line;
      // highlighted words are in the surface's highlight ink, its ink unless the surface names one.
      fill:
        l.slot === SEARCH_SLOT || l.slot === SOURCES_SLOT
          ? theme.muted
          : l.mark === 'highlight'
            ? (theme.highlightInk ?? theme.ink)
            : theme.ink,
      content: l.text,
    }),
  )
  return parts.join('')
}

/** The bars layout's two value slots, each drawn with a bar beside it. */
const BAR_SLOTS = [
  { slot: 'valueA', id: 'a' },
  { slot: 'valueB', id: 'b' },
] as const
/** Between the wider value and the bars, which all start at the same x. */
const BAR_GAP = 32

/** A bar is a large shape: 3:1 against its surface (WCAG non-text contrast). */
const BAR_CONTRAST = 3
const DEEP_BLUE = GUIDELINE.palette.find((c) => c.name === 'deep blue')?.hex

/**
 * The second bar's colour: the guideline's deep blue, or where that is the surface's own colour,
 * its ink (the first bar's) or too faint on it, the surface's highlight, then its muted ink; the
 * first of them that stands apart from the first bar at 3:1 against the surface.
 */
function secondBar(theme: Theme): string {
  const candidates = [DEEP_BLUE, theme.highlight, theme.muted].filter((c) => c !== undefined)
  return (
    candidates.find((c) => c !== theme.ink && contrastRatio(c, theme.bg) >= BAR_CONTRAST) ??
    theme.highlight
  )
}

/**
 * The comparison bars (GD4): beside each value, a bar as long as the first number in it, the
 * larger reaching the slide's right margin; a value with no number gets no bar. The first bar is
 * the surface's ink, the second `secondBar`, both at 3:1 or more against the surface.
 */
function bars(slide: LaidSlide, theme: Theme): string {
  const second = secondBar(theme)
  const rows = BAR_SLOTS.flatMap(({ slot, id }) => {
    const lines = slide.lines.filter((l) => l.slot === slot)
    if (lines.length === 0) return []
    const value = numbersIn(lines.map((l) => l.text).join(' '))[0]?.value ?? 0
    return [{ id, first: lines[0], value, fill: id === 'a' ? theme.ink : second }]
  })
  const largest = Math.max(0, ...rows.map((r) => r.value))
  if (largest <= 0) return ''
  const start = Math.max(...rows.map((r) => r.first.x + r.first.width)) + BAR_GAP
  const full = FRAME.right - start
  if (full <= 0) return ''
  return rows
    .filter((r) => r.value > 0)
    .map((r) => {
      const h = 0.5 * r.first.fontPx
      // Centred on the value's cap height (0.7 of the size above the baseline).
      const y = r.first.y - 0.35 * r.first.fontPx - h / 2
      return `<rect data-bar="${r.id}" x="${n(start)}" y="${n(y)}" width="${n((full * r.value) / largest)}" height="${n(h)}" fill="${r.fill}"/>`
    })
    .join('')
}

/**
 * A look's frame on the source baseline: "Swipe" (or its own cue, GD39) and an arrow before the
 * last slide, bold in the heading face and the surface's ink, then the dots.
 */
function frame(
  f: { slide: number; total: number; swipe?: string },
  theme: Theme,
  brand: Brand,
): string {
  const parts: string[] = []
  const cy = SOURCE_LINE.y - 0.35 * SOURCE_LINE.fontPx
  const first = FRAME.right - FRAME.dotRadius - (f.total - 1) * FRAME.dotPitch
  for (let i = 0; i < f.total; i++) {
    const cx = first + i * FRAME.dotPitch
    parts.push(
      i === f.slide - 1
        ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="${FRAME.dotRadius}" fill="${theme.ink}"/>`
        : `<circle cx="${n(cx)}" cy="${n(cy)}" r="${FRAME.dotRadius - 1}" fill="none" stroke="${theme.muted}" stroke-width="2"/>`,
    )
  }
  if (f.slide < f.total) {
    const end = first - FRAME.dotRadius - FRAME.gap
    const start = end - FRAME.arrowWidth
    const head = 8
    parts.push(
      `<path d="M${n(start)} ${n(cy)}H${n(end)}M${n(end - head)} ${n(cy - head)}L${n(end)} ${n(cy)}L${n(end - head)} ${n(cy + head)}" fill="none" stroke="${theme.ink}" stroke-width="4"/>`,
      `<text x="${n(start - FRAME.arrowGap)}" y="${n(SOURCE_LINE.y)}" font-family="${escapeXml(brand.fonts.heading.family)}" font-weight="700" font-size="${n(FRAME.swipePx)}" fill="${theme.ink}" text-anchor="end" xml:space="preserve">${runsXml(f.swipe ?? FRAME.label)}</text>`,
    )
  }
  return parts.join('')
}

/** The colours a post draws in. */
export type SlideColours = { theme: Theme; surfaces?: Record<Surface, Theme>; preset?: Preset }

/**
 * A look draws in its preset (GD9): Subdued when the theme id names it, Pop for any other id, with
 * the preset's base as the single theme. An old template draws in its brand's theme, the first
 * when none is chosen; null when the brand has no theme of that id.
 */
export function slideColours(input: {
  template: Template
  brand: Brand
  themeId: string | null
}): SlideColours | null {
  const { template, brand, themeId } = input
  if (isLook(template)) {
    const preset: Preset = themeId === 'subdued' ? 'subdued' : 'pop'
    const surfaces = presetThemes(preset)
    return { theme: surfaces.base, surfaces, preset }
  }
  const theme = themeId === null ? brand.themes[0] : brand.themes.find((t) => t.id === themeId)
  return theme ? { theme } : null
}

/** A PNG's pixel size, from its IHDR chunk; the URI is already checked as an embedded image. */
function pngSize(uri: string): { width: number; height: number } {
  // 24 bytes (the signature, then the IHDR's length, type, width and height) are 32 base64 characters.
  const start = uri.indexOf(',') + 1
  const head = Buffer.from(uri.slice(start, start + 32), 'base64')
  if (head.length < 24 || head[0] !== 0x89 || head.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('A panorama must be a PNG image')
  }
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) }
}

/**
 * Window `index` of `count` across a wide image: the art box's aspect ratio, as tall as the image
 * allows, the windows evenly spaced from the image's left edge to its right (overlapping when the
 * image is narrower than the windows end to end).
 */
function panoramaWindow(
  size: { width: number; height: number },
  box: Box,
  index: number,
  count: number,
): { x: number; y: number; w: number; h: number } {
  const aspect = box.w / box.h
  const h = Math.min(size.height, size.width / aspect)
  const w = h * aspect
  const x = count > 1 ? (index * (size.width - w)) / (count - 1) : (size.width - w) / 2
  return { x, y: (size.height - h) / 2, w, h }
}

/** "Planned scene" in an empty art box before images are drawn (GD12). */
const PLANNED = {
  label: 'Planned scene',
  pad: 48,
  labelPx: SOURCE_LINE.fontPx,
  px: 44,
  leading: 1.25,
} as const

function plannedScene(
  slide: LaidSlide,
  box: Box,
  scene: string,
  theme: Theme,
  brand: Brand,
): string {
  const { pad, labelPx, leading } = PLANNED
  const px = Math.max(PLANNED.px, LEGIBILITY_FLOOR_PX)
  // Above the panel's card where there is one, so the card does not hide the scene.
  const bottom = Math.min(box.y + box.h, slide.panel ? slide.panel.y : Number.POSITIVE_INFINITY)
  const x = box.x + pad
  const labelY = box.y + pad + 0.8 * labelPx
  const family = brand.fonts.body.family
  const parts = [
    `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" fill="${theme.muted}" fill-opacity="0.16"/>`,
    text({
      x,
      y: labelY,
      family,
      weight: 700,
      px: labelPx,
      fill: theme.muted,
      content: PLANNED.label,
    }),
  ]
  const lines = wrap(scene, brand.fonts.body.file, px, box.w - 2 * pad)
  lines.forEach((content, i) => {
    const y = labelY + 0.5 * labelPx + 0.8 * px + i * leading * px
    if (y + 0.2 * px <= bottom - pad) {
      parts.push(text({ x, y, family, weight: 400, px, fill: theme.ink, content }))
    }
  })
  return parts.join('')
}

/**
 * One SVG per slide from a layout. Art fills the slide's artBox (preserveAspectRatio="xMidYMid
 * slice"); none leaves it empty. Nothing else differs between a preview and a render.
 * - `art`: the one image of a post drawn before images per slide, in every art box.
 * - `arts`: an image per slide, by index (null: none on that slide); replaces `art`.
 * - `panorama`: one wide PNG, slide i showing window i of it; replaces both.
 * - `planned`: a scene per slide, by index, written in an art box left empty (previews).
 * `rateLines` maps a slide number (from 1, cover first) to the rate line drawn on it.
 * `surfaces` (a look's preset, `presetThemes`) colours each slide of a look by its surface; old
 * templates' slides carry no surface and keep the one `theme`. `preset` tints a look's art with
 * the brand filter (GD16); an old template's art is drawn as it is.
 */
export function svgSlides(input: {
  layout: LaidSlide[]
  theme: Theme
  brand: Brand
  art: string | null
  arts?: (string | null)[]
  panorama?: string
  planned?: (string | null)[]
  rateLines?: Record<number, string>
  surfaces?: Record<Surface, Theme>
  preset?: Preset
}): string[] {
  const { layout, brand, art, arts, panorama, planned, rateLines = {}, surfaces, preset } = input
  for (const uri of [art, ...(arts ?? []), panorama ?? null]) {
    if (uri !== null && !ART_URI.test(uri)) {
      throw new Error('Art must be an embedded PNG, JPEG or WebP data URI')
    }
  }
  const wide = panorama !== undefined ? { uri: panorama, size: pngSize(panorama) } : null
  const tint = preset ? tintFilter(preset, GUIDELINE) : null
  const small = (y: number, content: string, theme: Theme) =>
    text({
      x: SOURCE_LINE.x,
      y,
      family: brand.fonts.body.family,
      weight: 400,
      px: SOURCE_LINE.fontPx,
      fill: theme.muted,
      content,
    })

  return layout.map((slide, index) => {
    const theme = slide.surface && surfaces ? surfaces[slide.surface] : input.theme
    const b = slide.artBox
    const image = arts ? (arts[index] ?? null) : art
    // Only a look's slides carry a surface, so only their art is tinted.
    const tinted = b !== null && (wide !== null || image !== null) && !!tint && !!slide.surface
    const filter = tinted ? ' filter="url(#tint)"' : ''
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    ]
    if (tinted) parts.push(`<defs>${tint}</defs>`)
    parts.push(
      `<rect x="0" y="0" width="${CANVAS.width}" height="${CANVAS.height}" fill="${theme.bg}"/>`,
    )
    if (b !== null && wide !== null) {
      const v = panoramaWindow(wide.size, b, index, layout.length)
      parts.push(
        `<svg x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" viewBox="${n(v.x)} ${n(v.y)} ${n(v.w)} ${n(v.h)}" preserveAspectRatio="xMidYMid slice">`,
        `<image x="0" y="0" width="${wide.size.width}" height="${wide.size.height}" href="${escapeXml(wide.uri)}"${filter}/></svg>`,
      )
    } else if (b !== null && image !== null) {
      parts.push(
        `<image x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" preserveAspectRatio="xMidYMid slice" href="${escapeXml(image)}"${filter}/>`,
      )
    } else if (b !== null && planned?.[index]) {
      parts.push(plannedScene(slide, b, planned[index], theme, brand))
    }
    if (slide.panel) {
      const p = slide.panel
      parts.push(
        `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" rx="${PANEL.radius}" fill="${PANEL.fill}" fill-opacity="${PANEL.opacity}"/>`,
      )
    }
    for (const l of slide.lines) parts.push(line(l, theme, brand))
    if (slide.surface) parts.push(bars(slide, theme))
    if (slide.sourceLine !== null) {
      const searchRows = slide.lines.filter((l) => l.slot === SEARCH_SLOT).length
      parts.push(small(sourceLineY(searchRows), slide.sourceLine, theme))
    }
    const rate = rateLines[index + 1]
    if (rate !== undefined) parts.push(small(SOURCE_LINE.rateY, rate, theme))
    if (slide.frame) parts.push(frame(slide.frame, theme, brand))
    parts.push('</svg>')
    return parts.join('')
  })
}
