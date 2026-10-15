import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import { GUIDELINE, PRESETS, type Preset, presetThemes, SURFACES } from '../brands/guideline'
import { SEARCH_SLOT, type Slide, type Structure, type Template, type Theme } from '../model/types'
import { templateById } from '../templates'
import { contrastRatio } from '../text/contrast'
import { BULLET, LEGIBILITY_FLOOR_PX, layoutStructure, SEARCH_LINE, SOURCE_LINE } from './engine'
import { lookStructure } from './fixtures'
import { toPng } from './png'
import { escapeXml, slideColours, svgSlides } from './svg'
import { tintFilter } from './tint'

const BODY =
  'Students working up to 20 hours a week had grades similar to students who did not work. Above 20 hours a week, pass rates fell by 11 percentage points.'

const STRUCTURE: Structure = {
  templateId: 'the-line',
  artPrompt: 'An open notebook beside a small desk clock.',
  slides: [
    {
      kind: 'cover',
      slots: {
        kicker: { text: 'R&D <briefly>', factIds: [], factual: false },
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
const hexOf = (name: string) => GUIDELINE.palette.find((c) => c.name === name)?.hex
const { slides } = layoutStructure({
  structure: STRUCTURE,
  template: templateById('the-line') as Template,
  brand: FEED_BRAND,
  sourceTitle: 'Hours of paid work',
  facts: [],
})
// A 1 × 1 PNG.
const ART =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('svgSlides', () => {
  it('gives one SVG per slide, identical with and without art apart from the image', () => {
    const preview = svgSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: null })
    const render = svgSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: ART })
    expect(preview).toHaveLength(3)
    expect(render[0].match(/<image\b/g)).toHaveLength(1)
    expect(render[0]).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(preview.join('')).not.toContain('<image')
    expect(render.map((s) => s.replace(/<image\b[^>]*\/>/, ''))).toEqual(preview)
  })

  it('draws the source line on a body slide and a highlight on the cover', () => {
    const [cover, body] = svgSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: null })
    expect(body).toContain('Source: Hours of paid work')
    expect(body).toContain(`fill="${PAPER.muted}"`)
    expect(body).toContain('y="1270"')
    expect(cover).toMatch(new RegExp(`<rect [^>]*fill="${PAPER.highlight}"`))
    expect(cover).toContain(`fill="${PAPER.bg}"`)
    expect(cover).toContain('font-family="Barlow Condensed" font-weight="700" font-size="72"')
    expect(cover).toContain('xml:space="preserve"')
  })

  it('escapes slide text', () => {
    const [cover] = svgSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: null })
    expect(cover).toContain('R&amp;D &lt;briefly&gt;')
    expect(cover).not.toContain('<briefly>')
  })

  it('draws a rate line on the slide it names', () => {
    const svgs = svgSlides({
      layout: slides,
      theme: PAPER,
      brand: FEED_BRAND,
      art: null,
      rateLines: { 2: 'NPR at 88 per AUD · mock rate · 1 Oct 2026' },
    })
    expect(svgs[1]).toContain('NPR at 88 per AUD')
    expect(svgs[0]).not.toContain('NPR at 88 per AUD')
  })

  it('draws the search line rows on the last slide in the muted ink, its source line lifted above them', () => {
    const svgs = svgSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: null })
    const take = svgs[2]
    const rows = slides[2].lines.filter((l) => l.slot === SEARCH_SLOT)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map((r) => r.text).join(' ')).toBe(SEARCH_LINE('Hours of paid work'))
    for (const row of rows) {
      expect(take).toContain(
        `font-family="Barlow" font-weight="400" font-size="38" fill="${PAPER.muted}" xml:space="preserve">${escapeXml(row.text)}</text>`,
      )
    }
    expect(take).toContain(
      `y="${1270 - rows.length * 45.6}" font-family="Barlow" font-weight="400" font-size="38" fill="${PAPER.muted}" xml:space="preserve">Source: Hours of paid work</text>`,
    )
    expect(svgs[1]).toContain('y="1270"')
    expect(svgs[0]).not.toContain('To find this again')
    expect(svgs[1]).not.toContain('To find this again')
  })

  it('refuses art that is not an embedded image', () => {
    expect(() =>
      svgSlides({ layout: slides, theme: PAPER, brand: FEED_BRAND, art: 'file:///etc/passwd' }),
    ).toThrow()
  })
})

