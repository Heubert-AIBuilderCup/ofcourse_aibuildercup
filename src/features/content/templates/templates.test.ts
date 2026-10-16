import { describe, expect, it } from 'bun:test'
import { brandById, FEED_BRAND } from '../brands'
import { layoutStructure } from '../layout/engine'
import { fitChecks } from '../layout/fit'
import { slideColours } from '../layout/svg'
import { COMIC_PANELS } from '../lib/comic-rules'
import { type Box, LAYOUT_IDS, type SlideSpec, type Template, TemplateSchema } from '../model/types'
import dataDesk from './data-desk.json'
import fieldNotes from './field-notes.json'
import {
  artSlides,
  COMIC_TEMPLATE_ID,
  findSlideSpec,
  imagesFor,
  isLook,
  isPanorama,
  LEGACY_TEMPLATES,
  LOOKS,
  QUOTE_CARD,
  TEMPLATES,
  templateById,
  ticksLegacy,
} from './index'

const comicOrNull = templateById(COMIC_TEMPLATE_ID)

/** Every template drawn: the looks, the old templates posts still carry, the quote card (criterion 108) and the comic. */
const ALL = [...LOOKS, ...LEGACY_TEMPLATES, QUOTE_CARD, ...(comicOrNull ? [comicOrNull] : [])]

/** Every spec of a template: its drafting slides and, for a look, its eight layouts. */
const specsOf = (t: (typeof ALL)[number]): SlideSpec[] => [
  ...t.slides.map((s) => s.spec),
  ...Object.values(t.layouts ?? {}),
]

/** The slot keys of each layout, the same in every look. */
const LAYOUT_SLOTS = {
  cover: ['kicker', 'heading'],
  picture: ['heading', 'body'],
  number: ['number', 'label', 'body'],
  bars: ['heading', 'labelA', 'valueA', 'labelB', 'valueB'],
  quote: ['quote', 'credit'],
  checklist: ['heading', 'items'],
  bullets: ['heading', 'points'],
  takeaway: ['heading', 'body'],
} as const

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function within(b: Box): boolean {
  return b.x >= 0 && b.y >= 0 && b.x + b.w <= 1080 && b.y + b.h <= 1350
}

