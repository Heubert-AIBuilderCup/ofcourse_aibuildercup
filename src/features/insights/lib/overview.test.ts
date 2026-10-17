import { describe, expect, it } from 'bun:test'
import { DIMENSION_LABELS, DIMENSIONS } from '@/features/engine'
import { ALL_INSTITUTIONS, ALL_TOPICS, matchAudience } from '@/features/updates/lib/audience'
import {
  barRows,
  cacheShare,
  dimensionBars,
  evidenceTag,
  performanceRows,
  rankEvidenceGaps,
  updateReach,
} from './overview'

describe('rankEvidenceGaps', () => {
  it('ranks the claims by the students who saw each, most first, numbered from 1', () => {
    const gap = (claim: string, students: number) => ({
      claim,
      shown: 'Route step',
      evidence: { state: 'none' as const },
      students,
    })
    const ranked = rankEvidenceGaps([gap('b', 540), gap('a', 1284), gap('c', 962)])
    expect(ranked.map((g) => [g.rank, g.claim])).toEqual([
      [1, 'a'],
      [2, 'c'],
      [3, 'b'],
    ])
  })
})

describe('evidenceTag', () => {
  it('names the evidence state in one word, with its note after', () => {
    expect(evidenceTag({ state: 'none' })).toBe('No source')
    expect(evidenceTag({ state: 'weak', note: 'one 2024 listings sample' })).toBe(
      'Weak · one 2024 listings sample',
    )
    expect(evidenceTag({ state: 'out_of_date', note: 'survey 2021' })).toBe(
      'Out of date · survey 2021',
    )
    expect(evidenceTag({ state: 'conflicting', note: 'two sources' })).toBe(
      'Conflicting · two sources',
    )
    expect(evidenceTag({ state: 'weak' })).toBe('Weak')
  })
})

describe('barRows', () => {
  it('orders the rows by share, most first, each bar as wide as its share, held to 0–100', () => {
    const rows = barRows([
      { label: 'b', share: 27 },
      { label: 'a', share: 41 },
      { label: 'over', share: 140 },
      { label: 'under', share: -5 },
    ])
    expect(rows.map((r) => [r.label, r.width])).toEqual([
      ['over', '100%'],
      ['a', '41%'],
      ['b', '27%'],
      ['under', '0%'],
    ])
  })
})

describe('dimensionBars', () => {
  it('names every engine dimension by its label, ordered by the share weighting it high', () => {
    const shares = { cost: 68, time: 28, work: 47, pr: 54, location: 22, career: 39 }
    const bars = dimensionBars(shares)
    expect(bars).toHaveLength(DIMENSIONS.length)
    expect(bars.map((b) => b.label)).toEqual([
      DIMENSION_LABELS.cost,
      DIMENSION_LABELS.pr,
      DIMENSION_LABELS.work,
      DIMENSION_LABELS.career,
      DIMENSION_LABELS.time,
      DIMENSION_LABELS.location,
    ])
    expect(bars[0].width).toBe('68%')
  })
})

describe('cacheShare', () => {
  it('is the whole-number share of calls answered from the cache, and none with no calls', () => {
    expect(cacheShare({ calls: 200, cached: 124 })).toBe(62)
    expect(cacheShare({ calls: 3, cached: 1 })).toBe(33)
    expect(cacheShare({ calls: 0, cached: 0 })).toBeNull()
  })
})

describe('performanceRows', () => {
  const MOCK = [
    { title: 'Mock one', views: 100, saves: 10, completion: 70, intoStudio: 5 },
    { title: 'Mock two', views: 80, saves: 8, completion: 60, intoStudio: 4 },
  ]

  it('puts the mock figures beside the real live posts, by order, and keeps their titles', () => {
    const rows = performanceRows([{ id: 'p1', title: 'Real live post' }], MOCK)
    expect(rows).toEqual([
      { key: 'p1', title: 'Real live post', views: 100, saves: 10, completion: 70, intoStudio: 5 },
    ])
  })

  it('shows the mock rows when no post is live', () => {
    expect(performanceRows([], MOCK).map((r) => r.title)).toEqual(['Mock one', 'Mock two'])
  })

  it('shows no more live posts than there are mock figures', () => {
    const live = ['a', 'b', 'c'].map((id) => ({ id, title: id }))
    expect(performanceRows(live, MOCK).map((r) => r.key)).toEqual(['a', 'b'])
  })
})

describe('updateReach', () => {
  const FALLBACK = { title: 'ECU International Scholarship', matched: 412 }
  const students = [
    { id: 'a', name: 'A', homeCountry: 'Nepal', ranked: ['ecu-cyber'], interests: [] },
    { id: 'b', name: 'B', homeCountry: 'India', ranked: ['monash-data'], interests: [] },
    {
      id: 'c',
      name: 'C',
      homeCountry: 'India',
      ranked: ['ecu-cyber'],
      interests: ['data' as const],
    },
  ]

  it("is the latest live update's reach over the mock students", () => {
    const latest = {
      title: 'ECU grant',
      audience: { institution: 'ECU', homeCountry: null, topic: ALL_TOPICS },
    }
    expect(updateReach(latest, FALLBACK, students)).toEqual({ title: 'ECU grant', matched: 2 })
  })

  it("counts a topic's reach by the audience rule", () => {
    const audience = { institution: ALL_INSTITUTIONS, homeCountry: null, topic: 'data' as const }
    const reach = updateReach({ title: 'Data grant', audience }, FALLBACK, students)
    expect(reach.matched).toBe(matchAudience(audience, students).length)
    expect(reach.matched).toBe(2)
  })

  it('is the mock reach while no update is live', () => {
    expect(updateReach(null, FALLBACK, students)).toEqual(FALLBACK)
  })
})
