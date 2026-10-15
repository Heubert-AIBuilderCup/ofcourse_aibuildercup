import { describe, expect, it } from 'bun:test'
import { getRoad } from './road-data'
import {
  applyAnswers,
  buildScene,
  choicesFrom,
  NEW_SESSION,
  type Session,
  sessionFrom,
} from './scene'

const road = getRoad()
const scene = (session: Partial<Session> = {}) => buildScene(road, { ...NEW_SESSION, ...session })
const tile = (sc: ReturnType<typeof scene>, id: string) => sc.tiles.find((t) => t.id === id)
const states = (sc: ReturnType<typeof scene>, ids: string[]) => ids.map((id) => tile(sc, id)?.state)

const CYBER = 'cyber-security-ecu-perth'
const DS = 'data-science-uwa-perth'
const IS = 'information-systems-curtin-perth'
const MASTERS = 'masters-cyber-security-ecu'
const AHEAD = [
  MASTERS,
  'graduate-visa-485',
  'two-ways-to-pr',
  'state-nomination-190',
  'permanent-residency',
  'regional-491',
  'permanent-191',
]

describe('the default scene: at the course', () => {
  it('puts her at Cyber Security, the road walked to it and Student visa next', () => {
    const sc = scene()
    expect(sc.here).toBe(CYBER)
    expect(sc.lit).toEqual(['point-a', 'australia', 'perth', CYBER])
    expect(sc.next).toEqual([CYBER, 'student-visa-500'])
    expect(states(sc, ['point-a', 'australia', 'perth', CYBER, 'student-visa-500'])).toEqual([
      'lit',
      'lit',
      'lit',
      'here',
      'next',
    ])
  })

  it('keeps the road ahead dark but named', () => {
    const sc = scene()
    expect(states(sc, AHEAD)).toEqual(AHEAD.map(() => 'fog'))
    expect(tile(sc, MASTERS)?.name).toBe('Master’s · Cyber Security')
  })

  it('shows the alternative and the stack beside each level, and leaves the stack’s courses off the board', () => {
    const sc = scene()
    expect(sc.courseLine).toEqual([CYBER, DS, 'more-courses-perth'])
    expect(sc.cityLine).toEqual(['perth', 'adelaide', 'more-cities'])
    expect(states(sc, [DS, 'adelaide'])).toEqual(['alt', 'alt'])
    expect(tile(sc, IS)).toBeUndefined()
    expect(sc.hint).toBeNull()
  })

  it('runs the road ahead through the junction after the 485, on to Point B', () => {
    expect(scene().ahead).toEqual([
      'student-visa-500',
      MASTERS,
      'graduate-visa-485',
      'two-ways-to-pr',
      'state-nomination-190',
      'permanent-residency',
    ])
  })

  it('puts a small junction, "2 ways to PR", just after the 485 ends', () => {
    const sc = scene()
    const g485 = tile(sc, 'graduate-visa-485')!
    const junction = tile(sc, 'two-ways-to-pr')!
    expect(junction).toMatchObject({ kind: 'junction', state: 'fog', name: '2 ways to PR', gy: 0 })
    expect(junction.gx).toBeCloseTo((g485.gx1 ?? g485.gx) + 0.35)
    // Unnamed at Whole road, as the reference's lgFork leaves it.
    expect(junction.lab).toEqual({ whole: 'none', level: 'above', tile: 'above' })
  })

  it('sends both ways forward: the 190 straight on, the 491 an angled lane on the far side', () => {
    const sc = scene()
    const j = tile(sc, 'two-ways-to-pr')!.gx
    expect(tile(sc, 'state-nomination-190')).toMatchObject({ gy: 0 })
    expect(tile(sc, 'state-nomination-190')!.gx).toBeCloseTo(j + 1.3)
    expect(tile(sc, 'permanent-residency')!.gx).toBeCloseTo(j + 2.7)
    const lane = tile(sc, 'regional-491')!
    expect(lane).toMatchObject({ kind: 'slab', gy: -1.25, gy1: -2.1, w: 0.26 })
    expect(lane.gx).toBeCloseTo(j + 1.0)
    // The lane ends at the 2034 tick.
    const tick2034 = sc.ruler.ticks.find((t) => t.year === 2034)!.gx
    expect(Math.abs((lane.gx1 ?? 0) - tick2034)).toBeLessThan(0.2)
    const end = tile(sc, 'permanent-191')!
    expect(end.gx).toBeGreaterThan(lane.gx1 ?? 0)
    expect(end.gy).toBeLessThan(lane.gy1 ?? 0)
  })

  it('moves the years ruler to the other side of the road from the 491 lane', () => {
    const sc = scene()
    const lane = tile(sc, 'regional-491')!
    expect(Math.sign(sc.ruler.gy)).toBe(-Math.sign(lane.gy))
    expect(sc.ruler.gy).toBe(2.1)
  })

  it('names the country at every stop, and Adelaide above itself at Level', () => {
    const sc = scene()
    expect(tile(sc, 'australia')?.lab).toEqual({ whole: 'above', level: 'above', tile: 'above' })
    expect(tile(sc, 'adelaide')?.lab.level).toBe('above')
  })

  it('carries each tile’s label placement per stop', () => {
    const sc = scene()
    expect(tile(sc, 'perth')?.lab).toEqual({ whole: 'above', level: 'above', tile: 'above' })
    expect(tile(sc, DS)?.lab).toEqual({ whole: 'none', level: 'right', tile: 'none' })
  })

  it('never changes the road it was built from', () => {
    const before = structuredClone(road)
    scene({ swapped: true, added: true, read: true, first: true })
    expect(road).toEqual(before)
  })
})