describe('templates', () => {
  it('parse with TemplateSchema and have unique ids, in the registry order', () => {
    for (const t of ALL) expect(TemplateSchema.safeParse(t).success).toBe(true)
    const ids = [...LOOKS, ...LEGACY_TEMPLATES].map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'field-notes',
      'data-desk',
      'postcard',
      'the-line',
      'the-question',
      'the-long-read',
      'sketch-insight',
    ])
  })

  it('offers the looks for a new post, and still finds old templates and the quote card by id (GD8)', () => {
    expect(TEMPLATES).toEqual(LOOKS)
    expect(templateById('field-notes')?.id).toBe('field-notes')
    expect(templateById('the-line')?.name).toBe('Article carousel · The line')
    expect(templateById('quote-card')?.id).toBe('quote-card')
    expect(templateById('nope')).toBeNull()
    expect(LOOKS.every(isLook)).toBe(true)
    expect([...LEGACY_TEMPLATES, QUOTE_CARD].some(isLook)).toBe(false)
  })

  it('defines every layout in every look with the shared slot keys, each layout of its own kind', () => {
    const kindOf = (id: string) => (id === 'cover' ? 'cover' : id === 'takeaway' ? 'take' : 'body')
    for (const t of LOOKS) {
      expect(Object.keys(t.layouts ?? {}).sort()).toEqual([...LAYOUT_IDS].sort())
      for (const id of LAYOUT_IDS) {
        const spec = t.layouts?.[id]
        expect(spec?.kind).toBe(kindOf(id))
        // Data Desk's cover adds the big stat; every other slot key is shared.
        const keys = spec?.slots
          .map((s) => s.key)
          .filter((k) => !(t.id === 'data-desk' && id === 'cover' && k === 'number'))
        expect(keys).toEqual([...LAYOUT_SLOTS[id]])
      }
    }
  })

  it('keeps the quote card out of the editor’s list: one single slide, one factual quote slot, a source line, no art (108)', () => {
    expect(TemplateSchema.safeParse(QUOTE_CARD).success).toBe(true)
    expect(QUOTE_CARD.id).toBe('quote-card')
    expect(QUOTE_CARD.format).toBe('single')
    expect(TEMPLATES.some((t) => t.id === QUOTE_CARD.id)).toBe(false)
    expect(QUOTE_CARD.slides).toHaveLength(1)
    const { spec, repeat } = QUOTE_CARD.slides[0]
    expect(repeat).toEqual({ min: 1, max: 1 })
    expect(spec.kind).toBe('single')
    expect(spec.artBox).toBeNull()
    expect(spec.sourceLine).toBe(true)
    expect(spec.slots.map((s) => [s.key, s.factual])).toEqual([['quote', true]])
    // Room under the quote for the search line (up to two rows) above the source line.
    expect(spec.slots[0].box.y + spec.slots[0].box.h).toBeLessThanOrEqual(1152)
  })

  it('keeps every box inside the canvas, apart, and off the art unless the slots sit on a panel', () => {
    for (const t of ALL) {
      for (const spec of specsOf(t)) {
        const boxes = spec.slots.map((s) => s.box)
        for (const box of boxes) expect(within(box)).toBe(true)
        if (spec.artBox) {
          expect(within(spec.artBox)).toBe(true)
          if (!spec.panel) {
            for (const box of boxes) expect(intersects(box, spec.artBox)).toBe(false)
          }
        }
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            expect(intersects(boxes[i], boxes[j])).toBe(false)
          }
        }
        if (spec.sourceLine) {
          for (const box of boxes) expect(box.y + box.h).toBeLessThanOrEqual(1230)
        }
      }
    }
  })

  it('starts every slot at or above the legibility floor, and marks factual slots as not presentational', () => {
    for (const t of ALL) {
      for (const spec of specsOf(t)) {
        for (const slot of spec.slots) {
          expect(slot.fontPx).toBeGreaterThanOrEqual(38)
          if (slot.factual) expect(slot.presentational).toBe(false)
        }
      }
    }
  })

  it('limits old carousel body text to 30 to 70 words', () => {
    for (const t of LEGACY_TEMPLATES.filter((x) => x.format === 'carousel')) {
      const body = t.slides.find((s) => s.spec.kind === 'body')
      const slot = body?.spec.slots.find((s) => s.key === 'body')
      expect(slot?.limit).toEqual({ unit: 'words', min: 30, max: 70 })
    }
  })

  it('caps a look’s body text at 25 words', () => {
    for (const t of LOOKS) {
      const bodies = specsOf(t).flatMap((spec) => spec.slots.filter((s) => s.key === 'body'))
      expect(bodies.length).toBeGreaterThan(0)
      for (const slot of bodies) expect(slot.limit).toMatchObject({ unit: 'words', max: 25 })
    }
  })
})

