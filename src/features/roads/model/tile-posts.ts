// Which posts and updates belong to which tile (criteria 44-47): a live comic about a course sits
// on that course's tile, a live update from its university (for her country, or for all) on the
// same tile (aimed at a topic, only on a course in that field), and posts tagged for Australia on
// the Australia tile. At most three a tile; a tile with nothing has no key, so city tiles never
// get one. Nothing is ranked. Pure.

import type { FeedPost } from '@/features/content/lib/feed'
import { ALL_TOPICS, audienceOf } from '@/features/updates/lib/audience'
import { FEED_PATH } from '@/shared/lib/auth/gate'
import type { StoredAnswers } from '@/shared/types/student'
import { courseById } from '../data/courses'
import type { RoadSpec, SlotId } from '../data/types'

/** A live `admin_update` row, as far as a tile needs it. */
export type LiveUpdate = {
  id: string
  status: 'live'
  institution: string
  title: string
  body: string
  /** No `topic` on an update stored before topics: it reads as all topics. */
  audience: { institution: string; homeCountry: string | null; topic?: string }
}

export type TilePost = {
  kind: 'post' | 'update'
  id: string
  title: string
  href: string | null
  why: string
  body?: string
}

const PER_TILE = 3
const COURSE_SLOTS = [
  ['course', 'courseId'],
  ['alt-course', 'altCourseId'],
  ['stack-course', 'stackCourseId'],
] as const satisfies readonly (readonly [SlotId, keyof RoadSpec])[]

const postHref = (post: FeedPost) => `${FEED_PATH}/${post.id}`

/**
 * Her home country, as `where` stores it; null when she has not said ("Not sure" stores an assumed
 * default, which is not hers), so an update aimed at one country is not hers.
 */
export function herCountry(answers: StoredAnswers): string | null {
  const where = answers.where
  return where?.state === 'stated' && typeof where.value === 'string' ? where.value : null
}

/** The posts and updates for each tile of this road, by tile id; `where` is herCountry. */
export function tilePosts(
  spec: RoadSpec,
  input: { posts: FeedPost[]; updates: LiveUpdate[] },
  where: string | null,
): Record<string, TilePost[]> {
  const result: Record<string, TilePost[]> = {}
  const put = (slot: SlotId, found: TilePost[]) => {
    if (found.length) result[spec.slots[slot].id] = found.slice(0, PER_TILE)
  }

  for (const [slot, key] of COURSE_SLOTS) {
    const courseId = spec[key]
    const course = courseById(courseId)
    const comics = input.posts
      .filter((p) => p.courseId === courseId)
      .map(
        (p): TilePost => ({
          kind: 'post',
          id: p.id,
          title: p.title,
          href: postHref(p),
          why: 'A comic about this course',
        }),
      )
    const updates = input.updates
      .filter((u) => {
        const topic = audienceOf(u.audience).topic
        return (
          u.status === 'live' &&
          u.audience.institution === course?.university &&
          (u.audience.homeCountry === null || u.audience.homeCountry === where) &&
          (topic === ALL_TOPICS || topic === course?.field)
        )
      })
      .map(
        (u): TilePost => ({
          kind: 'update',
          id: u.id,
          title: u.title,
          href: null,
          why: `Update from ${u.audience.institution}`,
          body: u.body,
        }),
      )
    put(slot, [...comics, ...updates])
  }

  put(
    'australia',
    input.posts
      .filter((p) => p.tags.includes('destination:AU'))
      .map(
        (p): TilePost => ({
          kind: 'post',
          id: p.id,
          title: p.title,
          href: postHref(p),
          why: 'For students heading to Australia',
        }),
      ),
  )
  return result
}
