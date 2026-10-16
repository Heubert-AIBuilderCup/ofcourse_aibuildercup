import { describe, expect, it } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'
import { profileFromAnswers } from './profile-from-answers'

const stated = (value: string) => ({ value, state: 'stated' as const })

describe('profileFromAnswers', () => {
  it('maps the two countries with a market to their ids', () => {
    expect(profileFromAnswers({ where: stated('Nepal') }).homeMarket).toBe('NP')
    expect(profileFromAnswers({ where: stated('India') }).homeMarket).toBe('IN')
  })

  it('has no home market for any other country or none', () => {
    expect(profileFromAnswers({ where: stated('Bangladesh') }).homeMarket).toBeNull()
    expect(profileFromAnswers({}).homeMarket).toBeNull()
  })

  it('has Australia as the destination when she chose it, none when open to others or unanswered', () => {
    expect(profileFromAnswers({ dest: stated('Australia') }).destinations).toEqual(['AU'])
    expect(profileFromAnswers({ dest: stated('Open to others') }).destinations).toEqual([])
    expect(profileFromAnswers({}).destinations).toEqual([])
  })

  it('reads a "Not sure" (an assumed default) as no answer: no home market, no destination', () => {
    const assumed = (value: string) => ({ value, state: 'assumed' as const })
    const profile = profileFromAnswers({ where: assumed('Nepal'), dest: assumed('Australia') })
    expect(profile.homeMarket).toBeNull()
    expect(profile.destinations).toEqual([])
  })

  it('never has an age band', () => {
    const answers: StoredAnswers = { where: stated('Nepal'), dest: stated('Australia') }
    expect(profileFromAnswers(answers).ageBand).toBeNull()
  })
})
