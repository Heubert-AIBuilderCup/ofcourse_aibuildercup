// The markets and the mock rate matrix (ADR-123): what the model is told about a market's readers,
// and the dated rate from each source currency into its currency. Both are repo files parsed at
// load, as brands/index.ts does. The converted figure is never the model's: lib/market.ts works it
// out in code. Client-safe: JSON and zod only.

import { z } from 'zod'
import markets from './markets.json'
import rates from './rates.json'

export const MARKET_IDS = ['NP', 'IN', 'TH'] as const
export type MarketId = (typeof MARKET_IDS)[number]

const MARKET_CURRENCIES = ['NPR', 'INR', 'THB'] as const
export type MarketCurrency = (typeof MARKET_CURRENCIES)[number]

/** The currencies a source may quote money in: the destinations students are reading about. */
export const SOURCE_CURRENCIES = ['AUD', 'GBP', 'NZD', 'USD'] as const
export type SourceCurrency = (typeof SOURCE_CURRENCIES)[number]

const MarketSchema = z.object({
  id: z.enum(MARKET_IDS),
  name: z.string().min(1),
  currency: z.enum(MARKET_CURRENCIES),
  decisionFrame: z.string().min(1),
  notes: z.string().min(1),
})

/** ADR-097: every rate is a fact with a source and a date, shown wherever a converted figure is. */
const RateSchema = z.object({
  from: z.enum(SOURCE_CURRENCIES),
  to: z.enum(MARKET_CURRENCIES),
  rate: z.number().positive(),
  source: z.literal('mock rate'),
  date: z.iso.date(),
})

export type Market = z.infer<typeof MarketSchema>
export type Rate = z.infer<typeof RateSchema>

export const MARKETS: readonly Market[] = z.array(MarketSchema).parse(markets)
export const RATES: readonly Rate[] = z.array(RateSchema).parse(rates)

export function marketById(id: string): Market | null {
  return MARKETS.find((m) => m.id === id) ?? null
}

/** The row for a pair in the rates given (the file by default), or null when it has none. */
export function rateFor(
  from: SourceCurrency,
  to: MarketCurrency,
  rates: readonly Rate[] = RATES,
): Rate | null {
  return rates.find((r) => r.from === from && r.to === to) ?? null
}
