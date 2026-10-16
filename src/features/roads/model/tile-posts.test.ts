// Which posts and updates belong to which tile (criteria 44-47). Pure.

import { describe, expect, it } from 'bun:test'
import type { FeedPost } from '@/features/content/lib/feed'
import { courseById } from '../data/courses'
import { roadById } from '../data/roads'
import { specById } from './compose'
import { herCountry, type LiveUpdate, tilePosts } from './tile-posts'

const SPEC = roadById('perth-cyber')
if (!SPEC) throw new Error('perth-cyber road missing')

const post = (id: string, over: Partial<FeedPost> = {}): FeedPost =>
  ({ id, title: `Post ${id}`, courseId: null, tags: [], ...over }) as FeedPost

const university = (courseId: string) => courseById(courseId)?.university ?? ''

const update = (
  id: string,
  institution: string,
  homeCountry: string | null = null,
  status: string = 'live',
): LiveUpdate =>
  ({
    id,
    status,
    institution,
    title: `Update ${id}`,
    body: `Body ${id}`,
    audience: { institution, homeCountry },
  }) as LiveUpdate

describe('tilePosts: comics', () => {
  it('puts a comic about a course on that course tile, with its link and reason', () => {
    const result = tilePosts(
      SPEC,
      {
        posts: [
          post('c1', { courseId: SPEC.courseId }),
          post('c2', { courseId: SPEC.altCourseId }),
          post('c3', { courseId: SPEC.stackCourseId }),
        ],
        updates: [],
      },
      null,
    )
    expect(result[SPEC.slots.course.id]).toEqual([
      {
        kind: 'post',
        id: 'c1',
        title: 'Post c1',
        href: '/feed/c1',
        why: 'A comic about this course',
      },
    ])
    expect(result[SPEC.slots['alt-course'].id]?.[0]?.href).toBe('/feed/c2')
    expect(result[SPEC.slots['stack-course'].id]?.[0]?.href).toBe('/feed/c3')
  })
})

describe('tilePosts: updates', () => {
  const uni = university(SPEC.courseId)

  it("puts an update for the course's university on its tile, with its body and no link", () => {
    const result = tilePosts(SPEC, { posts: [], updates: [update('u1', uni)] }, null)
    expect(result[SPEC.slots.course.id]).toEqual([
      {
        kind: 'update',
        id: 'u1',
        title: 'Update u1',
        href: null,
        why: `Update from ${uni}`,
        body: 'Body u1',
      },
    ])
  })

  it("keeps an update for her country and drops another country's", () => {
    const result = tilePosts(
      SPEC,
      { posts: [], updates: [update('mine', uni, 'Nepal'), update('other', uni, 'India')] },
      'Nepal',
    )
    expect(result[SPEC.slots.course.id]?.map((p) => p.title)).toEqual(['Update mine'])
  })

  it('drops a country-specific update when she has not said where she is from', () => {
    const result = tilePosts(SPEC, { posts: [], updates: [update('u', uni, 'Nepal')] }, null)
    expect(result[SPEC.slots.course.id]).toBeUndefined()
  })

  it('ignores a draft or in-review update passed by mistake', () => {
    const result = tilePosts(
      SPEC,
      {
        posts: [],
        updates: [update('d', uni, null, 'draft'), update('r', uni, null, 'in_review')],
      },
      null,
    )
    expect(result[SPEC.slots.course.id]).toBeUndefined()
  })
})

describe('tilePosts: Australia', () => {
  it('puts posts tagged destination:AU on the australia tile', () => {
    const result = tilePosts(
      SPEC,
      { posts: [post('au', { tags: ['destination:AU'] }), post('other')], updates: [] },
      null,
    )
    expect(result[SPEC.slots.australia.id]).toEqual([
      {
        kind: 'post',
        id: 'au',
        title: 'Post au',
        href: '/feed/au',
        why: 'For students heading to Australia',
      },
    ])
  })
})

describe('tilePosts: limits and keys', () => {
  it('keeps at most three per tile: comics first, then updates, each in the order given', () => {
    const uni = university(SPEC.courseId)
    const result = tilePosts(
      SPEC,
      {
        posts: [post('c1', { courseId: SPEC.courseId }), post('c2', { courseId: SPEC.courseId })],
        updates: [update('u1', uni), update('u2', uni)],
      },
      null,
    )
    expect(result[SPEC.slots.course.id]?.map((p) => p.title)).toEqual([
      'Post c1',
      'Post c2',
      'Update u1',
    ])
  })

  it('gives a tile with nothing no key, and city tiles never one', () => {
    const result = tilePosts(
      SPEC,
      { posts: [post('c1', { courseId: SPEC.courseId })], updates: [] },
      null,
    )
    expect(Object.keys(result)).toEqual([SPEC.slots.course.id])
    expect(result[SPEC.slots.city.id]).toBeUndefined()
    expect(tilePosts(SPEC, { posts: [], updates: [] }, null)).toEqual({})
  })
})

describe('herCountry', () => {
  it('is the country she said she is from', () => {
    expect(herCountry({ where: { value: 'Nepal', state: 'stated' } })).toBe('Nepal')
  })

  it('is none when she said "Not sure" (an assumed default) or nothing', () => {
    expect(herCountry({ where: { value: 'Nepal', state: 'assumed' } })).toBeNull()
    expect(herCountry({})).toBeNull()
  })
})

describe('tilePosts on a composed road (criterion 56)', () => {
  const NURSING = specById('adelaide-unisa-nursing-stay')
  if (!NURSING) throw new Error('adelaide-unisa-nursing-stay missing')

  it('puts a comic about its own course on its course tile, and an update from its university', () => {
    const result = tilePosts(
      NURSING,
      {
        posts: [post('n1', { courseId: NURSING.courseId }), post('x1', { courseId: 'ecu-cyber' })],
        updates: [update('u1', university(NURSING.courseId))],
      },
      null,
    )
    expect(result[NURSING.slots.course.id]?.map((p) => p.id)).toEqual(['n1', 'u1'])
    expect(
      Object.values(result)
        .flat()
        .some((p) => p.id === 'x1'),
    ).toBe(false)
  })
})
