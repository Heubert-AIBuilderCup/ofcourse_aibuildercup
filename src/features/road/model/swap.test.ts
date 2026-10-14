import { describe, expect, it } from 'bun:test'
import { getRoad } from './road-data'
import { buildScene, NEW_SESSION } from './scene'
import { swapFrame } from './swap'

const road = getRoad()
const before = buildScene(road, NEW_SESSION)
const after = buildScene(road, { ...NEW_SESSION, swapped: true })
const at = (k: number, id: string) => {
  const t = swapFrame(before, after, k).tiles.find((x) => x.id === id)!
  return [t.gx, t.gy]
}
const CYBER = 'cyber-security-ecu-perth'
const DS = 'data-science-uwa-perth'

describe('swapFrame: the two tiles passing each other on the arc', () => {
  it('starts where they were and ends where they go', () => {
    expect(at(0, DS)).toEqual([7.2, -2.6])
    expect(at(1, DS)).toEqual([7.2, 0])
    expect(at(0, CYBER)).toEqual([7.2, 0])
    expect(at(1, CYBER)).toEqual([7.2, -2.6])
  })

  it('bows them apart halfway, so they never overlap', () => {
    const [dx] = at(0.5, DS)
    const [cx] = at(0.5, CYBER)
    expect(Math.abs(dx - cx)).toBeGreaterThan(2 * 0.72)
  })

  it('leaves every tile that does not move where it is', () => {
    const mid = swapFrame(before, after, 0.5)
    expect(mid.tiles.find((t) => t.id === 'perth')).toEqual(
      after.tiles.find((t) => t.id === 'perth'),
    )
    expect(mid.here).toBe(after.here)
  })
})
