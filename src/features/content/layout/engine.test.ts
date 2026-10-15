import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import {
  type Fact,
  type LaidSlide,
  SEARCH_SLOT,
  type Slide,
  type SlideSpec,
  SOURCES_SLOT,
  type Structure,
  type Template,
} from '../model/types'
import { TEMPLATES, templateById } from '../templates'
import { PAID_WORK_PARAGRAPHS } from '../text/fixtures'
import {
  BULLET,
  CANVAS,
  FRAME,
  LEGIBILITY_FLOOR_PX,
  layoutStructure,
  PANEL_PADDING,
  paragraphSite,
  paragraphSites,
  SEARCH_LINE,
  SOURCE_LINE,
  SOURCES_HEADING,
  SOURCES_LINE,
  SOURCES_MAX,
  slideSpec,
  sourceLineY,
} from './engine'
import { lookStructure } from './fixtures'

const WORDS = PAID_WORK_PARAGRAPHS.map((p) => p.text)
  .join(' ')
  .split(/\s+/)
const words = (n: number) => Array.from({ length: n }, (_, i) => WORDS[i % WORDS.length]).join(' ')

const FACTS: Fact[] = [
  {
    id: 'f1',
    text: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
    value: { number: 11, unit: 'percentage points' },
    ref: '¶3',
    quote: null,
    supported: true,
    why: null,
    span: null,
  },
]

