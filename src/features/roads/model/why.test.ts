// Why a tile is on her road (criteria 15, 16, 19, 20, 64–66): which slots get a why, the answers,
// rules and catalogue facts the model is given, the template that shows until (or instead of) the
// model's text, and the checks every why text must pass. Pure.

import { describe, expect, it } from 'bun:test'
import {
  DRAWN_TO_AREAS,
  NOT_SURE,
  PARTICULAR,
  SUGGEST_ME,
} from '@/features/opening/model/questions'
import type { Relative, RoadmapTag, StoredAnswers } from '@/shared/types/student'
import { ROAD_CANDIDATES } from '../data/candidates'
import { courseById } from '../data/courses'
import { ROADS, roadById } from '../data/roads'
import type { RoadSpec } from '../data/types'
import { specById } from './compose'
import { DEMO_PROFILES, stated } from './demo-profiles'
import { roadFor } from './road-for'
import { WHY_SLOTS, type WhyMatch, whyFacts, whyProblems, whyTemplate, whyTitle } from './why'

const PERTH = roadById('perth-cyber')
if (!PERTH) throw new Error('perth-cyber road missing')
const PROFILE_1 = DEMO_PROFILES[0]
const COUSIN: RoadmapTag = {
  text: 'Wants to be near her cousin',
  quote: 'my cousin lives there',
  step: 'living',
  wellbeing: false,
}
const WORRIED: RoadmapTag = {
  text: 'Worried about being lonely',
  quote: 'I get lonely',
  step: 'living',
  wellbeing: true,
}
const TAGS = [COUSIN]

/** Her road as roadFor matches it, and the match the why is given. */
function matched(
  answers: StoredAnswers,
  relative: Relative | null,
): { spec: RoadSpec; match: WhyMatch } {
  const r = roadFor({ answers, relative }, {})
  if (!r.spec || !r.match) throw new Error('no road matched')
  return { spec: r.spec, match: { differences: r.match.differences, relative } }
}

describe('WHY_SLOTS (20)', () => {
  it('is the city, course and way-to-stay slots only', () => {
    expect([...WHY_SLOTS]).toEqual([
      'city',
      'alt-city',
      'course',
      'alt-course',
      'stack-course',
      'pr-straight',
      'pr-lane',
      'pr-lane-end',
    ])
  })
})

