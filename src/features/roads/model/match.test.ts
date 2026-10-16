import { describe, expect, it } from 'bun:test'
import { cityById } from '@/features/engine/catalogue'
import { PARTICULAR } from '@/features/opening/model/questions'
import type { Relative, StoredAnswers } from '@/shared/types/student'
import { ALL_PICKS, pickId, ROAD_CANDIDATES } from '../data/candidates'
import { courseById } from '../data/courses'
import { ROAD_KEYS } from '../data/road-keys'
import { composeRoad, specById } from './compose'
import { stated as a, DEMO_PROFILES, relativeAt } from './demo-profiles'
import { levelsOpenTo } from './eligibility'
import { type Difference, matchRoad, pickedFields } from './match'

type Values = Parameters<typeof a>[0]
const DRAWN = "A few areas I'm drawn to"
/** The stay difference of a staying road whose course has no clear road to PR. */
const NO_CLEAR_PR_CHIP: Difference = { key: 'stay', yours: 'Yes', road: 'No clear PR' }
const drawn = (areas: string[], more: Values = {}) => a({ know: DRAWN, areas, ...more })
/** The picks no answer can reach, so matching leaves them out. */
const UNREACHABLE = [
  'perth-curtin-infosys-stay',
  'perth-curtin-infosys-home',
  'melbourne-swin-cyberpsych-stay',
  'melbourne-swin-cyberpsych-home',
]
const candidate = (id: string) => {
  const c = ROAD_CANDIDATES.find((r) => r.id === id)
  if (!c) throw new Error(`No candidate ${id}`)
  return c
}

describe('the demo profiles', () => {
  const expected = [
    'perth-cyber',
    'adelaide-it',
    'sydney-data',
    'geelong-business',
    'hobart-it',
    'melbourne-home',
  ]

  it('are the six of the brief, in the order of the roads', () => {
    expect(DEMO_PROFILES.map((p) => p.roadId)).toEqual(expected)
  })

  for (const [i, roadId] of expected.entries()) {
    it(`profile ${i + 1} reaches ${roadId} exactly`, () => {
      const p = DEMO_PROFILES[i]
      const m = matchRoad(p.answers, p.relative)
      expect(m.spec.id).toBe(roadId)
      expect(m.exact).toBe(true)
      expect(m.differences).toEqual([])
    })
  }
})

describe('ROAD_CANDIDATES', () => {
  it('is every pick an answer can reach, once: the six hand-written roads first, then the catalogue’s order', () => {
    expect(ROAD_CANDIDATES.map((c) => c.id).slice(0, 6)).toEqual(ROAD_KEYS.map((k) => k.id))
    const rest = ALL_PICKS.map(pickId).filter(
      (id) => !ROAD_KEYS.some((k) => k.id === id) && !UNREACHABLE.includes(id),
    )
    expect(ROAD_CANDIDATES.map((c) => c.id).slice(6)).toEqual(rest)
  })

  it('leaves out a pick an earlier candidate always ties or beats (criterion 86)', () => {
    // Curtin's Information Systems has every key matching reads (Perth, IT, a Master's, open
    // entry) in common with Curtin's Information Technology, which comes first; Swinburne's
    // Cyberpsychology is in psychology, a field no answer names, beside Monash's data Master's.
    const ids = ROAD_CANDIDATES.map((c) => c.id)
    for (const id of UNREACHABLE) {
      expect(ids).not.toContain(id)
      // Still a pick, so it stays an alternative or a stack course, and its road still resolves.
      expect(ALL_PICKS.map(pickId)).toContain(id)
      expect(specById(id)?.id).toBe(id)
    }
  })

  it('says what the composed road is: its keys, and its label’s way to stay or "home"', () => {
    for (const p of ALL_PICKS.filter((p) => !UNREACHABLE.includes(pickId(p)))) {
      const c = candidate(pickId(p))
      const road = composeRoad(p)
      const { id, stays, field, level, cityId, courseId } = road
      expect({ ...c, label: undefined }).toEqual({
        id,
        label: undefined,
        stays,
        field,
        level,
        cityId,
        courseId,
      })
      expect(c.label.split(' · ').at(-1)).toBe(road.label.split(' · ').at(-1))
    }
  })

  it('labels a composed road by its city, its catalogue course and its way to stay', () => {
    expect(candidate('adelaide-unisa-nursing-stay').label).toMatch(
      /^Adelaide · Master of Nursing \(graduate entry\) · (190|491|186)$/,
    )
    expect(candidate('adelaide-unisa-nursing-home').label).toBe(
      'Adelaide · Master of Nursing (graduate entry) · home',
    )
    expect(candidate('perth-cyber').label).toBe('Perth · Cyber Security · 190')
  })
})