function structure(templateId: string, bodies: string[]): Structure {
  return {
    templateId,
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
      ...bodies.map((body, i) => ({
        kind: 'body' as const,
        slots: {
          heading: { text: `Finding ${i + 1}`, factIds: [], factual: false },
          body: { text: body, factIds: ['f1'], factual: true },
        },
      })),
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
}

const THE_LINE = templateById('the-line') as Template
const LONG_READ = templateById('the-long-read') as Template
const lay = (s: Structure, template: Template, slotOverrides?: Record<string, string>) =>
  layoutStructure({
    structure: s,
    template,
    brand: FEED_BRAND,
    sourceTitle: 'Hours of paid work and first-year results',
    facts: FACTS,
    slotOverrides,
  })

describe('layoutStructure', () => {
  it('fits every slot of the-line at its starting size with a 47-word body', () => {
    const { fits, slides } = lay(structure('the-line', [words(47), words(40), words(40)]), THE_LINE)
    expect(slides).toHaveLength(5)
    // Every slot, plus the last slide's search line.
    expect(fits.length).toBe(3 + 3 * 2 + 1 + 1)
    for (const fit of fits) expect(fit.fits).toBe(true)
    const body = fits.find((f) => f.slide === 2 && f.slot === 'body')
    expect(body?.fontPx).toBe(40)
    const phrase = fits.find((f) => f.slide === 1 && f.slot === 'phrase')
    expect(phrase?.fontPx).toBe(72)
  })

  it('places every word of a slot as measured lines inside its box', () => {
    const body = words(47)
    const { slides } = lay(structure('the-line', [body, words(40), words(40)]), THE_LINE)
    const lines = slides[1].lines.filter((l) => l.slot === 'body')
    expect(lines.map((l) => l.text).join(' ')).toBe(body)
    for (const line of lines) {
      expect(line.x).toBe(96)
      expect(line.width).toBeLessThanOrEqual(888)
      expect(line.y).toBeGreaterThan(330)
      expect(line.y).toBeLessThanOrEqual(330 + 860)
    }
  })

  it('still fits a 121-word body in the-long-read box', () => {
    const { fits } = lay(structure('the-long-read', [words(121), words(40)]), LONG_READ)
    const body = fits.find((f) => f.slide === 2 && f.slot === 'body')
    expect(body?.fits).toBe(true)
  })

  it('steps a 400-word body down to the legibility floor and reports it does not fit', () => {
    expect(LEGIBILITY_FLOOR_PX).toBe(37)
    const { fits, slides } = lay(structure('the-long-read', [words(400), words(40)]), LONG_READ)
    const body = fits.find((f) => f.slide === 2 && f.slot === 'body')
    expect(body?.fontPx).toBe(37)
    expect(body?.fits).toBe(false)
    expect(body?.lines).toBeGreaterThan(body?.maxLines ?? 0)
    expect(slides[1].lines.filter((l) => l.slot === 'body').every((l) => l.fontPx === 37)).toBe(
      true,
    )
  })

  it('gives the same layout every time', () => {
    const s = structure('the-line', [words(47), words(60), words(33)])
    expect(lay(s, THE_LINE)).toEqual(lay(s, THE_LINE))
  })

  it('puts a source line on body slides only, naming the source and the paragraphs used', () => {
    const { slides } = lay(structure('the-line', [words(47), words(40), words(40)]), THE_LINE)
    expect(slides[0].sourceLine).toBeNull()
    expect(slides[0].artBox).toEqual({ x: 0, y: 0, w: 1080, h: 810 })
    expect(slides[1].sourceLine).toBe('Source: Hours of paid work and first-year results · ¶3')
    expect(slides[1].artBox).toBeNull()
  })

  it('names the site in the source line of a source read from a link; the search line keeps the title (94)', () => {
    const { slides } = layoutStructure({
      structure: structure('the-line', [words(47), words(40), words(40)]),
      template: THE_LINE,
      brand: FEED_BRAND,
      sourceTitle: 'Hours of paid work and first-year results',
      sourceSite: 'campustimes.example',
      facts: FACTS,
    })
    expect(slides[1].sourceLine).toBe('Source: campustimes.example · ¶3')
    expect(slides.at(-1)?.searchLine).toBe(SEARCH_LINE('Hours of paid work and first-year results'))
  })

  it('names the distinct sites of a slide’s facts when the source has parts (GD19)', () => {
    const facts: Fact[] = [
      { ...FACTS[0], id: 'f1', ref: '¶2' },
      { ...FACTS[0], id: 'f2', ref: '¶7' },
      { ...FACTS[0], id: 'f3', ref: '¶3' },
    ]
    const s = structure('the-line', [words(30), words(30), words(30)])
    s.slides[1].slots.body.factIds = ['f1', 'f2', 'f3']
    s.slides[2].slots.body.factIds = ['f1', 'f3']
    s.slides[3].slots.body.factIds = []
    const sites = { '¶2': 'abc.net.au', '¶3': 'abc.net.au', '¶7': 'studyaustralia.gov.au' }
    const { slides } = layoutStructure({
      structure: s,
      template: THE_LINE,
      brand: FEED_BRAND,
      sourceTitle: 'Hours of paid work and first-year results',
      sites,
      facts,
    })
    expect(slides[1].sourceLine).toBe('Sources: abc.net.au, studyaustralia.gov.au · ¶2, ¶3, ¶7')
    expect(slides[2].sourceLine).toBe('Source: abc.net.au · ¶2, ¶3')
    // A slide with no facts keeps today's line.
    expect(slides[3].sourceLine).toBe('Source: Hours of paid work and first-year results')
  })

  it('lays out a stored single-link source as before when its sites come from no parts', () => {
    const s = structure('the-line', [words(47), words(40), words(40)])
    const input = {
      structure: s,
      template: THE_LINE,
      brand: FEED_BRAND,
      sourceTitle: 'Hours of paid work and first-year results',
      sourceSite: 'campustimes.example',
      facts: FACTS,
    }
    const stored = { url: 'https://campustimes.example/a', site: 'campustimes.example' }
    expect(layoutStructure({ ...input, sites: paragraphSites(stored) })).toEqual(
      layoutStructure(input),
    )
  })

  it('replaces only the overridden slot', () => {
    const s = structure('the-line', [words(47), words(40), words(40)])
    const base = lay(s, THE_LINE)
    const over = lay(s, THE_LINE, { '1:kicker': 'With your family' })
    expect(over.slides[0].lines.filter((l) => l.slot === 'kicker').map((l) => l.text)).toEqual([
      'With your family',
    ])
    expect(over.slides[0].lines.filter((l) => l.slot !== 'kicker')).toEqual(
      base.slides[0].lines.filter((l) => l.slot !== 'kicker'),
    )
    expect(over.slides.slice(1)).toEqual(base.slides.slice(1))
  })
})

/** The shortest structure a template takes: each spec repeated its minimum, every slot one word. */
function shortest(template: Template): Structure {
  return {
    templateId: template.id,
    artPrompt: 'An open notebook beside a small desk clock.',
    slides: template.slides.flatMap(({ spec, repeat }) =>
      Array.from({ length: repeat.min }, () => ({
        kind: spec.kind,
        slots: Object.fromEntries(
          spec.slots.map((s) => [s.key, { text: 'Word', factIds: [], factual: false }]),
        ),
      })),
    ),
  }
}

describe('paragraphSite (GD19)', () => {
  const source = {
    parts: [
      { url: 'https://www.abc.net.au/a', site: 'abc.net.au', title: 'A', from: 1, to: 3 },
      {
        url: 'https://www.studyaustralia.gov.au/b',
        site: 'studyaustralia.gov.au',
        title: 'B',
        from: 4,
        to: 5,
      },
    ],
  }

  it('gives the site of the part that holds a paragraph or a sentence', () => {
    expect(paragraphSite(source, '¶1')).toBe('abc.net.au')
    expect(paragraphSite(source, '¶3')).toBe('abc.net.au')
    expect(paragraphSite(source, '¶4')).toBe('studyaustralia.gov.au')
    expect(paragraphSite(source, '¶5.2')).toBe('studyaustralia.gov.au')
  })

  it('gives none past the parts, for a ref that is no paragraph, or for a source with no parts', () => {
    expect(paragraphSite(source, '¶6')).toBeNull()
    expect(paragraphSite(source, 'title')).toBeNull()
    expect(paragraphSite({ site: 'campustimes.example' }, '¶1')).toBeNull()
  })

  it('maps every paragraph of the parts to its site, and none without parts', () => {
    expect(paragraphSites(source)).toEqual({
      '¶1': 'abc.net.au',
      '¶2': 'abc.net.au',
      '¶3': 'abc.net.au',
      '¶4': 'studyaustralia.gov.au',
      '¶5': 'studyaustralia.gov.au',
    })
    expect(paragraphSites({})).toBeUndefined()
  })
})

describe('the search line (criterion 106)', () => {
  const TITLE = 'Hours of paid work and first-year results'
  const LINE = 'To find this again, search “OfCourse Hours of paid work and first-year results”'

  it('ends the last slide of every template with it, naming the title, and no other slide', () => {
    expect(SEARCH_LINE(TITLE)).toBe(LINE)
    for (const template of TEMPLATES) {
      const { slides, fits } = layoutStructure({
        structure: shortest(template),
        template,
        brand: FEED_BRAND,
        sourceTitle: TITLE,
        facts: [],
      })
      const last = slides.length - 1
      expect(slides[last].searchLine).toBe(LINE)
      expect(
        slides[last].lines
          .filter((l) => l.slot === SEARCH_SLOT)
          .map((l) => l.text)
          .join(' '),
      ).toBe(LINE)
      for (const slide of slides.slice(0, last)) {
        expect(slide.searchLine).toBeNull()
        expect(slide.lines.some((l) => l.slot === SEARCH_SLOT)).toBe(false)
      }
      const fit = fits.find((f) => f.slide === slides.length && f.slot === SEARCH_SLOT)
      expect(fit).toMatchObject({ fontPx: SOURCE_LINE.fontPx, fits: true })
    }
  })

  it('wraps it into body rows at the source line size, the last row on the source baseline', () => {
    const { slides } = lay(structure('the-line', [words(47), words(40), words(40)]), THE_LINE)
    const rows = slides[4].lines.filter((l) => l.slot === SEARCH_SLOT)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.text).join(' ')).toBe(LINE)
    for (const row of rows) {
      expect(row).toMatchObject({ font: 'body', fontPx: 38, x: 96, mark: 'none' })
      expect(row.width).toBeLessThanOrEqual(888)
    }
    expect(rows[1].y).toBe(1270)
    expect(rows[0].y).toBe(1224.4)
  })

  it('reports a title too long for the foot of the slide as not fitting', () => {
    // Cover and take only, in wide glyphs: the rows overflow the foot without a title so long
    // that the source line's one-character-at-a-time shortening makes the test slow.
    const { fits, slides } = layoutStructure({
      structure: structure('the-line', []),
      template: THE_LINE,
      brand: FEED_BRAND,
      sourceTitle: Array.from({ length: 24 }, () => 'WWWWWWWW').join(' '),
      facts: FACTS,
    })
    const fit = fits.find((f) => f.slide === 2 && f.slot === SEARCH_SLOT)
    expect(fit?.fits).toBe(false)
    expect(fit?.lines).toBeGreaterThan(fit?.maxLines ?? 0)
    expect(fit?.fontPx).toBe(38)
    expect(slides[1].lines.filter((l) => l.slot === SEARCH_SLOT)).toHaveLength(fit?.lines ?? 0)
  })

  it('names the title it is given in place of the source title, which still names the source (RC7)', () => {
    const { slides } = layoutStructure({
      structure: structure('the-line', [words(20)]),
      template: THE_LINE,
      brand: FEED_BRAND,
      sourceTitle: 'Perth, Cyber Security',
      title: 'Life on this path',
      facts: FACTS,
    })
    expect(slides.at(-1)?.searchLine).toBe(SEARCH_LINE('Life on this path'))
    expect(slides[1].sourceLine).toContain('Perth, Cyber Security')
  })
})

