import { describe, expect, it } from 'bun:test'
import { measure, missingGlyphs, runs, wrap } from './measure'

const REGULAR = 'Barlow-Regular.ttf'
const BOLD = 'BarlowCondensed-Bold.ttf'
// The plan's opentype.js probe sentence (1613.6 px at 40 px; the plan calls it 95 characters, it is 94).
const PROBE =
  'Students working up to 20 hours a week had grades similar to students who did not work at all.'

describe('measure', () => {
  it('measures the probe sentence with the real font', () => {
    const width = measure(PROBE, REGULAR, 40)
    expect(width).toBeGreaterThan(1600)
    expect(width).toBeLessThan(1630)
  })

  it('refuses a font file outside the font folder', () => {
    expect(() => measure('a', '../../../package.json', 40)).toThrow()
  })
})

describe('runs', () => {
  it('splits a line by script, spaces and marks staying with the run before them', () => {
    expect(runs('Fees in नेपाल 2025, ภาษาไทย')).toEqual([
      { text: 'Fees in ', script: 'latin' },
      { text: 'नेपाल ', script: 'devanagari' },
      { text: '2025, ', script: 'latin' },
      { text: 'ภาษาไทย', script: 'thai' },
    ])
  })
})

describe('measure by script', () => {
  it("measures a Devanagari or Thai run with that script's Noto font, bold beside a bold brand font", () => {
    expect(measure('नेपाल', REGULAR, 40)).toBe(measure('नेपाल', 'NotoSansDevanagari-Regular.ttf', 40))
    expect(measure('ภาษาไทย', BOLD, 40)).toBe(measure('ภาษาไทย', 'NotoSansThai-Bold.ttf', 40))
    expect(measure('Fees ภาษา', REGULAR, 40)).toBe(
      measure('Fees ', REGULAR, 40) + measure('ภาษา', 'NotoSansThai-Regular.ttf', 40),
    )
  })
})

describe('missingGlyphs', () => {
  it('names an emoji and a Bengali character no font draws, each once, in order', () => {
    const missing = missingGlyphs('Fees 😀 কলেজ 😀', REGULAR)
    expect(missing).toContain('😀')
    expect(missing).toContain('ক')
    expect(missing.filter((c) => c === '😀')).toHaveLength(1)
    expect(missing.indexOf('😀')).toBeLessThan(missing.indexOf('ক'))
  })

  it("finds nothing missing in Nepali, Hindi and Thai beside the brand font: each run is checked against its script's font", () => {
    expect(missingGlyphs('शुल्क नेपाल 2025 · हिन्दी ।', REGULAR)).toEqual([])
    expect(missingGlyphs('ค่าเรียน 20% ต่อ ๆ ไป', BOLD)).toEqual([])
  })

  it('finds nothing missing in a byline with a middle dot, a percent sign and an em dash', () => {
    expect(missingGlyphs('AUD 499 · 20% (approx.) — fine', REGULAR)).toEqual([])
  })
})

describe('wrap', () => {
  it('never returns a line wider than the width', () => {
    const text = `${PROBE} ${PROBE} ${PROBE}`
    const lines = wrap(text, REGULAR, 40, 888)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(measure(line, REGULAR, 40)).toBeLessThanOrEqual(888)
    expect(lines.join(' ')).toBe(text)
  })

  it('breaks a word wider than the box by characters', () => {
    const url = 'https://example.com/a/b/c/d/ef'
    expect(url.length).toBe(30)
    const lines = wrap(url, REGULAR, 40, 200)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(measure(line, REGULAR, 40)).toBeLessThanOrEqual(200)
    expect(lines.join('')).toBe(url)
  })

  it('breaks a long word into the longest pieces that fit, as one character at a time would', () => {
    const url =
      'https://www.researchgate.net/publication/374869985_Personality_Profiles_of_263_Occupations'
    const lines = wrap(`See ${url} and ${url}`, REGULAR, 40, 300)
    expect(lines.join('').replace(/\s/g, '')).toBe(`See${url}and${url}`)
    const broken = lines.filter((l) => !l.includes(' ') && url.includes(l))
    expect(broken.length).toBeGreaterThan(4)
    for (const [i, line] of lines.entries()) {
      expect(measure(line, REGULAR, 40)).toBeLessThanOrEqual(300)
      // Every piece of a broken word but its last is full: one more character would overflow.
      const next = lines[i + 1]
      if (broken.includes(line) && next && broken.includes(next)) {
        expect(measure(line + next[0], REGULAR, 40)).toBeGreaterThan(300)
      }
    }
  })

  it('gives a line one character when that character alone is wider than the box', () => {
    expect(wrap('WWW', REGULAR, 40, 10)).toEqual(['W', 'W', 'W'])
  })

  it('wraps a Thai paragraph, which has no spaces, at its word boundaries', () => {
    const thai = 'นักศึกษาที่ทำงานไม่เกินยี่สิบชั่วโมงต่อสัปดาห์มีผลการเรียนใกล้เคียงกับนักศึกษาที่ไม่ได้ทำงานเลย'
    const ends = new Set(
      [...new Intl.Segmenter('th', { granularity: 'word' }).segment(thai)].map(
        (s) => s.index + s.segment.length,
      ),
    )
    const lines = wrap(thai, REGULAR, 40, 400)
    expect(lines.length).toBeGreaterThan(2)
    expect(lines.join('')).toBe(thai)
    let at = 0
    for (const line of lines) {
      at += line.length
      expect(ends.has(at)).toBe(true)
      expect(measure(line, REGULAR, 40)).toBeLessThanOrEqual(400)
    }
  })

  it('gives no lines for empty text', () => {
    expect(wrap('   ', REGULAR, 40, 888)).toEqual([])
  })
})