describe('the comic template (RC2, RC6, RC7)', () => {
  const comic = (): Template => {
    if (!comicOrNull) throw new Error('comic missing')
    return comicOrNull
  }
  const TITLE = 'From Pokhara to a nursing degree at Curtin University, Perth'
  const CAPTION =
    'Sita reads the offer letter twice on the bus home, then calls her mother before she can talk herself out of it. Perth feels so far away now.'

  it('is found by id but never offered for a new post, and draws as a look', () => {
    expect(TEMPLATES.some((t) => t.id === COMIC_TEMPLATE_ID)).toBe(false)
    expect(comic().id).toBe(COMIC_TEMPLATE_ID)
    expect(isLook(comic())).toBe(true)
  })

  it('holds as many panels as a comic may have, a cover then the rest', () => {
    const [cover, panels] = comic().slides
    expect(cover.spec.kind).toBe('cover')
    expect(panels.spec.kind).toBe('body')
    expect(cover.repeat.min + panels.repeat.min).toBe(COMIC_PANELS.min)
    expect(cover.repeat.max + panels.repeat.max).toBe(COMIC_PANELS.max)
  })

  it.each([3, 6])(
    'lays out %i panels of longest captions with the search line on the last, every check passing',
    (count) => {
      expect(TITLE).toHaveLength(60)
      expect(CAPTION).toHaveLength(140)
      const template = comic()
      const brand = brandById('comics')
      if (!brand) throw new Error('comics brand missing')
      const structure = {
        templateId: COMIC_TEMPLATE_ID,
        artPrompt: '',
        slides: Array.from({ length: count }, (_, i) => ({
          kind: i === 0 ? ('cover' as const) : ('body' as const),
          slots: { caption: { text: CAPTION, factIds: [], factual: false } },
          scene: 'Sita on a bus at dusk, holding a letter.',
        })),
      }
      const layout = layoutStructure({
        structure,
        template,
        brand,
        sourceTitle: TITLE,
        facts: [],
      })
      expect(layout.slides.map((s) => s.searchLine !== null)).toEqual(
        Array.from({ length: count }, (_, i) => i === count - 1),
      )
      expect(layout.slides.every((s) => s.artBox !== null)).toBe(true)
      const colours = slideColours({ template, brand, themeId: null })
      if (!colours) throw new Error('no colours')
      const failing = fitChecks({ structure, template, ...colours, brand, layout }).filter(
        (c) => !c.pass,
      )
      expect(failing).toEqual([])
    },
  )
})

describe('Data Desk’s signature: a big stat on the cover, colour blocks in the body', () => {
  const desk = () => {
    const t = templateById('data-desk')
    if (!t) throw new Error('data-desk missing')
    return t
  }

  it('puts a number slot on the cover, between the kicker and the heading, sized as a stat and optional', () => {
    for (const cover of [desk().layouts?.cover, desk().slides[0].spec]) {
      expect(cover?.slots.map((s) => s.key)).toEqual(['kicker', 'number', 'heading'])
      const number = cover?.slots.find((s) => s.key === 'number')
      expect(number).toMatchObject({ font: 'heading', factual: false })
      expect(number?.limit).toEqual({ unit: 'chars', min: 0, max: 8 })
      expect(number?.fontPx).toBeGreaterThanOrEqual(200)
    }
  })

  it('draws its picture layout, and the body it drafts in, as a colour block with no art box', () => {
    for (const spec of [desk().layouts?.picture, desk().slides[1].spec]) {
      expect(spec?.surface).toBe('block')
      expect(spec?.artBox).toBeNull()
    }
  })

  it('needs one image a post, the cover’s spot art, whichever layouts the body slides take', () => {
    const slides = (layouts: (string | null)[]) => ({
      slides: layouts.map((layout, i) => ({
        kind:
          i === 0
            ? ('cover' as const)
            : i === layouts.length - 1
              ? ('take' as const)
              : ('body' as const),
        slots: {},
        layout: layout as (typeof LAYOUT_IDS)[number] | null,
      })),
    })
    expect(imagesFor(desk(), slides(['cover', 'picture', 'picture', 'picture', 'takeaway']))).toBe(
      1,
    )
    expect(imagesFor(desk(), slides([null, null, null, null, null]))).toBe(1)
  })

  it('keeps a Data Desk frozen before it parsing and laying out: a cover with no stat, a picture with art', () => {
    const before = structuredClone(dataDesk) as typeof dataDesk
    before.layouts.cover.slots = before.layouts.cover.slots.filter((s) => s.key !== 'number')
    const { picture: _, ...partial } = before.layouts
    const frozen = TemplateSchema.parse({ ...before, layouts: partial })
    expect(findSlideSpec(frozen, { kind: 'body', layout: 'picture' })).toEqual(
      desk().layouts?.picture,
    )
    const brand = FEED_BRAND
    const slot = (text: string) => ({ text, factIds: [], factual: false })
    const { slides } = layoutStructure({
      structure: {
        templateId: 'data-desk',
        artPrompt: '',
        slides: [
          {
            kind: 'cover',
            layout: 'cover',
            slots: { kicker: slot('Research, briefly'), heading: slot('Work less') },
          },
        ],
      },
      template: frozen,
      brand,
      sourceTitle: 'Hours',
      facts: [],
    })
    expect(slides[0].lines.some((l) => l.slot === 'number')).toBe(false)
  })
})