describe('layoutStructure on long unbroken words (smoke test, 12 Oct)', () => {
  // A web address pasted as the source: the fake drafts each body as the address 40 times, and a
  // 200-character title with no space must be shortened in the source line. A preview request
  // lays out the whole structure, so this must take a moment, not seconds.
  const URL =
    'https://www.researchgate.net/publication/374869985_Personality_Profiles_of_263_Occupations'
  const body = Array.from({ length: 40 }, () => URL).join(' ')
  const title = 'x'.repeat(200)

  it('lays out three body slides of a repeated address and a long title in well under a second', () => {
    const started = performance.now()
    const { slides, fits } = layoutStructure({
      structure: structure('the-line', [body, body, body]),
      template: THE_LINE,
      brand: FEED_BRAND,
      sourceTitle: title,
      facts: FACTS,
    })
    const took = performance.now() - started
    expect(took).toBeLessThan(1000)
    const laid = fits.find((f) => f.slide === 2 && f.slot === 'body')
    expect(laid?.fontPx).toBe(LEGIBILITY_FLOOR_PX)
    expect(laid?.fits).toBe(false)
    for (const line of slides[1].lines) expect(line.width).toBeLessThanOrEqual(888)
    expect(slides[1].sourceLine?.startsWith('Source: xxx')).toBe(true)
    expect(slides[1].sourceLine?.endsWith('… · ¶3')).toBe(true)
  })
})