describe('matchRoad: her field, at a level her qualification opens', () => {
  it('gives a Bachelor’s holder drawn to Health a health Master’s, exactly (criterion 56)', () => {
    const m = matchRoad(drawn(['Health'], { stay: 'Yes', qual: "Bachelor's" }), null)
    expect(courseById(m.spec.courseId)?.field).toBe('health')
    expect(m.spec.level).toBe("Master's")
    expect(m.exact).toBe(true)
  })

  it('gives a school leaver in IT a Diploma in IT (criterion 60)', () => {
    const m = matchRoad(
      a({ stay: 'Yes', know: PARTICULAR, field: 'Information technology', qual: 'High school' }),
      null,
    )
    expect(m.spec.field).toBe('it')
    expect(m.spec.level).toBe('Diploma')
  })

  it('never offers a school leaver a Master’s: with no Design Diploma she gets the nearest Diploma, with a level chip (criterion 63)', () => {
    const answers = drawn(['Design'], { stay: 'Yes', qual: 'High school', level: "Master's" })
    const m = matchRoad(answers, null)
    expect(m.spec.level).toBe('Diploma')
    expect(m.exact).toBe(false)
    expect(m.differences.find((d) => d.key === 'level')).toEqual({
      key: 'level',
      yours: "Master's",
      road: 'Diploma',
    })
    // Without her qualification the same answers reach the Design Master's.
    const ungated = matchRoad(drawn(['Design'], { stay: 'Yes', level: "Master's" }), null)
    expect(ungated.spec.field).toBe('design')
  })

  it('names the qualification that closes her field when she gave no level, and never goes above it (criterion 63)', () => {
    const cases = [
      { answers: drawn(['Design'], { stay: 'Yes', qual: 'High school' }), field: 'Design' },
      {
        answers: drawn(['Engineering'], { stay: 'Yes', qual: 'High school' }),
        field: 'Engineering',
      },
      {
        answers: a({ stay: 'Yes', know: PARTICULAR, field: 'Data science', qual: 'Diploma' }),
        field: 'Data science',
      },
    ]
    for (const { answers, field } of cases) {
      const m = matchRoad(answers, null)
      const qual = String(answers.qual?.value)
      expect([field, m.spec.level, m.exact]).toEqual([field, 'Diploma', false])
      expect(m.differences.find((d) => d.key === 'qual')).toEqual({
        key: 'qual',
        yours: qual,
        road: 'Diploma',
        because: `${field} is taught here only as a Master's, which your qualification does not open`,
      })
    }
  })

  it('names the qualification when no road is at a level it opens: a Diploma holder gets a Diploma', () => {
    const m = matchRoad(
      a({ stay: 'Yes', know: PARTICULAR, field: 'Information technology', qual: 'Diploma' }),
      null,
    )
    expect([m.spec.field, m.spec.level, m.exact]).toEqual(['it', 'Diploma', false])
    expect(m.differences).toEqual([
      NO_CLEAR_PR_CHIP,
      {
        key: 'qual',
        yours: 'Diploma',
        road: 'Diploma',
        because: "no course here is a Bachelor's, the level your qualification opens",
      },
    ])
  })

  it('says there is no road when none is open to her and none is at her level or below', () => {
    const answers = drawn(['Health'], { stay: 'Yes', qual: 'High school' })
    expect(() => matchRoad(answers, null, [candidate('adelaide-unisa-nursing-stay')])).toThrow(
      'No road at a level her qualification allows',
    )
  })

  it('gives a Diploma holder who wants a Bachelor’s a Diploma road with a level chip, never a Master’s', () => {
    const m = matchRoad(
      a({
        stay: 'Yes',
        know: PARTICULAR,
        field: 'Information technology',
        qual: 'Diploma',
        level: "Bachelor's",
      }),
      null,
    )
    expect(m.spec.level).toBe('Diploma')
    expect(m.spec.field).toBe('it')
    expect(m.differences.map((d) => d.key)).toEqual(['stay', 'level', 'qual'])
    expect(m.differences[1]).toEqual({ key: 'level', yours: "Bachelor's", road: 'Diploma' })
  })

  it('reads field before level: no data Diploma, so a data Master’s with a level chip', () => {
    const m = matchRoad(a({ stay: 'Yes', field: 'Data science', level: 'Diploma' }), null)
    expect(m.spec.field).toBe('data')
    expect(m.differences).toEqual([{ key: 'level', yours: 'Diploma', road: "Master's" }])
  })

  it('prefers, in a tie, a course that asks no degree in its own field', () => {
    const roads = [candidate('sydney-uts-civil-stay'), candidate('adelaide-unisa-nursing-stay')]
    const m = matchRoad(
      drawn(['Engineering', 'Health'], { stay: 'Yes', qual: "Bachelor's" }),
      null,
      roads,
    )
    expect(m.spec.id).toBe('adelaide-unisa-nursing-stay')
    expect(m.exact).toBe(true)
  })
})

