import { describe, expect, test } from 'bun:test'
import { contrastRatio, MIN_CONTRAST } from '../text/contrast'
import {
  compile,
  GUIDELINE,
  type Guideline,
  guidelineFor,
  PRESETS,
  paletteHexes,
  presetThemes,
  type Surface,
} from './guideline'

const SURFACES: Surface[] = ['base', 'block', 'deep']

describe('presets', () => {
  test('every surface of every preset resolves to hexes from the palette', () => {
    const hexes = paletteHexes().map((h) => h.toUpperCase())
    for (const preset of PRESETS) {
      const themes = presetThemes(preset)
      expect(Object.keys(themes).sort()).toEqual([...SURFACES].sort())
      for (const surface of SURFACES) {
        const t = themes[surface]
        expect(t.id).toBe(`${preset}-${surface}`)
        for (const colour of [t.bg, t.ink, t.highlight, t.muted]) {
          expect(hexes).toContain(colour.toUpperCase())
        }
      }
    }
  })

  test('ink and the muted foot row read on the background, and the highlighted words on the highlight, on every surface', () => {
    for (const preset of PRESETS) {
      for (const surface of SURFACES) {
        const t = presetThemes(preset)[surface]
        expect(contrastRatio(t.ink, t.bg)).toBeGreaterThanOrEqual(MIN_CONTRAST)
        expect(contrastRatio(t.muted, t.bg)).toBeGreaterThanOrEqual(MIN_CONTRAST)
        const onHighlight = t.highlightInk ?? t.ink
        expect(contrastRatio(onHighlight, t.highlight)).toBeGreaterThanOrEqual(MIN_CONTRAST)
      }
    }
  })

  test("Pop's deep blue highlights in yellow with ink on it, Subdued's dark sepia in ochre with sepia ink; the other surfaces keep their ink", () => {
    const hex = (name: string) => GUIDELINE.palette.find((c) => c.name === name)?.hex
    const deep = presetThemes('pop').deep
    expect(deep.highlight).toBe(hex('yellow') as string)
    expect(deep.highlightInk).toBe(hex('ink') as string)
    expect(deep.ink).toBe(hex('white') as string)
    const sepia = presetThemes('subdued').deep
    expect(sepia.highlight).toBe(hex('ochre') as string)
    expect(sepia.highlightInk).toBe(hex('sepia ink') as string)
    expect(sepia.ink).toBe(hex('cream') as string)
    for (const preset of PRESETS) {
      for (const surface of ['base', 'block'] as const) {
        expect(presetThemes(preset)[surface].highlightInk).toBeUndefined()
      }
    }
  })
})

describe('guidelineFor', () => {
  test('images get every palette colour by name and hex, and every never-show item, but no voice', () => {
    const text = guidelineFor('image')
    for (const c of GUIDELINE.palette) {
      expect(text).toContain(c.name)
      expect(text).toContain(c.hex)
    }
    for (const item of GUIDELINE.art.neverShow) expect(text).toContain(item)
    for (const rule of GUIDELINE.voice.rules) expect(text).not.toContain(rule)
  })

  test('copy gets the voice rules and reading level but no hex', () => {
    const text = guidelineFor('copy')
    for (const rule of GUIDELINE.voice.rules) expect(text).toContain(rule)
    expect(text).toContain(GUIDELINE.voice.readingLevel)
    for (const hex of paletteHexes()) expect(text.toUpperCase()).not.toContain(hex.toUpperCase())
  })
})

describe('compile', () => {
  test('a changed hex changes the themes, the palette and the image guideline', () => {
    const changed: Guideline = structuredClone(GUIDELINE)
    const yellow = changed.palette.find((c) => c.name === 'yellow')
    if (!yellow) throw new Error('stand-in palette has no yellow')
    yellow.hex = '#FFD400'

    const a = compile(GUIDELINE)
    const b = compile(changed)
    expect(b.presetThemes('pop').block.bg).toBe('#FFD400')
    expect(b.presetThemes('pop').block.bg).not.toBe(a.presetThemes('pop').block.bg)
    expect(b.guidelineFor('image')).toContain('#FFD400')
    expect(b.guidelineFor('image')).not.toBe(a.guidelineFor('image'))
    expect(b.paletteHexes()).toContain('#FFD400')
  })

  test('a preset naming a colour missing from the palette fails the load', () => {
    const broken: Guideline = structuredClone(GUIDELINE)
    broken.palette = broken.palette.filter((c) => c.name !== 'yellow')
    expect(() => compile(broken)).toThrow()
  })
})
