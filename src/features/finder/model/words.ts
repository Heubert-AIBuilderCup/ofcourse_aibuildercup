// A text's words, by two rules. contentWords drops only true stopwords: the search's word-count gate
// (server/search.ts) and the fake embedding's bag of words (server/embed.ts) read it. topicWords also
// drops the words too common in what a student says about herself: the demo queries'
// no-shared-words check (criterion 15, evals/queries.test.ts) reads it. Pure.

/** Words too common to carry meaning. */
export const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'has',
  'have',
  'i',
  'in',
  'into',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'so',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'to',
  'was',
  'we',
  'what',
  'when',
  'which',
  'who',
  'with',
  'you',
  'your',
])

/**
 * Words too common in what a student says about herself to tell one course from another
 * (Nikhil, 17 Oct): criterion 15 counts topic words, not these; the word-count gate still does.
 */
export const COMMON_WORDS = new Set([
  'app',
  'apps',
  'enjoy',
  'good',
  'how',
  'like',
  'love',
  'make',
  'makes',
  'making',
  'people',
  'really',
  'stuff',
  'thing',
  'things',
  'use',
  'using',
  'want',
  'why',
])

/** A word: letters, with a contraction (I'm, don't) kept whole. */
const WORD = /\p{L}+(?:'\p{L}+)*/gu

/** Lower case, its words (a curly apostrophe read as a straight one), stopwords dropped. */
export function contentWords(text: string): string[] {
  const words = text.toLowerCase().replaceAll('’', "'").match(WORD) ?? []
  return words.filter((word) => !STOPWORDS.has(word))
}

/** Its content words, the common words dropped as well. */
export function topicWords(text: string): string[] {
  return contentWords(text).filter((word) => !COMMON_WORDS.has(word))
}