describe('escapeXml', () => {
  it('escapes markup characters', () => {
    expect(escapeXml('A & B <c>')).toBe('A &amp; B &lt;c&gt;')
    expect(escapeXml(`"it's"`)).toBe('&quot;it&apos;s&quot;')
  })
})

/** A look post with one slide per layout, in the order a post would run. */
const lookSvgs = (templateId: string, preset: Preset) => {
  const { slides: layout } = layoutStructure({
    structure: lookStructure(templateId),
    template: templateById(templateId) as Template,
    brand: FEED_BRAND,
    sourceTitle: 'Hours of paid work',
    facts: [],
  })
  return {
    layout,
    svgs: svgSlides({
      layout,
      theme: PAPER,
      brand: FEED_BRAND,
      art: null,
      surfaces: presetThemes(preset),
    }),
  }
}

describe('svgSlides for a look (GD6, GD9)', () => {
  it('draws one dot per slide with the current one solid, and “Swipe” on every slide but the last', () => {
    const { svgs } = lookSvgs('field-notes', 'pop')
    expect(svgs).toHaveLength(7)
    svgs.forEach((svg, i) => {
      const dots = svg.match(/<circle\b[^>]*>/g) ?? []
      expect(dots).toHaveLength(7)
      const solid = dots.flatMap((d, k) => (/fill="#[0-9A-F]{6}"/i.test(d) ? [k] : []))
      expect(solid).toEqual([i])
      expect(svg.includes('>Swipe</text>')).toBe(i < 6)
    })
  })

  it('draws the last slide’s "Sources:" rows in the muted ink, like the search line (GD31)', () => {
    const { slides: layout } = layoutStructure({
      structure: lookStructure('field-notes'),
      template: templateById('field-notes') as Template,
      brand: FEED_BRAND,
      sourceTitle: 'Hours of paid work',
      facts: [],
      sourcesAt: 'last_slide',
    })
    const surfaces = presetThemes('pop')
    const [last] = svgSlides({
      layout: layout.slice(-1),
      theme: PAPER,
      brand: FEED_BRAND,
      art: null,
      surfaces,
    })
    const muted = surfaces[layout.at(-1)?.surface ?? 'base'].muted
    expect(last).toContain(
      `font-size="38" fill="${muted}" xml:space="preserve">Sources: Hours of paid work</text>`,
    )
  })

  it('draws each slide on its surface’s colours from the preset', () => {
    const subdued = presetThemes('subdued')
    const { svgs } = lookSvgs('data-desk', 'subdued')
    const bg = (svg: string) =>
      svg.match(/<rect x="0" y="0" width="1080" height="1350" fill="([^"]+)"/)?.[1]
    // Data Desk: number and picture on block, cover and takeaway on deep, the rest on base.
    expect(bg(svgs[2])).toBe(subdued.block.bg)
    expect(bg(svgs[1])).toBe(subdued.block.bg)
    expect(bg(svgs[3])).toBe(subdued.base.bg)
    expect(bg(svgs[0])).toBe(subdued.deep.bg)
    expect(lookSvgs('data-desk', 'pop').svgs[2]).toContain(`fill="${presetThemes('pop').block.bg}"`)
  })

  it("draws a highlighted word on Pop's deep blue as a yellow chip with ink text, and keeps every other surface's ink", () => {
    const word = (surface: 'base' | 'block' | 'deep') => ({
      kind: 'cover' as const,
      lines: [
        {
          slot: 'phrase',
          text: 'twenty',
          x: 72,
          y: 400,
          fontPx: 72,
          font: 'heading' as const,
          mark: 'highlight' as const,
          width: 300,
        },
      ],
      artBox: null,
      sourceLine: null,
      searchLine: null,
      surface,
    })
    const drawn = (preset: Preset, surface: 'base' | 'block' | 'deep') => {
      const [svg] = svgSlides({
        layout: [word(surface)],
        theme: PAPER,
        brand: FEED_BRAND,
        art: null,
        surfaces: presetThemes(preset),
      })
      return {
        chip: svg.match(/<rect x="72" [^>]*width="300" height="72" fill="([^"]+)"/)?.[1],
        text: svg.match(/fill="([^"]+)" xml:space="preserve">twenty<\/text>/)?.[1],
      }
    }
    const hex = (name: string) => GUIDELINE.palette.find((c) => c.name === name)?.hex
    expect(drawn('pop', 'deep')).toEqual({ chip: hex('yellow'), text: hex('ink') })
    for (const [preset, surface] of [
      ['pop', 'base'],
      ['pop', 'block'],
      ['subdued', 'base'],
      ['subdued', 'block'],
      ['subdued', 'deep'],
    ] as const) {
      const t = presetThemes(preset)[surface]
      expect(drawn(preset, surface)).toEqual({ chip: t.highlight, text: t.ink })
    }
  })

  it('draws the comparison bars in proportion to the numbers in the two values, none without one', () => {
    const barsSvg = (valueA: string, valueB: string) => {
      const s = lookStructure('data-desk')
      const bars = s.slides[3]
      const slides: Slide[] = [
        {
          ...bars,
          slots: {
            ...bars.slots,
            valueA: { ...bars.slots.valueA, text: valueA },
            valueB: { ...bars.slots.valueB, text: valueB },
          },
        },
      ]
      const { slides: layout } = layoutStructure({
        structure: { ...s, slides },
        template: templateById('data-desk') as Template,
        brand: FEED_BRAND,
        sourceTitle: 'Hours of paid work',
        facts: [],
      })
      const pop = presetThemes('pop')
      return {
        svg: svgSlides({ layout, theme: PAPER, brand: FEED_BRAND, art: null, surfaces: pop })[0],
        base: pop.base,
      }
    }
    const width = (svg: string, bar: string) =>
      Number(svg.match(new RegExp(`<rect data-bar="${bar}"[^>]*width="([\\d.]+)"`))?.[1])
    const { svg, base } = barsSvg('100 hours', '76 hours')
    expect(width(svg, 'a') / width(svg, 'b')).toBeCloseTo(100 / 76, 2)
    expect(svg).toMatch(new RegExp(`<rect data-bar="a"[^>]*fill="${base.ink}"`))
    expect(svg).toMatch(new RegExp(`<rect data-bar="b"[^>]*fill="${hexOf('deep blue')}"`))
    const none = barsSvg('Most', '76%').svg
    expect(none).not.toContain('data-bar="a"')
    expect(none).toContain('data-bar="b"')
  })

  it('draws both comparison bars at 3:1 or more against the surface, apart from each other, on every surface of both presets', () => {
    const value = (slot: string, y: number) => ({
      slot,
      text: slot === 'valueA' ? '78%' : '67%',
      x: 96,
      y,
      fontPx: 96,
      font: 'heading' as const,
      mark: 'none' as const,
      width: 160,
    })
    for (const preset of PRESETS) {
      for (const surface of SURFACES) {
        const t = presetThemes(preset)[surface]
        const [svg] = svgSlides({
          layout: [
            {
              kind: 'body',
              lines: [value('valueA', 580), value('valueB', 900)],
              artBox: null,
              sourceLine: null,
              searchLine: null,
              surface,
            },
          ],
          theme: PAPER,
          brand: FEED_BRAND,
          art: null,
          surfaces: presetThemes(preset),
        })
        const fill = (bar: string) =>
          svg.match(new RegExp(`<rect data-bar="${bar}"[^>]*fill="([^"]+)"`))?.[1] ?? ''
        const ratios = ['a', 'b'].map((bar) => contrastRatio(fill(bar), t.bg))
        expect({ preset, surface, low: ratios.filter((r) => r < 3) }).toEqual({
          preset,
          surface,
          low: [],
        })
        expect(fill('a')).not.toBe(fill('b'))
      }
    }
  })

  it('lays a white card under the slots of a panel layout, and none elsewhere', () => {
    const postcard = lookSvgs('postcard', 'pop')
    const panel = postcard.layout[1].panel
    expect(panel).toBeDefined()
    expect(postcard.svgs[1]).toContain(
      `<rect x="${panel?.x}" y="${panel?.y}" width="${panel?.w}" height="${panel?.h}" rx="14" fill="#FFFFFF" fill-opacity="0.9"/>`,
    )
    expect(lookSvgs('field-notes', 'pop').svgs[1]).not.toContain('rx="14"')
  })
})

