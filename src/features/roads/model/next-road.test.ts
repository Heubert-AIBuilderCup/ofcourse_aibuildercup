// The road a new roadmap around a tile would draw, as the board needs it to turn into it: the new
// road's steps ahead on this board's tiles, and its options beside them. Built on the server.

import { describe, expect, it } from 'bun:test'
import { alternativeForCourse } from '@/features/finder/model/compare'
import { roadById } from '../data/roads'
import type { RoadSpec } from '../data/types'
import { buildRoad } from './build'
import { nextRoad } from './next-road'

const perth = roadById('perth-cyber') as RoadSpec
const sydney = alternativeForCourse(perth, 'uts-cyber') as RoadSpec
const answers = {}
const after = buildRoad(sydney, { answers })
const tileOf = (id: string) => after.tiles.find((t) => t.id === id)

const AHEAD = [
  'visa-500',
  'course-years',
  'visa-485',
  'fork',
  'pr-straight',
  'pr-point',
  'pr-lane',
  'pr-lane-end',
] as const

describe('nextRoad', () => {
  const next = nextRoad(perth, sydney, answers)

  it('names each step ahead, in road order, on the tile that holds its slot on this board', () => {
    expect(next.ahead.map((s) => s.id)).toEqual(AHEAD.map((slot) => perth.slots[slot].id))
    expect(next.ahead.map((s) => [s.name, s.short, s.when, s.kind])).toEqual(
      AHEAD.map((slot) => {
        const t = tileOf(sydney.slots[slot].id)
        return [t?.name, t?.short, t?.when, t?.kind]
      }),
    )
  })

  it('carries the new road’s options and jobs, each beside this board’s step', () => {
    const options = after.tiles.filter((t) => t.beside)
    expect(options.length).toBeGreaterThan(0)
    expect(next.options.map((t) => [t.id, t.gx, t.gy, t.name])).toEqual(
      options.map((t) => [t.id, t.gx, t.gy, t.name]),
    )
    const mine = new Map(AHEAD.map((slot) => [sydney.slots[slot].id, perth.slots[slot].id]))
    expect(next.options.map((t) => t.beside)).toEqual(options.map((t) => mine.get(t.beside ?? '')))
  })
})
