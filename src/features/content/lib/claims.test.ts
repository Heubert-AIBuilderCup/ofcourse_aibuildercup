import { describe, expect, it } from 'bun:test'
import type { Fact, Structure } from '../model/types'
import { templateById } from '../templates'
import { claimsIn, claimsWithEvidence, replaceSentence, unboundSlots } from './claims'

const template = templateById('the-line')
if (!template) throw new Error('the-line template missing')

const fact = (over: Partial<Fact> = {}): Fact => ({
  id: 'f1',
  text: 'Pass rates fell by 11 percentage points above 20 hours a week.',
  value: { number: 11, unit: 'percent' },
  ref: '¶1',
  quote: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
  supported: true,
  why: null,
  span: null,
  ...over,
})

function structure(body: string, factIds: string[]): Structure {
  return {
    templateId: 'the-line',
    artPrompt: 'An open notebook beside a small desk clock.',
    slides: [
      {
        kind: 'cover',
        slots: {
          kicker: { text: 'Research, briefly', factIds: [], factual: false },
          phrase: { text: '20-hour', factIds: [], factual: false },
          byline: { text: 'OfCourse · 5 min read', factIds: [], factual: false },
        },
      },
      {
        kind: 'body',
        slots: {
          heading: { text: 'Finding 1', factIds: [], factual: false },
          body: { text: body, factIds, factual: true },
        },
      },
    ],
  }
}

const TWO =
  'Above 20 hours a week, pass rates fell. First year is the worst time to find out where your limit is.'

describe('claimsIn', () => {
  it('splits a factual slot into one claim per sentence on the same slide and slot', () => {
    expect(claimsIn(structure(TWO, ['f1']), template)).toEqual([
      { slide: 2, slot: 'body', text: 'Above 20 hours a week, pass rates fell.' },
      {
        slide: 2,
        slot: 'body',
        text: 'First year is the worst time to find out where your limit is.',
      },
    ])
  })
})

describe('replaceSentence', () => {
  const [first, second] = [
    'Above 20 hours a week, pass rates fell.',
    'First year is the worst time to find out where your limit is.',
  ]

  it("puts the source's sentence in place of one sentence, the rest exactly as it was (104)", () => {
    expect(replaceSentence(TWO, second, 'The drop was largest in the first year of study.')).toBe(
      `${first} The drop was largest in the first year of study.`,
    )
    expect(replaceSentence(TWO, first, 'Pass rates fell by 11 points.')).toBe(
      `Pass rates fell by 11 points. ${second}`,
    )
  })

  it('takes a sentence out when it is replaced with nothing', () => {
    expect(replaceSentence(TWO, first, '')).toBe(second)
    expect(replaceSentence(TWO, second, '')).toBe(first)
  })

  it('is null when the sentence is not in the text', () => {
    expect(replaceSentence(TWO, 'Not here.', 'x')).toBeNull()
  })
})

describe('claimsWithEvidence', () => {
  it("gives each claim its slot's supported bound facts, as the source's sentences per paragraph (ADR-129)", () => {
    const sentence = fact({
      id: 'f2',
      text: 'Students who worked more than three night shifts a week reported more missed classes.',
      quote:
        'Students who worked more than three night shifts a week reported more missed classes.',
      ref: '¶3',
    })
    const later = fact({ id: 'f3', text: 'The study is small.', quote: null, ref: '¶3' })
    const unsupported = fact({ id: 'f4', supported: false, ref: '¶4' })
    const got = claimsWithEvidence(structure(TWO, ['f1', 'f2', 'f3', 'f4']), template, [
      fact(),
      sentence,
      later,
      unsupported,
    ])
    // A fact from before criterion 95 says the source's words in its quote.
    const evidence = [
      { ref: '¶1', text: 'Above 20 hours a week, pass rates fell by 11 percentage points.' },
      {
        ref: '¶3',
        text: 'Students who worked more than three night shifts a week reported more missed classes. The study is small.',
      },
    ]
    expect(got).toEqual([
      { slide: 2, slot: 'body', text: 'Above 20 hours a week, pass rates fell.', evidence },
      {
        slide: 2,
        slot: 'body',
        text: 'First year is the worst time to find out where your limit is.',
        evidence,
      },
    ])
  })

  it('gives a claim in a slot with no bound fact no evidence, so the check reads the paragraphs', () => {
    expect(claimsWithEvidence(structure('Pass rates fell.', []), template, [fact()])).toEqual([
      { slide: 2, slot: 'body', text: 'Pass rates fell.', evidence: [] },
    ])
  })
})

