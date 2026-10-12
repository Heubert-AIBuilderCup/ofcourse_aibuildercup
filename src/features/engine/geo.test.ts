import { describe, expect, it } from 'bun:test'
import type { Relative } from '@/shared/types/student'
import { CITIES } from './catalogue'
import { haversineKm, minutesBetween, whoOf } from './geo'
import type { City } from './types'

const find = <T extends { id: string }>(list: readonly T[], id: string): T => {
  const found = list.find((x) => x.id === id)
  if (!found) throw new Error(`No ${id}`)
  return found
}
const city = (id: string): City => find(CITIES, id)

const origin = { lat: 0, lng: 0 }
/** One degree of latitude: 6371 × π / 180 ≈ 111.19 km. */
const oneDegree = { lat: 1, lng: 0 }

describe('haversineKm', () => {
  it('puts Perth about 2,130 km from Adelaide', () => {
    const km = haversineKm(city('perth'), city('adelaide'))
    expect(km).toBeGreaterThan(2100)
    expect(km).toBeLessThan(2160)
  })

  it('uses an earth radius of 6371 km', () => {
    expect(haversineKm(origin, oneDegree)).toBeCloseTo(111.19, 1)
    expect(haversineKm(origin, origin)).toBe(0)
  })
})

describe('minutesBetween', () => {
  it('is ten minutes from a point to itself', () => {
    expect(minutesBetween(origin, origin)).toBe(10)
  })

  it('drives 1.3 times the distance at 40 km/h plus ten minutes, to the nearest 5', () => {
    // 111.19 × 1.3 / 40 × 60 + 10 = 226.8
    expect(minutesBetween(origin, oneDegree)).toBe(225)
  })
})

describe('whoOf', () => {
  const person = (
    relationship: Relative['relationship'],
    name: string | null = null,
  ): Relative => ({
    placeId: null,
    place: null,
    relationship,
    name,
  })

  it('is her name when she gave one', () => {
    expect(whoOf(person('Cousin', 'Anjali'))).toBe('Anjali')
    expect(whoOf(person(null, 'Anjali'))).toBe('Anjali')
  })

  it('is the relationship when she gave no name', () => {
    expect(whoOf(person('Cousin'))).toBe('your cousin')
    expect(whoOf(person('Sibling'))).toBe('your sibling')
    expect(whoOf(person('Aunt or uncle'))).toBe('your aunt or uncle')
    expect(whoOf(person('Friend'))).toBe('your friend')
  })

  it('is the person you know for Other or no relationship', () => {
    expect(whoOf(person('Other'))).toBe('the person you know')
    expect(whoOf(person(null))).toBe('the person you know')
  })
})
