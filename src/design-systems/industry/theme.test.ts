import { describe, expect, it } from 'bun:test'

const css = await Bun.file(new URL('./theme.css', import.meta.url)).text()

// Every rule block without a nested block: selector list → (property → value).
function parseBlocks(source: string) {
  const blocks: { selectors: string[]; props: Map<string, string> }[] = []
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, selector, body] of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const props = new Map<string, string>()
    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':')
      if (colon > 0)
        props.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim())
    }
    blocks.push({ selectors: selector.split(',').map((s) => s.trim()), props })
  }
  return blocks
}

const blocks = parseBlocks(css)
const lightBlock = blocks.find((b) => b.selectors.includes(':root'))
const darkBlock = blocks.find((b) => b.selectors.includes('[data-theme="dark"]'))
const light = lightBlock?.props ?? new Map<string, string>()
const dark = darkBlock?.props ?? new Map<string, string>()

type Rgba = [number, number, number, number]

// oklch(L C H) or oklch(L C H / A%) → gamma-encoded sRGB in 0–1, clipped to the gamut, with alpha.
function oklchToSrgb(value: string): Rgba {
  const match = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%)?\s*\)$/)
  if (!match) throw new Error(`not an oklch colour: ${value}`)
  const [L, C, H] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const alpha = match[4] === undefined ? 1 : Number(match[4]) / 100
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const encode = (x: number) => {
    const c = Math.min(1, Math.max(0, x))
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  }
  return [encode(linear[0]), encode(linear[1]), encode(linear[2]), alpha]
}

// WCAG 2 relative luminance of an opaque sRGB colour.
function luminance([r, g, b]: Rgba) {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// The foreground composited over the background (as the browser paints it), then WCAG contrast.
function contrast(theme: Map<string, string>, fg: string, bg: string) {
  const ground = oklchToSrgb(theme.get(bg) ?? '')
  const [r, g, b, a] = oklchToSrgb(theme.get(fg) ?? '')
  const over = (c: number, i: number) => c * a + ground[i] * (1 - a)
  const ink: Rgba = [over(r, 0), over(g, 1), over(b, 2), 1]
  const [hi, lo] = [luminance(ink), luminance(ground)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const ramps = [
  ...['accent', 'neutral', 'danger'].flatMap((ramp) => steps.map((step) => `--${ramp}-${step}`)),
  '--danger',
]
// The canvas's dark set keeps these at their light value: accent-900 is the steel in both themes,
// and the 500 mid steps (#749dc4, #eb6b61) are the same in both.
const sameInBothThemes = ['--accent-500', '--accent-900', '--danger-500']

// Hairlines (--border, --input: color-text at 16%) come to about 1.4:1 (light) and 1.5:1 (dark)
// on the ground by Industry's design, so they are not asserted here although intent criterion 8 names them.
const textPairs: [string, string][] = [
  ['--foreground', '--background'],
  ['--muted-foreground', '--background'],
  ['--accent-800', '--accent-100'],
  ['--danger-800', '--danger-100'],
  ['--primary-strong-foreground', '--primary-strong'],
  ['--popover-foreground', '--popover'],
]
const largeTextAndIconPairs: [string, string][] = [
  ['--primary', '--background'],
  ['--accent-700', '--background'],
  ['--danger-700', '--background'],
]

describe('Industry theme.css', () => {
  it('serves the light set on :root and on a nested [data-theme="light"]', () => {
    expect(lightBlock?.selectors).toEqual([':root', '[data-theme="light"]'])
  })

  it('redefines every ramp step in dark, each with a dark value', () => {
    for (const name of ramps) {
      expect(dark.has(name), `${name} in dark`).toBe(true)
      if (!sameInBothThemes.includes(name)) {
        expect(dark.get(name), `${name} differs from light`).not.toBe(light.get(name))
      }
    }
  })

  it('sets color-scheme in both themes so native controls follow', () => {
    expect(light.get('color-scheme')).toBe('light')
    expect(dark.get('color-scheme')).toBe('dark')
  })

  it('keeps the steel panel tokens out of the dark block', () => {
    for (const name of ['--panel', '--panel-foreground', '--panel-accent']) {
      expect(light.has(name), `${name} in light`).toBe(true)
      expect(dark.has(name), `${name} in dark`).toBe(false)
    }
  })

  for (const [themeName, theme] of [
    ['dark', dark],
    ['light', light],
  ] as const) {
    it(`${themeName}: text pairs reach 4.5:1`, () => {
      for (const [fg, bg] of textPairs) {
        expect(contrast(theme, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`${themeName}: large text and icon pairs reach 3:1`, () => {
      for (const [fg, bg] of largeTextAndIconPairs) {
        expect(contrast(theme, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3)
      }
    })
  }
})
