// Ask about a tile (criteria 23, 24, 25, 26): which tiles take a typed question, the rows the
// model may answer from, the checks every answer must pass, and the daily cap. Pure.

import { describe, expect, it } from 'bun:test'
import type { RoadmapTag, StoredAnswers } from '@/shared/types/student'
import { asksFor } from '../data/asks'
import { courseById } from '../data/courses'
import { ROADS, roadById } from '../data/roads'
import { SLOTS } from '../data/types'
import { ASK_SLOTS, askCap, askFacts, askProblems, askSubject, suggestedAsks } from './ask'
import { NO_DATA, needsCounsellor } from './ask-words'
import { specById } from './compose'
import { DEMO_PROFILES } from './demo-profiles'
import { whyFacts } from './why'

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

describe('ASK_SLOTS', () => {
  it('is the city and course slots only', () => {
    expect([...ASK_SLOTS]).toEqual(['city', 'alt-city', 'course', 'alt-course', 'stack-course'])
  })
})

const OTHER_SLOTS = SLOTS.filter((s) => !(ASK_SLOTS as readonly string[]).includes(s))

describe('askSubject (21)', () => {
  it("maps the city slots to the road's cities and the course slots to its courses", () => {
    expect(askSubject(PERTH, 'city')).toEqual({ kind: 'city', cityId: PERTH.cityId })
    expect(askSubject(PERTH, 'alt-city')).toEqual({ kind: 'city', cityId: PERTH.altCityId })
    expect(askSubject(PERTH, 'course')).toEqual({ kind: 'course', courseId: PERTH.courseId })
    expect(askSubject(PERTH, 'alt-course')).toEqual({
      kind: 'course',
      courseId: PERTH.altCourseId,
    })
    expect(askSubject(PERTH, 'stack-course')).toEqual({
      kind: 'course',
      courseId: PERTH.stackCourseId,
    })
  })

  it('maps every other slot, and no slot, to null', () => {
    expect(OTHER_SLOTS.length).toBeGreaterThan(0)
    for (const slot of OTHER_SLOTS) expect(askSubject(PERTH, slot)).toBeNull()
    expect(askSubject(PERTH, null)).toBeNull()
  })
})

describe('suggestedAsks (21, 22)', () => {
  it("gives a city or course tile its subject's asks", () => {
    expect(suggestedAsks(PERTH, PERTH.slots['alt-city'].id)).toEqual(
      asksFor({ kind: 'city', cityId: PERTH.altCityId }),
    )
    expect(suggestedAsks(PERTH, PERTH.slots['stack-course'].id)).toEqual(
      asksFor({ kind: 'course', courseId: PERTH.stackCourseId }),
    )
  })

  it('gives any other tile, or one not on the road, none', () => {
    for (const slot of OTHER_SLOTS) expect(suggestedAsks(PERTH, PERTH.slots[slot].id)).toEqual([])
    expect(suggestedAsks(PERTH, 'not-a-tile')).toEqual([])
  })

  it('gives every city and course tile on every road 3 or 4 asks', () => {
    for (const road of ROADS) {
      for (const slot of ASK_SLOTS) {
        const n = suggestedAsks(road, road.slots[slot].id).length
        expect({ road: road.id, slot, ok: n >= 3 && n <= 4 }).toEqual({
          road: road.id,
          slot,
          ok: true,
        })
      }
    }
  })
})

