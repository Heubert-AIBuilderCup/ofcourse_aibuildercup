import type { StoredAnswers } from '@/shared/types/student'
import type { MarketId } from '../markets'
import type { StudentProfile } from './profile-contract'

/** The `where` answers (country names) that have a market; any other country has none. */
const HOME_MARKETS: Record<string, MarketId> = { Nepal: 'NP', India: 'IN' }

/**
 * The feed's profile from one roadmap's answers: her home country if it has a market, Australia
 * as the destination if she chose it ("Open to others" or no answer leaves it open). Only what she
 * stated counts: "Not sure" stores an assumed default, which reads as no answer. No question asks
 * her age, so the age band is always null.
 */
export function profileFromAnswers(answers: StoredAnswers): StudentProfile {
  const said = (key: 'where' | 'dest') => {
    const answer = answers[key]
    return answer?.state === 'stated' ? answer.value : undefined
  }
  const where = said('where')
  const dest = said('dest')
  return {
    homeMarket: typeof where === 'string' ? (HOME_MARKETS[where] ?? null) : null,
    destinations: dest === 'Australia' ? ['AU'] : [],
    ageBand: null,
  }
}
