import { describe, expect, it } from 'bun:test'
import type { FutureId, StoredAnswer, StoredAnswers } from '@/shared/types/student'
import { COURSES } from './catalogue'
import { ANJALI, PRIYA_ANSWERS } from './fixtures'
import {
  buildFutures,
  diffFutures,
  FUTURE_CHIPS,
  FUTURE_HEADINGS,
  type Future,
  type FutureLine,
  type FuturesResult,
} from './futures'
import { DIMENSIONS, type Dimension } from './types'

const s = (value: StoredAnswer['value']): StoredAnswer => ({ value, state: 'stated' })
const assumed = (value: StoredAnswer['value']): StoredAnswer => ({ value, state: 'assumed' })

const priya = PRIYA_ANSWERS
const anjali = ANJALI
const build = (answers: StoredAnswers) => buildFutures({ answers, relative: anjali })

type Futures = Extract<FuturesResult, { kind: 'futures' }>
type Sealed = Extract<FuturesResult, { kind: 'sealed' }>

function futuresOf(r: FuturesResult): Futures {
  if (r.kind !== 'futures') throw new Error(`Expected futures, got ${r.kind}`)
  return r
}
function sealedOf(r: FuturesResult): Sealed {
  if (r.kind !== 'sealed') throw new Error(`Expected sealed, got ${r.kind}`)
  return r
}
function future(r: FuturesResult, id: FutureId): Future {
  const found = futuresOf(r).futures.find((f) => f.id === id)
  if (!found) throw new Error(`No ${id} future`)
  return found
}
function line(r: FuturesResult, id: FutureId, dim: Dimension): FutureLine {
  const found = future(r, id).lines.find((l) => l.dim === dim)
  if (!found) throw new Error(`No ${dim} line on the ${id} future`)
  return found
}
const courseIds = (r: FuturesResult) => futuresOf(r).futures.map((f) => [f.id, f.courseId])
const feeOf = (courseId: string) => COURSES.find((c) => c.id === courseId)?.feeK
const course = (id: string) => {
  const found = COURSES.find((c) => c.id === id)
  if (!found) throw new Error(`No course ${id}`)
  return found
}

const AREAS = "A few areas I'm drawn to"
const ALL: Dimension[] = [...DIMENSIONS]

describe('FUTURE_HEADINGS and FUTURE_CHIPS', () => {
  it('head each future by what it is built around', () => {
    expect(FUTURE_HEADINGS).toEqual({
      cost: 'Built around cost',
      staying: 'Built around staying',
      career: 'Built around career',
    })
  })

  it('name the answers each future rests on', () => {
    expect(FUTURE_CHIPS).toEqual({
      cost: ['amount', 'hard', 'place', 'field', 'latest'],
      staying: ['amount', 'stay', 'earn', 'level', 'field'],
      career: ['amount', 'dest', 'field', 'earn'],
    })
  })
})