describe('the bullets layout (GD34)', () => {
  it('is in every look: a heading and three to five points, counted as points', () => {
    for (const t of LOOKS) {
      const spec = t.layouts?.bullets
      expect(spec?.kind).toBe('body')
      expect(spec?.slots.find((s) => s.key === 'points')?.limit).toEqual({
        unit: 'points',
        min: 3,
        max: 5,
      })
    }
  })

  it('leaves a look frozen before it parsing, its bullets slides laid out in the look of its id', () => {
    const { bullets: _, ...before } = fieldNotes.layouts
    const frozen = TemplateSchema.parse({ ...fieldNotes, layouts: before })
    expect(frozen.layouts?.bullets).toBeUndefined()
    expect(isLook(frozen)).toBe(true)
    expect(findSlideSpec(frozen, { kind: 'body', layout: 'bullets' })).toEqual(
      templateById('field-notes')?.layouts?.bullets,
    )
    expect(findSlideSpec(frozen, { kind: 'body', layout: 'number' })).toEqual(
      frozen.layouts?.number,
    )
  })
})

describe('imagesFor and artSlides (GD12, GD14)', () => {
  const look = (id: string) => {
    const t = templateById(id)
    if (!t) throw new Error(`${id} missing`)
    return t
  }
  const kinds = { cover: 'cover', takeaway: 'take' } as const
  const structure = (id: string, layouts: (typeof LAYOUT_IDS)[number][]) => ({
    templateId: id,
    artPrompt: '',
    slides: layouts.map((layout) => ({
      kind: (kinds as Record<string, 'cover' | 'take'>)[layout] ?? ('body' as const),
      slots: {},
      layout,
    })),
  })

  it('counts the art-box slides of Field Notes and Data Desk, by each slide’s layout', () => {
    const notes = structure('field-notes', ['cover', 'picture', 'number', 'picture', 'takeaway'])
    expect(artSlides(look('field-notes'), notes)).toEqual([1, 2, 4])
    expect(imagesFor(look('field-notes'), notes)).toBe(3)
    const four = structure('field-notes', ['cover', 'picture', 'picture', 'picture', 'takeaway'])
    expect(imagesFor(look('field-notes'), four)).toBe(4)
    const desk = structure('data-desk', ['cover', 'number', 'bars', 'quote', 'takeaway'])
    expect(artSlides(look('data-desk'), desk)).toEqual([1])
    expect(imagesFor(look('data-desk'), desk)).toBe(1)
  })

  it('draws one panorama for Postcard, however many slides show it', () => {
    const card = structure('postcard', ['cover', 'picture', 'number', 'quote', 'takeaway'])
    expect(isPanorama(look('postcard'))).toBe(true)
    expect(isPanorama(look('field-notes'))).toBe(false)
    expect(artSlides(look('postcard'), card)).toEqual([1, 2, 3, 4, 5])
    expect(imagesFor(look('postcard'), card)).toBe(1)
  })
})

describe('ticksLegacy (GD8)', () => {
  it('is true for ticks naming a template from before the looks, false for looks or none', () => {
    expect(ticksLegacy(['the-line'])).toBe(true)
    expect(ticksLegacy(['the-long-read', 'the-line'])).toBe(true)
    expect(ticksLegacy(['field-notes'])).toBe(false)
    expect(ticksLegacy([])).toBe(false)
  })
})
