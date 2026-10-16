import { describe, expect, it } from 'bun:test'
import { missingNumbers, numbersIn } from './numbers'

const values = (text: string) => numbersIn(text).map((n) => n.value)

describe('numbersIn', () => {
  it('reads digits with separators and number words', () => {
    expect(values('3,100 students at eight universities')).toEqual([3100, 8])
  })

  it('drops a minus and reads percentage points as percent', () => {
    expect(numbersIn('pass rates −11 percentage points')).toMatchObject([
      { value: 11, unit: 'percent' },
    ])
  })

  it('reads decimals and the AUD prefix', () => {
    const found = numbersIn('AUD 24.95 an hour, about AUD 499')
    expect(found.map((n) => n.value)).toEqual([24.95, 499])
    expect(found.map((n) => n.unit)).toEqual(['aud', 'aud'])
  })

  it('reads A$ as aud, NPR and Rs as npr', () => {
    expect(numbersIn('A$20').map((n) => n.unit)).toEqual(['aud'])
    expect(numbersIn('NPR 500 or Rs 20').map((n) => n.unit)).toEqual(['npr', 'npr'])
  })

  it('reads the GBP, NZD and USD codes and symbols (86)', () => {
    expect(numbersIn('£1,200')[0]).toMatchObject({ value: 1200, unit: 'gbp' })
    expect(numbersIn('GBP 1,200')[0].unit).toBe('gbp')
    expect(numbersIn('NZ$ 500')[0]).toMatchObject({ value: 500, unit: 'nzd' })
    expect(numbersIn('NZD 500')[0].unit).toBe('nzd')
    expect(numbersIn('US$300')[0]).toMatchObject({ value: 300, unit: 'usd' })
    expect(numbersIn('USD 300')[0].unit).toBe('usd')
  })

  it('reads the INR and THB codes and symbols, with lakh', () => {
    expect(numbersIn('INR 5 lakh')[0]).toMatchObject({ value: 500000, unit: 'inr' })
    expect(numbersIn('₹5 lakh')[0]).toMatchObject({ value: 500000, unit: 'inr' })
    expect(numbersIn('THB 9,000')[0]).toMatchObject({ value: 9000, unit: 'thb' })
    expect(numbersIn('฿9,000')[0]).toMatchObject({ value: 9000, unit: 'thb' })
  })

  it('leaves a bare $ without a unit: it is ambiguous (ADR-123)', () => {
    expect(numbersIn('$300')[0]).toMatchObject({ value: 300, unit: null })
    expect(numbersIn('costs $ 300')[0].unit).toBeNull()
  })

  it('reads k, lakh and crore', () => {
    expect(values('36k or 25 lakh')).toEqual([36000, 2500000])
    expect(values('2 crore')).toEqual([20000000])
  })

  it('reads a range as two numbers', () => {
    expect(values('30–70 words')).toEqual([30, 70])
  })

  it('reads % and percent', () => {
    expect(numbersIn('40% and eight percent').map((n) => n.unit)).toEqual(['percent', 'percent'])
  })

  it('composes number words', () => {
    expect(values('twenty-one cases')).toEqual([21])
    expect(values('two hundred cases')).toEqual([200])
    expect(values('three hundred twenty one')).toEqual([321])
    expect(values('two thousand')).toEqual([2000])
    expect(values('eight nine')).toEqual([8, 9])
  })

  it('reads a scale word after digits', () => {
    expect(values('3 million students')).toEqual([3000000])
  })

  it('gives where each number sits, without its unit', () => {
    const text = 'fell by 9 percentage points'
    const [found] = numbersIn(text)
    expect(text.slice(found.start, found.end)).toBe('9')
  })

  it('finds nothing when there are no figures', () => {
    expect(numbersIn('no figures')).toEqual([])
  })

  it('does not read a number word inside a longer word', () => {
    expect(numbersIn('often phone')).toEqual([])
  })
})

describe('missingNumbers', () => {
  it('returns the claim number the paragraph lacks', () => {
    expect(
      missingNumbers('pass rates drop 11 points', 'pass rates fell by 9 percentage points'),
    ).toMatchObject([{ value: 11 }])
  })

  it('gives no false alarm for a word and its digit', () => {
    expect(missingNumbers('eight universities', '8 universities')).toEqual([])
  })

  it('accepts a claim number with no unit against a paragraph number with one', () => {
    expect(missingNumbers('rates fell 11 points', 'fell by 11 percentage points')).toEqual([])
  })

  it('rejects a different unit when both have one', () => {
    expect(missingNumbers('AUD 20', 'NPR 20')).toMatchObject([{ value: 20, unit: 'aud' }])
  })
})
