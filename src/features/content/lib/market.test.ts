import { describe, expect, it } from 'bun:test'
import { type Market, marketById, type Rate, rateFor } from '../markets'
import type { Conversion, Fact, Structure } from '../model/types'
import { applyConversions, conversionsFor, rateLine, toLocal } from './market'

// The market version's money rule (criteria 57, 58, 85, 86): code converts every money figure in
// the facts the structure is bound to, from its own currency at the rate file's row for the market
// (ADR-097, ADR-123); the model never writes a figure.

const NP = marketById('NP') as Market
const TH = marketById('TH') as Market
const AUD_NPR = rateFor('AUD', 'NPR') as Rate
const AUD_INR = rateFor('AUD', 'INR') as Rate

const fact = (id: string, ref: string, text: string): Fact => ({
  id,
  text,
  value: null,
  ref,
  quote: text,
  supported: true,
  why: null,
  span: null,
})

const WAGE = fact('f5', '¶5', '20 hours a week pays about AUD 499 before tax.')
const GRADES = fact('f2', '¶2', 'Students working up to 20 hours a week had similar grades.')

const slot = (text: string, factIds: string[] = []) => ({
  text,
  factIds,
  factual: factIds.length > 0,
})

/** The-line with its money body slide bound to ¶5. */
const THE_LINE: Structure = {
  templateId: 'the-line',
  artPrompt: 'A desk.',
  slides: [
    { kind: 'cover', slots: { kicker: slot('Research, briefly'), phrase: slot('The line') } },
    {
      kind: 'body',
      slots: { heading: slot('Grades'), body: slot(GRADES.text, ['f2']) },
    },
    {
      kind: 'body',
      slots: {
        heading: slot('The pay'),
        body: slot('At the minimum wage, 20 hours a week pays about AUD 499 before tax.', ['f5']),
      },
    },
    { kind: 'take', slots: { takeaway: slot('Keep paid work under 20 hours a week.') } },
  ],
}

/** The-line with one body slide bound to `moneyFact`. */
function bound(moneyFact: Fact): Structure {
  return {
    ...THE_LINE,
    slides: [
      THE_LINE.slides[0],
      {
        kind: 'body',
        slots: { heading: slot('The cost'), body: slot(moneyFact.text, [moneyFact.id]) },
      },
      THE_LINE.slides[3],
    ],
  }
}

/** The conversions, or a thrown refusal. */
function convert(structure: Structure, facts: Fact[], market = NP, rates?: readonly Rate[]) {
  const res = conversionsFor(structure, facts, market, rates)
  if (!res.ok) throw new Error(res.error)
  return res.conversions
}

describe('toLocal', () => {
  it('converts at the row and rounds to the nearest 100, with en-AU grouping', () => {
    expect(toLocal(499, AUD_NPR)).toBe('NPR 43,900')
    expect(toLocal(24.95, AUD_NPR)).toBe('NPR 2,200')
    expect(toLocal(499, AUD_INR)).toBe('INR 27,400')
  })
})

describe('conversionsFor', () => {
  it('gives one conversion for the AUD amount in the fact bound to the-line (57)', () => {
    expect(conversionsFor(THE_LINE, [GRADES, WAGE], NP)).toEqual({
      ok: true,
      conversions: [
        {
          factId: 'f5',
          from: 'AUD 499',
          to: 'NPR 43,900',
          rate: 88,
          rateSource: 'mock rate',
          rateDate: '2026-10-01',
          fromCurrency: 'AUD',
          toCurrency: 'NPR',
        },
      ],
    })
  })

  it('gives none when no bound fact carries money (58)', () => {
    const noMoney: Structure = { ...THE_LINE, slides: THE_LINE.slides.slice(0, 2) }
    expect(convert(noMoney, [GRADES, WAGE])).toEqual([])
  })

  it('ignores money in a fact the structure does not bind', () => {
    const unbound = fact('f9', '¶9', 'A room costs AUD 300 a week.')
    expect(convert(THE_LINE, [GRADES, WAGE, unbound]).map((c) => c.from)).toEqual(['AUD 499'])
  })

  it('converts a GBP figure into Thailand at the GBP→THB row (86)', () => {
    const rent = fact('f7', '¶7', 'Rent is about £1,200 a month in London.')
    expect(convert(bound(rent), [rent], TH)).toEqual([
      {
        factId: 'f7',
        from: '£1,200',
        to: 'THB 52,800',
        rate: 44,
        rateSource: 'mock rate',
        rateDate: '2026-10-01',
        fromCurrency: 'GBP',
        toCurrency: 'THB',
      },
    ])
  })

  it('converts US$ and NZ$ figures from their own currency', () => {
    const fees = fact('f8', '¶8', 'Fees are US$300 a credit, or NZ$ 500 a course.')
    expect(convert(bound(fees), [fees], NP).map((c) => [c.from, c.to, c.rate])).toEqual([
      ['US$300', 'NPR 40,200', 134],
      ['NZ$ 500', 'NPR 40,000', 80],
    ])
  })

  it('leaves a figure with no currency code or symbol alone (86)', () => {
    const bare = fact('f6', '¶6', 'Students earn about 500 a week, or $300 after rent.')
    expect(convert(bound(bare), [bare], NP)).toEqual([])
  })

  it('refuses a pair the rates have no row for (86)', () => {
    expect(conversionsFor(THE_LINE, [GRADES, WAGE], NP, [])).toEqual({
      ok: false,
      error: 'No rate for AUD→NPR',
    })
  })
})

describe('rateLine', () => {
  it('names the pair, the rate, its source and its date (ADR-097)', () => {
    expect(rateLine(convert(THE_LINE, [WAGE])[0])).toBe(
      'NPR at 88 per AUD · mock rate · 1 Oct 2026',
    )
    const rent = fact('f7', '¶7', 'Rent is £1,200 a month.')
    expect(rateLine(convert(bound(rent), [rent], TH)[0])).toBe(
      'THB at 44 per GBP · mock rate · 1 Oct 2026',
    )
  })
})

describe('applyConversions', () => {
  it('puts the local figure after each money figure, keyed "<slide>:<slot>", and nothing else', () => {
    expect(applyConversions(THE_LINE, convert(THE_LINE, [WAGE]))).toEqual({
      '3:body':
        'At the minimum wage, 20 hours a week pays about AUD 499 (≈ NPR 43,900) before tax.',
    })
  })

  it('never converts a longer amount that starts the same', () => {
    const shorter: Conversion[] = [{ ...convert(THE_LINE, [WAGE])[0], from: 'AUD 49' }]
    expect(applyConversions(THE_LINE, shorter)).toEqual({})
  })

  it('changes nothing without conversions', () => {
    expect(applyConversions(THE_LINE, [])).toEqual({})
  })
})
