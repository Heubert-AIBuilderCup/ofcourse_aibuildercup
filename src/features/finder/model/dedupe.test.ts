import { describe, expect, test } from 'bun:test'
import { dropNearDuplicates } from './dedupe'

/** A 2-d vector at cosine `cos` from [1, 0], scaled by `length`. */
const at = (cos: number, length = 1) => [cos * length, Math.sqrt(1 - cos * cos) * length]

describe('dropNearDuplicates', () => {
  test('keeps the first of a pair over the threshold, whatever the vectors’ lengths', () => {
    const { kept, dropped } = dropNearDuplicates(['a', 'b'], [at(1, 2), at(0.96, 3)], 0.95)
    expect(kept).toEqual(['a'])
    expect(dropped.map((d) => `${d.id}~${d.keptId}`)).toEqual(['b~a'])
    expect(dropped[0].similarity).toBeCloseTo(0.96, 6)
  })

  test('the first in input order is the one kept', () => {
    const { kept } = dropNearDuplicates(['b', 'a'], [at(0.96), at(1)], 0.95)
    expect(kept).toEqual(['b'])
  })

  test('keeps both of a pair at 0.94', () => {
    const { kept, dropped } = dropNearDuplicates(['a', 'b'], [at(1), at(0.94)], 0.95)
    expect(kept).toEqual(['a', 'b'])
    expect(dropped.length).toBe(0)
  })

  test('keeps the rest in input order', () => {
    const { kept } = dropNearDuplicates(
      ['c', 'a', 'x', 'b'],
      [
        [0, 0, 1],
        [1, 0, 0],
        [0.97, 0.243, 0],
        [0, 1, 0],
      ],
      0.95,
    )
    expect(kept).toEqual(['c', 'a', 'b'])
  })
})
