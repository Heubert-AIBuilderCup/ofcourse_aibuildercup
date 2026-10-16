// Which live updates are hers, on the feed: one of her roadmaps has the institution (or the update
// is for all of them) and her country, when the update names one. Pure.

import { describe, expect, it } from 'bun:test'
import { ALL_INSTITUTIONS } from './audience'
import { type FeedRoadmap, feedUpdates } from './feed-updates'
import { DEMO_DRAFT, type StoredUpdate } from './update'

const update = (
  id: string,
  institution: string,
  homeCountry: string | null = null,
  status: StoredUpdate['status'] = 'live',
): StoredUpdate => ({
  ...DEMO_DRAFT,
  id,
  status,
  institution,
  title: `Update ${id}`,
  audience: { institution, homeCountry },
})

const roadmap = (
  id: string,
  universities: string[],
  country: string | null = 'India',
): FeedRoadmap => ({ id, name: `Roadmap ${id}`, universities, country })

const PERTH = roadmap('perth', ['ECU', 'Curtin', 'UWA'])
const ids = (found: { update: { id: string } }[]) => found.map((f) => f.update.id)

describe('feedUpdates', () => {
  it('finds an update from the institution of her main course, with the card fields and why', () => {
    expect(feedUpdates([update('u1', 'ECU')], [PERTH])).toEqual([
      {
        update: {
          id: 'u1',
          kind: DEMO_DRAFT.kind,
          category: DEMO_DRAFT.category,
          institution: 'ECU',
          title: 'Update u1',
          body: DEMO_DRAFT.body,
          applyBy: DEMO_DRAFT.applyBy,
          sourceTitle: DEMO_DRAFT.sourceTitle,
          sourceCheckedAt: DEMO_DRAFT.sourceCheckedAt,
        },
        roadmapId: 'perth',
        why: 'Because ECU is on your roadmap "Roadmap perth"',
      },
    ])
  })

  it('finds one from the institution of her alternative course', () => {
    const [found] = feedUpdates([update('u1', 'Curtin')], [PERTH])
    expect(found?.why).toBe('Because Curtin is on your roadmap "Roadmap perth"')
  })

  it('finds nothing from an institution on none of her roadmaps', () => {
    expect(feedUpdates([update('u1', 'Monash')], [PERTH])).toEqual([])
  })

  it('finds an update for all institutions, for every student or for her country', () => {
    const found = feedUpdates(
      [update('all', ALL_INSTITUTIONS), update('india', ALL_INSTITUTIONS, 'India')],
      [PERTH],
    )
    expect(found.map((f) => f.why)).toEqual([
      'Because it applies to every student',
      'Because it applies to every student from India',
    ])
  })

  it('finds nothing aimed at another country, or at one when she has not stated hers', () => {
    expect(feedUpdates([update('u1', 'ECU', 'Nepal')], [PERTH])).toEqual([])
    expect(feedUpdates([update('u1', ALL_INSTITUTIONS, 'Nepal')], [PERTH])).toEqual([])
    const unstated = roadmap('unstated', ['ECU'], null)
    expect(feedUpdates([update('u1', 'ECU', 'India')], [unstated])).toEqual([])
    expect(feedUpdates([update('u1', 'ECU')], [unstated]).length).toBe(1)
  })

  it('gives one entry for an update two roadmaps match, through the first of them', () => {
    const found = feedUpdates([update('u1', 'ECU')], [roadmap('a', ['ECU']), roadmap('b', ['ECU'])])
    expect(found.map((f) => f.roadmapId)).toEqual(['a'])
  })

  it('picks the first roadmap that matches the country too', () => {
    const found = feedUpdates(
      [update('u1', 'ECU', 'Nepal')],
      [roadmap('a', ['ECU']), roadmap('b', ['ECU'], 'Nepal')],
    )
    expect(found.map((f) => f.roadmapId)).toEqual(['b'])
  })

  it('finds no update that is not live', () => {
    expect(
      feedUpdates(
        [update('d', 'ECU', null, 'draft'), update('r', 'ECU', null, 'in_review')],
        [PERTH],
      ),
    ).toEqual([])
  })

  it('keeps the order the updates were given in', () => {
    const found = feedUpdates(
      [update('u3', 'UWA'), update('u1', ALL_INSTITUTIONS), update('u2', 'ECU')],
      [PERTH],
    )
    expect(ids(found)).toEqual(['u3', 'u1', 'u2'])
  })

  it('finds nothing without a roadmap', () => {
    expect(feedUpdates([update('u1', ALL_INSTITUTIONS)], [])).toEqual([])
  })
})