describe('swapped: Data Science on the road', () => {
  it('puts Data Science where she is and Cyber Security, visited, in the alternative slot', () => {
    const sc = scene({ swapped: true })
    expect(sc.here).toBe(DS)
    expect(states(sc, [DS, CYBER])).toEqual(['here', 'lit'])
    expect(tile(sc, CYBER)?.kicker).toBe('Visited')
    expect(sc.courseLine).toEqual([DS, CYBER, 'more-courses-perth'])
    expect(tile(sc, DS)?.lab).toEqual({ whole: 'below', level: 'below', tile: 'below' })
    expect(tile(sc, CYBER)?.lab).toEqual({ whole: 'none', level: 'right', tile: 'none' })
  })

  it('re-routes the road ahead through Data Science', () => {
    const sc = scene({ swapped: true })
    expect(sc.lit).toEqual(['point-a', 'australia', 'perth', DS])
    expect(sc.next).toEqual([DS, 'student-visa-500'])
    expect(sc.rows).toContain(DS)
    expect(sc.rows).not.toContain(CYBER)
    expect(tile(sc, MASTERS)?.name).toBe('Master’s · Data Science')
  })
})

describe('added: Information Systems put on the board', () => {
  it('puts it beside the road, tagged, and folds Data Science into the stack', () => {
    const sc = scene({ added: true })
    expect(tile(sc, IS)).toMatchObject({ state: 'alt', kicker: 'Added · from your stack' })
    expect(tile(sc, DS)).toBeUndefined()
    expect(sc.courseLine).toEqual([CYBER, IS, 'more-courses-perth'])
    expect(sc.levelIds).toContain(IS)
    expect(sc.levelIds).not.toContain(DS)
    expect(sc.here).toBe(CYBER)
  })
})

describe('read: the lesson read', () => {
  it('turns the Master’s and the 485 from dark to looked at, and names the 485 at Level', () => {
    const sc = scene({ read: true })
    expect(states(sc, [MASTERS, 'graduate-visa-485', 'state-nomination-190'])).toEqual([
      'seen',
      'seen',
      'fog',
    ])
    expect(tile(sc, 'graduate-visa-485')?.lab.level).toBe('right')
  })
})

describe('first: the first arrival', () => {
  it('puts the duck at Australia with the hint on Perth', () => {
    const sc = scene({ first: true })
    expect(sc.here).toBe('australia')
    expect(sc.hint).toBe('perth')
    expect(sc.lit).toEqual(['point-a', 'australia'])
    expect(sc.next).toEqual(['australia', 'perth'])
    expect(states(sc, ['australia', 'perth', CYBER, 'student-visa-500'])).toEqual([
      'here',
      'next',
      'alt',
      'fog',
    ])
  })
})