describe('matchRoad: staying or going home', () => {
  it('tells a student who would stay that her road has no clear road to PR', () => {
    const leaver = { know: PARTICULAR, field: 'Information technology', qual: 'High school' }
    const yes = matchRoad(a({ stay: 'Yes', ...leaver }), null)
    expect([yes.spec.stays, yes.spec.level, yes.exact]).toEqual([true, 'Diploma', false])
    expect(yes.differences).toEqual([NO_CLEAR_PR_CHIP])
    const unsure = matchRoad(a({ stay: 'Not sure', ...leaver }), null)
    expect(unsure.differences).toEqual([{ ...NO_CLEAR_PR_CHIP, yours: 'Not sure' }])
    // A road with a way to PR, or one she did not say she would stay on, says nothing of it.
    expect(matchRoad(a({ stay: 'Yes', field: 'Data science' }), null).differences).toEqual([])
    expect(matchRoad(a({ stay: 'No', ...leaver }), null).differences).toEqual([])
  })

  it('prefers, in a tie, a staying road with a road to PR when she said she would stay', () => {
    const roads = [candidate('perth-tafe-cyber-stay'), candidate('perth-cyber')]
    expect(matchRoad(a({ stay: 'Yes' }), null, roads).spec.id).toBe('perth-cyber')
    expect(matchRoad(a({ stay: 'Not sure' }), null, roads).spec.id).toBe('perth-tafe-cyber-stay')
  })

  it('sends a student going home to a road home in her field, wherever it is taught (criterion 59)', () => {
    const data = matchRoad(a({ stay: 'No', field: 'Data science' }), null)
    expect(data.spec.stays).toBe(false)
    expect(data.spec.field).toBe('data')
    expect(data.exact).toBe(true)

    const cyber = matchRoad(a({ stay: 'No', field: 'Cyber security' }), null)
    expect(cyber.spec.stays).toBe(false)
    expect(cyber.spec.field).toBe('cyber')
    expect(cyber.spec.cityId).not.toBe('melbourne')
    expect(cyber.exact).toBe(true)

    const sydney = matchRoad(a({ stay: 'No', field: 'Data science' }), relativeAt('sydney-cbd'))
    expect(sydney.spec.id).toBe('sydney-uts-data-home')
  })

  it('never sends Yes to a road home', () => {
    expect(matchRoad(a({ stay: 'Yes', field: 'Data science' }), null).spec.stays).toBe(true)
  })
})

