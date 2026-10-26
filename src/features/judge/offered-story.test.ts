// The one story the student sign-in page offers the judges: Priya, because her board demos every
// action with the production switches on (judge-access.md). A catalogue change that takes a
// working "Start a new roadmap from it" or the related courses off her board fails here.

import { describe, expect, test } from 'bun:test'
import { compareByTile } from '@/features/finder/model/compare'
import { OFFERED_JUDGE_STORIES, roadFor } from '@/features/roads'

const [priya] = OFFERED_JUDGE_STORIES
const r = roadFor({ answers: priya.answers, relative: priya.relative }, {})
const compared = compareByTile(r.spec!, priya.answers)

describe('the story offered to the judges', () => {
  test('is Priya alone', () => {
    expect(OFFERED_JUDGE_STORIES.map((s) => s.id)).toEqual(['priya'])
  })

  test('every city and course beside her road starts a new roadmap: none is a dead end', () => {
    const unpinned = Object.entries(compared).filter(([, c]) => c.pin === null)
    expect(`${Object.keys(compared).length} tiles, unpinned: ${unpinned.map(([id]) => id)}`).toBe(
      '6 tiles, unpinned: ',
    )
  })

  test('"What changes" differs in money and jobs beside her, and in work rights and PR further off', () => {
    const changed = new Set<string>(
      Object.values(compared).flatMap((c) => c.rows.filter((x) => x.changed).map((x) => x.key)),
    )
    expect(['money', 'time', 'pr', 'career'].filter((k) => !changed.has(k))).toEqual([])
  })

  test('her stack lists several courses', () => {
    expect(r.road.stackRows.length).toBeGreaterThanOrEqual(3)
  })
})
