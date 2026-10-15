// The brand tint (GD16): an SVG filter that maps an image's colours onto the guideline's palette
// as it is drawn into a look slide. The stored image is never changed; only the slide shows the
// tinted version. Colours are worked in sRGB, so a mid-grey lands midway between the two tones.

import type { Guideline, Preset } from '../brands/guideline'

/** Rec. 709 luminance weights. */
const LUMA = '0.2126 0.7152 0.0722 0 0'
/** How far Subdued keeps an image's colour. */
const SUBDUED_SATURATION = 0.4

const r4 = (v: number) => String(Math.round(v * 10000) / 10000)

/** A palette colour by name, as 0–1 channels. */
function channels(guideline: Guideline, name: string): [number, number, number] {
  const colour = guideline.palette.find((c) => c.name === name)
  if (!colour) throw new Error(`"${name}" is not in the palette`)
  const hex = colour.hex
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
}

/**
 * The `<filter id="tint">` for a preset. Pop: a duotone, luminance mapped from the tint's shadow
 * (dark) to its light. Subdued: desaturated to 40%, then the wash laid over at the guideline's
 * strength (each channel c becomes c·(1 − s) + wash·s).
 */
export function tintFilter(preset: Preset, guideline: Guideline): string {
  const open = '<filter id="tint" color-interpolation-filters="sRGB">'
  const funcs = (each: (channel: 'R' | 'G' | 'B', i: number) => string) =>
    `<feComponentTransfer>${(['R', 'G', 'B'] as const).map(each).join('')}</feComponentTransfer>`

  if (preset === 'pop') {
    const shadow = channels(guideline, guideline.tint.pop.shadow)
    const light = channels(guideline, guideline.tint.pop.light)
    return [
      open,
      `<feColorMatrix type="matrix" values="${LUMA} ${LUMA} ${LUMA} 0 0 0 1 0"/>`,
      funcs((c, i) => `<feFunc${c} type="table" tableValues="${r4(shadow[i])} ${r4(light[i])}"/>`),
      '</filter>',
    ].join('')
  }

  const { wash, strength } = guideline.tint.subdued
  const tone = channels(guideline, wash)
  return [
    open,
    `<feColorMatrix type="saturate" values="${SUBDUED_SATURATION}"/>`,
    funcs(
      (c, i) =>
        `<feFunc${c} type="linear" slope="${r4(1 - strength)}" intercept="${r4(tone[i] * strength)}"/>`,
    ),
    '</filter>',
  ].join('')
}
