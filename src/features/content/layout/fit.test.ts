import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import { compile, GUIDELINE, PRESETS, presetThemes, type Surface } from '../brands/guideline'
import type { Structure, Template, Theme } from '../model/types'
import { templateById } from '../templates'
import { PAID_WORK_PARAGRAPHS } from '../text/fixtures'
import { NATIVE_IDS, nativeOf } from '../text/native-fixtures'
import { wordCount } from '../text/script'
import { layoutStructure } from './engine'
import { fitChecks, fitPasses } from './fit'
import { lookStructure } from './fixtures'

const WORDS = PAID_WORK_PARAGRAPHS.map((p) => p.text)
  .join(' ')
  .split(/\s+/)
const words = (n: number) => Array.from({ length: n }, (_, i) => WORDS[i % WORDS.length]).join(' ')

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
          body: { text: body, factIds: [], factual: true },
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

const theme = (id: string) => FEED_BRAND.themes.find((t) => t.id === id) as Theme
const THE_LINE = templateById('the-line') as Template
const LONG_READ = templateById('the-long-read') as Template

function checks(
  s: Structure,
  template: Template,
  themeId = 'paper',
  sourceTitle = 'Hours of paid work',
) {
  const layout = layoutStructure({
    structure: s,
    template,
    brand: FEED_BRAND,
    sourceTitle,
    facts: [],
  })
  return fitChecks({ structure: s, template, theme: theme(themeId), layout, brand: FEED_BRAND })
}

describe('fitChecks', () => {
  it('passes the clean the-line on Paper, with a row per slot, contrast and legibility', () => {
    const rows = checks(structure('the-line', [words(47), words(40), words(40)]), THE_LINE)
    expect(fitPasses(rows)).toBe(true)
    expect(rows.filter((r) => r.check === 'length')).toHaveLength(10)
    expect(rows.filter((r) => r.check === 'box')).toHaveLength(0)
    expect(rows.filter((r) => r.check === 'glyph')).toHaveLength(0)
    const labels = rows.map((r) => r.label)
    expect(labels).toContain('Slide 2 · 47 words (30–70) · OK')
    expect(labels).toContain('Slide 1 · 17 chars (4–30) · OK')
    expect(labels).toContain('Contrast · Paper 14.4:1 · OK')
    expect(labels).toContain('Legibility · 11.5px at 328px · OK')
    expect(labels).toContain('Legibility · 12.1px at 328px · OK')
    expect(labels).toContain('Legibility · 21.9px at 328px · OK')
  })

  it('fails a 121-word body on length, naming the slide and the count', () => {
    const rows = checks(structure('the-long-read', [words(121), words(40)]), LONG_READ)
    const row = rows.find((r) => r.label === 'Slide 2 · 121 words (30–70) · Over')
    expect(row).toMatchObject({ check: 'length', slide: 2, slot: 'body', value: 121, pass: false })
    expect(rows.some((r) => r.check === 'box')).toBe(false)
    expect(fitPasses(rows)).toBe(false)
  })

  it('labels a short body Under', () => {
    const rows = checks(structure('the-long-read', [words(12), words(40)]), LONG_READ)
    expect(rows.map((r) => r.label)).toContain('Slide 2 · 12 words (30–70) · Under')
  })

  it('adds a failing box row for a 400-word body', () => {
    const rows = checks(structure('the-long-read', [words(400), words(40)]), LONG_READ)
    const box = rows.filter((r) => r.check === 'box')
    expect(box).toHaveLength(1)
    expect(box[0]).toMatchObject({ slide: 2, slot: 'body', pass: false })
    expect(box[0].label).toMatch(/^Slide 2 · body · needs \d+ lines, room for 17 · Over$/)
    expect(fitPasses(rows)).toBe(false)
  })

  it('adds a failing box row naming the search line when the title is too long for the foot of the slide', () => {
    // Cover and take only, in wide glyphs (see engine.test.ts).
    const rows = checks(
      structure('the-line', []),
      THE_LINE,
      'paper',
      Array.from({ length: 24 }, () => 'WWWWWWWW').join(' '),
    )
    const box = rows.filter((r) => r.check === 'box')
    expect(box).toHaveLength(1)
    expect(box[0]).toMatchObject({ slide: 2, slot: 'search', pass: false })
    expect(box[0].label).toMatch(/^Slide 2 · search · needs \d+ lines, room for 7 · Over$/)
    expect(fitPasses(rows)).toBe(false)
  })

  it('fails a body holding a character the brand font cannot draw, naming it', () => {
    const rows = checks(
      structure('the-long-read', ['Keep 😀 calm and carry on.', words(40)]),
      LONG_READ,
    )
    const glyph = rows.filter((r) => r.check === 'glyph')
    expect(glyph).toHaveLength(1)
    expect(glyph[0]).toMatchObject({
      slide: 2,
      slot: 'body',
      value: 1,
      limit: '0 missing',
      pass: false,
    })
    expect(glyph[0].label).toBe('Slide 2 · body · cannot draw "😀" · Missing glyph')
    expect(fitPasses(rows)).toBe(false)
  })

  it('adds no glyph row to the paid-work fixtures', () => {
    const rows = checks(structure('the-long-read', [words(121), words(40)]), LONG_READ)
    expect(rows.some((r) => r.check === 'glyph')).toBe(false)
  })

  it('fails the Signal theme on contrast', () => {
    const rows = checks(
      structure('the-line', [words(47), words(40), words(40)]),
      THE_LINE,
      'signal',
    )
    expect(rows.find((r) => r.check === 'contrast')).toMatchObject({
      label: 'Contrast · Signal 4.2:1 · Too low',
      pass: false,
    })
    expect(fitPasses(rows)).toBe(false)
  })
})

