// The checks every road must pass, hand-written or composed (criterion 55): Priya's shape, unique
// and resolvable ids, a card for every tile, the board's trade-off words, the catalogue's figures,
// no one's name and nothing ranked, and a scene and a card for every choice she can have made.
// Shared by build.test.ts and compose.test.ts.

import { expect } from 'bun:test'
import { cityById } from '@/features/engine/catalogue'
import { PRIYA } from '@/features/road/model/fixture'
import { cardFor } from '@/features/road/model/press'
import type { Road, Tile } from '@/features/road/model/road-data'
import { buildScene, sessionFrom } from '@/features/road/model/scene'
import { courseById } from '../data/courses'
import { entryOf } from '../data/entry'
import { type RoadSpec, SLOTS, type SlotCopy } from '../data/types'
import { slotOf } from './build'

const KEPT = [
  'kind',
  'state',
  'gx',
  'gy',
  'gx1',
  'gy1',
  'w',
  'sz',
  'lab',
  'level',
  'branch',
  'inStack',
] as const
const geometry = (t: Tile) => Object.fromEntries(KEPT.map((k) => [k, t[k]]))

/** Every tile id the road refers to outside its tiles. */
function referencedIds(road: Road): string[] {
  const { walk, arrival } = road
  const arrivalIds = Object.values(arrival.walk).flatMap((v) =>
    typeof v === 'string' ? [v] : Array.isArray(v) ? v : [],
  )
  return [
    walk.here,
    walk.alternative,
    walk.courseStep,
    ...walk.lit,
    ...walk.next,
    ...walk.ahead,
    ...walk.cityLine,
    ...walk.courseLine,
    ...walk.levelIds,
    ...walk.rows,
    arrival.hint,
    ...arrivalIds,
    ...Object.keys(arrival.tiles),
    ...road.lesson.tileIds,
    ...road.stackRows.flatMap((r) => (r.tileId ? [r.tileId] : [])),
  ]
}

const BOOLS = [false, true]
/** The 32 combinations of what she can have done on the board. */
export const COMBINATIONS = BOOLS.flatMap((swapped) =>
  BOOLS.flatMap((added) =>
    BOOLS.flatMap((read) =>
      BOOLS.flatMap((city) => BOOLS.map((country) => ({ swapped, added, read, city, country }))),
    ),
  ),
)

export function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

const FEES = /AUD (\d+)k a year in fees/g
const LIVING = /AUD (\d+)k a year to live/g
const figures = (slot: SlotCopy, re: RegExp) =>
  [...JSON.stringify(slot).matchAll(re)].map((m) => Number(m[1]))

/** A course's fees and a city's living costs read as the catalogue has them. */
export function expectCatalogueFigures(spec: RoadSpec): void {
  const courses = [
    ['course', spec.courseId],
    ['alt-course', spec.altCourseId],
    ['stack-course', spec.stackCourseId],
  ] as const
  for (const [slot, courseId] of courses) {
    const fees = figures(spec.slots[slot], FEES)
    expect(fees.length).toBeGreaterThan(0)
    for (const fee of fees) expect(fee).toBe(courseById(courseId)?.feeK as number)
  }
  const cities = [
    ['city', spec.cityId],
    ['alt-city', spec.altCityId],
  ] as const
  for (const [slot, cityId] of cities) {
    for (const living of figures(spec.slots[slot], LIVING))
      expect(living).toBe(cityById(cityId).livingK)
  }
}

/** The road built from a spec keeps every rule the board's roads keep. */
export function expectSound(road: Road, spec: RoadSpec): void {
  const ids = road.tiles.map((t) => t.id)

  // Priya's shape: every tile's kind, state, place and label; the options beside its steps follow
  // them, each beside a tile of that shape.
  const shaped = road.tiles.filter((t) => !t.beside)
  expect(shaped.map(geometry)).toEqual(PRIYA.tiles.map(geometry))
  for (const t of road.tiles.slice(shaped.length))
    expect(shaped.map((s) => s.id)).toContain(t.beside as string)

  // Every tile its own id, and no reference to any other.
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of referencedIds(road)) expect(ids).toContain(id)
  for (const slot of SLOTS) expect(slotOf(spec, spec.slots[slot].id)).toBe(slot)

  // A card for every tile, and the card where she is for the five places she can stand.
  for (const id of ids) expect(road.cards[id]).toBeDefined()
  for (const slot of ['point-a', 'australia', 'city', 'course', 'alt-course'] as const) {
    expect(road.here[spec.slots[slot].id]).toBeDefined()
  }
  for (const key of Object.keys(road.here)) expect(ids).toContain(key)
  for (const t of road.tiles) if (t.routeId) expect(t.routeId).toBe(t.id)

  expect(slotOf(spec, 'no-such-tile')).toBeNull()
  expect(road.cards[spec.slots['course-years'].id].lesson).toBe(road.lesson.id)

  // A scene and a card for every choice she can have made.
  for (const choices of COMBINATIONS) {
    const scene = buildScene(road, sessionFrom(choices, false))
    for (const id of [...ids, null]) expect(() => cardFor(road, scene, id)).not.toThrow()
  }

  // Trade-offs in the board's words.
  const trades = [...road.tiles, ...Object.values(road.cards), ...Object.values(road.here)]
  for (const x of trades) {
    if (x.gains) expect(x.gains).toMatch(/^Good for: \S/)
    if (x.costs) expect(x.costs).toMatch(/^Less good for: \S/)
    for (const s of [x.gains, x.costs].filter(Boolean)) {
      expect(s).not.toMatch(/\b(Cost|Time|Work|Place|Career|Location)\b|\bpr\b/)
    }
  }
  for (const s of strings(road)) expect(s).not.toMatch(/your road(?!map)/i)

  // Fees equal to the catalogue, on the tile and in the copy.
  expect(road.tiles.find((t) => t.id === spec.slots.course.id)?.fees).toBe(
    courseById(spec.courseId)?.feeK as number,
  )
  expectCatalogueFigures(spec)

  // No one and nothing of Priya's, and nothing ranked.
  expect(JSON.stringify(road)).not.toMatch(/Anjali|Cannington|Priya|business degree|UWA/)

  // The English badge names the course's own score, and no other score is said anywhere.
  const ielts = Number(entryOf(spec.courseId)?.ielts).toFixed(1)
  expect(road.badges.ielts.value).toContain(`IELTS ${ielts} overall`)
  for (const [score] of JSON.stringify(road).matchAll(/IELTS \d\.\d/g)) {
    expect(score).toBe(`IELTS ${ielts}`)
  }
  // "leading Teams" is a unit's name the copy quotes ("units such as … leading Teams"), not a rank.
  expect(JSON.stringify(spec)).not.toMatch(
    /\b([Bb]iggest|[Hh]ighest|[Ll]argest|[Ll]owest|[Cc]heapest|[Bb]est|[Tt]op|[Mm]ost|[Ll]eading(?! [A-Z])|[Nn]umber one|[Ff]astest)\b/,
  )
}
