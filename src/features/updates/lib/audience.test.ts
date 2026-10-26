import { describe, expect, it } from 'bun:test'
import { COURSES } from '@/features/engine'
import { MOCK_STUDENTS } from '..'
import {
  ALL_INSTITUTIONS,
  ALL_TOPICS,
  audienceOf,
  INSTITUTIONS,
  matchAudience,
  routeName,
  TOPIC_IDS,
  type TopicId,
} from './audience'

const student = (id: string, homeCountry: string, ranked: string[], interests: TopicId[] = []) => ({
  id,
  name: id,
  homeCountry,
  ranked,
  interests,
})
const STUDENTS = [
  student('priya', 'Nepal', ['curtin-it', 'ecu-cyber', 'ecu-bsc-cyber']),
  student('anjali', 'India', ['ecu-bsc-cyber']),
  student('rohan', 'India', ['monash-data']),
]
const everyone = { institution: ALL_INSTITUTIONS, homeCountry: null, topic: ALL_TOPICS }

describe('matchAudience', () => {
  it('matches the students who ranked a route at the institution, in their order', () => {
    const matched = matchAudience(
      { institution: 'ECU', homeCountry: null, topic: ALL_TOPICS },
      STUDENTS,
    )
    expect(matched.map((m) => m.student.id)).toEqual(['priya', 'anjali'])
  })

  it('narrows to a home country when one is chosen', () => {
    const matched = matchAudience(
      { institution: 'ECU', homeCountry: 'India', topic: ALL_TOPICS },
      STUDENTS,
    )
    expect(matched.map((m) => m.student.id)).toEqual(['anjali'])
    expect(
      matchAudience({ institution: 'Monash', homeCountry: 'Nepal', topic: ALL_TOPICS }, STUDENTS),
    ).toEqual([])
  })

  it("gives each one's why line from the highest route they ranked there", () => {
    const [priya, anjali] = matchAudience(
      { institution: 'ECU', homeCountry: null, topic: ALL_TOPICS },
      STUDENTS,
    )
    expect(priya.why).toBe('Because you ranked ECU Cyber Security')
    expect(anjali.why).toBe('Because you ranked ECU Cyber Security')
    const [rohan] = matchAudience(
      { institution: 'Monash', homeCountry: null, topic: ALL_TOPICS },
      STUDENTS,
    )
    expect(rohan.why).toBe('Because you ranked Monash Data Science')
  })

  it('matches Priya, first, in the mock students for ECU', () => {
    const matched = matchAudience(
      { institution: 'ECU', homeCountry: null, topic: ALL_TOPICS },
      MOCK_STUDENTS,
    )
    expect(matched[0].student.name).toBe('Priya')
    expect(MOCK_STUDENTS.length).toBeGreaterThanOrEqual(20)
  })
})

describe('matchAudience: all institutions', () => {
  it('reaches every student, in order, because it applies to every student', () => {
    const matched = matchAudience(
      { institution: ALL_INSTITUTIONS, homeCountry: null, topic: ALL_TOPICS },
      STUDENTS,
    )
    expect(matched.map((m) => m.student.id)).toEqual(['priya', 'anjali', 'rohan'])
    expect(matched.map((m) => m.why)).toEqual(Array(3).fill('Because it applies to every student'))
    const all = matchAudience(
      { institution: ALL_INSTITUTIONS, homeCountry: null, topic: ALL_TOPICS },
      MOCK_STUDENTS,
    )
    expect(all.length).toBe(MOCK_STUDENTS.length)
  })

  it('narrows to a home country, and says so', () => {
    const matched = matchAudience(
      { institution: ALL_INSTITUTIONS, homeCountry: 'India', topic: ALL_TOPICS },
      STUDENTS,
    )
    expect(matched.map((m) => m.student.id)).toEqual(['anjali', 'rohan'])
    expect(matched[0].why).toBe('Because it applies to every student from India')
  })

  it('is not one of the catalogue institutions', () => {
    expect(ALL_INSTITUTIONS).toBe('All institutions')
    expect(INSTITUTIONS).not.toContain(ALL_INSTITUTIONS)
  })
})

describe('routeName', () => {
  it('names a route by its institution and its course without the degree', () => {
    const course = COURSES.find((c) => c.id === 'swin-cyberpsych')
    if (!course) throw new Error('no course')
    expect(routeName(course)).toBe('Swinburne Psychology (Cyberpsychology)')
  })
})