describe('unboundSlots', () => {
  it('reads a number word as its digits: "Ninety percent" stands on "90 percent"', () => {
    const visa = fact({
      text: 'The department decided 90 percent of student visa applications within 28 days in the latest quarter.',
      quote:
        'The department decided 90 percent of student visa applications within 28 days in the latest quarter.',
      value: { number: 90, unit: 'percent' },
    })
    const said = 'Ninety percent of decisions came within 28 days in the latest quarter.'
    expect(unboundSlots(structure(said, ['f1']), template, [visa])).toEqual([])
    const wrong = 'Eighty percent of decisions came within 28 days in the latest quarter.'
    expect(unboundSlots(structure(wrong, ['f1']), template, [visa]).map((u) => u.reason)).toEqual([
      'Number not in its fact',
    ])
  })

  it('flags a factual slot with no fact as No source', () => {
    const got = unboundSlots(structure('Pass rates fell.', []), template, [fact()])
    expect(got).toEqual([{ slide: 2, slot: 'body', text: 'Pass rates fell.', reason: 'No source' }])
  })

  it('flags a slot bound to an unsupported fact as No source', () => {
    const got = unboundSlots(structure('Pass rates fell.', ['f1']), template, [
      fact({ supported: false }),
    ])
    expect(got.map((u) => u.reason)).toEqual(['No source'])
  })

  it('flags a slot bound to a fact that does not exist as No source', () => {
    const got = unboundSlots(structure('Pass rates fell.', ['gone']), template, [fact()])
    expect(got.map((u) => u.reason)).toEqual(['No source'])
  })

  it('flags a number its bound fact does not contain (12 against 11) (28)', () => {
    const got = unboundSlots(structure('Pass rates fell by 12 points.', ['f1']), template, [fact()])
    expect(got).toEqual([
      {
        slide: 2,
        slot: 'body',
        text: 'Pass rates fell by 12 points.',
        reason: 'Number not in its fact',
      },
    ])
  })

  it('accepts a number found in the quote of one bound fact or the text of another', () => {
    const other = fact({ id: 'f2', text: 'Students worked 30 hours.', quote: null })
    const got = unboundSlots(
      structure('Over 20 hours and 30 hours, pass rates fell by 11 points.', ['f1', 'f2']),
      template,
      [fact(), other],
    )
    expect(got).toEqual([])
  })

  it('gives nothing for a correctly bound slot', () => {
    expect(
      unboundSlots(structure('Pass rates fell by 11 points.', ['f1']), template, [fact()]),
    ).toEqual([])
  })

  it('never lists a non-factual slot', () => {
    const s = structure('Pass rates fell by 11 points.', ['f1'])
    s.slides[0].slots.phrase.text = 'A 99 hour week'
    expect(unboundSlots(s, template, [fact()])).toEqual([])
  })
})

describe('claims on a look (GD4)', () => {
  const fieldNotes = templateById('field-notes')
  if (!fieldNotes) throw new Error('field-notes template missing')

  it('reads a slide’s factual slots from its layout: a quote slide’s unbound quote is found', () => {
    const quoteSlide: Structure = {
      templateId: 'field-notes',
      artPrompt: 'A desk.',
      slides: [
        {
          kind: 'body',
          layout: 'quote',
          slots: {
            quote: { text: 'Pass rates fell by 11 points.', factIds: [], factual: true },
            credit: { text: 'A survey', factIds: [], factual: false },
          },
        },
      ],
    }
    expect(unboundSlots(quoteSlide, fieldNotes, [fact()])).toEqual([
      { slide: 1, slot: 'quote', text: 'Pass rates fell by 11 points.', reason: 'No source' },
    ])
  })
})
