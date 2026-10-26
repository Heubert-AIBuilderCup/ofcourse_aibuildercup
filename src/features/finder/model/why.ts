// A finder card's why (criterion 6): code checks every answer the model gives, and the template
// stands behind it. The quote must be the course description's own words, and the why may say
// nothing the description does not: no figure it lacks, no ranking. Pure.

import { numbersIn, rankingWords } from '@/features/roads/model/why'

/** The shortest passage that counts as a quote. */
const QUOTE_MIN = 20
/** The longest why a card shows. */
const WHY_MAX = 300
/** How much of what she said the template repeats. */
const SAID_MAX = 60

/** One form for both texts: curly quotes as straight ones, each run of whitespace as one space. */
const plain = (text: string): string =>
  text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

/** The quote is a passage of the description, at least QUOTE_MIN characters long. */
export function quoteFound(quote: string, description: string): boolean {
  const passage = plain(quote)
  return passage.length >= QUOTE_MIN && plain(description).includes(passage)
}

/** Every problem in a why, one line each, for the model to fix; [] when it may be shown. */
export function finderWhyProblems(
  answer: { why: string; quote: string },
  description: string,
): string[] {
  const { why, quote } = answer
  const problems: string[] = []
  if (why.trim() === '') problems.push('why: write one or two sentences.')
  if (why.length > WHY_MAX) problems.push(`why: at most ${WHY_MAX} characters.`)
  if (!quoteFound(quote, description)) {
    problems.push(
      `quote: copy one passage of at least ${QUOTE_MIN} characters word for word from course.description.`,
    )
  }
  const given = new Set(numbersIn(description))
  for (const figure of new Set(numbersIn(why))) {
    if (!given.has(figure)) problems.push(`why: "${figure}" is not in course.description.`)
  }
  for (const word of rankingWords(why)) {
    problems.push(`why: never say "${word}"; nothing is ranked or recommended.`)
  }
  return problems
}

/** The first sentence of a text. */
const firstSentence = (text: string): string => text.trim().split(/(?<=[.!?])\s+/)[0]

/** The why when the model's is missing, late or fails its checks: her words and the description's. */
export function finderWhyTemplate(said: string, description: string): string {
  const words = said.trim()
  const shown = words.length > SAID_MAX ? `${words.slice(0, SAID_MAX)}…` : words
  return `Matches what you said about “${shown}”, from the course description: “${firstSentence(description)}”`
}
