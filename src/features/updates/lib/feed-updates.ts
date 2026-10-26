import {
  ALL_INSTITUTIONS,
  ALL_TOPICS,
  type AudienceRule,
  audienceOf,
  drawnToWhy,
  topicName,
} from './audience'
import type { CardUpdate, StoredUpdate } from './update'

// Which live updates are hers, on her feed: an update is hers when one of her roadmaps matches it,
// its institution on that roadmap (or the update for all of them), when it names a country, her
// country on that roadmap and, when it names a topic, a course in that field on the roadmap or the
// field among her stated interests. Pure and client-safe.

/** One of her roadmaps, as the match needs it: its name, institutions, topics, her country. */
export type FeedRoadmap = {
  id: string
  name: string
  /** The institutions of its course, alternative course and stacked course. */
  universities: string[]
  /** Her country on it; null when she has not stated one. */
  country: string | null
  /** The fields of its course, alternative course and stacked course. */
  courseTopics: string[]
  /** The fields she said she is drawn to on it (assumed answers left out). */
  interestTopics: string[]
  /** Whether its answers match a road; without one it is matched only by her interests. */
  hasRoad: boolean
}

/** An update of hers: the card's fields, the roadmap it is hers through, and why. */
export type FeedUpdate = { update: CardUpdate & { id: string }; roadmapId: string; why: string }

/** How a roadmap matches: for all topics, through a course in the topic, or a stated interest. */
type Match = 'plain' | 'course' | 'interest'

function matchOf(a: AudienceRule, r: FeedRoadmap): Match | null {
  if (a.homeCountry !== null && a.homeCountry !== r.country) return null
  // A road-less roadmap has no courses: only a topic she is drawn to, for every institution.
  if (!r.hasRoad) {
    const drawn =
      a.institution === ALL_INSTITUTIONS &&
      a.topic !== ALL_TOPICS &&
      r.interestTopics.includes(a.topic)
    return drawn ? 'interest' : null
  }
  if (a.institution !== ALL_INSTITUTIONS && !r.universities.includes(a.institution)) return null
  if (a.topic === ALL_TOPICS) return 'plain'
  if (r.courseTopics.includes(a.topic)) return 'course'
  return r.interestTopics.includes(a.topic) ? 'interest' : null
}

function whyOf(a: AudienceRule, r: FeedRoadmap, match: Match): string {
  if (match === 'course') return `Because ${topicName(a.topic)} is on your roadmap "${r.name}"`
  if (match === 'interest') return drawnToWhy(a.topic)
  if (a.institution !== ALL_INSTITUTIONS)
    return `Because ${a.institution} is on your roadmap "${r.name}"`
  return `Because it applies to every student${a.homeCountry === null ? '' : ` from ${a.homeCountry}`}`
}

/**
 * The live updates that are hers, in the order given (newest first), once each, through the first
 * of her roadmaps (last opened first) that matches, a course match before an interest match.
 */
export function feedUpdates(
  updates: readonly StoredUpdate[],
  roadmaps: readonly FeedRoadmap[],
): FeedUpdate[] {
  return updates.flatMap((u) => {
    if (u.status !== 'live') return []
    const a = audienceOf(u.audience)
    const matched = roadmaps.map((r) => ({ r, match: matchOf(a, r) }))
    const found =
      matched.find((m) => m.match === 'plain' || m.match === 'course') ??
      matched.find((m) => m.match === 'interest')
    if (!found?.match) return []
    const { r, match } = found
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
    return [{ update, roadmapId: r.id, why: whyOf(a, r, match) }]
  })
}
