import { describe, expect, it } from 'bun:test'
import { drawTile, iconOn, type LabelContext, labelOf, roadLines, toScreen } from './drawing'
import { kindOf } from './kinds'
import { getRoad, type Stop } from './road-data'
import { buildScene, NEW_SESSION, type Scene, type Session } from './scene'

const road = getRoad()
const cam = { u: 40, ox: 400, oy: 100 }
const sceneOf = (session: Partial<Session> = {}) => buildScene(road, { ...NEW_SESSION, ...session })
const ids = (session: Partial<Session>) => roadLines(sceneOf(session), cam).map((r) => r.id)
const tileIn = (sc: Scene, id: string) => {
  const t = sc.tiles.find((x) => x.id === id)
  if (!t) throw new Error(`No tile ${id}`)
  return t
}

/** A tile's label as the map asks for it: not hovered, not pressed, on a wide map with no edge. */
function label(id: string, stop: Stop, over: Partial<LabelContext> = {}, sc = sceneOf()) {
  const t = tileIn(sc, id)
  const c: LabelContext = {
    stop,
    here: id === sc.here,
    hovered: false,
    pressed: false,
    ahead: false,
    openLevel: sc.openLevel,
    phone: false,
    lift: 0,
    rem: 16,
    map: null,
    kind: kindOf(t, sc).word,
    ...over,
  }
  const drawn = drawTile(t, cam, c.lift)
  return { label: labelOf(t, drawn, cam, c), drawn }
}

describe('roadLines', () => {
  it('names each line once, also when no level is open (the first arrival)', () => {
    for (const session of [{}, { first: true }, { city: true }, { swapped: true, added: true }]) {
      const all = ids(session)
      expect(new Set(all).size).toBe(all.length)
    }
  })

  it('draws the 491 lane from the junction along its angle, to the 191', () => {
    const sc = sceneOf()
    const at = toScreen(cam)
    const fork = roadLines(sc, cam).find((r) => r.id === 'fork')!
    const lane = tileIn(sc, 'regional-491')
    const j = tileIn(sc, 'two-ways-to-pr')
    const end = tileIn(sc, 'permanent-191')
    const p = (gx: number, gy: number) =>
      at(gx, gy)
        .map((v) => v.toFixed(1))
        .join(' ')
    expect(fork.d).toBe(
      `M${p(j.gx, j.gy)} L${p(lane.gx, lane.gy)} L${p(lane.gx1!, lane.gy1!)} L${p(end.gx, end.gy)}`,
    )
  })
})

