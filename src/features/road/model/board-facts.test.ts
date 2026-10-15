import { describe, expect, it } from 'bun:test'
import { boardFacts } from './board-facts'
import { getRoad } from './road-data'

// The numbers are the fixture's: Priya's road lights 4 of its 7 rows at her course, Student visa
// (Late 2026) next; walked back to Perth, 3 are lit and her course is next.
const road = getRoad()

describe("a roadmap's board facts", () => {
  it('at her course: 4 of 7 walked, the visa next', () => {
    expect(boardFacts(road, {})).toEqual({
      walked: 4,
      steps: 7,
      next: 'Student visa',
      nextWhen: 'Late 2026',
    })
  })

  it('walked back to the city: 3 walked, her course next', () => {
    expect(boardFacts(road, { city: true })).toEqual({
      walked: 3,
      steps: 7,
      next: 'Cyber Security',
      nextWhen: null,
    })
  })

  it('with the alternative swapped on, the walk and the next step are the same', () => {
    expect(boardFacts(road, { swapped: true })).toMatchObject({
      walked: 4,
      next: 'Student visa',
      nextWhen: 'Late 2026',
    })
  })
})
