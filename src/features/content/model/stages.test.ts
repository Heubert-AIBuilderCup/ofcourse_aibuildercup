import { describe, expect, it } from 'bun:test'
import { STAGE_LABELS, STAGES } from './stages'

describe('STAGE_LABELS', () => {
  it('names every stage in the step words the editor knows, never Structures (GD25)', () => {
    expect(STAGE_LABELS).toEqual({
      source: 'Source',
      structures: 'Text',
      approved: 'Images',
      rendered: 'Settings',
      in_review: 'Review',
      ready: 'Review',
      live: 'Live',
      exported: 'Live',
    })
    expect(Object.keys(STAGE_LABELS).sort()).toEqual([...STAGES].sort())
  })
})
