import { CITIES } from '@/features/engine'
import type { Roadmap, StoredAnswers } from '@/shared/types/student'
import type { MarketId } from '../markets'
import type { StudentProfile } from './profile-contract'
import type { FeedRoadmap } from './roadmap-lines'

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

/** What the feed reads of one of her roadmaps. */
type FeedRoadmapSource = Pick<Roadmap, 'name' | 'answers' | 'choices'>

/**
 * One of her roadmaps as the feed links posts to it (lib/roadmap-lines.ts): named by her own name,
 * else by the city of the course it is pinned to and the field she stated ("Sydney · Data
 * science"), else "Your roadmap"; leading to Australia when she chose it or when it is pinned to
 * a course, since the catalogue's cities are Australia's (engine/catalogue.ts).
 */
export function feedRoadmapOf(roadmap: FeedRoadmapSource): FeedRoadmap {
  const pinned = roadmap.choices.pinned
  const city = pinned ? CITIES.find((c) => c.id === pinned.cityId) : undefined
  const field = roadmap.answers.field
  const stated = field?.state === 'stated' && typeof field.value === 'string' ? field.value : null
  const named = [city?.name, stated].filter(Boolean).join(' · ')
  const fromAnswers = profileFromAnswers(roadmap.answers).destinations
  return {
    name: roadmap.name ?? (named || 'Your roadmap'),
    destinations: city && !fromAnswers.includes('AU') ? [...fromAnswers, 'AU'] : fromAnswers,
  }
}

/**
 * The feed's profile from her roadmaps, opened last first: the home country from the first, as
 * before, and every destination across them all, each once; null when she has none.
 */
export function profileFromRoadmaps(roadmaps: readonly FeedRoadmapSource[]): StudentProfile | null {
  const [first] = roadmaps
  if (!first) return null
  const destinations = roadmaps.flatMap((r) => feedRoadmapOf(r).destinations)
  return { ...profileFromAnswers(first.answers), destinations: [...new Set(destinations)] }
}