describe('labelOf', () => {
  it('names every tile on her road at Level, the country included', () => {
    const sc = sceneOf()
    for (const id of new Set([...sc.lit, ...sc.next]))
      expect(label(id, 'level').label?.name).toBe(tileIn(sc, id).name)
    expect(label('australia', 'level').label?.place).toBe('above')
  })

  it('hangs Adelaide’s name above Adelaide', () => {
    expect(label('adelaide', 'level').label?.place).toBe('above')
  })

  it('hangs a label 0.75rem from its tile, at the root size', () => {
    const at = (rem: number) => label('perth', 'level', { rem })
    const { label: l16, drawn } = at(16)
    expect(l16?.y).toBeCloseTo(drawn.centre[1] - drawn.size * cam.u - drawn.top - 12)
    expect(at(20).label?.y).toBeCloseTo(drawn.centre[1] - drawn.size * cam.u - drawn.top - 15)

    const below = label('cyber-security-ecu-perth', 'level')
    expect(below.label?.y).toBeCloseTo(
      below.drawn.centre[1] + below.drawn.size * cam.u + below.drawn.depth + 12,
    )
    const right = label('student-visa-500', 'level')
    expect(right.label?.x).toBeCloseTo(right.drawn.centre[0] + 2 * right.drawn.size * cam.u + 12)
  })

  it('puts the kind word first, then the tile’s own kicker, never twice', () => {
    expect(label('perth', 'level').label?.kicker).toBe('City')
    expect(label('point-a', 'level').label?.kicker).toBe('You')
    expect(label('permanent-residency', 'whole').label?.kicker).toBe('Point B')
    expect(label('more-courses-perth', 'level').label?.kicker).toBe('Not looked at')
    const swapped = sceneOf({ swapped: true })
    expect(label('cyber-security-ecu-perth', 'level', {}, swapped).label?.kicker).toBe(
      'Course · Visited',
    )
  })

  it('at Level names the city before where she is, its sub left to the card', () => {
    expect(label('perth', 'level').label?.sub).toBeUndefined()
    expect(label('cyber-security-ecu-perth', 'level').label?.sub).toBe('ECU · Perth')
  })

  it('splits the trade-off into what it is good for and less good for', () => {
    expect(label('data-science-uwa-perth', 'level').label).toMatchObject({
      gains: 'Good for: career',
      costs: 'Less good for: cost, PR',
    })
  })

  describe('on a phone', () => {
    it('leaves a step ahead unnamed at Level, unless it is pressed', () => {
      expect(label('masters-cyber-security-ecu', 'level').label).not.toBeNull()
      expect(label('masters-cyber-security-ecu', 'level', { phone: true }).label).toBeNull()
      expect(
        label('masters-cyber-security-ecu', 'level', { phone: true, pressed: true }).label,
      ).not.toBeNull()
    })

    it('drops the kind word everywhere but where she is', () => {
      expect(label('perth', 'level', { phone: true }).label?.kicker).toBeUndefined()
      expect(label('cyber-security-ecu-perth', 'level', { phone: true }).label?.kicker).toBe(
        'Course',
      )
    })
  })

  describe('at the map’s edge', () => {
    const rem = 16
    /** The label's place with no edge, then with a map of this size. */
    const at = (id: string, map: { width: number; height: number }, rem2 = rem) => {
      const free = label(id, 'level', { rem: rem2 }).label!
      return { free, edged: label(id, 'level', { rem: rem2, map }).label }
    }

    it('keeps a name the map has room for', () => {
      expect(at('perth', { width: 4000, height: 4000 }).edged).not.toBeNull()
    })

    it('hides a name to the right that the right edge would cut (7rem)', () => {
      const { free } = at('student-visa-500', { width: 4000, height: 4000 })
      expect(free.place).toBe('right')
      const room = { width: free.x + 7 * rem + 1, height: 4000 }
      expect(at('student-visa-500', room).edged).not.toBeNull()
      expect(at('student-visa-500', { ...room, width: free.x + 7 * rem - 1 }).edged).toBeNull()
    })

    it('hides a name above or below too near either side (3rem)', () => {
      const { free } = at('perth', { width: 4000, height: 4000 })
      expect(at('perth', { width: free.x + 3 * rem + 1, height: 4000 }).edged).not.toBeNull()
      expect(at('perth', { width: free.x + 3 * rem - 1, height: 4000 }).edged).toBeNull()
    })

    it('hides a name below too near the foot (3rem)', () => {
      const { free } = at('more-cities', { width: 4000, height: 4000 })
      expect(free.place).toBe('below')
      expect(at('more-cities', { width: 4000, height: free.y + 3 * rem + 1 }).edged).not.toBeNull()
      expect(at('more-cities', { width: 4000, height: free.y + 3 * rem - 1 }).edged).toBeNull()
    })

    it('hides a name above too near the top (3rem), at the root size', () => {
      // At this camera Perth's name sits 64px down the map: room at 16px, not at 24px.
      const sc = sceneOf()
      const t = tileIn(sc, 'perth')
      const top = (rem2: number) => {
        const c: LabelContext = {
          stop: 'level',
          here: false,
          hovered: false,
          pressed: false,
          ahead: false,
          openLevel: sc.openLevel,
          phone: false,
          lift: 0,
          rem: rem2,
          map: { width: 4000, height: 4000 },
          kind: kindOf(t, sc).word,
        }
        const free = labelOf(t, drawTile(t, cam, 0), cam, { ...c, map: null })!
        const moved = { ...cam, ox: 1000, oy: cam.oy - free.y + 3 * 16 + 1 }
        return labelOf(t, drawTile(t, moved, 0), moved, c)
      }
      expect(top(16)).not.toBeNull()
      expect(top(24)).toBeNull()
    })

    it('never hides where she is', () => {
      expect(
        label('cyber-security-ecu-perth', 'level', { map: { width: 10, height: 10 } }).label,
      ).not.toBeNull()
    })
  })
})

describe('iconOn: the icon printed flat on the top face', () => {
  const matrix = (k: number, x: number, y: number) =>
    `matrix(${[k, 0, 0, k * 0.56, x - 12 * k, y - 12 * k * 0.56].map((v) => v.toFixed(3)).join(',')})`

  it('centres it on a tile’s top, two-thirds of its size', () => {
    const sc = sceneOf()
    const t = tileIn(sc, 'perth')
    const drawn = drawTile(t, cam, 6)
    const k = (0.72 * 0.66 * cam.u * 2) / 24
    const [x, y] = toScreen(cam)(t.gx, t.gy)
    expect(iconOn(drawn, t, cam)).toBe(matrix(k, x, y - 6))
  })

  it('makes it half the size on a stack, on its top layer', () => {
    const sc = sceneOf()
    const t = tileIn(sc, 'more-courses-perth')
    const drawn = drawTile(t, cam, 0)
    const k = (0.66 * 0.5 * cam.u * 2) / 24
    const [x, y] = toScreen(cam)(t.gx, t.gy)
    expect(iconOn(drawn, t, cam)).toBe(matrix(k, x, y - drawn.top))
  })

  it('fills most of the junction', () => {
    const sc = sceneOf()
    const t = tileIn(sc, 'two-ways-to-pr')
    const k = (0.22 * 0.8 * cam.u * 2) / 24
    const [x, y] = toScreen(cam)(t.gx, t.gy)
    expect(iconOn(drawTile(t, cam, 0), t, cam)).toBe(matrix(k, x, y))
  })

  it('puts it 0.55 units along an angled slab, from its start', () => {
    const sc = sceneOf()
    const t = tileIn(sc, 'regional-491')
    const dx = t.gx1! - t.gx
    const dy = t.gy1! - t.gy
    const L = Math.hypot(dx, dy)
    const k = (0.26 * 0.8 * cam.u * 2) / 24
    const [x, y] = toScreen(cam)(t.gx + (dx / L) * 0.55, t.gy + (dy / L) * 0.55)
    expect(iconOn(drawTile(t, cam, 0), t, cam)).toBe(matrix(k, x, y))
  })
})
