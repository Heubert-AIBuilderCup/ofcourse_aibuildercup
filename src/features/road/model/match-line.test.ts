import { describe, expect, test } from 'bun:test'
import { cityById } from '@/features/engine/catalogue'
import { matchRoad } from '@/features/roads'
import { relativeAt, stated } from '@/features/roads/model/demo-profiles'
import { matchLine } from './match-line'

const CLOSEST = 'Closest road to your answers'
const DRAWN = "A few areas I'm drawn to"

describe('matchLine', () => {
  test('a matched road says nothing', () => {
    expect(matchLine({ kind: 'matched', differences: [] })).toBeNull()
  })
  test('the switch off says nothing', () => {
    expect(matchLine({ kind: 'off', differences: [] })).toBeNull()
  })
  test('the nearest road names one chip per difference', () => {
    expect(
      matchLine({
        kind: 'nearest',
        differences: [{ key: 'level', yours: 'Diploma', road: "Master's" }],
      }),
    ).toEqual({ title: CLOSEST, chips: ["Level: this road is a Master's (you said Diploma)"] })
  })
  test('each chip says in plain words what the difference means for its key (criterion 75)', () => {
    const line = matchLine({
      kind: 'nearest',
      differences: [
        { key: 'place', yours: 'regional, which points to Perth or Adelaide', road: 'Sydney' },
        { key: 'place', yours: 'career-focused', road: 'Sydney', because: 'for its job market' },
        { key: 'field', yours: 'Cyber security', road: 'Data science' },
        { key: 'areas', yours: 'Health', road: 'Data science' },
        { key: 'stay', yours: 'Yes', road: 'Goes home' },
        {
          key: 'qual',
          yours: 'High school',
          road: 'Diploma',
          because:
            "Design is taught here only as a Master's, which your qualification does not open",
        },
      ],
    })
    expect(line?.chips).toEqual([
      'City: Sydney (you said regional, which points to Perth or Adelaide)',
      'City: Sydney, for its job market (you said career-focused)',
      'Field: this road is Data science (you picked Cyber security)',
      'Field: this road is Data science (you picked Health)',
      "Staying: this road ends at home (you said you'd stay)",
      "Qualification: this road is a Diploma; Design is taught here only as a Master's, which your qualification does not open (you said High school)",
    ])
  })
  test('a staying chip reads each of her answers in words', () => {
    const line = matchLine({
      kind: 'nearest',
      differences: [
        { key: 'stay', yours: 'Not sure', road: 'Goes home' },
        { key: 'stay', yours: 'No', road: 'Stays' },
        { key: 'stay', yours: 'Yes', road: 'No clear PR' },
      ],
    })
    expect(line?.chips).toEqual([
      "Staying: this road ends at home (you said you're not sure)",
      "Staying: this road leads to staying (you said you'd go home)",
      "Staying: this road has no clear road to PR (you said you'd stay)",
    ])
  })
  test('no chip pairs a key with another question’s answer', () => {
    const m = matchRoad(
      stated({
        stay: 'Yes',
        know: "A few areas I'm drawn to",
        areas: ['Design'],
        qual: 'High school',
        level: "Master's",
      }),
      null,
    )
    const chips = matchLine({ kind: 'nearest', differences: m.differences })?.chips ?? []
    expect(chips).toContain("Level: this road is a Diploma (you said Master's)")
    expect(
      chips.filter((c) => c.includes('High school') && !c.startsWith('Qualification:')),
    ).toEqual([])
    expect(
      chips.filter((c) => c.startsWith('Field:') && !c.endsWith('(you picked Design)')),
    ).toEqual([])
  })
  test('a city chip names the road’s own city, never one her hint named instead', () => {
    const sibling = { ...relativeAt('sydney-cbd'), relationship: 'Sibling' as const }
    const cases = [
      {
        answers: stated({ stay: 'Yes', know: DRAWN, areas: ['Health'], focus: 'Career-focused' }),
        relative: null,
      },
      {
        answers: stated({ stay: 'Yes', know: DRAWN, areas: ['Design'], place: 'Regional' }),
        relative: null,
      },
      { answers: stated({ stay: 'Yes', know: DRAWN, areas: ['Health'] }), relative: sibling },
    ]
    const chips = cases.map(({ answers, relative }) => {
      const m = matchRoad(answers, relative)
      const line = matchLine({ kind: 'nearest', differences: m.differences })?.chips ?? []
      return {
        city: cityById(m.spec.cityId).name,
        chips: line.filter((c) => c.startsWith('City:')),
      }
    })
    expect(chips.map((c) => c.chips.length)).toEqual([1, 1, 1])
    for (const {
      city,
      chips: [chip],
    } of chips)
      expect(chip?.startsWith(`City: ${city} (`)).toBe(true)
    expect(chips.map((c) => c.chips[0])).toEqual([
      `City: ${chips[0].city} (you said career-focused, which points to Sydney)`,
      'City: Melbourne (you said regional, which points to Perth or Adelaide)',
      `City: ${chips[2].city} (you said Sydney CBD, where your sibling lives)`,
    ])
  })
  test('the nearest road with no differences still says it is the closest', () => {
    expect(matchLine({ kind: 'nearest', differences: [] })).toEqual({ title: CLOSEST, chips: [] })
  })
  test('the illustrative road says it is drawn in the same shape', () => {
    expect(matchLine({ kind: 'illustrative', differences: [] })).toEqual({
      title: 'An illustrative road, drawn in the same shape as yours',
      chips: [],
    })
  })
})
