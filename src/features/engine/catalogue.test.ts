import { describe, expect, it } from 'bun:test'
import { questionOf } from '@/features/opening'
import {
  AREA_FIELDS,
  CAMPUSES,
  CITIES,
  COURSES,
  campusOf,
  cityById,
  cityOf,
  FIELD_LABELS,
  FIELD_OF_OPTION,
  PLACES,
  PREVIEW_TODAY,
  placeById,
} from './catalogue'
import type { Claim, Course } from './types'

const course = (id: string): Course => {
  const found = COURSES.find((c) => c.id === id)
  if (!found) throw new Error(`No course ${id}`)
  return found
}

/** Every claim in the catalogue, named by where it sits. */
const claims = (): [string, Claim][] => [
  ...CITIES.map((c): [string, Claim] => [`${c.id} location`, c.location.claim]),
  ...COURSES.flatMap((c): [string, Claim][] => [
    [`${c.id} fee`, c.feeClaim],
    ...Object.entries(c.lines).map(([dim, line]): [string, Claim] => [
      `${c.id} ${dim}`,
      line.claim,
    ]),
  ]),
]

/** Every sentence the catalogue can put on a screen. */
const prose = (): string[] => [
  ...CITIES.map((c) => c.location.text),
  ...COURSES.flatMap((c) => [
    c.name,
    c.route,
    c.keepOpen.text,
    c.keepOpen.doors,
    ...Object.values(c.lines).map((line) => line.text),
  ]),
  ...claims().flatMap(([, claim]) => [claim.source, ...claim.detail]),
]

