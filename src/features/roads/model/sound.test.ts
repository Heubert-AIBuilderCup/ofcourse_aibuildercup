// The ranking guard every road's spec passes (sound.test-helpers.ts, DS-R1): no word that ranks,
// in any case, except the literal names of units a course's copy quotes.

import { describe, expect, it } from 'bun:test'
import { rankingWords } from './sound.test-helpers'

describe('rankingWords', () => {
  it('finds a ranking word in any case', () => {
    expect(rankingWords('The best course')).toEqual(['best'])
    expect(rankingWords('THE TOP CHOICE')).toEqual(['TOP'])
    expect(rankingWords('Number one for jobs')).toEqual(['Number one'])
  })

  it('finds "leading" before a capital: a leading Australian university ranks', () => {
    expect(rankingWords('a leading Australian university')).toEqual(['leading'])
    expect(rankingWords('Leading in Australia')).toEqual(['Leading'])
  })

  it('lets through only the unit names the copy quotes', () => {
    expect(rankingWords('units such as Leading Teams and Leading People')).toEqual([])
    expect(rankingWords('units such as leading Teams')).toEqual([])
  })
})
