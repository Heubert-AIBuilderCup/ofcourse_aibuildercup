import { findQuote } from './verbatim'

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })

/**
 * A fragment ending in one of these is not a sentence end; the list grows by editing it. "No" is
 * not on it: a plain "No." is an answer, and the segmenter already keeps "Rule No. 4" whole.
 */
const ABBREVIATION = /(?:^|\s)(?:Dr|Mr|Mrs|Ms|Prof|Rs|vs|approx|e\.g|i\.e|etc|St|Jr|Sr|Mt)\.$/i
/** A closing quote, straight or typographic (U+201D), at the end of a fragment. */
const CLOSING_QUOTE = /["\u201D]$/
/** Initials such as "K.P." or "U.S." at the end of a fragment. */
const INITIALS = /(?:^|\s)(?:[A-Z]\.)+$/

/**
 * Sentences by Intl.Segmenter, trimmed, empty dropped, then fragments merged back where the
 * segmenter broke at an abbreviation, at initials, or after a closing quote, straight or
 * typographic, followed by a lowercase word ("Will it last?” she asked).
 */
export function sentences(text: string): string[] {
  const out: string[] = []
  for (const part of segmenter.segment(text)) {
    const fragment = part.segment.trim()
    if (fragment.length === 0) continue
    const previous = out.at(-1)
    const glue =
      previous !== undefined &&
      (ABBREVIATION.test(previous) ||
        INITIALS.test(previous) ||
        (CLOSING_QUOTE.test(previous) && /^[a-z]/.test(fragment)))
    if (glue) out[out.length - 1] = `${previous} ${fragment}`
    else out.push(fragment)
  }
  return out
}

/** A source sentence: `¶2.3` is paragraph 2's third sentence; start and end are offsets into the paragraph. */
export type SourceSentence = { id: string; ref: string; text: string; start: number; end: number }

/** The paragraph's sentences, numbered from 1, each its exact text in the paragraph. */
export function sourceSentences(paragraph: { ref: string; text: string }): SourceSentence[] {
  const out: SourceSentence[] = []
  let from = 0
  for (const sentence of sentences(paragraph.text)) {
    const at = findQuote(sentence, paragraph.text.slice(from))
    const start = from + (at?.start ?? 0)
    const end = from + (at?.end ?? 0)
    out.push({
      id: `${paragraph.ref}.${out.length + 1}`,
      ref: paragraph.ref,
      text: paragraph.text.slice(start, end),
      start,
      end,
    })
    from = end
  }
  return out
}