describe('whyFacts (15)', () => {
  it("gives the course tile, her stated and assumed answers by question, the course's facts and the tag texts", () => {
    const answers: StoredAnswers = {
      ...PROFILE_1.answers,
      amount: { value: 30, state: 'assumed' },
    }
    const data = whyFacts(PERTH, 'course', answers, TAGS)
    expect(data.tile).toEqual({ slot: 'course', name: PERTH.slots.course.name, on: 'roadmap' })
    expect(whyFacts(PERTH, 'alt-city', answers, TAGS).tile).toEqual({
      slot: 'alt-city',
      name: PERTH.slots['alt-city'].name,
      on: 'board',
    })
    expect(data.answers).toEqual([
      { question: 'Your budget per year', answer: 'AUD 30k a year, assumed' },
      { question: 'Do you know what you want to study?', answer: 'Something particular' },
      { question: 'Which field?', answer: 'Cyber security' },
      { question: 'Study level', answer: "Master's" },
      { question: 'Would you want to stay after?', answer: 'Yes' },
    ])
    const texts = data.facts.map((f) => f.text)
    expect(texts).toContain('Master of Cyber Security at ECU: fees about AUD 33k a year')
    expect(texts).toContain('Master of Cyber Security at ECU takes 2 years')
    expect(texts).toContain('Master of Cyber Security at ECU leads to ICT Security Specialist')
    expect(texts).toContain("ICT Security Specialist is on WA's 190 and 491 lists")
    expect(texts.some((t) => t.includes('Swan River Cyber'))).toBe(true)
    expect(new Set(data.facts.map((f) => f.id)).size).toBe(data.facts.length)
    expect(data.tags).toEqual([COUSIN.text])
  })

  it('gives her tags but never a wellbeing one: those are for support content only (ADR-088)', () => {
    const data = whyFacts(PERTH, 'course', PROFILE_1.answers, [WORRIED, COUSIN])
    expect(data.tags).toEqual([COUSIN.text])
    expect(JSON.stringify(data)).not.toContain(WORRIED.text)
  })

  it("gives a city's living cost, whether it counts as regional, and its state's lists", () => {
    const texts = whyFacts(PERTH, 'alt-city', PROFILE_1.answers, []).facts.map((f) => f.text)
    expect(texts).toContain('Living costs in Adelaide about AUD 20k a year')
    expect(texts).toContain('Adelaide counts as regional for visas')
    expect(texts).toContain("ICT Security Specialist is on SA's 190 and 491 lists")
  })

  it("gives a PR tile its visa's conditions and the occupation's list status", () => {
    const texts = whyFacts(PERTH, 'pr-straight', PROFILE_1.answers, []).facts.map((f) => f.text)
    expect(texts).toContain('Subclass 190: Your occupation must be on the state list for 190')
    expect(texts).toContain("ICT Security Specialist is on WA's 190 and 491 lists")
  })

  it('reads a way-to-stay tile’s visa from its slot, not from its tile id', () => {
    for (const spec of ROADS) {
      for (const slot of ['pr-straight', 'pr-lane', 'pr-lane-end'] as const) {
        const renamed = {
          ...spec,
          slots: { ...spec.slots, [slot]: { ...spec.slots[slot], id: 'a-renamed-tile' } },
        }
        expect([spec.id, slot, whyFacts(renamed, slot, {}, []).facts]).toEqual([
          spec.id,
          slot,
          whyFacts(spec, slot, {}, []).facts,
        ])
        expect([spec.id, slot, whyTemplate(renamed, slot, {})]).toEqual([
          spec.id,
          slot,
          whyTemplate(spec, slot, {}),
        ])
      }
    }
  })

  it("states a course's list status in the course's own state, not the road's", () => {
    const hobart = roadById('hobart-it')
    if (!hobart) throw new Error('hobart-it road missing')
    // The stack course on Hobart's road is UniSA's, in Adelaide (SA).
    const texts = whyFacts(hobart, 'stack-course', {}, []).facts.map((f) => f.text)
    expect(texts).toContain("Software Engineer is on SA's 190 and 491 lists")
    expect(texts.some((t) => t.includes("TAS's"))).toBe(false)
    expect(whyTemplate(hobart, 'stack-course', {})).toContain("on SA's 491 list")
  })

  it('has no fact ending in "(mock)" on any candidate road: the card’s mock tag says it (criterion 66)', () => {
    for (const { id } of ROAD_CANDIDATES) {
      const spec = specById(id)
      if (!spec) throw new Error(`${id} missing`)
      for (const slot of WHY_SLOTS) {
        const mocked = whyFacts(spec, slot, PROFILE_1.answers, [])
          .facts.filter((f) => f.text.includes('(mock)'))
          .map((f) => f.text)
        expect([id, slot, mocked]).toEqual([id, slot, []])
      }
    }
  })
})