/** `stat`: the big number on the cover, for Data Desk's cover (its number slot). */
function lookChecks(templateId: string, surfaces: Record<Surface, Theme>, stat?: string) {
  const plain = lookStructure(templateId)
  const [cover, ...rest] = plain.slides
  const s = stat
    ? {
        ...plain,
        slides: [
          {
            ...cover,
            slots: { ...cover.slots, number: { text: stat, factIds: [], factual: false } },
          },
          ...rest,
        ],
      }
    : plain
  const template = templateById(templateId) as Template
  const layout = layoutStructure({
    structure: s,
    template,
    brand: FEED_BRAND,
    sourceTitle: 'Hours of paid work and first-year results',
    facts: [],
  })
  return fitChecks({
    structure: s,
    template,
    theme: theme('paper'),
    surfaces,
    layout,
    brand: FEED_BRAND,
  })
}

describe('fitChecks on a look (GD9, GD17)', () => {
  it('passes every look, one slide per layout, with Pop and with Subdued', () => {
    for (const id of ['field-notes', 'data-desk', 'postcard']) {
      for (const preset of PRESETS) {
        const rows = lookChecks(id, presetThemes(preset))
        expect({ id, preset, failing: rows.filter((r) => !r.pass).map((r) => r.label) }).toEqual({
          id,
          preset,
          failing: [],
        })
      }
    }
  })

  it('passes Data Desk with a big stat on its cover, with Pop and with Subdued', () => {
    for (const preset of PRESETS) {
      const rows = lookChecks('data-desk', presetThemes(preset), '−11%')
      expect({ preset, failing: rows.filter((r) => !r.pass).map((r) => r.label) }).toEqual({
        preset,
        failing: [],
      })
      expect(rows).toContainEqual(
        expect.objectContaining({ check: 'length', slide: 1, slot: 'number', value: 4 }),
      )
    }
  })

  it('checks contrast once per surface used: ink and the muted foot row on it, and ink on the highlight where a slot has a mark', () => {
    const rows = lookChecks('data-desk', presetThemes('pop')).filter((r) => r.check === 'contrast')
    expect(rows.map((r) => r.label.replace(/ [\d.]+:1/, ''))).toEqual([
      'Contrast · Pop deep · OK',
      'Contrast · Pop deep muted · OK',
      'Contrast · Pop deep highlight · OK',
      'Contrast · Pop block · OK',
      'Contrast · Pop block muted · OK',
      'Contrast · Pop base · OK',
      'Contrast · Pop base muted · OK',
      'Contrast · Pop base highlight · OK',
    ])
  })

  it('reads the words on the highlight in their own colour: ink on yellow passes on Pop deep, white on it fails', () => {
    const highlightRow = (surfaces: Record<Surface, Theme>) =>
      lookChecks('data-desk', surfaces).find((r) =>
        r.label.startsWith('Contrast · Pop deep highlight'),
      )
    expect(highlightRow(presetThemes('pop'))?.pass).toBe(true)
    const changed = structuredClone(GUIDELINE)
    changed.presets.pop.deep.highlightInk = 'white'
    expect(highlightRow(compile(changed).presetThemes('pop'))?.pass).toBe(false)
  })

  it('fails the muted foot row where it falls short, as stone on yellow does', () => {
    const changed = structuredClone(GUIDELINE)
    changed.presets.pop.block.muted = 'stone'
    const rows = lookChecks('data-desk', compile(changed).presetThemes('pop'))
    expect(rows.filter((r) => !r.pass).map((r) => r.label)).toEqual([
      'Contrast · Pop block muted 4.1:1 · Too low',
    ])
  })

  it('fails the surface a changed guideline makes unreadable, naming it', () => {
    const changed = structuredClone(GUIDELINE)
    for (const c of changed.palette) if (c.name === 'yellow') c.hex = '#333333'
    const rows = lookChecks('data-desk', compile(changed).presetThemes('pop'))
    const failing = rows.filter((r) => !r.pass)
    expect(failing.map((r) => r.label.replace(/ [\d.]+:1/, ''))).toEqual([
      'Contrast · Pop deep highlight · Too low',
      'Contrast · Pop block · Too low',
      'Contrast · Pop block muted · Too low',
      'Contrast · Pop base highlight · Too low',
    ])
  })
})

