import { describe, expect, test } from 'bun:test'
import { FINDER_CITIES } from '@/features/finder/data/schema'
import { JOB_MARKET, jobMarketFor } from './job-market'
import { OCCUPATIONS } from './occupations'

const SECURITY = '262112'
const DATA = '224115'
const GENERAL_IT = ['261313', '261112', '313212']
const DIPLOMA = ['313212', '411611', '511112']

const row = (code: string, cityId: string) => {
  const found = jobMarketFor(code, cityId)
  if (!found) throw new Error(`no row for ${code} in ${cityId}`)
  return found
}

describe('job market sample data', () => {
  test('every occupation has a row in every finder city', () => {
    for (const { code } of OCCUPATIONS) {
      for (const cityId of FINDER_CITIES) {
        const found = jobMarketFor(code, cityId)
        expect(found).not.toBeNull()
        expect(typeof found?.openings).toBe('number')
        expect(typeof found?.payLowK).toBe('number')
        expect(typeof found?.payHighK).toBe('number')
      }
    }
    expect(JOB_MARKET.length).toBe(OCCUPATIONS.length * FINDER_CITIES.length)
  })

  test('openings are positive whole numbers and pay is a 40 to 150 range', () => {
    for (const r of JOB_MARKET) {
      expect(Number.isInteger(r.openings) && r.openings > 0).toBe(true)
      expect(r.payLowK).toBeLessThan(r.payHighK)
      expect(r.payLowK).toBeGreaterThanOrEqual(40)
      expect(r.payHighK).toBeLessThanOrEqual(150)
    }
  })

  test('a row has no key that could name an employer or provider', () => {
    for (const r of JOB_MARKET) {
      expect(Object.keys(r).sort().join(',')).toBe('cityId,code,openings,payHighK,payLowK')
    }
  })

  test('an unknown code or city returns null', () => {
    expect(jobMarketFor('000000', 'sydney')).toBeNull()
    expect(jobMarketFor(SECURITY, 'nowhere')).toBeNull()
  })

  test('Sydney and Melbourne have the most openings, Hobart and Geelong the fewest', () => {
    for (const { code } of OCCUPATIONS) {
      const n = (c: string) => row(code, c).openings
      expect(Math.min(n('sydney'), n('melbourne'))).toBeGreaterThan(
        Math.max(n('perth'), n('adelaide')),
      )
      expect(Math.min(n('perth'), n('adelaide'))).toBeGreaterThan(
        Math.max(n('geelong'), n('hobart')),
      )
    }
  })

  test('security and data pay above general IT in every city', () => {
    for (const cityId of FINDER_CITIES) {
      for (const top of [SECURITY, DATA]) {
        for (const general of GENERAL_IT) {
          expect(row(top, cityId).payLowK).toBeGreaterThan(row(general, cityId).payLowK)
          expect(row(top, cityId).payHighK).toBeGreaterThan(row(general, cityId).payHighK)
        }
      }
    }
  })

  test('diploma-level occupations pay below every degree-level one', () => {
    const degree = OCCUPATIONS.filter((o) => !DIPLOMA.includes(o.code))
    for (const cityId of FINDER_CITIES) {
      for (const d of DIPLOMA) {
        for (const o of degree) {
          expect(row(d, cityId).payHighK).toBeLessThan(row(o.code, cityId).payHighK)
        }
      }
    }
  })
})
