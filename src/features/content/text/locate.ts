import type { Paragraph, Span } from '../model/types'
import { missingNumbers, numbersIn } from './numbers'

const STOP_WORDS = new Set([
  'about',
  'also',
  'been',
  'does',
  'from',
  'have',
  'into',
  'more',
  'most',
  'only',
  'over',
  'such',
  'than',
  'that',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'were',
  'what',
  'when',
  'which',
  'will',
  'with',
  'would',
  'your',
])

/** Content words: lower-case words over three letters, not in a short stop list. */
export function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  return new Set(words.filter((w) => w.length > 3 && !STOP_WORDS.has(w)))
}

/** The paragraph sharing the largest fraction of the claim's content words (ties: the earlier), with that fraction. */
export function bestParagraph(
  claim: string,
  paragraphs: Paragraph[],
): { paragraph: Paragraph; overlap: number } {
  if (paragraphs.length === 0) throw new RangeError('bestParagraph needs at least one paragraph')
  const wanted = contentWords(claim)
  let best = { paragraph: paragraphs[0], overlap: -1 }
  for (const paragraph of paragraphs) {
    const have = contentWords(paragraph.text)
    let shared = 0
    for (const word of wanted) if (have.has(word)) shared++
    const overlap = wanted.size === 0 ? 0 : shared / wanted.size
    if (overlap > best.overlap) best = { paragraph, overlap }
  }
  return best
}

/** The number decision, which no model overrides: unsupported when the claim has a digit-number the paragraph lacks. */
export function numberVerdict(
  claim: string,
  paragraph: Paragraph,
): { ok: true } | { ok: false; why: string; span: Span } {
  const missing = missingNumbers(claim, paragraph.text).find((n) =>
    /\d/.test(claim.slice(n.start, n.end)),
  )
  if (!missing) return { ok: true }
  const candidates = numbersIn(paragraph.text).filter(
    (n) => missing.unit === null || n.unit === missing.unit,
  )
  let nearest: (typeof candidates)[number] | undefined
  for (const n of candidates) {
    if (!nearest || Math.abs(n.value - missing.value) < Math.abs(nearest.value - missing.value))
      nearest = n
  }
  if (!nearest) {
    return {
      ok: false,
      why: `The paragraph does not give ${missing.value}.`,
      span: { ref: paragraph.ref, start: 0, end: paragraph.text.length },
    }
  }
  return {
    ok: false,
    why: `The paragraph gives ${nearest.value}, not ${missing.value}.`,
    span: { ref: paragraph.ref, start: nearest.start, end: nearest.end },
  }
}
