import { describe, expect, it } from 'bun:test'
import { roadLines } from './drawing'
import { getRoad } from './road-data'
import { buildScene, NEW_SESSION, type Session } from './scene'

const road = getRoad()
const cam = { u: 40, ox: 0, oy: 0 }
const ids = (session: Partial<Session>) =>
  roadLines(buildScene(road, { ...NEW_SESSION, ...session }), cam).map((r) => r.id)

describe('roadLines', () => {
  it('names each line once, also when no level is open (the first arrival)', () => {
    for (const session of [{}, { first: true }, { city: true }, { swapped: true, added: true }]) {
      const all = ids(session)
      expect(new Set(all).size).toBe(all.length)
    }
  })
})
