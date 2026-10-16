// A slide's SVG rasterised with resvg, using only the brand's font files and the Noto files for
// the Devanagari and Thai it carries (system fonts off), so the PNG draws the same glyphs the
// engine measured. Server side: resvg is a native package.

import { Resvg } from '@resvg/resvg-js'
import { GUIDELINE, type Guideline, type Preset } from '../brands/guideline'
import type { Brand } from '../model/types'
import { CANVAS } from './engine'
import { fontPath, SCRIPT_FONTS } from './measure'
import { tintFilter } from './tint'

/** The Noto files (GD38), loaded only for a slide whose SVG names their family. */
function scriptFonts(svg: string): string[] {
  return Object.values(SCRIPT_FONTS)
    .filter((f) => svg.includes(`font-family="${f.family}"`))
    .flatMap((f) => [f.regular, f.bold])
}

export function toPng(svg: string, brand: Brand, width: number = CANVAS.width): Uint8Array {
  const files = [brand.fonts.heading.file, brand.fonts.body.file, ...scriptFonts(svg)]
  const fontFiles = [...new Set(files)].map(fontPath)
  return new Resvg(svg, {
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: brand.fonts.body.family },
    fitTo: { mode: 'width', value: width },
  })
    .render()
    .asPng()
}

/** A PNG's width and height from its IHDR chunk, or null when the bytes are not a PNG. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.length, 24))
  if (head.length < 24 || head[0] !== 0x89 || head.toString('latin1', 12, 16) !== 'IHDR') {
    return null
  }
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) }
}

/**
 * A picture drawn at its own size through the preset's brand filter (GD16), as a new PNG: what a
 * blog shows (BR4). The original's bytes are not touched. Null for a picture that is not a PNG
 * (the image model draws PNGs), which is then shown as it is.
 */
export function tintedPng(
  bytes: Uint8Array,
  preset: Preset,
  guideline: Guideline = GUIDELINE,
): Uint8Array | null {
  const size = pngSize(bytes)
  if (!size) return null
  const { width, height } = size
  const uri = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${tintFilter(preset, guideline)}</defs><image width="${width}" height="${height}" href="${uri}" filter="url(#tint)"/></svg>`
  return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng()
}
