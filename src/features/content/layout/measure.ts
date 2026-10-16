// Text measured with the real font files, so a line placed here is the line resvg draws.
// Server side: reads each font file once and keeps the parsed font for the life of the process
// (a handful of brand and Noto fonts, so the cache is bounded by the font folder). A line is
// measured by script runs (GD38): Devanagari and Thai in their Noto font, the rest in the brand's.

import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { type Font, parse } from 'opentype.js'
import { IN_SCRIPT, type Script } from '../text/script'

/** Resolved from process.cwd(): Next and bun test both run from the repo root. */
export const FONT_DIR = 'src/features/content/assets/fonts'

const fonts = new Map<string, Font>()

/** The font file's absolute path; a name with any directory part is refused. */
export function fontPath(fontFile: string): string {
  if (basename(fontFile) !== fontFile || fontFile.startsWith('.')) {
    throw new Error(`Font file must be a bare file name in ${FONT_DIR}`)
  }
  return join(process.cwd(), FONT_DIR, fontFile)
}

function font(fontFile: string): Font {
  let parsed = fonts.get(fontFile)
  if (!parsed) {
    const bytes = readFileSync(fontPath(fontFile))
    parsed = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    // opentype.js's Thai composition (ccmp) throws on a lookup Noto Sans Thai uses (a chained
    // substitution of type 11). It swaps mark shapes, not advances, so Thai is measured without it.
    const options = parsed.defaultRenderOptions
    parsed.defaultRenderOptions = {
      ...options,
      features: options.features.map((f) =>
        f.script === 'thai' ? { ...f, tags: f.tags.filter((t) => t !== 'ccmp') } : f,
      ),
    }
    fonts.set(fontFile, parsed)
  }
  return parsed
}

/** The fonts for the scripts the brand fonts cannot draw (GD38): Noto Sans, regular and bold. */
export const SCRIPT_FONTS = {
  devanagari: {
    family: 'Noto Sans Devanagari',
    regular: 'NotoSansDevanagari-Regular.ttf',
    bold: 'NotoSansDevanagari-Bold.ttf',
  },
  thai: {
    family: 'Noto Sans Thai',
    regular: 'NotoSansThai-Regular.ttf',
    bold: 'NotoSansThai-Bold.ttf',
  },
} as const

/** A stretch of a line in one script. */
export type Run = { text: string; script: Script }

/** Whitespace, a combining mark or a joiner: drawn in the run before it. */
const FOLLOWS = /[\s\p{M}‌‍]/u

/** The line as runs of one script each: Devanagari, Thai, and the rest (the brand font's). */
export function runs(text: string): Run[] {
  const out: Run[] = []
  for (const char of text) {
    const script: Script = IN_SCRIPT.devanagari.test(char)
      ? 'devanagari'
      : IN_SCRIPT.thai.test(char)
        ? 'thai'
        : 'latin'
    const last = out[out.length - 1]
    if (last && (last.script === script || FOLLOWS.test(char))) last.text += char
    else out.push({ text: char, script })
  }
  return out
}

/** The file a run is drawn in: the brand font, or its script's Noto font, bold beside a bold one. */
export function runFont(script: Script, fontFile: string): string {
  if (script === 'latin') return fontFile
  return SCRIPT_FONTS[script][/Bold|Black/.test(fontFile) ? 'bold' : 'regular']
}

/** The width of `text` set in `fontFile`, each script run in its own font. */
export function measure(text: string, fontFile: string, px: number): number {
  let width = 0
  for (const run of runs(text)) {
    width += font(runFont(run.script, fontFile)).getAdvanceWidth(run.text, px)
  }
  return width
}

/**
 * Characters of `text` (whitespace aside) that the font of their run cannot draw, each once, in
 * order of appearance.
 */
export function missingGlyphs(text: string, fontFile: string): string[] {
  const missing = new Set<string>()
  for (const run of runs(text)) {
    const parsed = font(runFont(run.script, fontFile))
    for (const char of run.text) {
      if (!/\s/.test(char) && !parsed.hasChar(char)) missing.add(char)
    }
  }
  return [...missing]
}

