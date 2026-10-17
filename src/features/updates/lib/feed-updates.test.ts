// Which live updates are hers, on the feed: one of her roadmaps has the institution (or the update
// is for all of them), her country, when the update names one, and the topic, when it names one
// (a course in the field, or the field among her stated interests). Pure.

import { describe, expect, it } from 'bun:test'
import { ALL_INSTITUTIONS, ALL_TOPICS, type AudienceRule } from './audience'
import { type FeedRoadmap, feedUpdates } from './feed-updates'
import { DEMO_DRAFT, type StoredUpdate } from './update'

const update = (
  id: string,
  institution: string,
  homeCountry: string | null = null,
  status: StoredUpdate['status'] = 'live',
  topic: AudienceRule['topic'] = ALL_TOPICS,
): StoredUpdate => ({
  ...DEMO_DRAFT,
  id,
  status,
  institution,
  title: `Update ${id}`,
  audience: { institution, homeCountry, topic },
})

const roadmap = (
  id: string,
  universities: string[],
  country: string | null = 'India',
  topics: Partial<Pick<FeedRoadmap, 'courseTopics' | 'interestTopics' | 'hasRoad'>> = {},
): FeedRoadmap => ({
  id,
  name: `Roadmap ${id}`,
  universities,
  country,
  courseTopics: [],
  interestTopics: [],
  hasRoad: true,
  ...topics,
})

/** A live update aimed at `topic`, for all institutions unless one is given. */
const aimed = (
  id: string,
  topic: AudienceRule['topic'],
  institution = ALL_INSTITUTIONS,
  homeCountry: string | null = null,
) => update(id, institution, homeCountry, 'live', topic)

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

  describe('by topic', () => {
    const course = (id: string) => roadmap(id, ['ECU'], 'India', { courseTopics: ['data'] })
    const drawn = (id: string) => roadmap(id, ['ECU'], 'India', { interestTopics: ['data'] })

    it('finds an update aimed at a topic a course on her roadmap is in, saying so', () => {
      const perth = { ...course('perth'), name: 'Perth' }
      const found = feedUpdates([aimed('u1', 'data')], [perth])
      expect(found.map((f) => [f.roadmapId, f.why])).toEqual([
        ['perth', 'Because Data science is on your roadmap "Perth"'],
      ])
    })

    it('finds one aimed at a topic she said she is drawn to, saying so', () => {
      const found = feedUpdates([aimed('u1', 'data')], [drawn('a')])
      expect(found.map((f) => [f.roadmapId, f.why])).toEqual([
        ['a', "Because you said you're drawn to Data science"],
      ])
    })

    it('gives it once, through a course match before an earlier interest match', () => {
      const found = feedUpdates([aimed('u1', 'data')], [drawn('a'), course('b')])
      expect(found.map((f) => f.roadmapId)).toEqual(['b'])
    })

    it('gives it once, through the first of two course matches', () => {
      const found = feedUpdates([aimed('u1', 'data')], [course('a'), course('b')])
      expect(found.map((f) => f.roadmapId)).toEqual(['a'])
    })

    it('finds nothing aimed at a topic she is neither on nor drawn to', () => {
      const other = roadmap('a', ['ECU'], 'India', {
        courseTopics: ['health'],
        interestTopics: ['design'],
      })
      expect(feedUpdates([aimed('u1', 'data')], [other])).toEqual([])
    })

    it('finds nothing when the topic matches but the country or the institution does not', () => {
      const nepal = aimed('u1', 'data', ALL_INSTITUTIONS, 'Nepal')
      expect(feedUpdates([nepal], [course('a'), drawn('b')])).toEqual([])
      expect(feedUpdates([aimed('u1', 'data', 'Monash')], [course('a'), drawn('b')])).toEqual([])
    })

    it('finds one that matches its institution, country and topic, saying why by the topic', () => {
      const found = feedUpdates([aimed('u1', 'data', 'ECU', 'India')], [course('a')])
      expect(found.map((f) => f.why)).toEqual([
        'Because Data science is on your roadmap "Roadmap a"',
      ])
    })

    it('finds one through a road-less roadmap only by her stated interest, for all institutions', () => {
      const roadless = roadmap('a', [], 'India', { interestTopics: ['data'], hasRoad: false })
      expect(feedUpdates([aimed('u1', 'data')], [roadless]).map((f) => f.why)).toEqual([
        "Because you said you're drawn to Data science",
      ])
      expect(feedUpdates([aimed('u1', 'health')], [roadless])).toEqual([])
      expect(feedUpdates([aimed('u1', 'data', ALL_INSTITUTIONS, 'Nepal')], [roadless])).toEqual([])
    })

    it('never finds an update for all topics, or for one institution, through a road-less roadmap', () => {
      const roadless = roadmap('a', ['ECU'], 'India', { interestTopics: ['data'], hasRoad: false })
      expect(feedUpdates([update('u1', ALL_INSTITUTIONS)], [roadless])).toEqual([])
      expect(feedUpdates([update('u1', 'ECU')], [roadless])).toEqual([])
      expect(feedUpdates([aimed('u1', 'data', 'ECU')], [roadless])).toEqual([])
    })

    it('never finds an update stored with a topic that is not one of the topics', () => {
      const stored = {
        ...update('u1', ALL_INSTITUTIONS),
        audience: { institution: ALL_INSTITUTIONS, homeCountry: null, topic: 'astrology' },
      } as unknown as StoredUpdate
      const drawn = roadmap('a', ['ECU'], 'India', { interestTopics: ['data'] })
      expect(feedUpdates([stored], [PERTH, drawn])).toEqual([])
    })

    it('reads an update stored without a topic as for all topics', () => {
      const stored = {
        ...update('u1', ALL_INSTITUTIONS),
        audience: { institution: ALL_INSTITUTIONS, homeCountry: null },
      } as unknown as StoredUpdate
      expect(feedUpdates([stored], [PERTH]).map((f) => f.why)).toEqual([
        'Because it applies to every student',
      ])
    })
  })
})
