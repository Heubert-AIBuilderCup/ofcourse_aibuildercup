// What a Nepali, a Hindi and a Thai editor types (GD36–GD40), for the tests that hold every guard
// to it: Devanagari with conjuncts and vowel signs, Thai with its vowel and tone marks, so a text
// has more code points than characters as a reader sees them.

import type { LanguageId } from '../languages'

export const NATIVE = {
  ne: 'विद्यार्थीहरूले पढाइसँगै हप्तामा केही घण्टा काम गर्न पाउँछन्',
  hi: 'छात्र पढ़ाई के साथ हफ़्ते में कुछ घंटे काम कर सकते हैं',
  th: 'นักศึกษาทำงานพิเศษได้ระหว่างเรียนในช่วงสัปดาห์',
} as const satisfies Partial<Record<LanguageId, string>>

export type NativeId = keyof typeof NATIVE
export const NATIVE_IDS = Object.keys(NATIVE) as NativeId[]

const graphemes = (text: string) =>
  Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
    (s) => s.segment,
  )

/**
 * Text in the language of exactly `chars` characters as a reader sees them (grapheme clusters),
 * its sample repeated and cut, ending in a letter; more than `chars` code points, so a guard that
 * counts code points refuses it. Throws on a length too short to show that.
 */
export function nativeOf(id: NativeId, chars: number): string {
  const sample = graphemes(`${NATIVE[id]} `)
  const out = Array.from({ length: chars }, (_, i) => sample[i % sample.length])
  if (out.at(-1) === ' ') out[out.length - 1] = sample[0]
  const text = out.join('')
  if (Array.from(text).length <= chars)
    throw new Error(`${chars} characters of ${id} are as many code points`)
  return text
}
