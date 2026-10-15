import { describe, expect, it } from 'bun:test'
import { contrastRatio, MIN_CONTRAST } from './contrast'

const round = (n: number) => Math.round(n * 100) / 100

describe('contrastRatio', () => {
  it('rounds #F4EFE6 on #1D1F20 to 14.45', () => {
    expect(round(contrastRatio('#F4EFE6', '#1D1F20'))).toBe(14.45)
  })

  it('rounds #1877F2 on #FFFFFF to 4.23', () => {
    expect(round(contrastRatio('#1877F2', '#FFFFFF'))).toBe(4.23)
  })

  it('rounds #16191B on #F4EFE6 to 15.42', () => {
    expect(round(contrastRatio('#16191B', '#F4EFE6'))).toBe(15.42)
  })

  it('does not depend on the order of the colours', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(contrastRatio('#000000', '#FFFFFF'))
  })

  it('keeps the WCAG minimum at 4.5', () => {
    expect(MIN_CONTRAST).toBe(4.5)
  })
})
