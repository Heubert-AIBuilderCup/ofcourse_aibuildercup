// Fit checks read from the measured layout (criteria 34, 35): slot lengths against the template's
// limits, slots that overflow their box, characters the brand font cannot draw (the renderer loads
// only the brand's fonts, so such a character would come out blank), the theme's contrast and the
// smallest text at phone width. Lengths are counted from the laid-out lines, so a market version's
// overridden slots are counted as drawn. Slides are numbered from 1, cover first.

import type { Surface } from '../brands/guideline'
import type {
  Brand,
  FitCheck,
  LaidSlide,
  SlotFit,
  Structure,
  Template,
  Theme,
} from '../model/types'
import { isLook } from '../templates'
import { contrastRatio, MIN_CONTRAST } from '../text/contrast'
import { charCount, wordCount } from '../text/script'
import { LEGIBILITY_FLOOR_PX, PHONE_WIDTH_PX, slideSpec } from './engine'
import { missingGlyphs } from './measure'

/**
 * A slot's text as the reader reads it. A wrap breaks a line at a space, or inside Thai, which
 * writes no space between its words, at none (measure.ts wrap); so when the lines draw the slot's
 * own words, the count is of those, spaced as written. Lines that draw other words (a market
 * version's) are joined with a space each, as before.
 */
function slotText(lines: LaidSlide['lines'], written: string | undefined): string {
  const drawn = lines.map((l) => l.text)
  const squeezed = (text: string) => text.replace(/\s+/g, '')
  if (written !== undefined && squeezed(drawn.join('')) === squeezed(written)) {
    return written.trim().replace(/\s+/g, ' ')
  }
  return drawn.join(' ')
}

const oneDecimal = (n: number) => Math.round(n * 10) / 10

function contrastRow(ink: string, bg: string, name: string): FitCheck {
  const ratio = contrastRatio(ink, bg)
  const ok = ratio >= MIN_CONTRAST
  return {
    check: 'contrast',
    slide: null,
    slot: null,
    value: oneDecimal(ratio),
    limit: `${MIN_CONTRAST}:1`,
    pass: ok,
    label: `Contrast · ${name} ${oneDecimal(ratio).toFixed(1)}:1 · ${ok ? 'OK' : 'Too low'}`,
  }
}

export function fitChecks(input: {
  structure: Structure
  template: Template
  theme: Theme
  brand: Brand
  layout: { slides: LaidSlide[]; fits: SlotFit[] }
  /** A look's preset (`presetThemes`): contrast is checked on each surface the slides use. */
  surfaces?: Record<Surface, Theme>
  /**
   * Texts that do not count against a slot's length: a market version's " (≈ NPR 2,640,000)" after
   * each converted figure, which the figure it converts already counts for. Its box still has to
   * hold it, at a legible size.
   */
  uncounted?: readonly string[]
}): FitCheck[] {
  const { structure, template, theme, brand, layout, surfaces } = input
  const uncounted = input.uncounted ?? []
  const rows: FitCheck[] = []
  const glyphRows: FitCheck[] = []

  structure.slides.forEach((slide, index) => {
    const number = index + 1
    const lines = layout.slides[index]?.lines ?? []
    for (const spec of slideSpec(template, slide).slots) {
      const slotLines = lines.filter((l) => l.slot === spec.key)
      const text = slotText(slotLines, slide.slots[spec.key]?.text)
      const missing = [
        ...new Set(slotLines.flatMap((l) => missingGlyphs(l.text, brand.fonts[l.font].file))),
      ]
      if (missing.length > 0) {
        glyphRows.push({
          check: 'glyph',
          slide: number,
          slot: spec.key,
          value: missing.length,
          limit: '0 missing',
          pass: false,
          label: `Slide ${number} · ${spec.key} · cannot draw ${missing.map((c) => `"${c}"`).join(' ')} · Missing glyph`,
        })
      }
      const { unit, min, max } = spec.limit
      const counted = uncounted.reduce((t, skip) => t.split(skip).join(''), text)
      // A points slot counts its points as drawn, one bullet each (GD34); Thai words by word, and
      // characters as a reader sees them (a conjunct, a letter with its marks, is one).
      const value =
        unit === 'points'
          ? slotLines.filter((l) => l.bullet).length
          : unit === 'words'
            ? wordCount(counted)
            : charCount(counted)
      const verdict = value > max ? 'Over' : value < min ? 'Under' : 'OK'
      rows.push({
        check: 'length',
        slide: number,
        slot: spec.key,
        value,
        limit: `${min}–${max} ${unit}`,
        pass: verdict === 'OK',
        label: `Slide ${number} · ${value} ${unit} (${min}–${max}) · ${verdict}`,
      })
    }
  })
  rows.push(...glyphRows)

  for (const fit of layout.fits.filter((f) => !f.fits)) {
    rows.push({
      check: 'box',
      slide: fit.slide,
      slot: fit.slot,
      value: fit.lines,
      limit: `${fit.maxLines} lines`,
      pass: false,
      label: `Slide ${fit.slide} · ${fit.slot} · needs ${fit.lines} lines, room for ${fit.maxLines} · Over`,
    })
  }

  if (surfaces && isLook(template)) {
    // Each surface once, in the order the slides first use it: ink, and the muted foot row (source
    // line, search line, frame) every look slide carries; the highlight ink (the surface's ink
    // unless it names one) on the highlight where a slot on that surface is marked (the highlight
    // is drawn under the words, the underline beside them).
    const used = new Map<Surface, boolean>()
    for (const slide of structure.slides) {
      const spec = slideSpec(template, slide)
      const marked = spec.slots.some((s) => s.mark !== 'none')
      used.set(spec.surface, (used.get(spec.surface) ?? false) || marked)
    }
    for (const [surface, marked] of used) {
      const t = surfaces[surface]
      rows.push(contrastRow(t.ink, t.bg, t.name))
      rows.push(contrastRow(t.muted, t.bg, `${t.name} muted`))
      if (marked) {
        rows.push(contrastRow(t.highlightInk ?? t.ink, t.highlight, `${t.name} highlight`))
      }
    }
  } else {
    rows.push(contrastRow(theme.ink, theme.bg, theme.name))
    // The words on the highlight too, where a slot is marked, as on a look's surfaces above.
    const marked = structure.slides.some((slide) =>
      slideSpec(template, slide).slots.some((s) => s.mark !== 'none'),
    )
    if (marked) {
      rows.push(
        contrastRow(theme.highlightInk ?? theme.ink, theme.highlight, `${theme.name} highlight`),
      )
    }
  }

  const sizes = [...new Set(layout.fits.filter((f) => f.lines > 0).map((f) => f.fontPx))].sort(
    (a, b) => a - b,
  )
  for (const px of sizes) {
    const atPhone = oneDecimal((px * PHONE_WIDTH_PX) / 1080)
    const ok = px >= LEGIBILITY_FLOOR_PX
    rows.push({
      check: 'legibility',
      slide: null,
      slot: null,
      value: atPhone,
      limit: `11px at ${PHONE_WIDTH_PX}px`,
      pass: ok,
      label: `Legibility · ${atPhone.toFixed(1)}px at ${PHONE_WIDTH_PX}px · ${ok ? 'OK' : 'Too small'}`,
    })
  }

  return rows
}

export function fitPasses(checks: FitCheck[]): boolean {
  return checks.every((c) => c.pass)
}
