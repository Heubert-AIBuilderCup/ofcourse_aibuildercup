import { describe, expect, it } from 'bun:test'
import type { StoredAnswer, StoredAnswers } from '@/shared/types/student'
import { DIMENSIONS } from './types'
import { deriveWeights } from './weights'

const s = (value: StoredAnswer['value']): StoredAnswer => ({ value, state: 'stated' })
const assumed = (value: StoredAnswer['value']): StoredAnswer => ({ value, state: 'assumed' })

const priya: StoredAnswers = {
  hard: s('Roughly'),
  latest: s('Jul 2027'),
  earn: s('Helpful'),
  stay: s('Yes'),
  place: s('Regional'),
  community: s('A little'),
  focus: s('Career-focused'),
  learn: s('Hands-on with placements'),
}

describe('deriveWeights (DS-D3)', () => {
  it("weighs Priya's answers as the design's plaque", () => {
    expect(deriveWeights(priya)).toEqual({
      weights: { cost: 2, time: 2, work: 2, pr: 3, location: 3, career: 3 },
      reasons: {
        cost: 'A rough budget: 2',
        time: 'Latest start within a year: 2',
        work: 'Need to earn: helpful · 2',
        pr: 'Stay after: yes · 3 · routes with no PR path seal',
        location: 'Regional chosen: 2 · community matters +1',
        career: 'Career-focused: 3 · placements +1',
      },
    })
  })

  it('assumes the defaults when nothing is answered, and never weighs Family', () => {
    expect(deriveWeights({})).toEqual({
      weights: { cost: 2, time: 2, work: 2, pr: 2, location: 1, career: 2 },
      reasons: {
        cost: 'Not sure: assumed 2',
        time: 'Not sure: assumed 2',
        work: 'Not sure: assumed 2',
        pr: 'Not sure: assumed 2',
        location: 'No preference: 1',
        career: 'Not sure: assumed 2',
      },
    })
    expect(Object.keys(deriveWeights(priya).weights)).toEqual([...DIMENSIONS])
  })

  it('assumes the default when the driving answer was "Not sure", whatever else she said', () => {
    const { weights, reasons } = deriveWeights({ hard: assumed('Roughly'), who: s('Loan') })
    expect(weights.cost).toBe(2)
    expect(reasons.cost).toBe('Not sure: assumed 2')
  })

  it('weighs cost from the budget, a loan adding one, capped at 3', () => {
    const hardLoan = deriveWeights({ hard: s('Hard limit'), who: s('Loan') })
    expect(hardLoan.weights.cost).toBe(3)
    expect(hardLoan.reasons.cost).toBe('A hard limit: 3 · paying by loan +1')
    expect(deriveWeights({ hard: s('Hard limit') }).reasons.cost).toBe('A hard limit: 3')
    const roughLoan = deriveWeights({ hard: s('Roughly'), who: s('Loan') })
    expect(roughLoan.weights.cost).toBe(3)
    expect(roughLoan.reasons.cost).toBe('A rough budget: 2 · paying by loan +1')
  })

  it('weighs time by the months from 1 Oct 2026 to the latest start', () => {
    const soon = deriveWeights({ latest: s('Feb 2027') })
    expect([soon.weights.time, soon.reasons.time]).toEqual([3, 'Latest start within 6 months: 3'])
    const later = deriveWeights({ latest: s('Feb 2028') })
    expect([later.weights.time, later.reasons.time]).toEqual([
      1,
      'Latest start more than a year away: 1',
    ])
    const short = deriveWeights({ latest: s('Feb 2027'), length: s('As short as possible') })
    expect([short.weights.time, short.reasons.time]).toEqual([
      3,
      'Latest start within 6 months: 3 · as short as possible +1',
    ])
    const shortYear = deriveWeights({ latest: s('Jul 2027'), length: s('As short as possible') })
    expect([shortYear.weights.time, shortYear.reasons.time]).toEqual([
      3,
      'Latest start within a year: 2 · as short as possible +1',
    ])
  })

  it('weighs work by the need to earn', () => {
    expect(deriveWeights({ earn: s('Yes') }).reasons.work).toBe('Need to earn: yes · 3')
    expect(deriveWeights({ earn: s('Yes') }).weights.work).toBe(3)
    expect(deriveWeights({ earn: s('No') }).reasons.work).toBe('Need to earn: no · 1')
    expect(deriveWeights({ earn: s('No') }).weights.work).toBe(1)
  })

  it('weighs PR by staying after: 0 when she will not stay', () => {
    const no = deriveWeights({ stay: s('No') })
    expect([no.weights.pr, no.reasons.pr]).toEqual([0, 'Stay after: no · 0'])
    const notSure = deriveWeights({ stay: s('Not sure') })
    expect([notSure.weights.pr, notSure.reasons.pr]).toEqual([2, 'Stay after: not sure · 2'])
  })

  it('weighs location by the kind of place, community adding one only when stated', () => {
    const city = deriveWeights({ place: s('City'), community: s('Yes') })
    expect([city.weights.location, city.reasons.location]).toEqual([
      3,
      'City chosen: 2 · community matters +1',
    ])
    const alone = deriveWeights({ place: s('Suburban'), community: s('No') })
    expect([alone.weights.location, alone.reasons.location]).toEqual([2, 'Suburban chosen: 2'])
    const unsaid = deriveWeights({ place: s('Regional'), community: assumed('A little') })
    expect([unsaid.weights.location, unsaid.reasons.location]).toEqual([2, 'Regional chosen: 2'])
  })

  it('reads an assumed place as no preference', () => {
    const { weights, reasons } = deriveWeights({ place: assumed('Suburban'), community: s('Yes') })
    expect([weights.location, reasons.location]).toEqual([1, 'No preference: 1'])
  })

  it('weighs career by focus, placements adding one only when stated', () => {
    const academic = deriveWeights({ focus: s('Academic') })
    expect([academic.weights.career, academic.reasons.career]).toEqual([1, 'Academic: 1'])
    const handsOn = deriveWeights({ focus: s('Academic'), learn: s('Hands-on with placements') })
    expect([handsOn.weights.career, handsOn.reasons.career]).toEqual([
      2,
      'Academic: 1 · placements +1',
    ])
    const career = deriveWeights({ focus: s('Career-focused') })
    expect([career.weights.career, career.reasons.career]).toEqual([3, 'Career-focused: 3'])
  })
})