describe('the mock catalogue', () => {
  it('is dated 1 October 2026', () => {
    expect(PREVIEW_TODAY).toBe('2026-10-01')
  })

  it('holds the seven cities with their regional status, living costs and places', () => {
    expect(CITIES.map((c) => [c.id, c.name, c.regional, c.livingK, c.lat, c.lng])).toEqual([
      ['perth', 'Perth', true, 21, -31.952, 115.861],
      ['adelaide', 'Adelaide', true, 20, -34.929, 138.601],
      ['sydney', 'Sydney', false, 28, -33.869, 151.209],
      ['melbourne', 'Melbourne', false, 25, -37.814, 144.963],
      ['geelong', 'Geelong', true, 22, -38.149, 144.361],
      ['hobart', 'Hobart', true, 21, -42.882, 147.327],
      ['wollongong', 'Wollongong', true, 24, -34.425, 150.893],
    ])
    expect(
      CITIES.map((c) => [c.id, c.location.text, c.location.claim.pips, c.location.claim.state]),
    ).toEqual([
      [
        'perth',
        'Counts as regional; rent about AUD 160 a week lower than Sydney (about 30%)',
        4,
        'estimated',
      ],
      ['adelaide', 'Counts as regional; rent about 30% below Sydney', 4, 'estimated'],
      ['sydney', 'The highest rents in the country', 1, 'estimated'],
      ['melbourne', "A big city; rents below Sydney's", 2, 'estimated'],
      ['geelong', 'Counts as regional; an hour from Melbourne', 4, 'confirmed'],
      ['hobart', 'Counts as regional; a small city with a tight rental market', 3, 'estimated'],
      ['wollongong', 'Counts as regional; 90 minutes from Sydney by train', 4, 'confirmed'],
    ])
  })

  it('holds the seventeen places and ten campuses, each in a city it has', () => {
    expect(PLACES.map((p) => [p.id, p.name, p.cityId, p.lat, p.lng])).toEqual([
      ['perth-cbd', 'Perth CBD', 'perth', -31.952, 115.861],
      ['cannington', 'Cannington', 'perth', -32.017, 115.935],
      ['joondalup', 'Joondalup', 'perth', -31.745, 115.766],
      ['bentley', 'Bentley', 'perth', -32.001, 115.9],
      ['adelaide-cbd', 'Adelaide CBD', 'adelaide', -34.929, 138.601],
      ['mawson-lakes', 'Mawson Lakes', 'adelaide', -34.81, 138.61],
      ['sydney-cbd', 'Sydney CBD', 'sydney', -33.869, 151.209],
      ['parramatta', 'Parramatta', 'sydney', -33.815, 151.001],
      ['strathfield', 'Strathfield', 'sydney', -33.873, 151.094],
      ['melbourne-cbd', 'Melbourne CBD', 'melbourne', -37.814, 144.963],
      ['footscray', 'Footscray', 'melbourne', -37.8, 144.9],
      ['clayton', 'Clayton', 'melbourne', -37.915, 145.129],
      ['geelong', 'Geelong', 'geelong', -38.149, 144.361],
      ['waurn-ponds', 'Waurn Ponds', 'geelong', -38.21, 144.3],
      ['hobart', 'Hobart', 'hobart', -42.882, 147.327],
      ['sandy-bay', 'Sandy Bay', 'hobart', -42.904, 147.325],
      ['wollongong', 'Wollongong', 'wollongong', -34.425, 150.893],
    ])
    expect(CAMPUSES.map((c) => [c.id, c.name, c.cityId, c.lat, c.lng])).toEqual([
      ['ecu-joondalup', 'ECU Joondalup', 'perth', -31.752, 115.77],
      ['curtin-bentley', 'Curtin Bentley', 'perth', -32.006, 115.894],
      ['tafe-perth', 'TAFE Perth', 'perth', -31.949, 115.858],
      ['unisa-city-west', 'UniSA City West', 'adelaide', -34.924, 138.592],
      ['uts-ultimo', 'UTS Ultimo', 'sydney', -33.883, 151.2],
      ['monash-clayton', 'Monash Clayton', 'melbourne', -37.911, 145.134],
      ['swinburne-hawthorn', 'Swinburne Hawthorn', 'melbourne', -37.822, 145.039],
      ['deakin-waurn-ponds', 'Deakin Waurn Ponds', 'geelong', -38.198, 144.298],
      ['utas-sandy-bay', 'UTAS Sandy Bay', 'hobart', -42.903, 147.325],
      ['uow-wollongong', 'UOW Wollongong', 'wollongong', -34.405, 150.878],
    ])
    const cityIds = new Set(CITIES.map((c) => c.id))
    for (const p of [...PLACES, ...CAMPUSES]) expect(cityIds.has(p.cityId)).toBe(true)
  })

  it('holds the fourteen courses with their fixed figures', () => {
    expect(
      COURSES.map((c) => [
        c.id,
        c.campusId,
        c.field,
        c.level,
        c.feeK,
        c.years,
        c.prScore,
        c.careerScore,
        c.placements,
      ]),
    ).toEqual([
      ['ecu-cyber', 'ecu-joondalup', 'cyber', "Master's", 33, 2, 3, 3, true],
      ['curtin-it', 'curtin-bentley', 'it', "Master's", 34, 2, 3, 3, true],
      ['unisa-cyber', 'unisa-city-west', 'cyber', "Master's", 27, 2, 3, 2, false],
      ['unisa-it', 'unisa-city-west', 'it', "Master's", 29, 2, 3, 2, false],
      ['uts-cyber', 'uts-ultimo', 'cyber', "Master's", 47, 2, 1, 5, true],
      ['uts-data', 'uts-ultimo', 'data', "Master's", 49, 2, 1, 5, true],
      ['monash-data', 'monash-clayton', 'data', "Master's", 45, 2, 1, 4, false],
      ['deakin-ba', 'deakin-waurn-ponds', 'business', "Master's", 36, 2, 3, 2, true],
      ['deakin-cyber', 'deakin-waurn-ponds', 'cyber', "Master's", 35, 2, 3, 2, true],
      ['utas-it', 'utas-sandy-bay', 'it', "Master's", 28, 2, 3, 1, false],
      ['uow-cyber', 'uow-wollongong', 'cyber', "Master's", 38, 2, 3, 3, true],
      ['swin-cyberpsych', 'swinburne-hawthorn', 'psych', "Master's", 40, 2, 0, 3, true],
      ['ecu-bsc-cyber', 'ecu-joondalup', 'cyber', "Bachelor's", 32, 3, 3, 3, true],
      ['tafe-cyber', 'tafe-perth', 'cyber', 'Diploma', 15, 2, 0, 2, true],
    ])
  })

  it('names each course, its university, route and keep-options-open action', () => {
    expect(COURSES.map((c) => [c.id, c.name, c.university, c.route])).toEqual([
      ['ecu-cyber', 'Master of Cyber Security', 'ECU', '190 state nomination, then PR'],
      ['curtin-it', 'Master of Information Technology', 'Curtin', '190 state nomination, then PR'],
      ['unisa-cyber', 'Master of Cyber Security', 'UniSA', '491 regional visa, then PR'],
      ['unisa-it', 'Master of Information Technology', 'UniSA', '491 regional visa, then PR'],
      ['uts-cyber', 'Master of Cyber Security', 'UTS', '485, then employer sponsorship'],
      [
        'uts-data',
        'Master of Data Science and Innovation',
        'UTS',
        '485, then employer sponsorship',
      ],
      ['monash-data', 'Master of Data Science', 'Monash', '485, then employer sponsorship'],
      ['deakin-ba', 'Master of Business Analytics', 'Deakin', '491 regional visa, then PR'],
      ['deakin-cyber', 'Master of Cyber Security', 'Deakin', '491 regional visa, then PR'],
      [
        'utas-it',
        'Master of Information Technology and Systems',
        'UTAS',
        '491 regional visa, then PR',
      ],
      ['uow-cyber', 'Master of Cyber Security', 'UOW', '491 regional visa, then PR'],
      [
        'swin-cyberpsych',
        'Master of Psychology (Cyberpsychology)',
        'Swinburne',
        '485, no clear road to PR',
      ],
      ['ecu-bsc-cyber', 'Bachelor of Cyber Security', 'ECU', '190 state nomination, then PR'],
      [
        'tafe-cyber',
        'Diploma of Information Technology (Cyber Security)',
        'North Metropolitan TAFE',
        'Diploma, then a degree pathway',
      ],
    ])
    expect(course('ecu-cyber').keepOpen).toEqual({
      text: 'Sit the IELTS before 30 Nov',
      doors: 'keeps 2 doors open: the February and July intakes',
    })
    expect(course('unisa-cyber').keepOpen).toEqual({
      text: 'Apply to two intakes (Feb and Jul 2027)',
      doors: 'keeps 2 doors open',
    })
    expect(course('uts-cyber').keepOpen).toEqual({
      text: 'Ask UTS whether you can defer a year',
      doors: 'keeps 1 door open',
    })
  })

  it("follows the design's Adelaide future, with the Adelaide job-market claim (R1)", () => {
    const { lines } = course('unisa-cyber')
    expect(lines.time).toMatchObject({
      effect: 'costs',
      text: 'About 6 years to permanent residency · a later intake keeps it open',
      claim: { pips: 2, state: 'unknown' },
    })
    expect(lines.work).toMatchObject({
      effect: 'gives',
      text: 'Regional study: up to 5 years of post-study work rights',
      claim: { pips: 4, state: 'confirmed' },
    })
    expect(lines.pr).toMatchObject({
      effect: 'gives',
      text: 'Regional points, then a 491 to 191 path',
      claim: { pips: 3, state: 'estimated' },
    })
    const r1 = {
      effect: 'costs',
      text: 'A smaller IT job market than Perth',
      claim: {
        pips: 2,
        state: 'estimated',
        source: 'Job-ad counts, Jul–Sep 2026 · mock figure',
        detail: [
          'Adelaide IT job market: moderate · ~2,100 postings last quarter vs 3,400 in Perth',
          'Graduates in this field from UniSA: 78% in full-time work within four months · graduate outcomes survey 2025',
        ],
        notSure: true,
      },
    }
    expect(lines.career).toMatchObject(r1)
    expect(course('unisa-it').lines.career).toMatchObject(r1)
  })

  it("follows the design's Perth and Sydney futures", () => {
    expect(course('ecu-cyber').lines.pr.text).toBe('Western Australia nominates its own graduates')
    expect(course('ecu-cyber').lines.career).toMatchObject({
      effect: 'gives',
      text: 'Steady demand for security roles in WA',
    })
    expect(course('uts-cyber').lines.career).toMatchObject({
      effect: 'gives',
      text: 'The biggest job market in Australia',
      claim: { pips: 5 },
    })
  })

  it('resolves every course to its campus and city', () => {
    for (const c of COURSES) {
      expect(campusOf(c).id).toBe(c.campusId)
      expect(cityOf(c).id).toBe(campusOf(c).cityId)
    }
    expect(cityOf(course('unisa-cyber')).name).toBe('Adelaide')
    expect(cityById('perth').name).toBe('Perth')
  })

  it('finds a place by id, and nothing for an id it does not have', () => {
    expect(placeById('cannington')?.name).toBe('Cannington')
    expect(placeById('kathmandu')).toBeUndefined()
  })

  it('draws work and PR lines from the facts: metro or regional, and the road to PR', () => {
    for (const c of COURSES) {
      const regional = cityOf(c).regional
      expect([c.id, c.lines.work.effect]).toEqual([c.id, regional ? 'gives' : 'costs'])
      if (!regional) expect(c.lines.work.text).toBe('Metro: 2 years of post-study work rights')
      expect([c.id, c.lines.pr.effect]).toEqual([c.id, c.prScore === 3 ? 'gives' : 'costs'])
      if (c.prScore === 1) {
        expect(c.lines.pr.text).toBe('No regional points; depends on an employer')
      }
      if (c.prScore === 0) expect(c.lines.pr.text).toBe('No clear road to permanent residency')
    }
  })

  it('gives every claim a source labelled mock, a date and the figure behind it (DS-R5)', () => {
    for (const [name, claim] of claims()) {
      expect([name, claim.source]).toEqual([name, expect.stringMatching(/ · mock( figure)?$/)])
      expect([name, claim.date.length > 0]).toEqual([name, true])
      expect([name, claim.detail.length > 0]).toEqual([name, true])
    }
  })

  it('marks exactly the two UniSA job-market claims as not sure', () => {
    expect(claims().flatMap(([name, claim]) => (claim.notSure ? [name] : []))).toEqual([
      'unisa-cyber career',
      'unisa-it career',
    ])
  })

  it('names no country other than Australia in a keep-options-open action', () => {
    for (const c of COURSES) {
      expect(`${c.keepOpen.text} ${c.keepOpen.doors}`).not.toMatch(/\b(UK|Canada|New Zealand|US)\b/)
    }
  })

  it('never gives a PR outlook as a percentage or a probability (DS-R6)', () => {
    for (const c of COURSES) {
      for (const text of [c.lines.pr.text, ...c.lines.pr.claim.detail]) {
        expect(text).not.toMatch(/%|percent|chance|likel|probab|odds|\d+ in \d+/i)
      }
    }
  })

  it('never ranks or recommends (DS-R1)', () => {
    for (const text of prose()) expect(text).not.toMatch(/ranked 1st|\bbest\b|recommended/i)
  })

  it('maps every field option and area to fields the catalogue has courses for', () => {
    const covered = new Set(COURSES.map((c) => c.field))
    const fieldOptions = questionOf('field').options.map(String)
    expect(Object.keys(FIELD_OF_OPTION).sort()).toEqual([...fieldOptions].sort())
    expect(FIELD_OF_OPTION['Cyber security']).toBe('cyber')
    for (const field of Object.values(FIELD_OF_OPTION)) expect(covered.has(field)).toBe(true)

    const areaOptions = questionOf('areas').options.map(String)
    expect(Object.keys(AREA_FIELDS).sort()).toEqual([...areaOptions].sort())
    for (const { fields } of Object.values(AREA_FIELDS)) {
      for (const field of fields) expect(covered.has(field)).toBe(true)
    }
    expect(AREA_FIELDS.Health).toEqual({ fields: ['psych'], substitutedFrom: 'health' })
    expect(AREA_FIELDS['IT and computing']).toEqual({ fields: ['it', 'cyber'] })
    expect([...covered].map((field) => FIELD_LABELS[field]).sort()).toEqual([
      'business analytics',
      'cyber security',
      'data science',
      'information technology',
      'psychology',
    ])
  })
})