describe('slideSpec (GD4)', () => {
  const FIELD_NOTES = templateById('field-notes') as Template
  const slide = (kind: Slide['kind'], layout: Slide['layout']): Slide => ({
    kind,
    layout,
    slots: {},
  })

  it('picks a look slide’s spec by its layout, and by its kind when it has none', () => {
    expect(slideSpec(FIELD_NOTES, slide('body', 'bars'))).toBe(
      FIELD_NOTES.layouts?.bars as SlideSpec,
    )
    expect(slideSpec(FIELD_NOTES, slide('body', 'number'))).toBe(
      FIELD_NOTES.layouts?.number as SlideSpec,
    )
    expect(slideSpec(FIELD_NOTES, slide('body', null))).toBe(FIELD_NOTES.slides[1].spec)
  })

  it('picks an old template’s spec by kind, whatever layout the slide names', () => {
    const body = THE_LINE.slides.find((s) => s.spec.kind === 'body')?.spec
    expect(slideSpec(THE_LINE, slide('body', null))).toBe(body as SlideSpec)
    expect(slideSpec(THE_LINE, slide('body', 'bars'))).toBe(body as SlideSpec)
  })

  it('starts each checklist item of a look on its own line', () => {
    const items = 'Check your visa hours\nAsk about exam weeks\nKeep one free day'
    const { slides } = layoutStructure({
      structure: {
        templateId: 'field-notes',
        artPrompt: 'A desk.',
        slides: [
          {
            kind: 'body',
            layout: 'checklist',
            slots: {
              heading: { text: 'Before a shift', factIds: [], factual: false },
              items: { text: items, factIds: [], factual: false },
            },
          },
        ],
      },
      template: FIELD_NOTES,
      brand: FEED_BRAND,
      sourceTitle: 'Hours of paid work',
      facts: [],
    })
    expect(slides[0].lines.filter((l) => l.slot === 'items').map((l) => l.text)).toEqual(
      items.split('\n'),
    )
  })
})

describe('the Postcard foot row (GD6, GD9)', () => {
  it('sits on the panel on every slide, never on the art: source line, search line and frame', () => {
    const structure = lookStructure('postcard')
    const { slides } = layoutStructure({
      structure,
      template: templateById('postcard') as Template,
      brand: FEED_BRAND,
      sourceTitle: 'Hours of paid work and first-year results',
      facts: [],
    })
    for (const [i, slide] of slides.entries()) {
      const panel = slide.panel
      if (!panel) throw new Error(`slide ${i + 1} has no panel`)
      const foot = slide.lines.filter((l) => l.slot === SEARCH_SLOT).map((l) => l.y)
      // On the last slide the source line moves up above the search line's rows.
      const sourceY = slide.sourceLine === null ? SOURCE_LINE.y : sourceLineY(foot.length)
      const top = Math.min(SOURCE_LINE.y, sourceY, ...foot) - SOURCE_LINE.fontPx
      expect({ slide: i + 1, covers: panel.x <= SOURCE_LINE.x }).toEqual({
        slide: i + 1,
        covers: true,
      })
      expect({ slide: i + 1, covers: panel.x + panel.w >= FRAME.right }).toEqual({
        slide: i + 1,
        covers: true,
      })
      expect({ slide: i + 1, covers: panel.y <= top }).toEqual({ slide: i + 1, covers: true })
      expect({ slide: i + 1, covers: panel.y + panel.h >= SOURCE_LINE.y }).toEqual({
        slide: i + 1,
        covers: true,
      })
    }
  })
})