describe('chosenBy: the rule that chose the tile (criterion 64)', () => {
  const HEALTH = stated({
    stay: 'Yes',
    know: DRAWN_TO_AREAS,
    areas: ['Health'],
    qual: "Bachelor's",
  })
  const COUSIN_IN_ADELAIDE: Relative = {
    placeId: 'adelaide-cbd',
    place: null,
    relationship: 'Cousin',
    name: null,
  }

  it('gives a city tile the stay rule and the city hint with its source', () => {
    const { spec, match } = matched(HEALTH, COUSIN_IN_ADELAIDE)
    expect(spec.cityId).toBe('adelaide')
    expect(whyFacts(spec, 'city', HEALTH, [], match).chosenBy).toEqual([
      "you said you'd stay",
      'Adelaide: where your cousin lives',
    ])
  })

  it('gives a course tile the field and level rules', () => {
    const { spec, match } = matched(HEALTH, COUSIN_IN_ADELAIDE)
    expect(whyFacts(spec, 'course', HEALTH, [], match).chosenBy).toEqual([
      'you picked Health',
      "your last qualification opens Master's",
    ])
  })

  it('gives a way-to-stay tile the stay rule', () => {
    const { spec, match } = matched(HEALTH, COUSIN_IN_ADELAIDE)
    for (const slot of ['pr-straight', 'pr-lane', 'pr-lane-end'] as const) {
      expect(whyFacts(spec, slot, HEALTH, [], match).chosenBy).toEqual(["you said you'd stay"])
    }
  })

  it('names no stay answer on the steps of a staying road with no clear road to PR', () => {
    const spec = specById('perth-tafe-cyber-stay')
    if (!spec) throw new Error('perth-tafe-cyber-stay missing')
    const answers = stated({ stay: 'Yes' })
    for (const slot of ['pr-straight', 'pr-lane', 'pr-lane-end'] as const) {
      expect([slot, whyFacts(spec, slot, answers, []).chosenBy]).toEqual([slot, []])
    }
  })

  it('names a career focus as the hint that chose Sydney', () => {
    const answers = stated({
      stay: 'Yes',
      know: PARTICULAR,
      field: 'Data science',
      focus: 'Career-focused',
    })
    const { spec, match } = matched(answers, null)
    expect(whyFacts(spec, 'city', answers, [], match).chosenBy).toEqual([
      "you said you'd stay",
      'Sydney: its job market, and you said career-focused',
    ])
  })

  it('never names a rule her road differs from', () => {
    const differences: WhyMatch['differences'] = [
      { key: 'stay', yours: 'Yes', road: 'Goes home' },
      { key: 'field', yours: 'Cyber security', road: 'Information technology' },
      { key: 'level', yours: "Master's", road: "Bachelor's" },
      { key: 'place', yours: 'Perth CBD, where the person you know lives', road: 'Perth' },
    ]
    const match: WhyMatch = { differences, relative: PROFILE_1.relative }
    for (const slot of WHY_SLOTS) {
      const { chosenBy } = whyFacts(PERTH, slot, PROFILE_1.answers, [], match)
      expect([slot, chosenBy]).toEqual([slot, []])
    }
  })

  it('names no rule she did not answer', () => {
    const match: WhyMatch = { differences: [], relative: null }
    for (const slot of WHY_SLOTS) {
      expect([slot, whyFacts(PERTH, slot, {}, [], match).chosenBy]).toEqual([slot, []])
    }
  })

  it('reads a road against her answers alone, even one her qualification does not open', () => {
    const answers = stated({ stay: 'Yes', qual: 'High school' })
    expect(whyFacts(PERTH, 'city', answers, []).chosenBy).toEqual(["you said you'd stay"])
  })
})

describe('relation: how an alternative relates to her course (criterion 65)', () => {
  const { spec, match } = matched(PROFILE_1.answers, PROFILE_1.relative)

  it("says how Perth's other course relates to hers, and never that her answers chose it", () => {
    expect(spec.id).toBe('perth-cyber')
    const data = whyFacts(spec, 'alt-course', PROFILE_1.answers, [], match)
    expect(data.chosenBy).toEqual([])
    expect(data.relation).toEqual([
      'another course in Perth',
      'information technology is related to cyber security',
      'AUD 1k a year more in fees',
      "its occupation is on WA's 190 list too",
    ])
  })

  it('gives a stack course in another city its relation too', () => {
    const hobart = roadById('hobart-it')
    if (!hobart) throw new Error('hobart-it road missing')
    const data = whyFacts(hobart, 'stack-course', DEMO_PROFILES[4].answers, [])
    expect(data.chosenBy).toEqual([])
    expect(data.relation?.[0]).toBe('a course in Adelaide')
  })

  it('says how the other city relates to hers, and never that her answers chose it', () => {
    const data = whyFacts(spec, 'alt-city', PROFILE_1.answers, [], match)
    expect(data.chosenBy).toEqual([])
    expect(data.relation).toEqual([
      'the other city on your board, beside Perth',
      'Adelaide counts as regional for visas; so does Perth',
      'AUD 1k a year less in living costs',
    ])
    const sydney = roadById('sydney-data')
    if (!sydney) throw new Error('sydney-data road missing')
    expect(whyFacts(sydney, 'alt-city', {}, []).relation?.[1]).toBe(
      'Melbourne does not count as regional for visas; neither does Sydney',
    )
    expect(whyTemplate(spec, 'alt-city', PROFILE_1.answers, match)).toStartWith(
      'Beside your roadmap: the other city on your board, beside Perth; ',
    )
  })

  it('gives no relation to a tile on her roadmap', () => {
    for (const slot of ['city', 'course', 'pr-straight'] as const) {
      expect(whyFacts(spec, slot, PROFILE_1.answers, [], match).relation).toBeUndefined()
    }
  })

  it('cites no occupation list on the city or course tiles of a road with no way to PR, staying or home (criteria 58, 59, 65)', () => {
    // Beside a fork that says there is no clear road to PR (or a road home), a list reads as one;
    // a course tile keeps its occupation, without the list.
    const noPr = ROAD_CANDIDATES.map(({ id }) => specById(id)).filter(
      (s): s is RoadSpec => s?.prRoute === 'none',
    )
    expect(noPr.some((s) => s.id === 'perth-tafe-cyber-stay')).toBe(true)
    expect(noPr.some((s) => s.id === 'adelaide-unisa-dip-it-stay')).toBe(true)
    const claims = /\blists?\b|\b(190|491|186|485)\b|permanent|\bPR\b/
    for (const s of noPr) {
      for (const slot of ['city', 'alt-city', 'course', 'alt-course', 'stack-course'] as const) {
        const data = whyFacts(s, slot, {}, [])
        const lists = data.facts.filter((f) => claims.test(f.text)).map((f) => f.text)
        expect([s.id, slot, lists]).toEqual([s.id, slot, []])
        const text = whyTemplate(s, slot, {})
        expect([s.id, slot, claims.test(text)]).toEqual([s.id, slot, false])
        expect([s.id, slot, whyProblems(text, data, [])]).toEqual([s.id, slot, []])
      }
    }
  })
})

