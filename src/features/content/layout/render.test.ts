import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import type { Structure, Template, Theme } from '../model/types'
import { templateById } from '../templates'
import { layoutStructure } from './engine'
import { renderSlides } from './render'
import { svgSlides } from './svg'

const BODY =
  'Students working up to 20 hours a week had grades similar to students who did not work. Above 20 hours a week, pass rates fell by 11 percentage points.'

const STRUCTURE: Structure = {
  templateId: 'the-line',
  artPrompt: 'An open notebook beside a small desk clock.',
  slides: [
    {
      kind: 'cover',
      slots: {
        kicker: { text: 'Research, briefly', factIds: [], factual: false },
        phrase: { text: '20-hour', factIds: [], factual: false },
        byline: { text: 'OfCourse · 5 min read', factIds: [], factual: false },
      },
    },
    {
      kind: 'body',
      slots: {
        heading: { text: 'Finding 1', factIds: [], factual: false },
        body: { text: BODY, factIds: [], factual: true },
      },
    },
    {
      kind: 'take',
      slots: {
        takeaway: {
          text: 'Keep paid work under 20 hours a week in first year.',
          factIds: [],
          factual: false,
        },
      },
    },
  ],
}

const PAPER = FEED_BRAND.themes.find((t) => t.id === 'paper') as Theme
const { slides } = layoutStructure({
  structure: STRUCTURE,
  template: templateById('the-line') as Template,
  brand: FEED_BRAND,
  sourceTitle: 'Hours of paid work',
  facts: [],
})
// A 1 × 1 PNG.
const ART = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

describe('renderSlides', () => {
  it('equals the preview once the art element is removed', () => {
    const preview = svgSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: null })
    const render = renderSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: ART })
    expect(render.svgs).toHaveLength(preview.length)
    expect(render.svgs[0]).toContain('<image')
    expect(render.svgs.map((s) => s.replace(/<image\b[^>]*\/>/, ''))).toEqual(preview)
  })

  it('draws every slide as a PNG, with no image on the body slides', () => {
    const { svgs, pngs } = renderSlides({
      layout: slides,
      theme: PAPER,
      brand: FEED_BRAND,
      art: ART,
    })
    expect(pngs).toHaveLength(3)
    for (const png of pngs) expect(Array.from(png.slice(0, 4))).toEqual(SIGNATURE)
    expect(svgs[1]).not.toContain('<image')
    expect(svgs[2]).not.toContain('<image')
  })

  it('renders the preview exactly when there is no art', () => {
    const preview = svgSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: null })
    const { svgs } = renderSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: null })
    expect(svgs).toEqual(preview)
  })

  it('passes rate lines through', () => {
    const { svgs } = renderSlides({
      layout: slides,
      theme: PAPER,
      brand: FEED_BRAND,
      art: null,
      rateLines: { 2: 'NPR at 88 per AUD' },
    })
    expect(svgs[1]).toContain('NPR at 88 per AUD')
  })

  it('refuses bytes that are not a PNG, JPEG or WebP', () => {
    expect(() =>
      renderSlides({
        layout: slides,
        theme: PAPER,
        brand: FEED_BRAND,
        art: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      }),
    ).toThrow()
  })
})
