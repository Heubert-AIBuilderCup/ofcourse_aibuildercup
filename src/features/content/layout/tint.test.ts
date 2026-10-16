import { describe, expect, it } from 'bun:test'
import { Resvg } from '@resvg/resvg-js'
import { FEED_BRAND } from '../brands'
import { GUIDELINE } from '../brands/guideline'
import { tintedPng, toPng } from './png'
import { tintFilter } from './tint'

const hexOf = (name: string) => GUIDELINE.palette.find((c) => c.name === name)?.hex ?? ''
const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]))

/** The RGB of the PNG's centre pixel, decoded by drawing it 1:1 with resvg. */
function centre(png: Uint8Array, width: number, height: number): number[] {
  const uri = `data:image/png;base64,${Buffer.from(png).toString('base64')}`
  const pixels = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image width="${width}" height="${height}" href="${uri}"/></svg>`,
  ).render().pixels
  const at = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4
  return [pixels[at], pixels[at + 1], pixels[at + 2]]
}

describe('tintFilter (GD16)', () => {
  it('maps Pop to a duotone from the tint’s shadow to its light', () => {
    const filter = tintFilter('pop', GUIDELINE)
    expect(filter).toStartWith('<filter id="tint"')
    expect(filter).toContain('<feColorMatrix type="matrix"')
    const [shadow, light] = [
      rgb(hexOf(GUIDELINE.tint.pop.shadow)),
      rgb(hexOf(GUIDELINE.tint.pop.light)),
    ]
    ;(['R', 'G', 'B'] as const).forEach((channel, i) => {
      const values = filter.match(
        new RegExp(`<feFunc${channel} type="table" tableValues="([^"]+)"`),
      )?.[1]
      expect(values?.split(' ').map(Number)).toEqual(
        [shadow[i] / 255, light[i] / 255].map((v) => Math.round(v * 10000) / 10000),
      )
    })
  })

  it('desaturates Subdued to 40% and lays the wash over it at the guideline’s strength', () => {
    const filter = tintFilter('subdued', GUIDELINE)
    expect(filter).toContain('<feColorMatrix type="saturate" values="0.4"/>')
    const { wash, strength } = GUIDELINE.tint.subdued
    const [r] = rgb(hexOf(wash))
    expect(filter).toContain(
      `<feFuncR type="linear" slope="${1 - strength}" intercept="${Math.round((r / 255) * strength * 10000) / 10000}"/>`,
    )
  })

  it('follows a changed guideline', () => {
    const changed = {
      ...GUIDELINE,
      palette: GUIDELINE.palette.map((c) =>
        c.name === GUIDELINE.tint.pop.light ? { ...c, hex: '#FF0000' } : c,
      ),
    }
    expect(tintFilter('pop', changed)).toContain('<feFuncR type="table" tableValues="0.0706 1"/>')
  })

  it('draws a mid-grey image through resvg closer to the mix of shadow and light than to grey', () => {
    const grey = toPng(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#808080"/></svg>',
      FEED_BRAND,
      8,
    )
    const uri = `data:image/png;base64,${Buffer.from(grey).toString('base64')}`
    const tinted = toPng(
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><defs>${tintFilter('pop', GUIDELINE)}</defs><image width="40" height="40" href="${uri}" filter="url(#tint)"/></svg>`,
      FEED_BRAND,
      40,
    )
    const pixel = centre(tinted, 40, 40)
    const shadow = rgb(hexOf(GUIDELINE.tint.pop.shadow))
    const light = rgb(hexOf(GUIDELINE.tint.pop.light))
    const mix = shadow.map((v, i) => (v + light[i]) / 2)
    expect(distance(pixel, mix)).toBeLessThan(distance(pixel, [128, 128, 128]))
  })
})

describe('tintedPng: a blog picture mapped to the palette, the original kept (GD16, BR4)', () => {
  const greyPng = (width: number, height: number) =>
    toPng(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#808080"/></svg>`,
      FEED_BRAND,
      width,
    )
  const size = (png: Uint8Array) => {
    const view = Buffer.from(png)
    return [view.readUInt32BE(16), view.readUInt32BE(20)]
  }

  it('draws the picture at its own size through the Subdued wash, leaving the original as it was', () => {
    const grey = greyPng(32, 18)
    const before = Uint8Array.from(grey)
    const tinted = tintedPng(grey, 'subdued')
    if (!tinted) throw new Error('not tinted')
    expect(size(tinted)).toEqual([32, 18])
    expect(grey).toEqual(before)
    const { wash, strength } = GUIDELINE.tint.subdued
    const washed = rgb(hexOf(wash)).map((v) => 128 * (1 - strength) + v * strength)
    expect(distance(centre(tinted, 32, 18), washed)).toBeLessThan(3)
  })

  it('leaves a picture that is not a PNG untinted', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(0)])
    expect(tintedPng(jpeg, 'subdued')).toBeNull()
  })
})