describe('matchRoad: the city hint', () => {
  it('picks among the cities that teach her course', () => {
    expect(matchRoad(drawn(['Health'], { stay: 'Yes' }), relativeAt('hobart')).spec.id).toBe(
      'hobart-utas-nursing-stay',
    )
    const regional = matchRoad(drawn(['Health'], { stay: 'Yes', place: 'Regional' }), null)
    expect(regional.spec.id).toBe('adelaide-unisa-nursing-stay')
    expect(regional.exact).toBe(true)
  })

  it('lets the relative city win over the place', () => {
    const m = matchRoad(
      a({ stay: 'Yes', field: 'Information technology', place: 'Regional' }),
      relativeAt('hobart'),
    )
    expect(m.spec.id).toBe('hobart-it')
  })

  it('gives a tie to the hand-written road first, then to the catalogue’s order', () => {
    // Perth's data Master's comes first in the catalogue; Sydney's is hand-written.
    expect(matchRoad(a({ stay: 'Yes', field: 'Data science' }), null).spec.id).toBe('sydney-data')
    expect(
      matchRoad(a({ stay: 'Yes', field: 'Information technology', place: 'Regional' }), null).spec
        .id,
    ).toBe('adelaide-it')
    // No hand-written health road: Adelaide comes before Hobart and Melbourne.
    expect(matchRoad(drawn(['Health'], { stay: 'Yes' }), null).spec.id).toBe(
      'adelaide-unisa-nursing-stay',
    )
  })

  it('uses career focus to choose Sydney among roads still tied', () => {
    expect(matchRoad(a({ stay: 'Yes', focus: 'Career-focused' }), null).spec.id).toBe('sydney-data')
  })

  it('takes the earlier road in the list it is given when a tie is left', () => {
    const answers = a({ stay: 'Yes', field: 'Information technology' })
    expect(matchRoad(answers, null, ROAD_KEYS).spec.id).toBe('adelaide-it')
    expect(matchRoad(answers, null, [...ROAD_KEYS].reverse()).spec.id).toBe('hobart-it')
  })

  it('names the road’s own city, and her hint with its source: career focus', () => {
    const m = matchRoad(drawn(['Health'], { stay: 'Yes', focus: 'Career-focused' }), null)
    expect(m.spec.field).toBe('health')
    expect(m.differences).toEqual([
      {
        key: 'place',
        yours: 'career-focused, which points to Sydney',
        road: cityById(m.spec.cityId).name,
      },
    ])
    expect(m.differences[0]?.road).not.toBe('Sydney')
  })

  it('names the road’s own city, and her hint with its source: a regional place, her person', () => {
    const regional = matchRoad(drawn(['Design'], { stay: 'Yes', place: 'Regional' }), null)
    expect(regional.spec.cityId).toBe('melbourne')
    expect(regional.differences).toEqual([
      NO_CLEAR_PR_CHIP,
      { key: 'place', yours: 'regional, which points to Perth or Adelaide', road: 'Melbourne' },
    ])

    const sibling: Relative = { ...relativeAt('sydney-cbd'), relationship: 'Sibling' }
    const near = matchRoad(drawn(['Health'], { stay: 'Yes' }), sibling)
    expect(near.differences).toEqual([
      {
        key: 'place',
        yours: 'Sydney CBD, where your sibling lives',
        road: cityById(near.spec.cityId).name,
      },
    ])
    const someone = matchRoad(drawn(['Health'], { stay: 'Yes' }), relativeAt('sydney-cbd'))
    expect(someone.differences.map((d) => d.yours)).toEqual([
      'Sydney CBD, where the person you know lives',
    ])
  })

  it('says when the road’s city shares her hint’s reason: another regional city', () => {
    // A Business Diploma is taught only in Geelong, which counts as regional too.
    const m = matchRoad(
      a({
        stay: 'Yes',
        know: PARTICULAR,
        field: 'Business analytics',
        qual: 'High school',
        place: 'Regional',
      }),
      null,
    )
    expect(m.spec.cityId).toBe('geelong')
    expect(m.differences).toEqual([
      NO_CLEAR_PR_CHIP,
      {
        key: 'place',
        yours: 'regional, which points to Perth or Adelaide',
        road: 'Geelong',
        because: 'which counts as regional too',
      },
    ])
  })
})