describe("buildFutures: Priya's three futures", () => {
  const r = buildFutures({ answers: priya, relative: anjali })

  it('builds one future around cost, one around staying, one around career, each a different course', () => {
    expect(r.kind).toBe('futures')
    expect(courseIds(r)).toEqual([
      ['cost', 'unisa-cyber'],
      ['staying', 'ecu-cyber'],
      ['career', 'uts-cyber'],
    ])
    expect(futuresOf(r).futures.map((f) => f.heading)).toEqual([
      'Built around cost',
      'Built around staying',
      'Built around career',
    ])
    expect(futuresOf(r).notices).toEqual([])
  })

  it('weighs her answers by DS-D3 and carries the reasons for the plaque', () => {
    expect(r.weights).toEqual({ cost: 2, time: 2, work: 2, pr: 3, location: 3, career: 3 })
    expect(r.reasons.cost).toBe('A rough budget: 2')
  })

  it('gives each future one line per dimension, in order', () => {
    for (const f of futuresOf(r).futures) expect(f.lines.map((l) => l.dim)).toEqual(ALL)
  })

  it('reads the cost line against her budget, with its feel', () => {
    expect(line(r, 'cost', 'cost')).toMatchObject({
      effect: 'neutral',
      text: 'Fees about AUD 27k a year: within your budget, only AUD 3k spare',
      feel: 'fine',
    })
    expect(line(r, 'staying', 'cost')).toMatchObject({
      effect: 'costs',
      text: 'Fees about AUD 33k a year: AUD 3k over, a stretch on a rough budget',
      feel: 'stretched',
    })
    expect(line(r, 'career', 'cost')).toMatchObject({
      effect: 'costs',
      text: 'Fees about AUD 47k a year: AUD 17k over your budget',
      feel: 'hard',
    })
    expect(line(r, 'cost', 'cost').claim).toEqual(course('unisa-cyber').feeClaim)
  })

  it('takes the time, work, PR and career lines from the course, R1 marked not sure', () => {
    const adelaide = course('unisa-cyber').lines
    for (const dim of ['time', 'work', 'pr', 'career'] as const) {
      expect(line(r, 'cost', dim)).toMatchObject(adelaide[dim])
    }
    expect(line(r, 'cost', 'career').claim.notSure).toBe(true)
    expect(line(r, 'staying', 'career').claim.notSure).toBe(false)
  })

  it('gives every claim strength pips and a data state, and PR as a band, never a number', () => {
    for (const f of futuresOf(r).futures) {
      for (const l of f.lines) {
        expect(l.claim.pips).toBeGreaterThanOrEqual(1)
        expect(l.claim.pips).toBeLessThanOrEqual(5)
        expect(l.claim.state).toBeString()
      }
      const pr = f.lines.find((l) => l.dim === 'pr')
      expect(pr?.claim.detail[0]).toBe("A band, not a number: we don't predict this for you")
      expect(pr?.text).not.toMatch(/%|chance|probab/i)
    }
  })

  it('reads location from the city and her kind of place', () => {
    expect(line(r, 'cost', 'location')).toMatchObject({
      effect: 'gives',
      text: 'Counts as regional; rent about 30% below Sydney',
      feel: 'relieved',
    })
    expect(line(r, 'career', 'location')).toMatchObject({
      effect: 'costs',
      text: 'The highest rents in the country',
      feel: 'hard',
    })
  })

  it('writes the route on one line, and the distance from Anjali', () => {
    expect(futuresOf(r).futures[0].route).toBe(
      'Adelaide · Master of Cyber Security, UniSA · 491 regional visa, then PR',
    )
    expect(future(r, 'cost').distance).toBe(
      'Adelaide: a 3½-hour flight from Anjali in Perth · estimate',
    )
    expect(future(r, 'staying').distance).toMatch(
      /^ECU Joondalup: about \d+ min from Anjali in Cannington · estimate$/,
    )
  })

  it('marks the dimensions she weighs most, and what each future is strong on and costs', () => {
    expect(line(r, 'cost', 'pr').weighMost).toBe(true)
    expect(line(r, 'cost', 'location').weighMost).toBe(true)
    expect(line(r, 'cost', 'career').weighMost).toBe(true)
    expect(line(r, 'cost', 'cost').weighMost).toBe(false)
    expect(future(r, 'cost').strongOn).toEqual(['pr', 'location'])
    expect(future(r, 'cost').costsOn).toEqual(['time', 'career'])
  })

  it('lists the chips each future rests on, then her unsaid answers, and a way to keep options open', () => {
    // Priya left who pays, course length and destination unsaid: each is assumed, so each shows.
    expect(future(r, 'cost').chips).toEqual([...FUTURE_CHIPS.cost, 'who', 'length', 'dest'])
    expect(future(r, 'staying').chips).toEqual([...FUTURE_CHIPS.staying, 'who', 'length', 'dest'])
    expect(future(r, 'career').chips).toEqual([...FUTURE_CHIPS.career, 'who', 'length'])
    expect(future(r, 'cost').keepOpen).toEqual({
      text: 'Apply to two intakes (Feb and Jul 2027)',
      doors: 'keeps 2 doors open',
    })
  })

  it('has no distance when she named no one', () => {
    const alone = buildFutures({ answers: priya, relative: null })
    for (const f of futuresOf(alone).futures) expect(f.distance).toBeNull()
  })

  it('is the same every time for the same answers', () => {
    const input = { answers: priya, relative: anjali }
    expect(buildFutures(input)).toEqual(buildFutures(input))
    expect(buildFutures({ answers: {}, relative: null })).toEqual(
      buildFutures({ answers: {}, relative: null }),
    )
  })

  it('never takes the coins as an input (DS-R7)', () => {
    const coins = { state: 'spent', piles: [5, 5, 0, 0, 0, 0, 0, 0], assumed: false }
    // @ts-expect-error coins are not an input to the futures
    expect(buildFutures({ answers: priya, relative: anjali, coins })).toEqual(r)
  })
})

