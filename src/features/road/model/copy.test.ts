import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getRoad } from './road-data'

const road = getRoad()

/** Every string the fixture shows: tiles, cards, the card where she is, the lesson and its toast. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}
const shown = strings([
  road.tiles,
  road.cards,
  road.here,
  road.lesson,
  road.stackRows,
  road.badges,
  road.overview,
  road.arrival.line,
])

const trades = [...road.tiles, ...Object.values(road.cards), ...Object.values(road.here)]
const gains = trades.flatMap((x) => (x.gains ? [x.gains] : []))
const costs = trades.flatMap((x) => (x.costs ? [x.costs] : []))

describe('the board’s copy', () => {
  it('reads trade-offs in plain words, with no arrows', () => {
    for (const s of shown) {
      expect(s).not.toMatch(/▲|▼|Strong on|Costs you on/)
    }
  })

  it('says "your roadmap", never "your road"', () => {
    for (const s of shown) expect(s).not.toMatch(/your road(?!map)/i)
  })

  it('says "your roadmap" in the feature’s own source too: its copy and accessible names', () => {
    const root = join(import.meta.dir, '..')
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(
      (f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f),
    )
    expect(files.length).toBeGreaterThan(0)
    const left = files.filter((f) =>
      /your road(?!map)/i.test(readFileSync(join(root, f), 'utf8').replace(/whole road/gi, '')),
    )
    expect(left).toEqual([])
  })

  it('puts what a tile is good for and less good for in two fields', () => {
    expect(gains.length).toBeGreaterThan(0)
    expect(costs.length).toBeGreaterThan(0)
    for (const g of gains) expect(g).toMatch(/^Good for/)
    for (const c of costs) expect(c).toMatch(/^Less good for/)
    expect(road.tiles.find((t) => t.id === 'cyber-security-ecu-perth')).toMatchObject({
      gains: 'Good for: PR, career',
      costs: 'Less good for: location',
    })
  })

  it('lower-cases the criteria and keeps PR upper-case', () => {
    for (const s of [...gains, ...costs]) {
      expect(s).not.toMatch(/\b(Cost|Time|Work|Place|Career|Location)\b/)
      expect(s).not.toMatch(/\bpr\b/)
    }
  })

  it('tells her where she is what it is good for of what matters most to her', () => {
    expect(road.here[road.walk.here].gains).toStartWith('Good for what matters most to you:')
  })
})
