// The script a post's text is written in (GD37). A post not in English is written in its own
// script, Devanagari for Nepali and Hindi, Thai for Thai, with names of places, universities and
// visas kept as they are, so a text passes with most of its letters in the script. Numbers are
// Western digits in every language, so the number checks read them unchanged. Pure.

import type { Language } from '../languages'

export type Script = Language['script']

/** The least share of a text's letters in its language's script. */
export const MIN_SCRIPT_SHARE = 0.6

/** One letter of each script: Devanagari U+0900–U+097F, Thai U+0E00–U+0E7F. */
export const IN_SCRIPT: Record<Script, RegExp> = {
  latin: /\p{Script=Latin}/u,
  devanagari: /[ऀ-ॿ]/u,
  thai: /[฀-๿]/u,
}
/** A letter, or a mark on one: Devanagari and Thai write vowels as marks. */
const LETTER = /[\p{L}\p{M}]/gu
/** Digits outside 0–9: Devanagari ०–९ (U+0966–U+096F), Thai ๐–๙ (U+0E50–U+0E59). */
const NATIVE_DIGIT = /[०-९๐-๙]/gu

/** The share of the text's letters in the script, 0 to 1; a text with no letter has nothing to refuse, 1. */
export function scriptShare(text: string, script: Script): number {
  const letters = text.match(LETTER) ?? []
  if (letters.length === 0) return 1
  return letters.filter((l) => IN_SCRIPT[script].test(l)).length / letters.length
}

/** Each digit in the text that is not 0–9, in order. */
export function nativeDigits(text: string): string[] {
  return text.match(NATIVE_DIGIT) ?? []
}

/**
 * The problems the model can fix in one piece of text, named `at`, given as its named parts: a
 * digit outside 0–9 in any part, in any language; and, in a language not written in Latin, a
 * share of all the parts' letters in the script under 60%. Read together, so a part that is only
 * a name, kept as it is, passes beside the rest.
 */
export function scriptProblems(
  at: string,
  parts: [at: string, text: string][],
  language: Pick<Language, 'label' | 'script'>,
): string[] {
  const problems = parts.flatMap(([part, text]) =>
    nativeDigits(text).map(
      (d) => `${part}: "${d}" is not a Western digit; write every number with 0–9.`,
    ),
  )
  if (language.script === 'latin') return problems
  const share = scriptShare(parts.map(([, text]) => text).join('\n'), language.script)
  if (share < MIN_SCRIPT_SHARE) {
    problems.push(
      `${at}: write it in ${language.label}, in its own script; ${Math.round(share * 100)}% of its letters are, and it takes at least ${MIN_SCRIPT_SHARE * 100}%. Keep names of places, universities and visas as they are.`,
    )
  }
  return problems
}

/** Characters as a reader sees them: a Devanagari conjunct (क्ष) or a Thai letter with its marks (ที่) is one. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/**
 * The text's length in characters as a reader sees them (grapheme clusters), as every character
 * limit counts it; English, a code point to a character, counts as it always did.
 */
export function charCount(text: string): number {
  let count = 0
  for (const _ of GRAPHEMES.segment(text)) count++
  return count
}

/** The text's first `max` characters as a reader sees them, never one cut through its marks. */
export function firstChars(text: string, max: number): string {
  let end = 0
  let count = 0
  for (const { segment } of GRAPHEMES.segment(text)) {
    if (count === max) break
    end += segment.length
    count++
  }
  return text.slice(0, end)
}

/** Thai words, found by meaning: Thai writes no space between them. */
const THAI_WORDS = new Intl.Segmenter('th', { granularity: 'word' })

/**
 * A text's words as a 'words' limit counts them: a text with Thai in it by Intl.Segmenter's
 * word-like segments, so a Thai line is not one word per space; any other by its spaces, as always.
 */
export function wordCount(text: string): number {
  if (!IN_SCRIPT.thai.test(text)) return text.split(/\s+/).filter(Boolean).length
  return Array.from(THAI_WORDS.segment(text)).filter((s) => s.isWordLike).length
}