describe('country: walked back to her country', () => {
  it('puts the duck at Australia, Perth next, with no hint', () => {
    const sc = scene({ country: true })
    expect(sc.here).toBe('australia')
    expect(sc.hint).toBeNull()
    expect(sc.lit).toEqual(['point-a', 'australia'])
    expect(sc.next).toEqual(['australia', 'perth'])
    expect(states(sc, ['australia', 'perth'])).toEqual(['here', 'next'])
    expect(sc.ahead.slice(0, 3)).toEqual(['perth', CYBER, 'student-visa-500'])
  })

  it('keeps a swap: the road ahead runs through the course she swapped on', () => {
    const sc = scene({ country: true, swapped: true })
    expect(sc.here).toBe('australia')
    expect(sc.next).toEqual(['australia', 'perth'])
    expect(sc.ahead.slice(0, 3)).toEqual(['perth', DS, 'student-visa-500'])
    expect(states(sc, ['australia', 'perth', DS, CYBER])).toEqual(['here', 'next', 'alt', 'alt'])
  })
})

describe('city: walked back to her city', () => {
  it('puts the duck at Perth with the city level open and her course next', () => {
    const sc = scene({ city: true })
    expect(sc.here).toBe('perth')
    expect(sc.openLevel).toBe('city')
    expect(sc.lit).toEqual(['point-a', 'australia', 'perth'])
    expect(sc.next).toEqual(['perth', CYBER])
    expect(sc.ahead[0]).toBe(CYBER)
    expect(sc.levelIds).toEqual(['australia', 'perth', 'adelaide', 'more-cities', CYBER])
    expect(states(sc, ['perth', CYBER, 'student-visa-500'])).toEqual(['here', 'next', 'fog'])
  })

  it('names her course at Level and leaves the courses beside it unnamed', () => {
    const sc = scene({ city: true })
    expect(tile(sc, CYBER)?.lab).toMatchObject({ level: 'right', tile: 'right' })
    expect(tile(sc, DS)?.lab).toEqual({ whole: 'none', level: 'none', tile: 'none' })
    expect(tile(sc, 'student-visa-500')?.lab.level).toBe('none')
  })

  it('walks back from whichever course is on her road', () => {
    const sc = scene({ city: true, swapped: true })
    expect(sc.here).toBe('perth')
    expect(sc.next).toEqual(['perth', DS])
  })
})

describe('swapped, then added', () => {
  it('puts the added course beside her road and folds Cyber Security into the stack', () => {
    const sc = scene({ swapped: true, added: true })
    expect(sc.here).toBe(DS)
    expect(sc.alternative).toBe(IS)
    expect(tile(sc, CYBER)).toBeUndefined()
    expect(sc.courseLine).toEqual([DS, IS, 'more-courses-perth'])
  })
})

describe('an empty road', () => {
  it('puts her at Point A with a dotted Destination ahead, nothing else drawn', () => {
    const sc = buildScene({ ...road, tiles: [] }, NEW_SESSION)
    expect(sc.empty).toBe(true)
    expect(sc.here).toBe('point-a')
    expect(sc.tiles.map((t) => [t.id, t.state])).toEqual([
      ['point-a', 'here'],
      ['destination', 'unknown'],
    ])
    expect(tile(sc, 'point-a')?.sub).toBe(road.here['point-a'].sub)
    expect(sc.next).toEqual(['point-a', 'destination'])
    expect(sc.ahead).toEqual([])
    expect(sc.ruler.ticks).toEqual([])
  })
})

describe('a roadmap’s stored choices', () => {
  it('start the session: each stored key, the rest false, first from the visit', () => {
    expect(sessionFrom({ swapped: true, read: true }, false)).toEqual({
      ...NEW_SESSION,
      swapped: true,
      read: true,
    })
    expect(sessionFrom({}, true)).toEqual({ ...NEW_SESSION, first: true })
    expect(sessionFrom({ added: true, city: true, country: true }, false)).toEqual({
      ...NEW_SESSION,
      added: true,
      city: true,
      country: true,
    })
  })

  it('are what the session keeps, every key, never the first arrival or the preview', () => {
    expect(
      choicesFrom({ ...NEW_SESSION, swapped: true, first: true, preview: { perth: 'A stretch' } }),
    ).toEqual({
      swapped: true,
      added: false,
      read: false,
      city: false,
      country: false,
    })
  })
})