describe('the Postcard card, sized to its text so the picture shows', () => {
  const postcard = templateById('postcard') as Template
  const box = (key: string) => postcard.layouts?.picture?.slots.find((s) => s.key === key)?.box
  /** Slide 2 of a three-slide Postcard post: a picture slide with this body under a short heading. */
  const pictureSlide = (body: string) => {
    const s = lookStructure('postcard')
    const [cover, picture] = s.slides
    const take = s.slides.at(-1) as Slide
    const slides = [
      cover,
      { ...picture, slots: { ...picture.slots, body: { ...picture.slots.body, text: body } } },
      take,
    ]
    return layoutStructure({
      structure: { ...s, slides },
      template: postcard,
      brand: FEED_BRAND,
      sourceTitle: 'Hours of paid work',
      facts: [],
    }).slides[1]
  }
  const footTop = SOURCE_LINE.y - SOURCE_LINE.fontPx

  it('keeps a short body’s card under 40% of the slide, the foot row inside it', () => {
    const slide = pictureSlide(words(15))
    const panel = slide.panel
    if (!panel) throw new Error('no panel')
    expect(panel.h).toBeLessThan(0.4 * CANVAS.height)
    expect(panel.y).toBeLessThanOrEqual(footTop)
    expect(panel.y + panel.h).toBeGreaterThanOrEqual(SOURCE_LINE.y)
    // Every word of the slide sits on the card.
    for (const l of slide.lines) expect(l.y - 0.8 * l.fontPx).toBeGreaterThanOrEqual(panel.y)
  })

  it('grows the card with a longer body, never past the slots’ area and the foot row', () => {
    const short = pictureSlide(words(15)).panel
    const long = pictureSlide(words(25)).panel
    if (!short || !long) throw new Error('no panel')
    expect(long.h).toBeGreaterThan(short.h)
    expect(long.y).toBeGreaterThanOrEqual((box('heading')?.y ?? 0) - PANEL_PADDING)
  })

  it('stacks the text against the foot row, each line at its own x, and records the shift', () => {
    const slide = pictureSlide(words(15))
    const shift = slide.shift ?? 0
    expect(shift).toBeGreaterThan(0)
    const heading = slide.lines.filter((l) => l.slot === 'heading')
    expect(heading[0].x).toBe(box('heading')?.x ?? -1)
    expect(heading[0].y).toBeGreaterThan(box('heading')?.y ?? 0)
    const bottom = Math.max(...slide.lines.map((l) => l.y + 0.25 * l.fontPx))
    expect(bottom).toBeLessThan(footTop)
    expect(bottom).toBeGreaterThan(footTop - 2 * PANEL_PADDING)
  })

  it('leaves the other looks’ slides where they were, with no shift', () => {
    for (const id of ['field-notes', 'data-desk']) {
      const { slides } = layoutStructure({
        structure: lookStructure(id),
        template: templateById(id) as Template,
        brand: FEED_BRAND,
        sourceTitle: 'Hours of paid work',
        facts: [],
      })
      for (const slide of slides) expect(slide.shift).toBeUndefined()
    }
  })
})

describe('the source line of a template from before the looks, shortened to fit (71)', () => {
  // A look's slides carry no source line (GD31), so only an old template's line is shortened.
  const lay = (sourceTitle: string) => {
    const s = structure('the-line', [words(30), words(30), words(30)])
    s.slides[2].slots.body.factIds = []
    return layoutStructure({
      structure: s,
      template: THE_LINE,
      brand: FEED_BRAND,
      sourceTitle,
      facts: FACTS,
    }).slides
  }
  const LONG = 'Paid work and grades among first-year students at the largest city universities'

  it('shortens a line that does not fit at a word boundary, never mid-word, and keeps the whole line', () => {
    const slides = lay(LONG)
    expect(slides[1].sourceLine).toBe('Source: Paid work and grades among first-year… · ¶3')
    expect(slides[1].fullSourceLine).toBe(`Source: ${LONG} · ¶3`)
  })

  it('drops the comma a cut would leave before the ellipsis', () => {
    expect(
      lay('Paid work and grades among first-year, students at city universities')[1].sourceLine,
    ).toBe('Source: Paid work and grades among first-year… · ¶3')
  })

  it('keeps a line that fits whole, with nothing more stored', () => {
    const slides = lay('Paid work and grades')
    expect(slides[2].sourceLine).toBe('Source: Paid work and grades')
    expect('fullSourceLine' in slides[2]).toBe(false)
  })
})

