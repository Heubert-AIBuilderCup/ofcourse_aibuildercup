// Start a new roadmap from it: the road ahead turns into the new roadmap's, step by step in road
// order, its options and jobs with it; then the course traded onto the road takes her place.

import { describe, expect, it } from 'bun:test'
import { getRoad, type Tile } from './road-data'
import { buildScene, NEW_SESSION } from './scene'
import {
  MORPH_FADE_MS,
  MORPH_STAGGER_MS,
  morphFrame,
  type NextRoad,
  startMorph,
  tradePlaces,
} from './start'

const road = getRoad()
const option = (id: string, beside: string, gy: number): Tile => ({
  id,
  kind: 'course',
  state: 'alt',
  gx: 10,
  gy,
  name: id,
  beside,
  lab: { whole: 'none', level: 'right', tile: 'right' },
})
const STUDY = 'masters-cyber-security-ecu'
/** Priya's board with two courses beside the study step. */
const priya = buildScene(road, NEW_SESSION)
const scene = {
  ...priya,
  tiles: [...priya.tiles, option('other-a', STUDY, -2.4), option('other-b', STUDY, -4)],
}

/** A new road: every step but the 485 renamed and re-dated; `other-b` stays, `other-c` arrives. */
const next: NextRoad = {
  ahead: [
    {
      id: 'student-visa-500',
      name: 'Student visa · 500',
      short: 'Student visa',
      when: 'Late 2027',
      kind: 'step',
    },
    {
      id: STUDY,
      name: 'Master’s · Data Science',
      short: 'Master’s',
      when: 'Feb 2028 – Dec 2029',
      kind: 'slab',
    },
    {
      id: 'graduate-visa-485',
      name: 'Graduate visa · 485',
      short: '485',
      when: 'From 2029',
      kind: 'slab',
    },
    {
      id: 'state-nomination-190',
      name: '190 · state nomination',
      short: '190',
      when: '2032',
      kind: 'step',
    },
  ],
  options: [option('other-b', STUDY, -2.4), option('other-c', STUDY, -4)],
}

const tileIn = (s: { tiles: Tile[] }, id: string) => s.tiles.find((t) => t.id === id)

describe('startMorph: how long the road ahead takes to turn', () => {
  it('staggers one beat per changed step, in road order, and the last beat fades in full', () => {
    // The visa, the study step (with its options) and the 190 change; the 485 reads the same.
    expect(startMorph(scene, next, null).ms).toBe(2 * MORPH_STAGGER_MS + MORPH_FADE_MS)
  })

  it('is nothing when nothing changes', () => {
    const same = {
      ahead: [
        next.ahead[2],
        { ...next.ahead[1], name: 'Master’s · Cyber Security', when: 'Feb 2027 – Dec 2028' },
      ],
      options: [tileIn(scene, 'other-a')!, tileIn(scene, 'other-b')!],
    }
    expect(startMorph(scene, same, null).ms).toBe(0)
  })
})

describe('morphFrame: the road ahead as it turns', () => {
  it('ends on the next road’s names and dates, its options in, the old ones out', () => {
    const end = morphFrame(scene, startMorph(scene, next, null), Number.POSITIVE_INFINITY)
    for (const step of next.ahead) {
      const t = tileIn(end.scene, step.id)
      expect([t?.name, t?.short, t?.when, t?.kind]).toEqual([
        step.name,
        step.short,
        step.when,
        step.kind,
      ])
    }
    const options = end.scene.tiles.filter((t) => t.beside).map((t) => [t.id, t.gy])
    expect(options).toEqual([
      ['other-b', -2.4],
      ['other-c', -4],
    ])
    expect(end.fade).toEqual({})
    expect(end.was).toEqual({})
  })

  it('crossfades each step in road order, one after another', () => {
    // Half way through the visa's fade: the visa is turning, the study step has not started.
    const at = morphFrame(scene, startMorph(scene, next, null), MORPH_FADE_MS / 2)
    expect(at.was['student-visa-500']).toEqual({
      name: 'Student visa · 500',
      short: 'Student visa',
      when: 'Late 2026',
      k: 0.5,
    })
    expect(tileIn(at.scene, 'student-visa-500')?.when).toBe('Late 2027')
    expect(tileIn(at.scene, STUDY)?.name).toBe('Master’s · Cyber Security')
    expect(at.was[STUDY]).toBeUndefined()
    // Not there yet: the new option, which arrives with the study step.
    expect(tileIn(at.scene, 'other-c')).toBeUndefined()
  })

  it('fades the study step’s old options out and the new ones in, the one staying moving', () => {
    const at = morphFrame(
      scene,
      startMorph(scene, next, null),
      MORPH_STAGGER_MS + MORPH_FADE_MS / 2,
    )
    expect(at.fade['other-a']).toBe(0.5)
    expect(at.fade['other-c']).toBe(0.5)
    expect(at.fade['other-b']).toBeUndefined()
    const staying = tileIn(at.scene, 'other-b')!.gy
    expect(staying > -4 && staying < -2.4).toBe(true)
  })

  it('keeps the tile the new roadmap is built around, never fading it out', () => {
    const end = morphFrame(scene, startMorph(scene, next, 'other-a'), Number.POSITIVE_INFINITY)
    expect(tileIn(end.scene, 'other-a')?.gy).toBe(-2.4)
    // Nothing arrives on top of it: the new option in its place (other-b) waits for the new board.
    const options = end.scene.tiles.filter((t) => t.beside).map((t) => [t.id, t.gy])
    expect(options).toEqual([
      ['other-a', -2.4],
      ['other-c', -4],
    ])
    // Nor once it has traded places with her course, which then stands there.
    const traded = morphFrame(
      tradePlaces(scene, 'other-a'),
      startMorph(scene, next, 'other-a'),
      Number.POSITIVE_INFINITY,
    )
    expect(traded.scene.tiles.filter((t) => t.gy === -2.4).map((t) => t.id)).toEqual([scene.here])
  })
})

describe('tradePlaces: the course traded onto her road', () => {
  it('takes her place, and hers takes its own, as the swap draws it', () => {
    const here = tileIn(scene, scene.here)!
    const traded = tradePlaces(scene, 'other-a')
    expect(traded.here).toBe('other-a')
    const on = tileIn(traded, 'other-a')!
    const off = tileIn(traded, here.id)!
    expect([on.gx, on.gy, on.state, on.beside]).toEqual([here.gx, here.gy, 'here', undefined])
    expect([off.gx, off.gy, off.state]).toEqual([10, -2.4, 'lit'])
    expect(traded.lit).toContain('other-a')
    expect(traded.lit).not.toContain(here.id)
    expect(traded.courseLine[0]).toBe('other-a')
  })

  it('trades the alternative as the board’s swap does', () => {
    const swapped = buildScene(road, { ...NEW_SESSION, swapped: true })
    const traded = tradePlaces(buildScene(road, NEW_SESSION), scene.alternative)
    expect([traded.here, traded.alternative, traded.courseLine]).toEqual([
      swapped.here,
      swapped.alternative,
      swapped.courseLine,
    ])
    for (const id of [swapped.here, swapped.alternative])
      expect([tileIn(traded, id)?.gx, tileIn(traded, id)?.gy]).toEqual([
        tileIn(swapped, id)?.gx,
        tileIn(swapped, id)?.gy,
      ])
  })
})