describe('INSTITUTIONS', () => {
  it("lists the catalogue's institutions once each, sorted", () => {
    expect(INSTITUTIONS).toContain('ECU')
    expect(new Set(INSTITUTIONS).size).toBe(INSTITUTIONS.length)
    expect([...INSTITUTIONS].sort((a, b) => a.localeCompare(b))).toEqual([...INSTITUTIONS])
  })
})

describe('topics', () => {
  it('are the eight broad fields, and "All topics" leaves the topic out', () => {
    expect([...TOPIC_IDS]).toEqual([
      'cyber',
      'data',
      'business',
      'it',
      'psych',
      'health',
      'engineering',
      'design',
    ])
    expect(ALL_TOPICS).toBe('All topics')
  })
})

describe('audienceOf', () => {
  it('reads a stored audience without a topic as all topics', () => {
    expect(audienceOf({ institution: 'ECU', homeCountry: null })).toEqual({
      institution: 'ECU',
      homeCountry: null,
      topic: ALL_TOPICS,
    })
  })

  it('reads a stored topic that is not one of the topics as reaching no student', () => {
    const rule = audienceOf({
      institution: ALL_INSTITUTIONS,
      homeCountry: null,
      topic: 'astrology',
    })
    expect(matchAudience(rule, MOCK_STUDENTS)).toEqual([])
  })
})

describe('matchAudience: all topics keeps the old rules', () => {
  const pairs = (rule: Parameters<typeof matchAudience>[0]) =>
    matchAudience(rule, MOCK_STUDENTS).map((m) => [m.student.id, m.why])

  it('reaches the same students, with the same why lines, as before topics', () => {
    const ecu = 'Because you ranked ECU Cyber Security'
    expect(pairs({ institution: 'ECU', homeCountry: null, topic: ALL_TOPICS })).toEqual(
      ['priya', 'aarav', 'bikash', 'anjali', 'meera', 'ploy', 'minh', 'tharushi', 'jose'].map(
        (id) => [id, ecu],
      ),
    )
    expect(pairs({ institution: 'Monash', homeCountry: 'India', topic: ALL_TOPICS })).toEqual([
      ['rohan', 'Because you ranked Monash Data Science'],
      ['kabir', 'Because you ranked Monash Data Science'],
    ])
    const thai = 'Because it applies to every student from Thailand'
    expect(pairs({ ...everyone, homeCountry: 'Thailand' })).toEqual([
      ['nok', thai],
      ['ploy', thai],
      ['arthit', thai],
    ])
  })
})

describe('matchAudience: a topic', () => {
  const FIXTURE = [
    student('ranked', 'India', ['ecu-cyber', 'monash-data']),
    student('drawn', 'Nepal', ['ecu-cyber'], ['psych', 'data']),
    student('neither', 'India', ['ecu-cyber', 'curtin-it'], ['psych']),
    student('both', 'Nepal', ['uts-data'], ['data']),
  ]

  it('keeps the students with a ranked course in the field or the field among their interests', () => {
    const matched = matchAudience({ ...everyone, topic: 'data' }, FIXTURE)
    expect(matched.map((m) => [m.student.id, m.why])).toEqual([
      ['ranked', 'Because Data science is on a route you ranked'],
      ['drawn', "Because you said you're drawn to Data science"],
      ['both', 'Because Data science is on a route you ranked'],
    ])
  })

  it("needs the institution too when one is chosen, and gives the topic's why, as her feed does", () => {
    const matched = matchAudience({ institution: 'ECU', homeCountry: null, topic: 'data' }, FIXTURE)
    expect(matched.map((m) => [m.student.id, m.why])).toEqual([
      ['ranked', 'Because Data science is on a route you ranked'],
      ['drawn', "Because you said you're drawn to Data science"],
    ])
  })

  it('leaves out students from elsewhere when a home country is chosen', () => {
    const matched = matchAudience({ ...everyone, homeCountry: 'Nepal', topic: 'data' }, FIXTURE)
    expect(matched.map((m) => m.student.id)).toEqual(['drawn', 'both'])
  })

  it('counts stated interests among the mock students', () => {
    const matched = matchAudience({ ...everyone, topic: 'data' }, MOCK_STUDENTS)
    const expected = MOCK_STUDENTS.filter(
      (s) =>
        s.ranked.some((id) => COURSES.find((c) => c.id === id)?.field === 'data') ||
        s.interests.includes('data'),
    ).map((s) => s.id)
    expect(matched.map((m) => m.student.id)).toEqual(expected)
    expect(matched.some((m) => m.why === "Because you said you're drawn to Data science")).toBe(
      true,
    )
  })
})