describe('buildFutures: the budget', () => {
  it('redraws the cost lines from a new amount', () => {
    const r = build({ ...priya, amount: s(36) })
    expect(line(r, 'cost', 'cost')).toMatchObject({
      effect: 'gives',
      text: 'Fees about AUD 27k a year: within your budget, AUD 9k spare',
      feel: 'relieved',
    })
    expect(line(r, 'staying', 'cost')).toMatchObject({
      effect: 'neutral',
      text: 'Fees about AUD 33k a year: within your budget, only AUD 3k spare',
    })
    expect(line(r, 'career', 'cost')).toMatchObject({
      effect: 'costs',
      text: 'Fees about AUD 47k a year: AUD 11k over your budget',
      feel: 'hard',
    })
  })

  it('counts living costs when the budget covers fees and living', () => {
    const r = build({ ...priya, amount: s(42), covers: s('Fees and living') })
    expect(line(r, 'cost', 'cost')).toMatchObject({
      effect: 'costs',
      text: 'Fees and living about AUD 47k a year: AUD 5k over, a stretch on a rough budget',
      feel: 'stretched',
    })
  })

  it('keeps every future within a hard limit', () => {
    const r = build({ ...priya, amount: s(36), hard: s('Hard limit') })
    expect(courseIds(r)).toEqual([
      ['cost', 'unisa-cyber'],
      ['staying', 'ecu-cyber'],
      ['career', 'deakin-cyber'],
    ])
    for (const f of futuresOf(r).futures) expect(feeOf(f.courseId)).toBeLessThanOrEqual(36)
  })

  it('shows only the routes that fit a hard limit, and says which chip opens more', () => {
    const r = build({ ...priya, hard: s('Hard limit') })
    expect(courseIds(r)).toEqual([['cost', 'unisa-cyber']])
    expect(futuresOf(r).notices).toEqual([
      { kind: 'fewer', text: 'Only one route fits a hard limit of AUD 30k', chip: 'amount' },
    ])
  })

  it('counts more than one route that fits a hard limit', () => {
    const r = build({ ...priya, amount: s(33), hard: s('Hard limit') })
    expect(courseIds(r)).toEqual([
      ['cost', 'unisa-cyber'],
      ['staying', 'ecu-cyber'],
    ])
    expect(futuresOf(r).notices).toEqual([
      { kind: 'fewer', text: 'Only 2 routes fit a hard limit of AUD 33k', chip: 'amount' },
    ])
  })

  it('blames the fields, not a hard limit that ruled nothing out', () => {
    const r = build({
      ...priya,
      field: s('Business analytics'),
      amount: s(42),
      hard: s('Hard limit'),
    })
    expect(courseIds(r)).toEqual([['cost', 'deakin-ba']])
    expect(futuresOf(r).notices).toEqual([
      { kind: 'fewer', text: 'Only one route in this preview for these fields', chip: 'field' },
    ])
  })

  it('seals at a hard limit that rules out every route, with the nearest three', () => {
    const r = build({ ...priya, amount: s(24), hard: s('Hard limit') })
    expect(r).toMatchObject({
      kind: 'sealed',
      budgetK: 24,
      weights: { cost: 3 },
      notices: [],
    })
    expect(sealedOf(r).nearest).toEqual([
      {
        courseId: 'unisa-cyber',
        route: 'Adelaide · Master of Cyber Security, UniSA · 491 regional visa, then PR',
        overByK: 3,
      },
      {
        courseId: 'ecu-cyber',
        route: 'Perth · Master of Cyber Security, ECU · 190 state nomination, then PR',
        overByK: 9,
      },
      {
        courseId: 'deakin-cyber',
        route: 'Geelong · Master of Cyber Security, Deakin · 491 regional visa, then PR',
        overByK: 11,
      },
    ])
  })

  it('seals on fees and living when that is what breaks the limit', () => {
    const r = build({
      ...priya,
      amount: s(42),
      covers: s('Fees and living'),
      hard: s('Hard limit'),
    })
    expect(sealedOf(r).nearest.map((n) => [n.courseId, n.overByK])).toEqual([
      ['unisa-cyber', 5],
      ['ecu-cyber', 12],
      ['deakin-cyber', 15],
    ])
  })
})

