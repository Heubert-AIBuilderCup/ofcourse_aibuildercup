// The feed settings a post starts from when it first reaches Settings (GD29): General, for
// everyone, for 90 days, its sources in the caption (GD31), tagged with the destinations and
// themes its supported facts name, and with its language's home country when it is not in English
// (GD40). Nothing is saved until the editor saves or sends. Pure and
// client-safe.

import { CITIES } from '@/features/engine'
import { type LanguageId, languageById } from '../languages'
import type { Fact, FeedSettings } from '../model/types'
import { TAGS } from '../tags'
import { placesIn } from './places'

/** The destination tag each place names: the catalogue's cities are Australia's (engine/catalogue.ts). */
const DESTINATIONS = new Map<string, string>([
  ...CITIES.map((c): [string, string] => [c.name, 'destination:AU']),
  ['Australia', 'destination:AU'],
  ['United Kingdom', 'destination:UK'],
  ['UK', 'destination:UK'],
  ['New Zealand', 'destination:NZ'],
  ['United States', 'destination:US'],
  ['USA', 'destination:US'],
])

/** The words that name each theme tag, whole and in any case, a plural with them. */
const THEMES: { tag: string; words: RegExp }[] = [
  { tag: 'theme:work-study-life', words: /\b(work(s|ing)?|jobs?|shifts?|study|studies)\b/i },
  { tag: 'theme:books-movies', words: /\b(books?|movies?|films?)\b/i },
]

export function defaultSettings(facts: Fact[], language: LanguageId = 'en'): FeedSettings {
  const supported = facts.filter((f) => f.supported)
  const text = supported.map((f) => f.text).join('\n')
  const home = languageById(language)?.home ?? null
  const named = new Set([
    ...(home ? [`home:${home}`] : []),
    ...placesIn(supported).flatMap((place) => DESTINATIONS.get(place) ?? []),
    ...THEMES.filter((t) => t.words.test(text)).map((t) => t.tag),
  ])
  return {
    layer: 'general',
    audience: { mode: 'everyone', rules: [] },
    whyLine: null,
    expiry: { kind: 'days', days: 90 },
    studioLink: null,
    // In the tag file's order, as the form saves them.
    tags: TAGS.filter((t) => named.has(t.id)).map((t) => t.id),
    sourcesAt: 'caption',
  }
}
