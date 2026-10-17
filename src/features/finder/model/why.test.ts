// The checks a finder card's why must pass before it is shown, and the template behind it
// (criterion 6): the quote is the course's own words, and the why says nothing the description
// does not.

import { describe, expect, it } from 'bun:test'
import { finderWhyProblems, finderWhyTemplate, quoteFound } from './why'

const DESCRIPTION =
  'You learn how people think, decide and remember, through lab classes and small studies of your own. The course’s “research methods” stream runs over 3 years.'

describe('quoteFound', () => {
  it('is true for an exact passage of the description', () => {
    expect(quoteFound('how people think, decide and remember', DESCRIPTION)).toBe(true)
  })

  it('is true when the quote differs only in runs of whitespace', () => {
    expect(quoteFound('how people  think,\n decide and   remember', DESCRIPTION)).toBe(true)
  })

  it('is true when the quote has straight quotes where the description has curly ones', () => {
    expect(quoteFound(`The course's "research methods" stream`, DESCRIPTION)).toBe(true)
  })

  it('is false for a paraphrase', () => {
    expect(quoteFound('how people reason, choose and recall things', DESCRIPTION)).toBe(false)
  })

  it('is false for a quote under 20 characters, even one in the description', () => {
    expect(quoteFound('lab classes', DESCRIPTION)).toBe(false)
  })
})

describe('finderWhyProblems', () => {
  const clean = {
    why: 'You said you like puzzles about people; this course studies how people think and decide.',
    quote: 'how people think, decide and remember',
  }

  it('finds nothing in a clean answer', () => {
    expect(finderWhyProblems(clean, DESCRIPTION)).toEqual([])
  })

  it('names a quote the description does not have', () => {
    const problems = finderWhyProblems(
      { ...clean, quote: 'how people reason and choose' },
      DESCRIPTION,
    )
    expect(problems.length).toBe(1)
    expect(problems[0]).toContain('quote')
  })

  it('names a figure the description does not give, and accepts one it does', () => {
    const absent = finderWhyProblems(
      { ...clean, why: `${clean.why} It takes 4 years.` },
      DESCRIPTION,
    )
    expect(absent.length).toBe(1)
    expect(absent[0]).toContain('4')
    expect(
      finderWhyProblems({ ...clean, why: `${clean.why} It runs over 3 years.` }, DESCRIPTION),
    ).toEqual([])
  })

  it('names a ranking word', () => {
    const problems = finderWhyProblems(
      { ...clean, why: 'This is the best course for someone who likes puzzles.' },
      DESCRIPTION,
    )
    expect(problems.length).toBe(1)
    expect(problems[0]).toContain('best')
  })

  it('names a why over 300 characters', () => {
    const problems = finderWhyProblems({ ...clean, why: 'a'.repeat(301) }, DESCRIPTION)
    expect(problems.length).toBe(1)
    expect(problems[0]).toContain('300')
    expect(finderWhyProblems({ ...clean, why: 'a'.repeat(300) }, DESCRIPTION)).toEqual([])
  })

  it('names an empty why', () => {
    expect(finderWhyProblems({ ...clean, why: '  ' }, DESCRIPTION).length).toBe(1)
  })
})

describe('finderWhyTemplate', () => {
  it('quotes what she said and the first sentence of the description', () => {
    expect(finderWhyTemplate('  I like puzzles ', DESCRIPTION)).toBe(
      'Matches what you said about “I like puzzles”, from the course description: “You learn how people think, decide and remember, through lab classes and small studies of your own.”',
    )
  })

  it('cuts what she said to 60 characters, marked with an ellipsis', () => {
    const said = 'I like working out why people do what they do, and testing my ideas'
    expect(finderWhyTemplate(said, DESCRIPTION)).toStartWith(
      `Matches what you said about “${said.slice(0, 60)}…”, from`,
    )
  })
})