describe('fitChecks on the bullets layout (GD34)', () => {
  const POINTS = [
    'Check your visa hours',
    'Ask about exam weeks',
    'Keep one free day',
    'Book your shifts early',
    'Rest before exams',
    'Save for the holidays',
  ]
  const checks = (templateId: string, n: number) => {
    const template = templateById(templateId) as Template
    const structure: Structure = {
      templateId,
      artPrompt: '',
      slides: [
        {
          kind: 'body',
          layout: 'bullets',
          slots: {
            heading: { text: 'Before you take a shift', factIds: [], factual: false },
            points: { text: POINTS.slice(0, n).join('\n'), factIds: [], factual: true },
          },
        },
      ],
    }
    const layout = layoutStructure({
      structure,
      template,
      brand: FEED_BRAND,
      sourceTitle: 'Paid work',
      facts: [],
    })
    return fitChecks({
      structure,
      template,
      theme: theme('paper'),
      surfaces: presetThemes('pop'),
      layout,
      brand: FEED_BRAND,
    })
  }

  it('passes three and five points in every look, counting the points', () => {
    for (const id of ['field-notes', 'data-desk', 'postcard']) {
      for (const n of [3, 5]) {
        const rows = checks(id, n)
        expect({ id, n, failing: rows.filter((r) => !r.pass).map((r) => r.label) }).toEqual({
          id,
          n,
          failing: [],
        })
        expect(rows.find((r) => r.slot === 'points')?.label).toBe(
          `Slide 1 · ${n} points (3–5) · OK`,
        )
      }
    }
  })

  it('counts two points as under and six as over', () => {
    const row = (n: number) => checks('field-notes', n).find((r) => r.slot === 'points')
    expect(row(2)).toMatchObject({ pass: false, label: 'Slide 1 · 2 points (3–5) · Under' })
    expect(row(6)).toMatchObject({ pass: false, label: 'Slide 1 · 6 points (3–5) · Over' })
  })
})

/** A look post written in the language, one slide each of cover, picture and takeaway (GD38). */
function writtenIn(texts: {
  kicker: string
  heading: string
  pictureHeading: string
  body: string
  takeHeading: string
  takeBody: string
}): Structure {
  const slot = (text: string) => ({ text, factIds: [], factual: false })
  return {
    templateId: 'field-notes',
    artPrompt: 'An open notebook beside a small desk clock.',
    slides: [
      {
        kind: 'cover',
        layout: 'cover',
        slots: { kicker: slot(texts.kicker), heading: slot(texts.heading) },
      },
      {
        kind: 'body',
        layout: 'picture',
        slots: { heading: slot(texts.pictureHeading), body: slot(texts.body) },
      },
      {
        kind: 'take',
        layout: 'takeaway',
        slots: { heading: slot(texts.takeHeading), body: slot(texts.takeBody) },
      },
    ],
  }
}

const NEPALI_TEXTS = {
  kicker: 'अनुसन्धान, छोटकरीमा',
  heading: 'हप्तामा 20 घण्टाभन्दा कम काम',
  pictureHeading: 'कामका घण्टा र नतिजा',
  body: 'हप्तामा 20 घण्टासम्म काम गर्ने विद्यार्थीहरूको नतिजा काम नगर्ने विद्यार्थीहरूको जस्तै थियो। 20 घण्टाभन्दा बढी काम गर्दा उत्तीर्ण दर 11 प्रतिशत अंकले घट्यो।',
  takeHeading: 'पहिलो वर्ष 20 घण्टाभन्दा कम काम',
  takeBody: 'पहिलो वर्षले पछिका वर्षहरूको गति तय गर्छ, त्यसैले पढाइको समय जोगाउनुहोस्।',
}
const NEPALI = writtenIn(NEPALI_TEXTS)

