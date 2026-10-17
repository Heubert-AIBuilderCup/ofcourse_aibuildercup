import { describe, expect, test } from 'bun:test'
import { seedPlan } from './seed-plan'

const M = 'model-a'

describe('seedPlan', () => {
  test('a course not yet stored is embedded', () => {
    const plan = seedPlan([{ id: 'a', textHash: 'h1' }], [], M)
    expect(plan).toEqual({ embed: ['a'], keep: [], remove: [] })
  })

  test('a course whose text changed is embedded again', () => {
    const plan = seedPlan(
      [{ id: 'a', textHash: 'h2' }],
      [{ id: 'a', textHash: 'h1', embeddingModel: M }],
      M,
    )
    expect(plan).toEqual({ embed: ['a'], keep: [], remove: [] })
  })

  test('a course embedded by another model is embedded again', () => {
    const plan = seedPlan(
      [{ id: 'a', textHash: 'h1' }],
      [{ id: 'a', textHash: 'h1', embeddingModel: 'model-old' }],
      M,
    )
    expect(plan).toEqual({ embed: ['a'], keep: [], remove: [] })
  })

  test('a course with the same text and model is kept', () => {
    const plan = seedPlan(
      [{ id: 'a', textHash: 'h1' }],
      [{ id: 'a', textHash: 'h1', embeddingModel: M }],
      M,
    )
    expect(plan).toEqual({ embed: [], keep: ['a'], remove: [] })
  })

  test('a stored course no longer in the catalogue is removed', () => {
    const plan = seedPlan(
      [{ id: 'a', textHash: 'h1' }],
      [
        { id: 'a', textHash: 'h1', embeddingModel: M },
        { id: 'gone', textHash: 'h9', embeddingModel: M },
      ],
      M,
    )
    expect(plan).toEqual({ embed: [], keep: ['a'], remove: ['gone'] })
  })

  test('each list keeps its input order', () => {
    const plan = seedPlan(
      [
        { id: 'c', textHash: 'new' },
        { id: 'a', textHash: 'h1' },
        { id: 'b', textHash: 'h2' },
      ],
      [
        { id: 'z', textHash: 'x', embeddingModel: M },
        { id: 'b', textHash: 'h2', embeddingModel: M },
        { id: 'a', textHash: 'h1', embeddingModel: M },
        { id: 'y', textHash: 'x', embeddingModel: M },
      ],
      M,
    )
    expect(plan).toEqual({ embed: ['c'], keep: ['a', 'b'], remove: ['z', 'y'] })
  })
})