describe('askFacts (23)', () => {
  it("gives a course's fees, years, subjects, occupations and lists, opportunities and asks", () => {
    const data = askFacts(PERTH, 'course', PROFILE_1.answers, TAGS)
    expect(data.tile).toEqual({ slot: 'course', name: PERTH.slots.course.name })
    expect(data.answers).toEqual(whyFacts(PERTH, 'course', PROFILE_1.answers, []).answers)
    expect(data.tags).toEqual([COUSIN.text])
    const texts = data.rows.map((r) => r.text)
    expect(texts).toContain('Master of Cyber Security at ECU: fees about AUD 33k a year (mock)')
    expect(texts).toContain('Master of Cyber Security at ECU takes 2 years (mock)')
    expect(texts).toContain(
      'Master of Cyber Security at ECU majors: Network security and Digital forensics (mock)',
    )
    expect(texts.some((t) => t.includes('Ethical hacking'))).toBe(true)
    expect(texts.some((t) => t.includes('A programming bridging unit'))).toBe(true)
    expect(texts).toContain(
      'Master of Cyber Security at ECU leads to ICT Security Specialist (mock)',
    )
    expect(texts).toContain("ICT Security Specialist is on WA's 190 and 491 lists (mock)")
    expect(texts.some((t) => t.includes('Swan River Cyber'))).toBe(true)
    expect(texts.some((t) => t.startsWith('What will I study?'))).toBe(true)
    expect(texts.every((t) => t.endsWith('(mock)'))).toBe(true)
    expect(new Set(data.rows.map((r) => r.id)).size).toBe(data.rows.length)
  })

  it('gives a course the entry conditions its card shows: its English score, and a degree in its field where it asks one (62)', () => {
    const texts = askFacts(PERTH, 'course', PROFILE_1.answers, []).rows.map((r) => r.text)
    expect(texts).toContain('Master of Cyber Security at ECU entry: needs IELTS 6.5 (mock)')
    const civil = specById('sydney-uts-civil-stay')
    if (!civil) throw new Error('sydney-uts-civil-stay missing')
    const course = courseById(civil.courseId)
    expect(askFacts(civil, 'course', {}, []).rows.map((r) => r.text)).toContain(
      `${course?.name} at UTS entry: needs a bachelor’s degree in engineering (mock)`,
    )
  })

  it("gives the course its slot names, never the road's main course outside her own rows", () => {
    const texts = askFacts(PERTH, 'alt-course', PROFILE_1.answers, [])
      .rows.filter((r) => !r.id.startsWith('yours-'))
      .map((r) => r.text)
    expect(texts.some((t) => t.includes('Master of Cyber Security at ECU'))).toBe(false)
    expect(texts.some((t) => t.includes('Curtin'))).toBe(true)
  })

  it("gives a city's living cost, regional status, state, opportunities and asks, and no course rows", () => {
    const data = askFacts(PERTH, 'city', PROFILE_1.answers, [])
    expect(data.tile).toEqual({ slot: 'city', name: PERTH.slots.city.name })
    const texts = data.rows.map((r) => r.text)
    expect(texts).toContain('Living costs in Perth about AUD 21k a year (mock)')
    expect(texts).toContain('Perth counts as regional for visas (mock)')
    expect(texts).toContain('Perth is in WA (mock)')
    expect(texts.some((t) => t.includes('Help desk assistant at Westbay Services'))).toBe(true)
    expect(texts.some((t) => t.startsWith('How much does it cost to live in Perth?'))).toBe(true)
    expect(texts.some((t) => t.includes('fees about'))).toBe(false)
    expect(texts.some((t) => t.includes('Adelaide'))).toBe(false)
    expect(texts.every((t) => t.endsWith('(mock)'))).toBe(true)
    expect(new Set(data.rows.map((r) => r.id)).size).toBe(data.rows.length)
  })

  it('gives the other city its own rows', () => {
    const texts = askFacts(PERTH, 'alt-city', PROFILE_1.answers, []).rows.map((r) => r.text)
    expect(texts).toContain('Living costs in Adelaide about AUD 20k a year (mock)')
    expect(texts).toContain('Adelaide is in SA (mock)')
    expect(texts.some((t) => t.includes('Perth'))).toBe(false)
  })

  it('gives her tags but never a wellbeing one: those are for support content only (ADR-088)', () => {
    expect(askFacts(PERTH, 'city', PROFILE_1.answers, [WORRIED, COUSIN]).tags).toEqual([
      COUSIN.text,
    ])
  })
})

describe('askFacts: her own course beside an alternative or stack course (criterion 69)', () => {
  const own = askFacts(PERTH, 'course', PROFILE_1.answers, []).rows

  it("adds her own course's rows, ids prefixed yours-, to the alternative and the stack course", () => {
    for (const slot of ['alt-course', 'stack-course'] as const) {
      const rows = askFacts(PERTH, slot, PROFILE_1.answers, []).rows
      expect(rows.filter((r) => r.id.startsWith('yours-'))).toEqual(
        own.map((r) => ({ id: `yours-${r.id}`, text: r.text })),
      )
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    }
    expect(askFacts(PERTH, 'alt-course', PROFILE_1.answers, []).rows.map((r) => r.text)).toContain(
      'Master of Cyber Security at ECU: fees about AUD 33k a year (mock)',
    )
  })

  it('adds none to her own course or a city', () => {
    for (const slot of ['course', 'city', 'alt-city'] as const) {
      const ids = askFacts(PERTH, slot, PROFILE_1.answers, []).rows.map((r) => r.id)
      expect(ids.filter((id) => id.startsWith('yours-'))).toEqual([])
    }
  })

  it('lets an answer cite them', () => {
    const facts = askFacts(PERTH, 'alt-course', PROFILE_1.answers, [])
    const reply = 'Your own course costs about AUD 33k a year (mock).'
    expect(askProblems({ answerable: true, reply, cited: ['yours-course-fees'] }, facts)).toEqual(
      [],
    )
  })
})

