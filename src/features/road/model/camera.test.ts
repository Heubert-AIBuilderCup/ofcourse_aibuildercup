import { describe, expect, it } from 'bun:test'
import {
  type Camera,
  clamp,
  fit,
  frame,
  layoutOf,
  type MapSize,
  mapPadding,
  project,
  reframe,
  STOP_CAP,
  stepFromPinch,
  stepFromWheel,
  stepStop,
  tween,
  WHEEL_IDLE,
  type WheelGesture,
} from './camera'
import { getRoad, type Stop, type Tile } from './road-data'
import { buildScene, NEW_SESSION, type Scene } from './scene'

const scene = buildScene(getRoad(), NEW_SESSION)
const SIZES: Record<string, MapSize> = {
  phone: { width: 390, height: 600, layout: 'phone', rs: 1 },
  stacked: { width: 768, height: 560, layout: 'stacked', rs: 1 },
  wide: { width: 1060, height: 820, layout: 'wide', rs: 1 },
}

/** A tile's centre on screen under the camera. */
const onScreen = (t: Tile, cam: Camera) => {
  const [x, y] = project(t.kind === 'slab' ? (t.gx + (t.gx1 ?? t.gx)) / 2 : t.gx, t.gy)
  return [cam.ox + x * cam.u, cam.oy + y * cam.u]
}

/** The tiles a stop frames, per the reference's `frame`. */
const framed = (stop: Stop, focus: string | null, sc: Scene) => {
  if (stop === 'whole') return sc.tiles
  if (stop === 'tile') return sc.tiles.filter((t) => t.id === (focus ?? sc.here))
  return sc.tiles.filter((t) => sc.levelIds.includes(t.id))
}

describe('fit', () => {
  for (const [name, size] of Object.entries(SIZES)) {
    for (const stop of ['whole', 'level', 'tile'] as const) {
      it(`frames ${stop} inside the ${name} map, less its padding, under the stop's cap`, () => {
        const cam = fit(stop, null, size, scene)
        const pad = mapPadding(size)
        for (const t of framed(stop, null, scene)) {
          const [x, y] = onScreen(t, cam)
          expect({ id: t.id, inside: true }).toEqual({
            id: t.id,
            inside: x >= pad.l && x <= size.width - pad.r && y >= pad.t && y <= size.height - pad.b,
          })
        }
        expect(cam.u).toBeLessThanOrEqual(STOP_CAP[size.layout][stop])
      })
    }
  }

  it('caps the unit at Tile on a wide map', () => {
    expect(fit('tile', null, SIZES.wide, scene).u).toBe(104)
    expect(fit('whole', null, { ...SIZES.wide, width: 4000, height: 3000 }, scene).u).toBe(46)
  })

  it('scales the cap with the root font size', () => {
    const big = { ...SIZES.wide, width: 1600, height: 1100, rs: 4 / 3 }
    expect(fit('tile', null, big, scene).u).toBeCloseTo(104 * (4 / 3))
  })

  it('zooms in from Whole road to Level to Tile', () => {
    const u = (stop: Stop) => fit(stop, null, SIZES.wide, scene).u
    expect(u('whole')).toBeLessThan(u('level'))
    expect(u('level')).toBeLessThan(u('tile'))
  })

  it('at Level centres a tile beyond the level on that tile', () => {
    const size = SIZES.wide
    const cam = fit('level', 'permanent-residency', size, scene)
    const pad = mapPadding(size)
    const pr = scene.tiles.find((t) => t.id === 'permanent-residency')!
    const [x, y] = onScreen(pr, cam)
    expect(x).toBeCloseTo(pad.l + (size.width - pad.l - pad.r) / 2)
    expect(y).toBeCloseTo(pad.t + (size.height - pad.t - pad.b) / 2)
  })

  it('at Tile frames the angled 491 lane along its angle: centred, its far end inside', () => {
    const size = SIZES.wide
    const cam = fit('tile', 'regional-491', size, scene)
    const pad = mapPadding(size)
    const lane = scene.tiles.find((t) => t.id === 'regional-491')!
    const at = (gx: number, gy: number) => {
      const [x, y] = project(gx, gy)
      return [cam.ox + x * cam.u, cam.oy + y * cam.u]
    }
    const [mx, my] = at((lane.gx + lane.gx1!) / 2, (lane.gy + lane.gy1!) / 2)
    expect(mx).toBeCloseTo(pad.l + (size.width - pad.l - pad.r) / 2)
    expect(my).toBeCloseTo(pad.t + (size.height - pad.t - pad.b) / 2)
    for (const gy of [lane.gy1! - lane.w!, lane.gy1! + lane.w!]) {
      const [x, y] = at(lane.gx1!, gy)
      expect(x >= pad.l && x <= size.width - pad.r && y >= pad.t && y <= size.height - pad.b).toBe(
        true,
      )
    }
  })
})

describe('frame', () => {
  it('Whole road takes in every tile', () => {
    const f = frame('whole', null, scene)
    for (const t of scene.tiles) {
      const [x, y] = project(t.gx, t.gy)
      expect(x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1).toBe(true)
    }
  })
})