describe('whyTemplate (16)', () => {
  const { match } = matched(PROFILE_1.answers, PROFILE_1.relative)

  it('says the rules that chose a tile on her roadmap, then a catalogue fact', () => {
    expect(whyTemplate(PERTH, 'course', PROFILE_1.answers, match)).toBe(
      "On your roadmap: you picked Cyber security; you chose Master's. Master of Cyber Security at ECU leads to ICT Security Specialist, on WA's 190 list.",
    )
  })

  it('says how a course beside her roadmap relates to hers', () => {
    expect(whyTemplate(PERTH, 'alt-course', PROFILE_1.answers, match)).toStartWith(
      "Beside your roadmap: another course in Perth; information technology is related to cyber security; AUD 1k a year more in fees; its occupation is on WA's 190 list too. ",
    )
  })

  it('says a tile beside her roadmap is beside it, not on it, and titles it so', () => {
    for (const slot of ['alt-city', 'alt-course', 'stack-course'] as const) {
      expect(whyTemplate(PERTH, slot, PROFILE_1.answers)).toStartWith('Beside your roadmap: ')
      expect(whyTemplate(PERTH, slot, {})).toStartWith('Beside your roadmap: ')
      expect(whyTitle(slot)).toBe('Why it’s on your board')
    }
    for (const slot of ['city', 'course', 'pr-straight', 'pr-lane', 'pr-lane-end'] as const) {
      expect(whyTemplate(PERTH, slot, PROFILE_1.answers)).toStartWith('On your roadmap: ')
      expect(whyTitle(slot)).toBe('Why it’s on your roadmap')
    }
  })

  it('is never empty and passes the why checks on every road, slot and profile', () => {
    for (const spec of ROADS) {
      for (const slot of WHY_SLOTS) {
        for (const profile of [...DEMO_PROFILES, { answers: {}, relative: null }]) {
          const m = matched(profile.answers, profile.relative).match
          const text = whyTemplate(spec, slot, profile.answers, m)
          expect(text.trim()).not.toBe('')
          const data = whyFacts(spec, slot, profile.answers, [], m)
          expect([spec.id, slot, whyProblems(text, data, [])]).toEqual([spec.id, slot, []])
        }
      }
    }
  })
})