describe('buildFutures: staying', () => {
  it("weighs PR at 0 and reads every PR line neutral when she won't stay", () => {
    const r = build({ ...priya, stay: s('No') })
    expect(r.weights.pr).toBe(0)
    for (const f of futuresOf(r).futures) {
      const pr = f.lines.find((l) => l.dim === 'pr')
      expect(pr).toMatchObject({
        effect: 'neutral',
        text: "PR doesn't count here: you don't plan to stay",
        feel: 'fine',
        claim: course(f.courseId).lines.pr.claim,
      })
    }
  })

  it('drops routes with no road to PR when she wants to stay, and says so', () => {
    const r = build({ know: s(AREAS), areas: s(['Health']), stay: s('Yes') })
    expect(futuresOf(r).futures).toEqual([])
    expect(futuresOf(r).notices).toEqual([
      {
        kind: 'field-substituted',
        text: 'No health courses in this preview, so these use psychology.',
        chip: 'field',
      },
      {
        kind: 'fewer',
        text: 'No route in this preview has a road to permanent residency for these fields',
        chip: 'stay',
      },
    ])
  })

  it('counts the routes left with a road to PR', () => {
    const r = build({ ...priya, know: s(AREAS), areas: s(['Health', 'Business']) })
    expect(courseIds(r)).toEqual([['cost', 'deakin-ba']])
    expect(futuresOf(r).notices.at(-1)).toEqual({
      kind: 'fewer',
      text: 'Only one route with a road to permanent residency',
      chip: 'stay',
    })
  })

  it('blames staying, not a hard limit that ruled nothing out', () => {
    const r = build({ know: s(AREAS), areas: s(['Health']), stay: s('Yes'), hard: s('Hard limit') })
    expect(r.kind).toBe('futures')
    expect(futuresOf(r).notices.at(-1)?.chip).toBe('stay')
  })
})

describe('buildFutures: fields and levels', () => {
  it('uses the nearest covered field for an area the preview lacks, and says so', () => {
    const r = build({ know: s(AREAS), areas: s(['Health']) })
    expect(courseIds(r)).toEqual([['cost', 'swin-cyberpsych']])
    expect(futuresOf(r).notices).toEqual([
      {
        kind: 'field-substituted',
        text: 'No health courses in this preview, so these use psychology.',
        chip: 'field',
      },
      { kind: 'fewer', text: 'Only one route in this preview for these fields', chip: 'field' },
    ])
  })

  it('takes the union of the areas she picked', () => {
    const r = build({ ...priya, know: s(AREAS), areas: s(['IT and computing']) })
    expect(courseIds(r)).toEqual([
      ['cost', 'unisa-cyber'],
      ['staying', 'utas-it'],
      ['career', 'uts-cyber'],
    ])
    expect(futuresOf(r).notices).toEqual([])
  })

  it('changes the routes with the field', () => {
    const r = build({ ...priya, field: s('Data science') })
    expect(courseIds(r)).toEqual([
      ['cost', 'monash-data'],
      ['staying', 'uts-data'],
    ])
    expect(futuresOf(r).notices).toEqual([
      { kind: 'fewer', text: 'Only 2 routes in this preview for these fields', chip: 'field' },
    ])
  })

  it('changes the routes with the level', () => {
    const diploma = build({ ...priya, level: s('Diploma'), stay: s('Not sure') })
    expect(courseIds(diploma)).toEqual([['cost', 'tafe-cyber']])
    const bachelor = build({ ...priya, level: s("Bachelor's") })
    expect(courseIds(bachelor)).toEqual([['cost', 'ecu-bsc-cyber']])
  })

  it('shows other levels when the fields have none at hers, and says so', () => {
    const r = build({ ...priya, field: s('Business analytics'), level: s("Bachelor's") })
    expect(courseIds(r)).toEqual([['cost', 'deakin-ba']])
    expect(futuresOf(r).notices[0]).toEqual({
      kind: 'level-substituted',
      text: "No Bachelor's courses for these fields in this preview, so these show other levels.",
      chip: 'level',
    })
  })

  it('says the futures are Australian when she is open to other countries', () => {
    const r = build({ ...priya, dest: s('Open to others') })
    expect(futuresOf(r).notices).toEqual([
      {
        kind: 'australia-only',
        text: 'Only Australia is covered in this preview, so these futures are Australian.',
      },
    ])
  })
})