const THAI_TEXTS = {
  kicker: 'งานวิจัยโดยย่อ',
  heading: 'ทำงานน้อยกว่า 20 ชั่วโมง',
  pictureHeading: 'ชั่วโมงทำงานกับผลการเรียน',
  body: 'นักศึกษาที่ทำงานไม่เกิน 20 ชั่วโมงต่อสัปดาห์มีผลการเรียนใกล้เคียงกับนักศึกษาที่ไม่ได้ทำงาน เมื่อทำงานเกิน 20 ชั่วโมงต่อสัปดาห์ อัตราการสอบผ่านลดลง 11 จุด',
  takeHeading: 'ทำงานไม่เกิน 20 ชั่วโมงในปีแรก',
  takeBody: 'ปีแรกกำหนดจังหวะของปีต่อ ๆ ไป จึงควรรักษาเวลาเรียนไว้',
}
const THAI = writtenIn(THAI_TEXTS)

describe('fitChecks on a Nepali and a Thai slide (GD38)', () => {
  it('lays out Nepali and Thai in their Noto fonts and passes the glyph, box and legibility checks', () => {
    for (const [name, s, title] of [
      ['Nepali', NEPALI, 'कामका घण्टा'],
      ['Thai', THAI, 'ชั่วโมงทำงาน'],
    ] as const) {
      const template = templateById('field-notes') as Template
      const layout = layoutStructure({
        structure: s,
        template,
        brand: FEED_BRAND,
        sourceTitle: title,
        facts: [],
      })
      const rows = fitChecks({
        structure: s,
        template,
        theme: theme('paper'),
        surfaces: presetThemes('pop'),
        layout,
        brand: FEED_BRAND,
      }).filter((r) => ['glyph', 'box', 'legibility'].includes(r.check))
      expect(rows.some((r) => r.check === 'legibility')).toBe(true)
      expect({ name, failing: rows.filter((r) => !r.pass).map((r) => r.label) }).toEqual({
        name,
        failing: [],
      })
    }
  })
})

describe('the length check on a Thai slot (GD37)', () => {
  it('counts a Thai slot’s words by word, not by its spaces', () => {
    const template = templateById('field-notes') as Template
    const layout = layoutStructure({
      structure: THAI,
      template,
      brand: FEED_BRAND,
      sourceTitle: 'ชั่วโมงทำงาน',
      facts: [],
    })
    const rows = fitChecks({
      structure: THAI,
      template,
      theme: theme('paper'),
      surfaces: presetThemes('pop'),
      layout,
      brand: FEED_BRAND,
    })
    const slide = THAI.slides.findIndex((s) => s.slots.body?.text.startsWith('นักศึกษา')) + 1
    const row = rows.find((r) => r.check === 'length' && r.slide === slide && r.slot === 'body')
    const text = THAI.slides[slide - 1].slots.body.text
    expect(row?.value).toBe(wordCount(text))
    expect(row?.value).toBeGreaterThan(text.split(/\s+/).length)
  })
})

describe('the length check on a Nepali, Hindi or Thai slot (GD37)', () => {
  it('counts a slot’s characters as a reader sees them, a conjunct or a letter with its marks as one', () => {
    const template = templateById('field-notes') as Template
    for (const id of NATIVE_IDS) {
      const s = writtenIn({
        ...(id === 'th' ? THAI_TEXTS : NEPALI_TEXTS),
        kicker: nativeOf(id, 30),
        heading: nativeOf(id, 48),
        pictureHeading: nativeOf(id, 40),
        takeHeading: nativeOf(id, 60),
      })
      const layout = layoutStructure({
        structure: s,
        template,
        brand: FEED_BRAND,
        sourceTitle: 'कामका घण्टा',
        facts: [],
      })
      const rows = fitChecks({
        structure: s,
        template,
        theme: theme('paper'),
        surfaces: presetThemes('pop'),
        layout,
        brand: FEED_BRAND,
      }).filter((r) => r.check === 'length' && r.slot !== 'body')
      expect({ id, labels: rows.map((r) => r.label) }, id).toEqual({
        id,
        labels: [
          'Slide 1 · 30 chars (4–30) · OK',
          'Slide 1 · 48 chars (1–48) · OK',
          'Slide 2 · 40 chars (1–40) · OK',
          'Slide 3 · 60 chars (1–60) · OK',
        ],
      })
    }
  })
})
