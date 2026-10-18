// The brand tint (GD16): an SVG filter that maps an image's colours onto the guideline's palette
// as it is drawn into a look slide. The stored image is never changed; only the slide shows the
// tinted version. Colours are worked in sRGB, so a mid-grey lands midway between the two tones.

import type { Guideline, Preset } from '../brands/guideline'

/** Rec. 709 luminance weights. */
const LUMA = '0.2126 0.7152 0.0722 0 0'

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
 * The `<filter id="tint">` for a preset: a duotone, luminance mapped from the preset's shadow
 * (dark) to its light. Pop: deep blue to yellow; Subdued: dark sepia to the sepia page.
 */
export function tintFilter(preset: Preset, guideline: Guideline): string {
  const shadow = channels(guideline, guideline.tint[preset].shadow)
  const light = channels(guideline, guideline.tint[preset].light)
  const funcs = (['R', 'G', 'B'] as const)
    .map((c, i) => `<feFunc${c} type="table" tableValues="${r4(shadow[i])} ${r4(light[i])}"/>`)
    .join('')
  return [
    '<filter id="tint" color-interpolation-filters="sRGB">',
    `<feColorMatrix type="matrix" values="${LUMA} ${LUMA} ${LUMA} 0 0 0 1 0"/>`,
    `<feComponentTransfer>${funcs}</feComponentTransfer>`,
    '</filter>',
  ].join('')
}