describe('where sources go (GD31)', () => {
  const TITLE = 'Hours of paid work and first-year results'
  const SOURCES = [
    { site: 'abc.net.au', title: 'Students who work long hours', url: 'https://abc.net.au/a' },
    { site: 'studyaustralia.gov.au', title: 'Work rights for students', url: null },
  ]
  const layLook = (templateId: string, sourcesAt?: 'caption' | 'last_slide' | 'sources_slide') => {
    const s = lookStructure(templateId)
    s.slides[1].slots.body.factIds = ['f1']
    return layoutStructure({
      structure: s,
      template: templateById(templateId) as Template,
      brand: FEED_BRAND,
      sourceTitle: TITLE,
      facts: [{ ...FACTS[0], ref: '¶1' }],
      sources: SOURCES,
      sourcesAt,
    })
  }
  const rowsOf = (slide: { lines: { slot: string; text: string }[] }, slot: string) =>
    slide.lines.filter((l) => l.slot === slot).map((l) => l.text)

  it('draws no source line on any slide of a look, whichever the option', () => {
    for (const templateId of ['field-notes', 'data-desk', 'postcard']) {
      for (const at of [undefined, 'caption', 'last_slide', 'sources_slide'] as const) {
        const { slides } = layLook(templateId, at)
        expect({ templateId, at, lines: slides.map((s) => s.sourceLine) }).toEqual({
          templateId,
          at,
          lines: slides.map(() => null),
        })
      }
    }
  })

  it('keeps the slides as they are with the sources in the caption', () => {
    const { slides } = layLook('field-notes', 'caption')
    expect(slides).toHaveLength(lookStructure('field-notes').slides.length)
    for (const slide of slides) expect(rowsOf(slide, SOURCES_SLOT)).toEqual([])
  })

  it('puts one "Sources:" line of site names above the search line on the last slide only', () => {
    const { slides, fits } = layLook('field-notes', 'last_slide')
    const last = slides.at(-1)
    if (!last) throw new Error('no slides')
    expect(slides).toHaveLength(lookStructure('field-notes').slides.length)
    expect(rowsOf(last, SOURCES_SLOT).join(' ')).toBe(
      SOURCES_LINE(['abc.net.au', 'studyaustralia.gov.au']),
    )
    expect(SOURCES_LINE(['abc.net.au', 'studyaustralia.gov.au'])).toBe(
      'Sources: abc.net.au, studyaustralia.gov.au',
    )
    const sourceYs = last.lines.filter((l) => l.slot === SOURCES_SLOT).map((l) => l.y)
    const searchYs = last.lines.filter((l) => l.slot === SEARCH_SLOT).map((l) => l.y)
    expect(Math.max(...sourceYs)).toBeLessThan(Math.min(...searchYs))
    expect(fits.find((f) => f.slide === slides.length && f.slot === SOURCES_SLOT)).toMatchObject({
      fontPx: SOURCE_LINE.fontPx,
      fits: true,
    })
    for (const slide of slides.slice(0, -1)) expect(rowsOf(slide, SOURCES_SLOT)).toEqual([])
  })

  it('wraps a long list of sites into rows and reports it when the foot cannot hold them', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      site: `university-number-${i + 1}.example.edu.au`,
      title: 'A page',
      url: null,
    }))
    const s = lookStructure('field-notes')
    const { slides, fits } = layoutStructure({
      structure: s,
      template: templateById('field-notes') as Template,
      brand: FEED_BRAND,
      sourceTitle: TITLE,
      facts: [],
      sources: many,
      sourcesAt: 'last_slide',
    })
    const rows = slides.at(-1)?.lines.filter((l) => l.slot === SOURCES_SLOT) ?? []
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) expect(row.width).toBeLessThanOrEqual(SOURCE_LINE.width)
    const fit = fits.find((f) => f.slide === slides.length && f.slot === SOURCES_SLOT)
    expect(fit?.lines).toBe(rows.length)
    expect(fit?.fits).toBe(fit ? fit.lines <= fit.maxLines : false)
  })

  it('adds a final sources slide in every look: the heading, one row per source, the search line', () => {
    for (const templateId of ['field-notes', 'data-desk', 'postcard']) {
      const { slides, fits } = layLook(templateId, 'sources_slide')
      const count = lookStructure(templateId).slides.length
      expect(slides).toHaveLength(count + 1)
      const extra = slides[count]
      expect(rowsOf(extra, 'heading')).toEqual([SOURCES_HEADING])
      // Each source starts its own line; a long title wraps under it.
      const rows = rowsOf(extra, 'rows')
      expect(rows.join(' ')).toBe(
        'abc.net.au · Students who work long hours studyaustralia.gov.au · Work rights for students',
      )
      expect(rows.filter((r) => r.includes(' · ')).map((r) => r.split(' · ')[0])).toEqual([
        'abc.net.au',
        'studyaustralia.gov.au',
      ])
      expect(extra.searchLine).toBe(SEARCH_LINE(TITLE))
      expect(extra.frame).toEqual({ slide: count + 1, total: count + 1 })
      expect(slides[count - 1].searchLine).toBeNull()
      expect(slides[count - 1].frame).toEqual({ slide: count, total: count + 1 })
      for (const fit of fits.filter((f) => f.slide === count + 1)) {
        expect({ templateId, slot: fit.slot, fits: fit.fits }).toEqual({
          templateId,
          slot: fit.slot,
          fits: true,
        })
      }
    }
  })

  it('lists at most six sources on the sources slide, never a link', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({
      site: `site${i + 1}.example`,
      title: `Article ${i + 1}`,
      url: `https://site${i + 1}.example/a-very-long-path/that-goes-on?and=on`,
    }))
    const { slides } = layoutStructure({
      structure: lookStructure('field-notes'),
      template: templateById('field-notes') as Template,
      brand: FEED_BRAND,
      sourceTitle: TITLE,
      facts: [],
      sources: eight,
      sourcesAt: 'sources_slide',
    })
    const rows = rowsOf(slides.at(-1) as { lines: { slot: string; text: string }[] }, 'rows')
    expect(rows).toHaveLength(SOURCES_MAX)
    expect(SOURCES_MAX).toBe(6)
    expect(rows.some((r) => r.includes('https://'))).toBe(false)
  })

  it('draws the sources slide for a look frozen before it, from the look of the same id', () => {
    const frozen = { ...(templateById('data-desk') as Template), sourcesLayout: undefined }
    const { slides } = layoutStructure({
      structure: lookStructure('data-desk'),
      template: frozen,
      brand: FEED_BRAND,
      sourceTitle: TITLE,
      facts: [],
      sources: SOURCES,
      sourcesAt: 'sources_slide',
    })
    expect(slides).toHaveLength(lookStructure('data-desk').slides.length + 1)
  })

  it('names a pasted source by its title when there is no list of sources', () => {
    const { slides } = layoutStructure({
      structure: lookStructure('field-notes'),
      template: templateById('field-notes') as Template,
      brand: FEED_BRAND,
      sourceTitle: 'Paid work',
      facts: [],
      sourcesAt: 'last_slide',
    })
    expect(rowsOf(slides.at(-1) as LaidSlide, SOURCES_SLOT)).toEqual(['Sources: Paid work'])
  })

  it('keeps the source lines of a template from before the looks, whatever the option (GD8)', () => {
    const s = structure('the-line', [words(47), words(40), words(40)])
    const base = { structure: s, template: THE_LINE, brand: FEED_BRAND, sourceTitle: TITLE }
    const before = layoutStructure({ ...base, facts: FACTS })
    for (const at of ['last_slide', 'sources_slide'] as const) {
      expect(layoutStructure({ ...base, facts: FACTS, sources: SOURCES, sourcesAt: at })).toEqual(
        before,
      )
    }
  })
})