describe('askFacts: her budget against the catalogue (criterion 82)', () => {
  const budget = (
    amount: number,
    covers: string,
    state: 'stated' | 'assumed' = 'stated',
  ): StoredAnswers => ({
    ...PROFILE_1.answers,
    amount: { value: amount, state },
    covers: { value: covers, state: 'stated' },
  })
  const budgetRows = (slot: Parameters<typeof askFacts>[1], answers: StoredAnswers) =>
    askFacts(PERTH, slot, answers, []).rows.filter((r) => r.id === 'budget')

  it('compares a course tile with its fees alone for fees only', () => {
    expect(budgetRows('course', budget(30, 'Fees only'))).toEqual([
      {
        id: 'budget',
        text: 'Your budget, AUD 30k a year for fees only: the fees are AUD 33k a year, AUD 3k over.',
      },
    ])
  })

  it("compares it with the fees and its city's living costs for fees and living", () => {
    expect(budgetRows('course', budget(36, 'Fees and living'))).toEqual([
      {
        id: 'budget',
        text: 'Your budget, AUD 36k a year for fees and living: the fees (AUD 33k) and living costs in Perth (AUD 21k) are AUD 54k a year, AUD 18k over.',
      },
    ])
  })

  it('says what is left when the budget is more', () => {
    expect(budgetRows('course', budget(42, 'Fees only'))[0]?.text).toBe(
      'Your budget, AUD 42k a year for fees only: the fees are AUD 33k a year, AUD 9k to spare.',
    )
    expect(budgetRows('course', budget(33, 'Fees only'))[0]?.text).toBe(
      'Your budget, AUD 33k a year for fees only: the fees are AUD 33k a year, exactly your budget.',
    )
  })

  it("compares a city tile with her road's course fees and that city's living costs", () => {
    expect(budgetRows('city', budget(30, 'Fees only'))[0]?.text).toBe(
      'Your budget, AUD 30k a year for fees only: the fees of Master of Cyber Security at ECU are AUD 33k a year, AUD 3k over.',
    )
    expect(budgetRows('alt-city', budget(42, 'Fees and living'))[0]?.text).toBe(
      'Your budget, AUD 42k a year for fees and living: the fees of Master of Cyber Security at ECU (AUD 33k) and living costs in Adelaide (AUD 20k) are AUD 53k a year, AUD 11k over.',
    )
  })

  it('gives no budget row without a stated amount', () => {
    expect(budgetRows('course', PROFILE_1.answers)).toEqual([])
    expect(budgetRows('course', budget(30, 'Fees only', 'assumed'))).toEqual([])
  })

  it('lets an answer use and cite it', () => {
    const facts = askFacts(PERTH, 'course', budget(30, 'Fees only'), [])
    const reply = 'The fees are AUD 33k a year, AUD 3k over your budget of AUD 30k (mock).'
    expect(askProblems({ answerable: true, reply, cited: ['budget'] }, facts)).toEqual([])
  })
})

describe('needsCounsellor (criterion 70)', () => {
  it('is true for a question about visas, the law or safety', () => {
    for (const q of [
      'Will my visa be approved?',
      'Can I get PR after this?',
      'How do I get permanent residency?',
      'Do I need a lawyer?',
      'Is it legal to work 30 hours?',
      'Who do I call, the police?',
      'Is Perth safe at night?',
      'Is the area unsafe?',
      'What if someone harasses me?',
      'Is it against the law to work 30 hours a week?',
      'what are the laws on part-time work',
      'is that lawful',
      'Is it unlawful for my boss to keep my pay?',
    ])
      expect({ q, counsellor: needsCounsellor(q) }).toEqual({ q, counsellor: true })
  })

  it('is false for fees or rent', () => {
    for (const q of [
      'How much are the fees?',
      'What is the rent in Perth?',
      'Is it expensive?',
      'Lawrence Street rent',
      'Is there a lawn at the house?',
    ])
      expect({ q, counsellor: needsCounsellor(q) }).toEqual({ q, counsellor: false })
  })
})