describe('matchRoad: what it reads', () => {
  it('reads the areas when she is drawn to areas', () => {
    const data = matchRoad(drawn(['Data'], { stay: 'Yes' }), null)
    expect(data.spec.field).toBe('data')
    expect(data.exact).toBe(true)
  })

  it('lets IT and computing reach either an IT or a cyber road', () => {
    const m = matchRoad(drawn(['IT and computing'], { stay: 'Yes' }), null)
    expect(['it', 'cyber']).toContain(m.spec.field)
    expect(m.exact).toBe(true)
  })

  it('ignores the field when she asked to be suggested one', () => {
    const m = matchRoad(a({ stay: 'Yes', know: 'Suggest me', field: 'Data science' }), null)
    expect(m.differences).toEqual([])
  })

  it('matches nothing in particular when nothing is answered', () => {
    const m = matchRoad({}, null)
    expect(m.exact).toBe(false)
    expect(m.differences).toEqual([])
    expect(ROAD_CANDIDATES).toContain(m.spec)
  })

  it('reads an assumed answer as unanswered: it draws no rule and no "you said" chip', () => {
    const assumed = (value: string | string[]) => ({ value, state: 'assumed' as const })
    const base = a({ field: 'Business analytics' })
    const withAssumed: StoredAnswers = {
      ...base,
      stay: assumed('No'),
      level: assumed('Diploma'),
      qual: assumed('High school'),
      place: assumed('Regional'),
      focus: assumed('Career-focused'),
    }
    expect(matchRoad(withAssumed, null)).toEqual(matchRoad(base, null))
    expect(matchRoad(withAssumed, null).differences).toEqual([])

    const drawnTo = a({ stay: 'Yes', know: DRAWN })
    expect(matchRoad({ ...drawnTo, areas: assumed(['Health']) }, null)).toEqual(
      matchRoad(drawnTo, null),
    )
  })

  it('never reads the budget', () => {
    const base = { stay: 'Yes', field: 'Data science' }
    const low = matchRoad(a({ ...base, amount: 10 }), null)
    const high = matchRoad(a({ ...base, amount: 500 }), null)
    expect(low).toEqual(high)
    expect(low).toEqual(matchRoad(a(base), null))
  })
})

