// Related posts (criterion 91, ADR-125): explicit, labelled edges computed from the records in
// code, never by a model. Pure and client-safe: the tag file for labels and types from feed.ts.

import { tagById } from '../tags'
import { type FeedPost, tagValue } from './feed'

export type Related = { post: FeedPost; why: string }

/** The most related posts a page shows. */
export const MAX_RELATED = 4

/** The tag's label from the tag file, its bare value when the file no longer has it. */
const labelOf = (id: string): string => tagById(id)?.label ?? tagValue(id)

/** The first tag of `group` in `post`'s order that `other` also carries, or null. */
function sharedTag(post: FeedPost, other: FeedPost, group: 'theme' | 'destination'): string | null {
  const prefix = `${group}:`
  return post.tags.find((t) => t.startsWith(prefix) && other.tags.includes(t)) ?? null
}

/** The strongest reason `other` is related to `post`, lower rank first, or null when none holds. */
function reasonFor(post: FeedPost, other: FeedPost): { rank: number; why: string } | null {
  if (post.sourceId !== null && other.sourceId === post.sourceId) {
    return { rank: 0, why: 'built on the same source' }
  }
  const theme = sharedTag(post, other, 'theme')
  if (theme) return { rank: 1, why: `also about ${labelOf(theme)}` }
  const destination = sharedTag(post, other, 'destination')
  if (destination) return { rank: 2, why: `also for ${labelOf(destination)}` }
  return null
}

/**
 * Other live posts, strongest reason first, one reason each, at most four: same sourceId ("built
 * on the same source"), a shared theme tag ("also about <label>"), a shared destination tag ("also
 * for <label>"). Never the post itself; within a reason the order of `all` holds. The caller
 * passes live posts only (ADR-125).
 */
export function relatedTo(post: FeedPost, all: FeedPost[]): Related[] {
  const found: { rank: number; related: Related }[] = []
  for (const other of all) {
    if (other.id === post.id) continue
    const reason = reasonFor(post, other)
    if (reason) found.push({ rank: reason.rank, related: { post: other, why: reason.why } })
  }
  return found
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_RELATED)
    .map((f) => f.related)
}
