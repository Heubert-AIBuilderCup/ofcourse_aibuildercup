import { describe, expect, it } from 'bun:test'
import { stated } from './demo-profiles'
import { eligibleRoads, levelsOpenTo } from './eligibility'

describe('eligibleRoads: the roads her qualification lets her be offered', () => {
  it('never falls back above her level: a school leaver with only Master’s roads gets none', () => {
    const roads = [{ level: "Master's" as const }]
    expect(eligibleRoads(stated({ qual: 'High school' }), roads)).toEqual([])
    expect(eligibleRoads(stated({ qual: 'Not sure' }), roads)).toEqual(roads)
  })
})

describe('levelsOpenTo: the levels her qualification lets her enter', () => {
  it('opens a Diploma or a Bachelor’s to a school leaver', () => {
    expect(levelsOpenTo(stated({ qual: 'High school' }))).toEqual(['Diploma', "Bachelor's"])
  })

  it('opens a Bachelor’s to a Diploma holder', () => {
    expect(levelsOpenTo(stated({ qual: 'Diploma' }))).toEqual(["Bachelor's"])
  })

  it('opens a Master’s to a Bachelor’s or a Master’s holder', () => {
    expect(levelsOpenTo(stated({ qual: "Bachelor's" }))).toEqual(["Master's"])
    expect(levelsOpenTo(stated({ qual: "Master's" }))).toEqual(["Master's"])
  })

  it('gates nothing when she did not say, said not sure, or the answer is only assumed', () => {
    expect(levelsOpenTo({})).toBeNull()
    expect(levelsOpenTo(stated({ qual: 'Not sure' }))).toBeNull()
    expect(levelsOpenTo({ qual: { value: 'High school', state: 'assumed' } })).toBeNull()
  })
})