describe('buildFutures: the chips', () => {
  const stated = {
    ...priya,
    who: s('Family'),
    length: s('As short as possible'),
    dest: s('Australia'),
  }

  it('adds a chip for a "Not sure" on any answer the engine reads, on every future', () => {
    const unsure = futuresOf(build({ ...stated, focus: assumed('Career-focused') }))
    for (const f of unsure.futures) expect(f.chips).toEqual([...FUTURE_CHIPS[f.id], 'focus'])
  })

  it('adds nothing beyond the fixed chips when every answer it reads is stated', () => {
    for (const f of futuresOf(build(stated)).futures) expect(f.chips).toEqual(FUTURE_CHIPS[f.id])
  })

  it('lists the assumed answers in question order, after the fixed ones, each once', () => {
    const f = futuresOf(buildFutures({ answers: {}, relative: null })).futures[0]
    expect(f.chips).toEqual([
      ...FUTURE_CHIPS.cost,
      'covers',
      'who',
      'level',
      'learn',
      'length',
      'dest',
      'community',
      'stay',
      'focus',
      'earn',
    ])
  })

  it('never makes a chip of an answer the engine does not read, or one with no default', () => {
    const f = futuresOf(buildFutures({ answers: {}, relative: null })).futures[0]
    for (const key of [
      'where',
      'earliest',
      'years',
      'dep',
      'qual',
      'eng',
      'knows',
      'areas',
      'climate',
      'settle',
    ] as const) {
      expect(f.chips).not.toContain(key)
    }
  })
})

describe('buildFutures: nothing answered', () => {
  const r = buildFutures({ answers: {}, relative: null })

  it('builds three futures from the defaults, over every field', () => {
    expect(courseIds(r)).toEqual([
      ['cost', 'unisa-cyber'],
      ['staying', 'utas-it'],
      ['career', 'uts-cyber'],
    ])
    expect(futuresOf(r).notices).toEqual([])
  })

  it('reads an assumed place as no preference', () => {
    for (const f of futuresOf(r).futures) {
      expect(f.lines.find((l) => l.dim === 'location')?.effect).toBe('neutral')
    }
    const unsaid = build({ ...priya, place: assumed('Suburban') })
    expect(line(unsaid, 'cost', 'location').effect).toBe('neutral')
  })

  it('weighs most every dimension at the top weight of 2 or more', () => {
    expect(futuresOf(r).futures[0].lines.map((l) => [l.dim, l.weighMost])).toEqual([
      ['cost', true],
      ['time', true],
      ['work', true],
      ['pr', true],
      ['location', false],
      ['career', true],
    ])
  })
})

describe('buildFutures: kind of place', () => {
  it('gives in a metro city and stays neutral in a regional one for a city person', () => {
    const r = build({ ...priya, place: s('City') })
    expect(line(r, 'cost', 'location').effect).toBe('neutral')
    expect(line(r, 'career', 'location').effect).toBe('gives')
  })

  it('stays neutral for a suburban person', () => {
    const r = build({ ...priya, place: s('Suburban') })
    for (const f of futuresOf(r).futures) {
      expect(f.lines.find((l) => l.dim === 'location')?.effect).toBe('neutral')
    }
  })
})

describe('diffFutures', () => {
  const before = build(priya)

  it('marks nothing when nothing changed', () => {
    expect(diffFutures(before, build(priya))).toEqual({})
  })

  it('marks the cost line on every future when the amount changes', () => {
    expect(diffFutures(before, build({ ...priya, amount: s(36) }))).toEqual({
      cost: ['cost'],
      staying: ['cost'],
      career: ['cost'],
    })
  })

  it('marks a line whose feel alone changed', () => {
    expect(diffFutures(before, build({ ...priya, who: s('Loan') }))).toEqual({
      staying: ['cost'],
    })
  })

  it('marks all six dimensions on a future whose course changed', () => {
    expect(diffFutures(before, build({ ...priya, field: s('Data science') }))).toEqual({
      cost: ALL,
      staying: ALL,
    })
  })

  it('marks every future that appears out of a sealed result, and none that leave', () => {
    const sealed = build({ ...priya, amount: s(24), hard: s('Hard limit') })
    const one = build({ ...priya, hard: s('Hard limit') })
    expect(diffFutures(sealed, one)).toEqual({ cost: ALL })
    expect(diffFutures(one, sealed)).toEqual({})
  })
})