describe('the preview: what an answer not saved would move', () => {
  it('puts its words on each tile it names, "If you save"', () => {
    const sc = scene({ preview: { perth: 'A stretch on your budget', [CYBER]: 'AUD 3.5k over' } })
    expect(tile(sc, 'perth')?.prev).toBe('A stretch on your budget')
    expect(tile(sc, CYBER)?.prev).toBe('AUD 3.5k over')
    expect(tile(sc, 'adelaide')?.prev).toBeUndefined()
  })

  it('names no tile without one', () => {
    expect(scene().tiles.filter((t) => t.prev !== undefined)).toEqual([])
  })
})

describe('a roadmap’s saved answers on the scene', () => {
  const budget = (value: number) => ({ amount: { value, state: 'stated' as const } })

  it('a budget under the course’s fees marks the city a stretch and the course over budget', () => {
    const sc = applyAnswers(scene(), budget(30))
    expect(tile(sc, 'perth')?.kicker).toBe('A stretch on your budget')
    expect(tile(sc, CYBER)?.badges).toEqual(['over', 'offerings', 'ielts', 'fork'])
    expect(tile(sc, CYBER)?.costs).toBe('Less good for: cost (AUD 3.5k a year over budget)')
    expect(sc.badges.over).toEqual({
      kind: 'Condition',
      value: 'Over budget by AUD 3.5k',
      explanation:
        'Your budget is AUD 30k a year for fees, roughly. This course is AUD 33.5k a year.',
      icon: 'alert',
    })
  })

  it('says by how much for each budget, and drops "roughly" for a hard limit', () => {
    const sc = applyAnswers(scene(), {
      ...budget(24),
      hard: { value: 'Hard limit', state: 'stated' },
    })
    expect(sc.badges.over.value).toBe('Over budget by AUD 9.5k')
    expect(sc.badges.over.explanation).toBe(
      'Your budget is AUD 24k a year for fees. This course is AUD 33.5k a year.',
    )
    expect(tile(sc, CYBER)?.costs).toBe('Less good for: cost (AUD 9.5k a year over budget)')
  })

  it('changes nothing for a budget that covers the fees, or with no budget given', () => {
    const before = scene()
    expect(applyAnswers(before, budget(42))).toEqual(before)
    expect(applyAnswers(before, budget(36))).toEqual(before)
    expect(applyAnswers(before, {})).toEqual(before)
  })

  it('"Not taken yet" on the English test leaves the course’s condition not met', () => {
    const sc = applyAnswers(scene(), { eng: { value: 'Not taken yet', state: 'stated' } })
    expect(sc.badges.ielts.value).toBe('Not met: IELTS 6.5 by March')
    expect(sc.badges.ielts.explanation).toBe(
      'You haven’t taken an English test yet, so this condition isn’t met.',
    )
    expect(tile(sc, CYBER)?.badges).toEqual(['offerings', 'ielts', 'fork'])
    const met = applyAnswers(scene(), { eng: { value: 'IELTS 7.0', state: 'stated' } })
    expect(met.badges.ielts.value).toBe('IELTS 6.5 by March')
  })

  it('marks the course on her road, not one she swapped off it', () => {
    const sc = applyAnswers(scene({ swapped: true }), budget(30))
    expect(tile(sc, CYBER)?.badges).toEqual(['offerings', 'ielts', 'fork'])
    expect(tile(sc, 'perth')?.kicker).toBeUndefined()
  })

  it('runs inside buildScene when the answers are passed, after the session', () => {
    const sc = buildScene(road, { ...NEW_SESSION, city: true }, budget(30))
    expect(sc.here).toBe('perth')
    expect(tile(sc, 'perth')?.kicker).toBe('A stretch on your budget')
    expect(tile(sc, CYBER)?.badges?.[0]).toBe('over')
  })

  it('never changes the scene or the road it reads', () => {
    const before = scene()
    const copy = structuredClone(before)
    const roadCopy = structuredClone(road)
    applyAnswers(before, { ...budget(24), eng: { value: 'Not taken yet', state: 'stated' } })
    expect(before).toEqual(copy)
    expect(road).toEqual(roadCopy)
  })
})
