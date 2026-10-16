import { ALL_INSTITUTIONS } from './audience'
import type { CardUpdate, StoredUpdate } from './update'

// Which live updates are hers, on her feed: an update is hers when one of her roadmaps matches it,
// its institution on that roadmap (or the update for all of them) and, when it names a country,
// her country on that roadmap. Pure and client-safe.

/** One of her roadmaps, as the match needs it: its name, the institutions on it, her country. */
export type FeedRoadmap = {
  id: string
  name: string
  /** The institutions of its course, alternative course and stacked course. */
  universities: string[]
  /** Her country on it; null when she has not stated one. */
  country: string | null
}

/** An update of hers: the card's fields, the roadmap it is hers through, and why. */
export type FeedUpdate = { update: CardUpdate & { id: string }; roadmapId: string; why: string }

const matches = (u: StoredUpdate, r: FeedRoadmap) =>
  (u.audience.institution === ALL_INSTITUTIONS ||
    r.universities.includes(u.audience.institution)) &&
  (u.audience.homeCountry === null || u.audience.homeCountry === r.country)

function whyOf(u: StoredUpdate, r: FeedRoadmap): string {
  const { institution, homeCountry } = u.audience
  if (institution !== ALL_INSTITUTIONS)
    return `Because ${institution} is on your roadmap "${r.name}"`
  return `Because it applies to every student${homeCountry === null ? '' : ` from ${homeCountry}`}`
}

/**
 * The live updates that are hers, in the order given (newest first), once each, through the first
 * of her roadmaps (last opened first) that matches.
 */
export function feedUpdates(
  updates: readonly StoredUpdate[],
  roadmaps: readonly FeedRoadmap[],
): FeedUpdate[] {
  return updates.flatMap((u) => {
    if (u.status !== 'live') return []
    const r = roadmaps.find((r) => matches(u, r))
    if (!r) return []
    const update = {
      id: u.id,
      kind: u.kind,
      category: u.category,
      institution: u.institution,
      title: u.title,
      body: u.body,
      applyBy: u.applyBy,
      sourceTitle: u.sourceTitle,
      sourceCheckedAt: u.sourceCheckedAt,
    }
    return [{ update, roadmapId: r.id, why: whyOf(u, r) }]
  })
}