/**
 * The length of the longest prefix of `chars` that fits `width`, at least 1 (a line takes one
 * character even when that alone is too wide). A prefix only widens as it takes characters, so
 * the search gallops 2, 4, 8… until a prefix overflows, then halves between the last two:
 * O(log n) measures of strings at most twice the piece, however long the word.
 */
function longestFit(chars: string[], fontFile: string, px: number, width: number): number {
  const fits = (n: number) => measure(chars.slice(0, n).join(''), fontFile, px) <= width
  // `good` fits (or is the one character a line always takes); `bad` overflows or is past the end.
  let good = 1
  let bad = 2
  while (bad <= chars.length && fits(bad)) {
    good = bad
    bad *= 2
  }
  bad = Math.min(bad, chars.length + 1)
  while (bad - good > 1) {
    const mid = Math.floor((good + bad) / 2)
    if (fits(mid)) good = mid
    else bad = mid
  }
  return good
}

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const THAI_WORDS = new Intl.Segmenter('th', { granularity: 'word' })

/**
 * A word wider than the box, in pieces: each the longest run of its characters that fits. A
 * character is a grapheme, so a vowel mark stays on its letter.
 */
function pieces(word: string, fontFile: string, px: number, width: number): string[] {
  const out: string[] = []
  let rest = Array.from(GRAPHEMES.segment(word), (g) => g.segment)
  while (rest.length > 0) {
    const n = longestFit(rest, fontFile, px, width)
    out.push(rest.slice(0, n).join(''))
    rest = rest.slice(n)
  }
  return out
}

/**
 * The text's words, each with the space before it ('' inside Thai). Thai is written without
 * spaces between words, so a stretch of it splits at its word boundaries (Intl.Segmenter, `th`),
 * punctuation staying with the word before it, or the word after it at the stretch's start.
 */
function words(text: string): { word: string; space: string }[] {
  const out: { word: string; space: string }[] = []
  for (const chunk of text.split(/\s+/).filter(Boolean)) {
    if (!IN_SCRIPT.thai.test(chunk)) {
      out.push({ word: chunk, space: ' ' })
      continue
    }
    const start = out.length
    let held = ''
    for (const { segment, isWordLike } of THAI_WORDS.segment(chunk)) {
      if (isWordLike) {
        out.push({ word: held + segment, space: out.length === start ? ' ' : '' })
        held = ''
      } else if (out.length > start) out[out.length - 1].word += segment
      else held += segment
    }
    if (held) out.push({ word: held, space: ' ' })
  }
  return out
}

/**
 * Greedy wrap by measured width, whole words at a time (Thai at its word boundaries); a single
 * word wider than the box is broken by characters into the longest pieces that fit. Each distinct
 * word is measured, and broken, once per call, so a long unbroken word (a web address) costs a
 * few measures, not one per character.
 */
export function wrap(text: string, fontFile: string, px: number, width: number): string[] {
  const lines: string[] = []
  const fitsAlone = new Map<string, boolean>()
  const broken = new Map<string, string[]>()
  let line = ''
  for (const { word, space } of words(text)) {
    let alone = fitsAlone.get(word)
    if (alone === undefined) {
      alone = measure(word, fontFile, px) <= width
      fitsAlone.set(word, alone)
    }
    // A line is never narrower than its last word, so only a word that fits alone can join one.
    if (alone && (!line || measure(`${line}${space}${word}`, fontFile, px) <= width)) {
      line = line ? `${line}${space}${word}` : word
      continue
    }
    if (line) lines.push(line)
    line = ''
    if (alone) {
      line = word
      continue
    }
    // Break the word by characters; its last piece starts the next line.
    let parts = broken.get(word)
    if (!parts) {
      parts = pieces(word, fontFile, px, width)
      broken.set(word, parts)
    }
    lines.push(...parts.slice(0, -1))
    line = parts[parts.length - 1]
  }
  if (line) lines.push(line)
  return lines
}