describe('whyProblems (19, 66)', () => {
  const data = whyFacts(PERTH, 'course', PROFILE_1.answers, [])
  const factId = data.facts[0].id
  const CLEAN =
    'You said you would like to stay after. Master of Cyber Security at ECU takes 2 years and leads to ICT Security Specialist, on the 190 list.'

  it('passes clean text', () => {
    expect(whyProblems(CLEAN, data, [factId])).toEqual([])
  })

  it('refuses each ranking word, in any case', () => {
    for (const word of ['best', 'Recommended', 'RECOMMEND', 'top', 'ranked', 'Number One']) {
      expect(whyProblems(`Perth is the ${word} city for you.`, data, [])).toHaveLength(1)
    }
    expect(whyProblems('The best and top city.', data, [])).toHaveLength(2)
  })

  it('refuses a number that is in no fact and no answer', () => {
    expect(whyProblems('It takes 3 years.', data, [])).toHaveLength(1)
    expect(whyProblems('It costs AUD 33k a year and takes 2 years.', data, [])).toEqual([])
  })

  it('reads a figure spelled out in words as its number', () => {
    expect(whyProblems('It takes five years.', data, [])).toHaveLength(1)
    expect(whyProblems('About thirty thousand a year.', data, [])).toHaveLength(1)
    expect(whyProblems('Thirty-three thousand a year in fees.', data, [])).toHaveLength(1)
    expect(whyProblems('It takes two years.', data, [])).toEqual([])
    expect(whyProblems('One of the courses in Perth.', data, [])).toEqual([])
  })

  it('takes the figures in her relation as known', () => {
    const { match } = matched(PROFILE_1.answers, PROFILE_1.relative)
    const alt = whyFacts(PERTH, 'alt-course', PROFILE_1.answers, [], match)
    expect(whyProblems('Its fees are AUD 1k a year more than yours.', alt, [])).toEqual([])
  })

  it('refuses an id that is not a fact', () => {
    expect(whyProblems(CLEAN, data, [factId, 'made-up'])).toHaveLength(1)
  })

  it('refuses empty text and text over 600 characters', () => {
    expect(whyProblems('   ', data, [])).toHaveLength(1)
    expect(whyProblems('a'.repeat(601), data, [])).toHaveLength(1)
    expect(whyProblems('a'.repeat(600), data, [])).toEqual([])
  })

  it('refuses "(mock)" inside the text', () => {
    expect(whyProblems('Fees are about AUD 33k a year (mock).', data, [])).toHaveLength(1)
  })

  it('refuses the wording of each listed option, in any case, and nothing else of hers', () => {
    for (const option of [PARTICULAR, DRAWN_TO_AREAS, SUGGEST_ME, NOT_SURE]) {
      expect(whyProblems(`You said ${option.toUpperCase()}.`, data, [])).toHaveLength(1)
      expect(whyProblems(`You chose "${option.toLowerCase()}".`, data, [])).toHaveLength(1)
    }
    const answers = [...data.answers, { question: 'English test', answer: 'IELTS 7.0' }]
    expect(
      whyProblems('You picked Data science, and you have IELTS 7.0.', { ...data, answers }, []),
    ).toEqual([])
  })

  it('refuses a sentence that gives one of her tags as the reason', () => {
    const tagged = { ...data, tags: ['near her cousin'] }
    expect(
      whyProblems('Perth is on your roadmap because you want to be near her cousin.', tagged, []),
    ).toHaveLength(1)
    expect(
      whyProblems('You picked cyber security. Perth is also near her cousin.', tagged, []),
    ).toEqual([])
    expect(
      whyProblems(
        'This is here because you picked cyber security. Near her cousin, too.',
        tagged,
        [],
      ),
    ).toEqual([])
  })
})

describe('whyFacts on a composed road (criterion 56)', () => {
  const NURSING = specById('adelaide-unisa-nursing-stay')
  if (!NURSING) throw new Error('adelaide-unisa-nursing-stay missing')
  const named = `${courseById(NURSING.courseId)?.name} at ${courseById(NURSING.courseId)?.university}`

  it('gives its course tile the facts of its own course', () => {
    const data = whyFacts(NURSING, 'course', PROFILE_1.answers, TAGS)
    expect(data.tile.name).toBe(NURSING.slots.course.name)
    expect(data.facts.find((f) => f.id === 'course-fees')?.text).toStartWith(named)
    expect(data.facts.some((f) => f.text.includes('Registered Nurse'))).toBe(true)
  })

  it('gives its city and way-to-stay tiles facts about its course’s occupation', () => {
    const city = whyFacts(NURSING, 'city', PROFILE_1.answers, TAGS)
    expect(city.facts.some((f) => f.text.includes('Registered Nurse'))).toBe(true)
    const pr = whyFacts(NURSING, 'pr-straight', PROFILE_1.answers, TAGS)
    expect(pr.facts[0]?.id).toBe(`visa-${NURSING.slots['pr-straight'].visa}-1`)
    expect(pr.facts.some((f) => f.text.includes('Registered Nurse'))).toBe(true)
  })
})
