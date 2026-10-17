import { describe, expect, it } from 'bun:test'
import { CITY_STATE, OCCUPATIONS, occupationsFor, routeFor } from './occupations'

const COURSE_IDS = [...new Set(OCCUPATIONS.flatMap((o) => o.courseIds))]
const CITIES = Object.keys(CITY_STATE)

describe('routeFor', () => {
  it('finds no way to stay without an occupation', () => {
    expect(routeFor([], 'perth', 3)).toBe('none')
  })

  it('finds no way to stay when the PR score is 0', () => {
    for (const id of COURSE_IDS)
      for (const city of CITIES)
        expect(`${id} ${city} ${routeFor(occupationsFor(id), city, 0)}`).toBe(`${id} ${city} none`)
  })
})