describe('the bullets layout (GD34)', () => {
  const POINTS = [
    'Check your visa hours',
    'Ask about exam weeks',
    'Keep one free day',
    'Book your shifts early',
    'Rest before exams',
  ]
  const bullets = (points: string[]): Slide => ({
    kind: 'body',
    layout: 'bullets',
    slots: {
      heading: { text: 'Before you take a shift', factIds: [], factual: false },
      points: { text: points.join('\n'), factIds: [], factual: true },
    },
  })
  const lay = (template: Template, slide: Slide) =>
    layoutStructure({
      structure: { templateId: template.id, artPrompt: '', slides: [slide] },
      template,
      brand: FEED_BRAND,
      sourceTitle: 'Paid work and grades',
      facts: [],
    })
  const look = (id: string) => templateById(id) as Template

  it('starts each of three or five points on its own row after a bullet, indented past it, in every look', () => {
    for (const id of ['field-notes', 'data-desk', 'postcard']) {
      for (const n of [3, 5]) {
        const { slides, fits } = lay(look(id), bullets(POINTS.slice(0, n)))
        const rows = slides[0].lines.filter((l) => l.slot === 'points')
        expect(rows.filter((l) => l.bullet).map((l) => l.text)).toEqual(POINTS.slice(0, n))
        const box = slideSpec(look(id), bullets([])).slots.find((s) => s.key === 'points')?.box
        for (const row of rows) expect(row.x).toBe((box?.x ?? 0) + BULLET.indent)
        expect(fits.find((f) => f.slot === 'points')?.fits).toBe(true)
      }
    }
  })

  it('marks only the first row of a point that wraps, and skips empty lines', () => {
    const long = `${words(30)}`
    const { slides } = lay(look('field-notes'), bullets([long, '', 'Keep one free day']))
    const rows = slides[0].lines.filter((l) => l.slot === 'points')
    expect(rows.length).toBeGreaterThan(2)
    expect(rows.map((l) => l.bullet === true)).toEqual([
      true,
      ...Array(rows.length - 2).fill(false),
      true,
    ])
  })

  it('lays a bullets slide out on a look frozen before the layout, as the look of its id does', () => {
    const { bullets: _, ...before } = look('data-desk').layouts ?? {}
    const frozen: Template = { ...look('data-desk'), layouts: before }
    const slide = bullets(POINTS.slice(0, 4))
    expect(lay(frozen, slide)).toEqual(lay(look('data-desk'), slide))
  })
})

