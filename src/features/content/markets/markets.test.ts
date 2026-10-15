import { describe, expect, it } from 'bun:test'
import { MARKET_IDS, MARKETS, marketById, RATES, rateFor } from './index'

// The markets file and the mock rate matrix (criterion 85, ADR-123): three markets, and one dated
// rate from each of AUD, GBP, NZD and USD into each market currency.

const SOURCES = ['AUD', 'GBP', 'NZD', 'USD'] as const

describe('markets', () => {
  it('lists Nepal, India and Thailand in MARKET_IDS order, each with its currency', () => {
    expect(MARKETS.map((m) => m.id)).toEqual([...MARKET_IDS])
    expect(MARKETS.map((m) => [m.name, m.currency])).toEqual([
      ['Nepal', 'NPR'],
      ['India', 'INR'],
      ['Thailand', 'THB'],
    ])
  })

  it('keeps the Nepal frame and notes the model was given before', () => {
    expect(marketById('NP')).toEqual({
      id: 'NP',
      name: 'Nepal',
      currency: 'NPR',
      decisionFrame: 'family',
      notes: 'Families often decide together; Dashain falls in autumn; plain, respectful tone.',
    })
  })

  it('finds a market by id, null for an unknown one', () => {
    expect(marketById('IN')?.currency).toBe('INR')
    expect(marketById('TH')?.currency).toBe('THB')
    expect(marketById('np')).toBeNull()
    expect(marketById('nope')).toBeNull()
  })
})

describe('rates', () => {
  it('has twelve rows: every source currency into every market currency, once', () => {
    expect(RATES).toHaveLength(12)
    for (const from of SOURCES) {
      for (const market of MARKETS) {
        const rows = RATES.filter((r) => r.from === from && r.to === market.currency)
        expect(rows, `${from}→${market.currency}`).toHaveLength(1)
      }
    }
  })

  it('is a mock rate, dated, on every row (ADR-097)', () => {
    for (const r of RATES) {
      expect(r.source).toBe('mock rate')
      expect(r.date).toBe('2026-10-01')
      expect(r.rate).toBeGreaterThan(0)
    }
  })

  it('finds the row for a pair, in the file or in the rates given', () => {
    expect(rateFor('AUD', 'NPR')?.rate).toBe(88)
    expect(rateFor('AUD', 'INR')?.rate).toBe(55)
    expect(rateFor('GBP', 'THB')?.rate).toBe(44)
    expect(rateFor('GBP', 'THB', [])).toBeNull()
    expect(
      rateFor('USD', 'INR', [
        { from: 'USD', to: 'INR', rate: 1, source: 'mock rate', date: '2026-10-01' },
      ])?.rate,
    ).toBe(1)
  })
})