describe('svgSlides for an old template (GD8)', () => {
  // Captured before looks existed: a stored the-line revision with art, a bound fact and a rate
  // line. A regression pin: the old drawing must not move a byte.
  const FACT = {
    id: 'f1',
    text: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
    value: { number: 11, unit: 'percentage points' },
    ref: '¶3',
    quote: null,
    supported: true,
    why: null,
    span: null,
  }
  const STORED: Structure = {
    ...STRUCTURE,
    slides: STRUCTURE.slides.map((s, i) => ({
      ...s,
      slots:
        i === 0
          ? { ...s.slots, kicker: { text: 'Research, briefly', factIds: [], factual: false } }
          : i === 1
            ? { ...s.slots, body: { text: BODY, factIds: ['f1'], factual: true } }
            : s.slots,
    })),
  }
  const PINNED = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect x="0" y="0" width="1080" height="1350" fill="#F4EFE6"/><image x="0" y="0" width="1080" height="810" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="/><text x="96" y="888" font-family="Barlow" font-weight="400" font-size="40" fill="#1D1F20" xml:space="preserve">Research, briefly</text><rect x="96" y="917.2" width="207.5" height="72" fill="#F5C542"/><text x="96" y="974.8" font-family="Barlow Condensed" font-weight="700" font-size="72" fill="#1D1F20" xml:space="preserve">20-hour</text><text x="96" y="1276.1" font-family="Barlow" font-weight="400" font-size="38" fill="#1D1F20" xml:space="preserve">OfCourse · 5 min read</text></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect x="0" y="0" width="1080" height="1350" fill="#F4EFE6"/><text x="96" y="184.8" font-family="Barlow Condensed" font-weight="700" font-size="72" fill="#1D1F20" xml:space="preserve">Finding 1</text><text x="96" y="371" font-family="Barlow" font-weight="400" font-size="40" fill="#1D1F20" xml:space="preserve">Students working up to 20 hours a week had grades</text><text x="96" y="425" font-family="Barlow" font-weight="400" font-size="40" fill="#1D1F20" xml:space="preserve">similar to students who did not work. Above 20</text><text x="96" y="479" font-family="Barlow" font-weight="400" font-size="40" fill="#1D1F20" xml:space="preserve">hours a week, pass rates fell by 11 percentage</text><text x="96" y="533" font-family="Barlow" font-weight="400" font-size="40" fill="#1D1F20" xml:space="preserve">points.</text><text x="96" y="1270" font-family="Barlow" font-weight="400" font-size="38" fill="#5F5D58" xml:space="preserve">Source: Hours of paid work · ¶3</text><text x="96" y="1316" font-family="Barlow" font-weight="400" font-size="38" fill="#5F5D58" xml:space="preserve">A$1 = NPR 88.1 (RBA, 1 Oct 2026)</text></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect x="0" y="0" width="1080" height="1350" fill="#F4EFE6"/><text x="96" y="466.6" font-family="Barlow Condensed" font-weight="700" font-size="72" fill="#1D1F20" xml:space="preserve">Keep paid work under 20 hours a</text><text x="96" y="549.4" font-family="Barlow Condensed" font-weight="700" font-size="72" fill="#1D1F20" xml:space="preserve">week in first year.</text><text x="96" y="1224.4" font-family="Barlow" font-weight="400" font-size="38" fill="#5F5D58" xml:space="preserve">To find this again, search “OfCourse Hours of paid</text><text x="96" y="1270" font-family="Barlow" font-weight="400" font-size="38" fill="#5F5D58" xml:space="preserve">work”</text><text x="96" y="1178.8" font-family="Barlow" font-weight="400" font-size="38" fill="#5F5D58" xml:space="preserve">Source: Hours of paid work</text></svg>',
  ]

  it('draws a stored the-line revision byte for byte as before', () => {
    const { slides: laid } = layoutStructure({
      structure: STORED,
      template: templateById('the-line') as Template,
      brand: FEED_BRAND,
      sourceTitle: 'Hours of paid work',
      facts: [FACT],
    })
    const svgs = svgSlides({
      layout: laid,
      theme: PAPER,
      brand: FEED_BRAND,
      art: ART,
      rateLines: { 2: 'A$1 = NPR 88.1 (RBA, 1 Oct 2026)' },
    })
    expect(svgs).toEqual(PINNED)
  })
})

