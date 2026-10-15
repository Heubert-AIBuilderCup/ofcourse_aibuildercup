import { escapeRegExp } from './regexp'
/** Phrases generated copy must not contain: the ranking words DS-R1 bans, and common filler. Case-insensitive, whole words. */
export const BANNED_PHRASES = [
  'ranked 1st',
  'best',
  'recommended',
  'guaranteed',
  'game-changer',
  'unlock',
  'dive into',
  'journey',
  'seamless',
  'revolutionary',
  'elevate',
  'empower',
  "in today's fast-paced world",
  "don't miss out",
  'act now',
] as const

// A space in a phrase matches any run of whitespace; a hyphen also matches a space.
const PATTERNS = BANNED_PHRASES.map((phrase) => ({
  phrase,
  pattern: new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(phrase).replace(/ /g, '\\s+').replace(/-/g, '[-\\u2010\\u2011\\s]')}(?![\\p{L}\\p{N}])`,
    'iu',
  ),
}))

/** The banned phrases found in the text, each once, in list order. */
export function bannedPhrases(text: string): string[] {
  const plain = text.replace(/[\u2018\u2019]/g, "'")
  return PATTERNS.filter(({ pattern }) => pattern.test(plain)).map(({ phrase }) => phrase)
}

/** Phrases that promise an outcome, which a comic never does. Case-insensitive, whole words. */
export const OUTCOME_PROMISES = [
  'you will get',
  "you'll get",
  'you will be',
  'guaranteed',
  'guarantee',
  'definitely',
  'for sure',
  '100%',
  'certain to',
  'you will',
  "you'll",
] as const

// Longest first, so one alternation lets "you will get" win over "you will".
const PROMISE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...OUTCOME_PROMISES]
    .sort((a, b) => b.length - a.length)
    .map((phrase) => escapeRegExp(phrase).replace(/ /g, '\\s+'))
    .join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
)

/** The outcome promises in the text as written, each once, the longest first. */
export function outcomePromises(text: string): string[] {
  // Curly apostrophes read as straight ones; the length stays, so indexes still fit the text.
  const plain = text.replace(/[‘’]/g, "'")
  const seen = new Set<string>()
  const found: string[] = []
  for (const match of plain.matchAll(PROMISE_PATTERN)) {
    const written = text.slice(match.index, match.index + match[0].length)
    if (seen.has(written.toLowerCase())) continue
    seen.add(written.toLowerCase())
    found.push(written)
  }
  return found.sort((a, b) => b.length - a.length)
}