describe('clamp', () => {
  const size = SIZES.wide
  const cam = fit('level', null, size, scene)
  const road = frame('whole', null, scene)
  /** How much of the road's box is on screen, along x and y. */
  const showing = (c: Camera) => ({
    x: Math.min(size.width, c.ox + road.x1 * c.u) - Math.max(0, c.ox + road.x0 * c.u),
    y: Math.min(size.height, c.oy + road.y1 * c.u) - Math.max(0, c.oy + road.y0 * c.u),
  })

  it('keeps at least 80px of the road on screen however far it is panned', () => {
    for (const far of [
      { ox: 1e5, oy: 0 },
      { ox: -1e5, oy: 0 },
      { ox: 0, oy: 1e5 },
      { ox: 0, oy: -1e5 },
    ]) {
      const s = showing(clamp({ ...cam, ox: cam.ox + far.ox, oy: cam.oy + far.oy }, size, scene))
      expect(s.x).toBeGreaterThanOrEqual(80)
      expect(s.y).toBeGreaterThanOrEqual(80)
    }
  })

  it('leaves a camera on the road alone', () => {
    expect(clamp(cam, size, scene)).toEqual(cam)
  })
})

describe('tween', () => {
  const from = { u: 10, ox: 0, oy: 100 }
  const to = { u: 90, ox: 200, oy: -100 }

  it('scales evenly in log space: halfway, the unit is the geometric mean', () => {
    expect(tween(from, to, 0.5)).toEqual({ u: expect.closeTo(30), ox: 100, oy: 0 })
  })

  it('starts at from and ends at to', () => {
    expect(tween(from, to, 0)).toEqual(from)
    expect(tween(from, to, 1)).toEqual({ ...to, u: expect.closeTo(90) })
  })
})

describe('stepStop', () => {
  it('steps one stop in or out and stops at either end', () => {
    expect(stepStop('level', 1)).toBe('tile')
    expect(stepStop('level', -1)).toBe('whole')
    expect(stepStop('tile', 1)).toBe('tile')
    expect(stepStop('whole', -1)).toBe('whole')
  })
})

describe('stepFromWheel', () => {
  /** Feeds a gesture's events (deltaY, at time ms) and collects the steps. */
  const run = (events: { deltaY: number; time: number; ctrlKey?: boolean }[]) => {
    let g: WheelGesture = WHEEL_IDLE
    const steps: number[] = []
    for (const e of events) {
      const r = stepFromWheel(g, { ctrlKey: false, ...e })
      g = r.gesture
      if (r.step) steps.push(r.step)
    }
    return steps
  }
  const gesture = (deltaY: number, from: number, count: number, ctrlKey = false) =>
    Array.from({ length: count }, (_, i) => ({ deltaY, time: from + i * 16, ctrlKey }))

  it('steps out once for a whole scroll down', () => {
    expect(run(gesture(40, 0, 30))).toEqual([-1])
  })

  it('steps in for a scroll up', () => {
    expect(run(gesture(-40, 0, 5))).toEqual([1])
  })

  it('needs more than a nudge', () => {
    expect(run(gesture(30, 0, 3))).toEqual([])
  })

  it('forgets a nudge after a pause', () => {
    expect(run([...gesture(30, 0, 2), ...gesture(30, 1000, 2)])).toEqual([])
  })

  it('counts a trackpad pinch (Ctrl + scroll) four times over', () => {
    expect(run(gesture(-10, 0, 3, true))).toEqual([1])
  })

  it('steps again for a second gesture', () => {
    expect(run([...gesture(40, 0, 5), ...gesture(40, 1000, 5)])).toEqual([-1, -1])
  })
})

describe('stepFromPinch', () => {
  it('steps in when the fingers spread, out when they close, and restarts from there', () => {
    expect(stepFromPinch(100, 140)).toEqual({ start: 140, step: 1 })
    expect(stepFromPinch(100, 70)).toEqual({ start: 70, step: -1 })
    expect(stepFromPinch(100, 110)).toEqual({ start: 100, step: 0 })
  })
})

describe('layoutOf', () => {
  it('phone below 576px, stacked to 1024px, wide from there', () => {
    expect([390, 575, 576, 1023, 1024, 1920].map(layoutOf)).toEqual([
      'phone',
      'phone',
      'stacked',
      'stacked',
      'wide',
      'wide',
    ])
  })
})

describe('reframe', () => {
  const at = { stop: 'level' as Stop, here: 'cyber', focus: null }

  it('keeps the framing when a press opens a tile at Whole road or Level', () => {
    expect(reframe(at, { stop: 'level', here: 'cyber', tile: 'visa-485' })).toBe(at)
    const whole = { ...at, stop: 'whole' as Stop }
    expect(reframe(whole, { stop: 'whole', here: 'cyber', tile: 'perth' })).toBe(whole)
  })

  it('frames the open tile when the zoom changes', () => {
    expect(reframe(at, { stop: 'tile', here: 'cyber', tile: 'visa-485' })).toEqual({
      stop: 'tile',
      here: 'cyber',
      focus: 'visa-485',
    })
    expect(reframe(at, { stop: 'whole', here: 'cyber', tile: 'perth' }).focus).toBe('perth')
  })

  it('follows a press at Tile', () => {
    const tile = { ...at, stop: 'tile' as Stop, focus: 'perth' }
    expect(reframe(tile, { stop: 'tile', here: 'cyber', tile: 'visa-485' }).focus).toBe('visa-485')
    expect(reframe(tile, { stop: 'tile', here: 'cyber', tile: 'perth' })).toBe(tile)
  })

  it('frames afresh when she moves', () => {
    expect(reframe(at, { stop: 'level', here: 'data', tile: null })).toEqual({
      stop: 'level',
      here: 'data',
      focus: null,
    })
  })
})
