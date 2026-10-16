import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import type { Structure, Template, Theme } from '../model/types'
import { templateById } from '../templates'
import { layoutStructure } from './engine'
import { toPng } from './png'
import { svgSlides } from './svg'

const STRUCTURE: Structure = {
  templateId: 'the-line',
  artPrompt: 'An open notebook.',
  slides: [
    {
      kind: 'cover',
      slots: {
        kicker: { text: 'Research, briefly', factIds: [], factual: false },
        phrase: { text: '20-hour', factIds: [], factual: false },
        byline: { text: 'OfCourse · 5 min read', factIds: [], factual: false },
      },
    },
  ],
}

const { slides } = layoutStructure({
  structure: STRUCTURE,
  template: templateById('the-line') as Template,
  brand: FEED_BRAND,
  sourceTitle: 'Hours of paid work',
  facts: [],
})
const [cover] = svgSlides({
  layout: slides,
  theme: FEED_BRAND.themes[0] as Theme,
  brand: FEED_BRAND,
  art: null,
})
const ihdrWidth = (png: Uint8Array) => new DataView(png.buffer, png.byteOffset).getUint32(16)

describe('toPng', () => {
  it('rasterises a slide to a 1080-wide PNG', () => {
    const png = toPng(cover, FEED_BRAND)
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(ihdrWidth(png)).toBe(1080)
  })

  it('rasterises at a given width', () => {
    expect(ihdrWidth(toPng(cover, FEED_BRAND, 390))).toBe(390)
  })
})

describe('toPng in Thai and Devanagari (GD38)', () => {
  const svg = (family: string, content: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="200"><rect width="1080" height="200" fill="#FFFFFF"/><text x="40" y="120" font-family="Barlow" font-weight="400" font-size="80" fill="#000000"><tspan font-family="${family}">${content}</tspan></text></svg>`
  const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b))

  // Without its Noto font every character draws as the brand font's same missing-glyph box, so
  // the same characters in another order would give the same image.
  it("draws Thai and Devanagari with their Noto fonts, not the brand font's missing-glyph box", () => {
    const thai = toPng(svg('Noto Sans Thai', 'ภาษาไทย'), FEED_BRAND)
    expect([...thai.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(same(thai, toPng(svg('Noto Sans Thai', 'ไทยภาษา'), FEED_BRAND))).toBe(false)
    const nepali = toPng(svg('Noto Sans Devanagari', 'नपाल'), FEED_BRAND)
    expect(same(nepali, toPng(svg('Noto Sans Devanagari', 'लपान'), FEED_BRAND))).toBe(false)
  })
})