describe('askProblems (23, 24, 25)', () => {
  const rows = [
    { id: 'city-living', text: 'Living costs in Perth about AUD 21k a year (mock)' },
    { id: 'city-regional', text: 'Perth counts as regional for visas (mock)' },
  ]
  const facts = { rows, answers: [] }
  const answer = (reply: string, cited = ['city-living'], answerable = true) => ({
    answerable,
    reply,
    cited,
  })

  it('passes an answer from the rows that cites them', () => {
    expect(askProblems(answer('Living costs about AUD 21k a year (mock).'), facts)).toEqual([])
  })

  it('passes the exact refusal', () => {
    expect(askProblems(answer(NO_DATA, [], false), facts)).toEqual([])
    expect(NO_DATA).toBe("I don't have that in our data.")
  })

  it('flags an answer that cites nothing', () => {
    expect(askProblems(answer('Perth counts as regional (mock).', []), facts)).toHaveLength(1)
  })

  it('flags an empty answer', () => {
    expect(askProblems(answer('  '), facts)).toHaveLength(1)
  })

  it('flags a cited id that is not a row', () => {
    const problems = askProblems(answer('Perth counts as regional.', ['visa-500']), facts)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('visa-500')
  })

  it('flags a figure in no row', () => {
    const problems = askProblems(answer('Rent is about AUD 370 a week.'), facts)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('370')
  })

  it('passes a figure from her answers, as the why does (23)', () => {
    const hers = { rows, answers: [{ question: 'Amount', answer: '30' }] }
    const reply = answer('Your 30k covers living costs of about AUD 21k a year (mock).')
    expect(askProblems(reply, hers)).toEqual([])
    expect(askProblems(reply, facts)).toHaveLength(1)
  })

  it('flags every ranking word', () => {
    for (const word of ['best', 'recommended', 'recommend', 'top', 'ranked', 'number one']) {
      expect(askProblems(answer(`Perth is ${word}.`), facts)).toHaveLength(1)
    }
  })

  it('flags a judgement between courses or cities, and passes a factual comparison', () => {
    for (const reply of [
      'Perth is better for you.',
      'Adelaide is worse.',
      'Perth has a stronger job market.',
      'Perth is the right choice.',
      'Adelaide is a weaker option.',
    ]) {
      expect([reply, askProblems(answer(reply), facts).length]).toEqual([reply, 1])
    }
    expect(
      askProblems(answer('Living costs about AUD 21k a year (mock), more than in Hobart.'), facts),
    ).toEqual([])
  })

  it('flags a reply over 700 characters', () => {
    expect(askProblems(answer('a'.repeat(701)), facts)).toHaveLength(1)
    expect(askProblems(answer('a'.repeat(700)), facts)).toEqual([])
  })

  it('flags a refusal in any words but the exact ones', () => {
    expect(askProblems(answer('Sorry, I cannot say.', [], false), facts)).toHaveLength(1)
  })
})

describe('askCap (26)', () => {
  it('is 20 unless STUDENT_ASK_DAILY_CAP holds a whole number', () => {
    expect(askCap({})).toBe(20)
    expect(askCap({ STUDENT_ASK_DAILY_CAP: '5' })).toBe(5)
    for (const bad of ['abc', '-1', '']) expect(askCap({ STUDENT_ASK_DAILY_CAP: bad })).toBe(20)
  })
})

describe('Ask on a composed road (criterion 56)', () => {
  const NURSING = specById('adelaide-unisa-nursing-stay')
  if (!NURSING) throw new Error('adelaide-unisa-nursing-stay missing')
  const course = courseById(NURSING.courseId)
  const named = `${course?.name} at ${course?.university}`

  it('gives its course tile the rows of its own course, with its subjects and asks', () => {
    const data = askFacts(NURSING, 'course', PROFILE_1.answers, [])
    const texts = data.rows.map((r) => r.text)
    expect(texts).toContain(`${named}: fees about AUD ${course?.feeK}k a year (mock)`)
    expect(texts.some((t) => t.startsWith(`${named} majors:`))).toBe(true)
    expect(texts.some((t) => t.includes('Registered Nurse'))).toBe(true)
    expect(texts.some((t) => t.startsWith('What will I study?'))).toBe(true)
  })

  it('gives its city and course tiles their suggested questions', () => {
    for (const slot of ['city', 'course'] as const)
      expect(suggestedAsks(NURSING, NURSING.slots[slot].id).length).toBeGreaterThan(0)
  })
})