describe('the matching sweep (criterion 86)', () => {
  const STAYS = ['Yes', 'Not sure', 'No', undefined]
  const PICKS: Values[] = [
    ...['Cyber security', 'Data science', 'Business analytics', 'Information technology'].map(
      (field) => ({ know: PARTICULAR, field }),
    ),
    ...['IT and computing', 'Business', 'Data', 'Health', 'Engineering', 'Design'].map((area) => ({
      know: DRAWN,
      areas: [area],
    })),
  ]
  const LEVELS = ['Diploma', "Bachelor's", "Master's", undefined]
  const QUALS = ['High school', 'Diploma', "Bachelor's", "Master's", undefined]
  const PLACES = ['City', 'Suburban', 'Regional', undefined]
  const FOCUSES = ['Career-focused', 'Academic', undefined]
  /** Her person in each of the six cities, by a place there, or none. */
  const CITY_OF_PLACE: Record<string, string> = {
    'perth-cbd': 'perth',
    'adelaide-cbd': 'adelaide',
    'sydney-cbd': 'sydney',
    geelong: 'geelong',
    hobart: 'hobart',
    'melbourne-cbd': 'melbourne',
  }
  const RELATIVES: (Relative | null)[] = [
    ...Object.keys(CITY_OF_PLACE).map((placeId) => relativeAt(placeId)),
    null,
  ]

  const hasLevel = (level: string) => ROAD_CANDIDATES.some((c) => c.level === level)
  /** The cities her hint names, in the matcher's order of sources; null when she gave none. */
  const hintCities = (relative: Relative | null, place?: string, focus?: string) => {
    if (relative?.placeId) return [CITY_OF_PLACE[relative.placeId]]
    if (place === 'Regional') return ['perth', 'adelaide']
    if (focus === 'Career-focused') return ['sydney']
    return null
  }

  it('matches at least half of the matchable answer sets exactly and reaches every candidate (full product: 67,200 combinations)', () => {
    let total = 0
    let matchable = 0
    let exactAll = 0
    let exactMatchable = 0
    const reached = new Set<string>()
    for (const stay of STAYS)
      for (const pick of PICKS)
        for (const level of LEVELS)
          for (const qual of QUALS)
            for (const place of PLACES)
              for (const focus of FOCUSES)
                for (const relative of RELATIVES) {
                  const values = Object.fromEntries(
                    Object.entries({ stay, level, qual, place, focus, ...pick }).filter(
                      ([, v]) => v !== undefined,
                    ),
                  ) as Values
                  const answers = a(values)
                  const m = matchRoad(answers, relative)
                  total++
                  reached.add(m.spec.id)
                  if (m.exact) exactAll++

                  const fields = pickedFields(answers) ?? []
                  const opens = levelsOpenTo(answers)
                  const cities = hintCities(relative, place, focus)
                  const isMatchable =
                    (level === undefined || hasLevel(level)) &&
                    (opens === null || opens.some(hasLevel)) &&
                    (cities === null ||
                      ROAD_CANDIDATES.some(
                        (c) => cities.includes(c.cityId) && fields.includes(c.field),
                      ))
                  if (isMatchable) {
                    matchable++
                    if (m.exact) exactMatchable++
                  }
                }
    const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`
    console.log(
      `matching sweep (full product): ${total} combinations; exact ${pct(exactMatchable, matchable)} of ${matchable} matchable, ${pct(exactAll, total)} of all`,
    )
    const unreached = ROAD_CANDIDATES.map((c) => c.id).filter((id) => !reached.has(id))
    console.log(`unreached candidates: ${unreached.join(', ') || 'none'}`)
    expect(total).toBe(67_200)
    expect(exactMatchable / matchable).toBeGreaterThanOrEqual(0.5)
    expect(unreached).toEqual([])
  }, 120_000)
})

describe('pickedFields: the fields she picked, as matching reads them', () => {
  it('reads the field she named', () => {
    expect(pickedFields(a({ field: 'Cyber security' }))).toEqual(['cyber'])
    expect(pickedFields(a({ know: PARTICULAR, field: 'Data science' }))).toEqual(['data'])
  })

  it('reads the areas she is drawn to, Health, Engineering and Design among them', () => {
    expect(pickedFields(drawn(['IT and computing']))).toEqual(['it', 'cyber'])
    expect(pickedFields(drawn(['Health']))).toEqual(['health'])
    expect(pickedFields(drawn(['Engineering', 'Design']))).toEqual(['engineering', 'design'])
  })

  it('is null when she picked no field: unanswered, suggest me, or only assumed', () => {
    expect(pickedFields({})).toBeNull()
    expect(pickedFields(a({ know: 'Suggest me', field: 'Data science' }))).toBeNull()
    expect(pickedFields({ field: { value: 'Data science', state: 'assumed' } })).toBeNull()
  })
})
