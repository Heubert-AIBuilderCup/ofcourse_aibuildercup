import { describe, expect, it } from 'bun:test'
import { sentences, sourceSentences } from './sentences'

describe('sentences', () => {
  it('splits the probe text into three sentences, keeping 24.95, e.g. and U.S. whole', () => {
    expect(
      sentences(
        'At AUD 24.95 an hour, e.g. 20 hours pays AUD 499. Above 20 hours, rates fell. The U.S. differs.',
      ),
    ).toEqual([
      'At AUD 24.95 an hour, e.g. 20 hours pays AUD 499.',
      'Above 20 hours, rates fell.',
      'The U.S. differs.',
    ])
  })

  it('returns nothing for empty or blank text', () => {
    expect(sentences('')).toEqual([])
    expect(sentences('  \n ')).toEqual([])
  })

  it('keeps abbreviations and initials whole', () => {
    expect(
      sentences(
        'Dr. Sharma said the U.S. grant was Rs. 2.5 crore. It covers 1.5 lakh people (approx.). "Will it last?" she asked. Mr. K.P. Oli disagreed.',
      ),
    ).toEqual([
      'Dr. Sharma said the U.S. grant was Rs. 2.5 crore.',
      'It covers 1.5 lakh people (approx.).',
      '"Will it last?" she asked.',
      'Mr. K.P. Oli disagreed.',
    ])
  })

  it('keeps a quote closed with a typographic ” whole with the lowercase words after it', () => {
    expect(sentences('“Will it last?” she asked. Nobody knew.')).toEqual([
      '“Will it last?” she asked.',
      'Nobody knew.',
    ])
  })

  it('ends a sentence at a plain "No.", and keeps "Rule No. 4" whole', () => {
    expect(sentences('Can students work more? No. Visas allow 48 hours a fortnight.')).toEqual([
      'Can students work more?',
      'No.',
      'Visas allow 48 hours a fortnight.',
    ])
    expect(sentences('It is Rule No. 4 of the visa. It allows 48 hours.')).toEqual([
      'It is Rule No. 4 of the visa.',
      'It allows 48 hours.',
    ])
  })

  it('keeps "Above" as a new sentence, not joined to the previous one', () => {
    expect(sentences('It pays AUD 499. Above 20 hours, rates fell.')).toEqual([
      'It pays AUD 499.',
      'Above 20 hours, rates fell.',
    ])
  })

  it('splits properly with Rs., Prof., and p.a. abbreviations', () => {
    expect(
      sentences(
        'Fees are Rs. Five lakh a year. Prof. Rai agreed. Tuition is AUD 38k p.a. Living costs add NPR 1.2 lakh.',
      ),
    ).toEqual([
      'Fees are Rs. Five lakh a year.',
      'Prof. Rai agreed.',
      'Tuition is AUD 38k p.a.',
      'Living costs add NPR 1.2 lakh.',
    ])
  })
})

describe('sourceSentences', () => {
  it('numbers a paragraph’s sentences ¶n.k, each its exact text and where it sits', () => {
    const text = 'Dr. Rai  spoke. Pass rates fell by 9 points.\nThe drop was largest in year one.'
    const out = sourceSentences({ ref: '¶2', text })
    expect(out.map(({ id, ref, text }) => [id, ref, text])).toEqual([
      ['¶2.1', '¶2', 'Dr. Rai  spoke.'],
      ['¶2.2', '¶2', 'Pass rates fell by 9 points.'],
      ['¶2.3', '¶2', 'The drop was largest in year one.'],
    ])
    expect(out.map((s) => text.slice(s.start, s.end))).toEqual([
      'Dr. Rai  spoke.',
      'Pass rates fell by 9 points.',
      'The drop was largest in year one.',
    ])
  })
})