/** A PNG `width` × `height` of one colour, as an embedded data URI. */
function pngUri(width: number, height: number, fill: string): string {
  const png = toPng(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`,
    FEED_BRAND,
    width,
  )
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`
}

describe('svgSlides with an image per slide, a panorama and the tint (GD4, GD12–GD16)', () => {
  const postcard = lookSvgs('postcard', 'pop').layout
  const pop = presetThemes('pop')
  const draw = (extra: Partial<Parameters<typeof svgSlides>[0]>) =>
    svgSlides({
      layout: postcard,
      theme: PAPER,
      brand: FEED_BRAND,
      art: null,
      surfaces: pop,
      ...extra,
    })

  it('puts arts[i] in slide i’s art box and leaves a null one empty', () => {
    const a = pngUri(2, 2, '#FF0000')
    const b = pngUri(2, 2, '#00FF00')
    const svgs = draw({ layout: postcard.slice(0, 3), arts: [a, null, b] })
    expect(svgs[0]).toContain(`href="${a}"`)
    expect(svgs[0]).not.toContain(`href="${b}"`)
    expect(svgs[1]).not.toContain('<image')
    expect(svgs[2]).toContain(`href="${b}"`)
  })

  it('cuts a panorama into one window per slide, evenly spaced from its left edge to its right', () => {
    const svgs = draw({ layout: postcard.slice(0, 4), panorama: pngUri(2400, 1000, '#1877F2') })
    const windows = svgs.map((svg) => {
      const box = svg.match(
        /<svg x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" viewBox="([^"]+)"/,
      )
      expect(box).not.toBeNull()
      const [x, y, w, h] = (box?.[1] ?? '').split(' ').map(Number)
      return { x, y, w, h }
    })
    expect(windows).toHaveLength(4)
    const art = postcard[0].artBox
    for (const w of windows) expect(w.w / w.h).toBeCloseTo((art?.w ?? 0) / (art?.h ?? 1), 2)
    for (let i = 1; i < 4; i++) expect(windows[i].x).toBeGreaterThan(windows[i - 1].x)
    expect(windows[0].x).toBe(0)
    expect(windows[3].x + windows[3].w).toBeCloseTo(2400, 1)
    // 4 windows 800 wide over 2400: they overlap, evenly.
    expect(windows[1].x - windows[0].x).toBeCloseTo(windows[3].x - windows[2].x, 1)
  })

  it('tints the art of a look slide with the preset’s filter, and not an old template’s', () => {
    const [look] = draw({ art: ART, preset: 'subdued' })
    expect(look).toContain(`<defs>${tintFilter('subdued', GUIDELINE)}</defs>`)
    expect(look).toMatch(/<image\b[^>]*filter="url\(#tint\)"/)
    const [legacy] = svgSlides({
      layout: slides,
      theme: PAPER,
      brand: FEED_BRAND,
      art: ART,
      preset: 'pop',
    })
    expect(legacy).toContain('<image')
    expect(legacy).not.toContain('tint')
  })

  it('writes the planned scene in an empty art box, at the legibility floor or larger', () => {
    const scene =
      'Two students share a bench outside the library at dusk, one reading a timetable aloud.'
    const svgs = draw({ layout: postcard.slice(0, 2), planned: [scene, null] })
    expect(svgs[0]).toContain('>Planned scene</text>')
    const words = [...svgs[0].matchAll(/font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)]
    const sceneLines = words.filter(([, , t]) => scene.includes(t) && t.length > 0)
    expect(sceneLines.map(([, , t]) => t).join(' ')).toBe(scene)
    for (const [, px] of sceneLines) expect(Number(px)).toBeGreaterThanOrEqual(LEGIBILITY_FLOOR_PX)
    expect(svgs[1]).not.toContain('Planned scene')
    expect(draw({ layout: postcard.slice(0, 1), arts: [ART], planned: [scene] })[0]).not.toContain(
      'Planned scene',
    )
  })
})

describe('slideColours', () => {
  const look = templateById('postcard') as Template
  const legacy = templateById('the-line') as Template

  it('draws a look in Subdued when the theme names it, and in Pop otherwise', () => {
    const subdued = slideColours({ template: look, brand: FEED_BRAND, themeId: 'subdued' })
    expect(subdued).toEqual({
      theme: presetThemes('subdued').base,
      surfaces: presetThemes('subdued'),
      preset: 'subdued',
    })
    for (const themeId of ['pop', 'paper', null]) {
      expect(slideColours({ template: look, brand: FEED_BRAND, themeId })?.preset).toBe('pop')
    }
  })

  it('draws an old template in its brand theme, the first when none is chosen, and none for an unknown one', () => {
    expect(slideColours({ template: legacy, brand: FEED_BRAND, themeId: 'paper' })).toEqual({
      theme: PAPER,
    })
    expect(slideColours({ template: legacy, brand: FEED_BRAND, themeId: null })).toEqual({
      theme: FEED_BRAND.themes[0],
    })
    expect(slideColours({ template: legacy, brand: FEED_BRAND, themeId: 'pop' })).toBeNull()
  })
})

describe('svgSlides for the bullets layout (GD34)', () => {
  it('draws one bullet mark per point, in the ink, beside its first row only', () => {
    const template = templateById('field-notes') as Template
    const long =
      'Ask your manager about exam weeks before the term starts so your shifts can move around them'
    const structure: Structure = {
      templateId: template.id,
      artPrompt: '',
      slides: [
        {
          kind: 'body',
          layout: 'bullets',
          slots: {
            heading: { text: 'Before you take a shift', factIds: [], factual: false },
            points: {
              text: ['Check your visa hours', long, 'Keep one free day'].join('\n'),
              factIds: [],
              factual: true,
            },
          },
        },
      ],
    }
    const { slides: layout } = layoutStructure({
      structure,
      template,
      brand: FEED_BRAND,
      sourceTitle: 'Paid work',
      facts: [],
    })
    const pop = presetThemes('pop')
    const [svg] = svgSlides({ layout, theme: PAPER, brand: FEED_BRAND, art: null, surfaces: pop })
    const rows = layout[0].lines.filter((l) => l.slot === 'points')
    expect(rows.length).toBeGreaterThan(3)
    const marks = [
      ...svg.matchAll(/<circle data-bullet="" cx="([\d.]+)" cy="([\d.]+)"[^>]*fill="([^"]+)"/g),
    ]
    expect(marks).toHaveLength(3)
    const firsts = rows.filter((l) => l.bullet)
    marks.forEach(([, cx, cy, fill], i) => {
      expect(Number(cx)).toBeLessThan(firsts[i].x)
      expect(Number(cy)).toBeLessThan(firsts[i].y)
      expect(fill).toBe(pop.base.ink)
    })
    // The PNG is what every screen and the export show: a bullets slide must draw.
    expect(() => toPng(svg, FEED_BRAND, 108)).not.toThrow()
  })
})

describe('svgSlides for the checklist layout', () => {
  it('draws one tick per item, in the ink, beside its first row, every row indented as a point is', () => {
    const template = templateById('data-desk') as Template
    const long =
      'Ask your manager about exam weeks before the term starts so your shifts can move around them'
    const structure: Structure = {
      templateId: template.id,
      artPrompt: '',
      slides: [
        {
          kind: 'body',
          layout: 'checklist',
          slots: {
            heading: { text: 'Before you take a shift', factIds: [], factual: false },
            items: {
              text: ['Check your visa hours', long, 'Keep one free day'].join('\n'),
              factIds: [],
              factual: false,
            },
          },
        },
      ],
    }
    const { slides: layout } = layoutStructure({
      structure,
      template,
      brand: FEED_BRAND,
      sourceTitle: 'Paid work',
      facts: [],
    })
    const pop = presetThemes('pop')
    const [svg] = svgSlides({ layout, theme: PAPER, brand: FEED_BRAND, art: null, surfaces: pop })
    const box = template.layouts?.checklist?.slots.find((s) => s.key === 'items')?.box
    const rows = layout[0].lines.filter((l) => l.slot === 'items')
    expect(rows.length).toBeGreaterThan(3)
    for (const row of rows) expect(row.x).toBe((box?.x ?? 0) + BULLET.indent)
    const ticks = [
      ...svg.matchAll(/<path data-tick="" d="M([\d.]+) ([\d.]+)[^"]*"[^>]*stroke="([^"]+)"/g),
    ]
    expect(ticks).toHaveLength(3)
    expect(svg).not.toContain('data-bullet')
    const firsts = rows.filter((l) => l.tick)
    expect(firsts).toHaveLength(3)
    ticks.forEach(([, x, y, stroke], i) => {
      expect(Number(x)).toBeLessThan(firsts[i].x)
      expect(Number(y)).toBeLessThan(firsts[i].y)
      expect(stroke).toBe(pop.base.ink)
    })
    // The PNG is what every screen and the export show: the ticked slide must draw.
    expect(() => toPng(svg, FEED_BRAND, 108)).not.toThrow()
  })
})

describe('svgSlides in Nepali and Thai (GD38)', () => {
  const svgFor = (heading: string) => {
    const s: Structure = {
      templateId: 'field-notes',
      artPrompt: 'An open notebook.',
      slides: [
        {
          kind: 'cover',
          layout: 'cover',
          slots: {
            kicker: { text: 'OfCourse', factIds: [], factual: false },
            heading: { text: heading, factIds: [], factual: false },
          },
        },
      ],
    }
    const { slides: layout } = layoutStructure({
      structure: s,
      template: templateById('field-notes') as Template,
      brand: FEED_BRAND,
      sourceTitle: 'Hours',
      facts: [],
    })
    return svgSlides({
      layout,
      theme: PAPER,
      brand: FEED_BRAND,
      art: null,
      surfaces: presetThemes('pop'),
    })[0]
  }

  it("writes each Devanagari or Thai run in its Noto family inside the brand font's line", () => {
    const nepali = svgFor('काम 20 घण्टा')
    expect(nepali).toContain('<tspan font-family="Noto Sans Devanagari">काम </tspan>20 ')
    expect(nepali).toContain('<tspan font-family="Noto Sans Devanagari">घण्टा</tspan>')
    expect(nepali).toContain('font-family="Barlow Condensed"')
    expect(svgFor('ทำงาน 20 ชั่วโมง')).toContain(
      '<tspan font-family="Noto Sans Thai">ทำงาน </tspan>20 <tspan font-family="Noto Sans Thai">ชั่วโมง</tspan>',
    )
    // A line in the brand's script alone is written as before, with no run of its own.
    expect(svgFor('Work less')).not.toContain('<tspan')
  })
})

describe('the swipe cue in the post’s language (GD39)', () => {
  const svgsIn = (language: 'en' | 'th') =>
    svgSlides({
      layout: layoutStructure({
        structure: lookStructure('field-notes'),
        template: templateById('field-notes') as Template,
        brand: FEED_BRAND,
        sourceTitle: 'Hours of paid work',
        facts: [],
        language,
      }).slides,
      theme: PAPER,
      brand: FEED_BRAND,
      art: null,
      surfaces: presetThemes('pop'),
    })

  it('writes a Thai cue in Noto Sans Thai, on every slide but the last, and an English one as before', () => {
    const thai = svgsIn('th')
    const cue = '<tspan font-family="Noto Sans Thai">ปัดเพื่อดูต่อ</tspan></text>'
    thai.forEach((svg, i) => {
      expect(svg.includes(cue)).toBe(i < thai.length - 1)
      expect(svg.includes('>Swipe</text>')).toBe(false)
    })
    const english = svgsIn('en')
    english.forEach((svg, i) => {
      expect(svg.includes('>Swipe</text>')).toBe(i < english.length - 1)
    })
  })

  it('draws the cue bold in the heading face, at the frame’s size or larger, in the surface’s ink', () => {
    const { layout, svgs } = lookSvgs('field-notes', 'pop')
    const pop = presetThemes('pop')
    for (const lang of ['en', 'th'] as const) {
      const [svg] = lang === 'en' ? svgs : svgsIn('th')
      const cue = svg.match(
        /<text [^>]*font-family="([^"]+)" font-weight="(\d+)" font-size="([\d.]+)" fill="([^"]+)" text-anchor="end"[^>]*>/,
      )
      expect(cue?.[1]).toBe(FEED_BRAND.fonts.heading.family)
      expect(cue?.[2]).toBe('700')
      expect(Number(cue?.[3])).toBeGreaterThanOrEqual(SOURCE_LINE.fontPx)
      expect(cue?.[4]).toBe(pop[layout[0].surface ?? 'base'].ink)
    }
  })
})