describe('the lines code writes, in the post’s language (GD39)', () => {
  const TITLE = 'Paid work in Australia'
  const SOURCES = [
    { site: 'abc.net.au', title: 'Students who work long hours', url: null },
    { site: 'studyaustralia.gov.au', title: 'Work rights for students', url: null },
  ]
  const layLook = (
    language: 'en' | 'ne' | 'th' | undefined,
    sourcesAt: 'last_slide' | 'sources_slide',
  ) =>
    layoutStructure({
      structure: lookStructure('field-notes'),
      template: templateById('field-notes') as Template,
      brand: FEED_BRAND,
      sourceTitle: TITLE,
      facts: [],
      sources: SOURCES,
      sourcesAt,
      language,
    })
  const rowsOf = (slide: LaidSlide | undefined, slot: string) =>
    (slide?.lines ?? []).filter((l) => l.slot === slot).map((l) => l.text)

  it('ends a Thai post’s last slide with the Thai search line, “OfCourse” and the title as written', () => {
    const { slides, fits } = layLook('th', 'last_slide')
    const line = `หากต้องการกลับมาอ่านอีกครั้ง ให้ค้นหา “OfCourse ${TITLE}”`
    expect(SEARCH_LINE(TITLE, 'th')).toBe(line)
    expect(slides.at(-1)?.searchLine).toBe(line)
    expect(rowsOf(slides.at(-1), SEARCH_SLOT).join('').replace(/ /g, '')).toBe(
      line.replace(/ /g, ''),
    )
    expect(fits.find((f) => f.slide === slides.length && f.slot === SEARCH_SLOT)?.fits).toBe(true)
  })

  it('keeps a title with a replacement pattern in it as written', () => {
    expect(SEARCH_LINE('Fees $& more', 'th')).toContain('“OfCourse Fees $& more”')
    expect(SEARCH_LINE('Fees $& more')).toBe('To find this again, search “OfCourse Fees $& more”')
  })

  it('heads a Nepali post’s sources line and sources slide in Nepali', () => {
    const last = layLook('ne', 'last_slide').slides.at(-1)
    expect(rowsOf(last, SOURCES_SLOT).join(' ')).toBe('स्रोतहरू: abc.net.au, studyaustralia.gov.au')
    expect(rowsOf(layLook('ne', 'sources_slide').slides.at(-1), 'heading')).toEqual(['स्रोतहरू'])
  })

  it('carries a Thai post’s swipe cue on each frame that draws one, and leaves English frames as they were', () => {
    const { slides } = layLook('th', 'last_slide')
    const total = slides.length
    slides.forEach((slide, i) => {
      expect(slide.frame).toEqual(
        i < total - 1 ? { slide: i + 1, total, swipe: 'ปัดเพื่อดูต่อ' } : { slide: i + 1, total },
      )
    })
    expect(layLook('en', 'last_slide')).toEqual(layLook(undefined, 'last_slide'))
    for (const slide of layLook('en', 'sources_slide').slides) {
      expect(slide.frame && Object.keys(slide.frame)).toEqual(['slide', 'total'])
    }
  })
})
