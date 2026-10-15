// The places a post's facts name (GD7): Postcard draws a place, so it is suggested only when the
// facts name one. Pure: the ideas step reads it, and so may the screens.

import { CITIES } from '@/features/engine'
import type { Fact } from '../model/types'
import { escapeRegExp } from '../text/regexp'

const COUNTRIES = [
  'Australia',
  'United Kingdom',
  'UK',
  'New Zealand',
  'United States',
  'USA',
  'Nepal',
  'India',
  'Thailand',
] as const

/** Each place with its whole-word, case-insensitive pattern: cities first, then countries. */
const PLACES = [...CITIES.map((c) => c.name), ...COUNTRIES].map((name) => ({
  name,
  pattern: new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(name).replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`,
    'iu',
  ),
}))

/** The cities and countries the facts' text names, each once, in the list's order. */
export function placesIn(facts: Fact[]): string[] {
  const text = facts.map((f) => f.text).join('\n')
  return PLACES.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name)
}
