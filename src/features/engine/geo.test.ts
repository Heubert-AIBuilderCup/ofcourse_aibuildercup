import { describe, expect, it } from 'bun:test'
import type { Relative } from '@/shared/types/student'
import { CAMPUSES, CITIES, COURSES, placeById } from './catalogue'
import { distanceLine, flightHours, formatFlight, haversineKm, minutesBetween } from './geo'
import type { Campus, City, Course, Place } from './types'

const find = <T extends { id: string }>(list: readonly T[], id: string): T => {
  const found = list.find((x) => x.id === id)
  if (!found) throw new Error(`No ${id}`)
  return found
}
const city = (id: string): City => find(CITIES, id)
const course = (id: string): Course => find(COURSES, id)
const campus = (id: string): Campus => find(CAMPUSES, id)
const place = (id: string): Place => {
  const found = placeById(id)
  if (!found) throw new Error(`No place ${id}`)
  return found
}

const origin = { lat: 0, lng: 0 }
/** One degree of latitude: 6371 × π / 180 ≈ 111.19 km. */
const oneDegree = { lat: 1, lng: 0 }

const anjali: Relative = {
  placeId: 'cannington',
  place: 'Cannington',
  relationship: 'Cousin',
  name: 'Anjali',
}

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

describe('flightHours', () => {
  it('flies at 750 km/h plus 45 minutes, to the nearest half hour', () => {
    expect(flightHours(origin, oneDegree)).toBe(1) // 0.90
    expect(flightHours(origin, { lat: 18, lng: 0 })).toBe(3.5) // 2001 km: 3.42
    expect(flightHours(origin, { lat: 0, lng: 30 })).toBe(5) // 3336 km: 5.20
  })
})

describe('formatFlight', () => {
  it('writes a half hour as ½', () => {
    expect(formatFlight(3.5)).toBe('a 3½-hour flight')
    expect(formatFlight(5)).toBe('a 5-hour flight')
    expect(formatFlight(4)).toBe('a 4-hour flight')
  })
})

describe('distanceLine', () => {
  it('gives minutes from her person to the campus in the same city', () => {
    const line = distanceLine(course('ecu-cyber'), anjali)
    expect(line).toMatch(/^ECU Joondalup: about \d+ min from Anjali in Cannington · estimate$/)
    const minutes = Number(line?.match(/about (\d+) min/)?.[1])
    expect(minutes).toBe(minutesBetween(place('cannington'), campus('ecu-joondalup')))
  })

  it('gives a flight from her person’s city to a course in another city', () => {
    expect(distanceLine(course('unisa-cyber'), anjali)).toBe(
      'Adelaide: a 3½-hour flight from Anjali in Perth · estimate',
    )
  })

  it('gives minutes by road, not a flight, to a course in a nearby city (under 300 km)', () => {
    const footscray: Relative = { ...anjali, placeId: 'footscray', place: 'Footscray' }
    const minutes = minutesBetween(place('footscray'), campus('deakin-waurn-ponds'))
    expect(distanceLine(course('deakin-cyber'), footscray)).toBe(
      `Geelong: about ${minutes} min by road from Anjali in Melbourne · estimate`,
    )
    expect(haversineKm(city('melbourne'), city('geelong'))).toBeLessThan(300)
  })

  it('keeps a flight for a city 300 km or more away', () => {
    expect(haversineKm(city('perth'), city('adelaide'))).toBeGreaterThanOrEqual(300)
    expect(distanceLine(course('unisa-cyber'), anjali)).toMatch(/-hour flight from Anjali in Perth/)
  })

  it('says the relationship when she gave no name', () => {
    const cousin = { ...anjali, name: null }
    expect(distanceLine(course('ecu-cyber'), cousin)).toMatch(/ from your cousin in Cannington /)
    expect(distanceLine(course('unisa-cyber'), cousin)).toBe(
      'Adelaide: a 3½-hour flight from your cousin in Perth · estimate',
    )
    expect(
      distanceLine(course('unisa-cyber'), { ...cousin, relationship: 'Aunt or uncle' }),
    ).toMatch(/ from your aunt or uncle in Perth /)
  })

  it('promises the distance for a place outside the preview', () => {
    const elsewhere: Relative = { ...anjali, placeId: null, place: 'Kathmandu' }
    expect(distanceLine(course('ecu-cyber'), elsewhere)).toBe(
      'Distances from Anjali in Kathmandu will show once we can work them out.',
    )
  })

  it('promises the distance for a place id the preview no longer has', () => {
    const stale: Relative = { ...anjali, placeId: 'gone', place: 'Somewhere' }
    expect(distanceLine(course('ecu-cyber'), stale)).toBe(
      'Distances from Anjali in Somewhere will show once we can work them out.',
    )
  })

  it('is nothing without a relative', () => {
    expect(distanceLine(course('ecu-cyber'), null)).toBeNull()
  })
})
