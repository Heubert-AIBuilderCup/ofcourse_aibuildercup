import { describe, expect, test } from 'bun:test'
import { FIELD_EDGES, FIELDS } from './fields'

const niche = FIELDS.filter((f) => f.niche)

describe('the field graph', () => {
  test('every field id is unique', () => {
    const ids = FIELDS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every edge runs between fields that exist', () => {
    const ids = new Set(FIELDS.map((f) => f.id))
    const loose = FIELD_EDGES.flatMap((e) => [e.from, e.to]).filter((id) => !ids.has(id))
    expect(loose).toEqual([])
  })

  test('every niche field has a definition of at most 140 characters', () => {
    const long = niche.filter((f) => f.definition.length > 140).map((f) => f.id)
    expect(long).toEqual([])
  })

  test('every niche field has at least one edge', () => {
    const linked = new Set(FIELD_EDGES.flatMap((e) => [e.from, e.to]))
    const alone = niche.filter((f) => !linked.has(f.id)).map((f) => f.id)
    expect(alone).toEqual([])
  })

  test('there are at least twelve niche fields', () => {
    expect(niche.length).toBeGreaterThanOrEqual(12)
  })
})
