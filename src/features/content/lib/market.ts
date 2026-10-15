// The market version's money rule (criteria 57, 58, 85, 86). Code, never the model, converts each
// money figure in the facts the structure is bound to, from its own currency at the rate file's row
// for the market (ADR-097, ADR-123), and writes the local figure beside it; a figure with no
// currency code or symbol is left alone, a source with no money gets nothing added (AD-R8), and a
// pair the file has no row for refuses the version rather than guessing.
// Pure and client-safe: slides are numbered from 1, cover first, as the layout engine numbers them.

import { type Market, RATES, type Rate, rateFor, type SourceCurrency } from '../markets'
import type { Conversion, Fact, Structure } from '../model/types'
import { CURRENCY_BEFORE, type CurrencyUnit, numbersIn } from '../text/numbers'
import { escapeRegExp } from '../text/regexp'

const GROUPED = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 })
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** The units numbersIn reads that a source quotes money in; a market currency is never converted. */
const SOURCES: { unit: CurrencyUnit; code: SourceCurrency }[] = [
  { unit: 'aud', code: 'AUD' },
  { unit: 'gbp', code: 'GBP' },
  { unit: 'nzd', code: 'NZD' },
  { unit: 'usd', code: 'USD' },
]

/** The local figure for an amount at the row, to the nearest 100: 499 at AUD→NPR 88 → "NPR 43,900". */
export function toLocal(amount: number, rate: Rate): string {
  return `${rate.to} ${GROUPED.format(Math.round((amount * rate.rate) / 100) * 100)}`
}

/**
 * One conversion per money figure (numbersIn, a source-currency unit) in the facts bound to the
 * structure, at the market's row for that currency; none when the source has none (AD-R8).
 * Refuses with "No rate for <pair>" when the rates have no row for a figure's currency (86).
 */
export function conversionsFor(
  structure: Structure,
  facts: Fact[],
  market: Market,
  rates: readonly Rate[] = RATES,
): { ok: true; conversions: Conversion[] } | { ok: false; error: string } {
  const bound = new Set(
    structure.slides.flatMap((s) => Object.values(s.slots).flatMap((slot) => slot.factIds)),
  )
  const conversions: Conversion[] = []
  const seen = new Set<string>()
  for (const fact of facts) {
    if (!bound.has(fact.id)) continue
    for (const n of numbersIn(fact.text)) {
      const source = SOURCES.find((s) => s.unit === n.unit)
      if (!source || seen.has(`${source.code} ${n.value}`)) continue
      const prefix = CURRENCY_BEFORE[source.unit].exec(fact.text.slice(0, n.start))
      if (!prefix) continue
      const rate = rateFor(source.code, market.currency, rates)
      if (!rate) return { ok: false, error: `No rate for ${source.code}→${market.currency}` }
      seen.add(`${source.code} ${n.value}`)
      conversions.push({
        factId: fact.id,
        // The figure as the fact writes it, so it is found as written on the slide.
        from: fact.text.slice(n.start - prefix[0].length, n.end),
        to: toLocal(n.value, rate),
        rate: rate.rate,
        rateSource: rate.source,
        rateDate: rate.date,
        fromCurrency: rate.from,
        toCurrency: rate.to,
      })
    }
  }
  return { ok: true, conversions }
}

/** "NPR at 88 per AUD · mock rate · 1 Oct 2026" (ADR-097), drawn under the converted figure. */
export function rateLine(c: Conversion): string {
  const [year, month, day] = c.rateDate.split('-').map(Number)
  return `${c.toCurrency} at ${c.rate} per ${c.fromCurrency} · ${c.rateSource} · ${day} ${MONTHS[month - 1]} ${year}`
}

/**
 * The slot texts with each conversion's `from` followed by " (≈ <to>)", keyed "<slide>:<slot>" as
 * layoutStructure's slotOverrides are. Only the slots that change; a longer figure that starts the
 * same ("AUD 4990" for "AUD 499") is left alone.
 */
export function applyConversions(
  structure: Structure,
  conversions: Conversion[],
): Record<string, string> {
  const patterns = conversions.map((c) => ({
    pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(c.from)}(?![\\p{N}]|[.,]\\p{N})`, 'gu'),
    to: c.to,
  }))
  const changed: Record<string, string> = {}
  structure.slides.forEach((slide, index) => {
    for (const [key, slot] of Object.entries(slide.slots)) {
      let text = slot.text
      for (const { pattern, to } of patterns) text = text.replace(pattern, (m) => `${m} (≈ ${to})`)
      if (text !== slot.text) changed[`${index + 1}:${key}`] = text
    }
  })
  return changed
}
