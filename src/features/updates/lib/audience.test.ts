import { describe, expect, it } from 'bun:test'
import { COURSES } from '@/features/engine'
import { MOCK_STUDENTS } from '..'
import { ALL_INSTITUTIONS, INSTITUTIONS, matchAudience, routeName } from './audience'

const student = (id: string, homeCountry: string, ranked: string[]) => ({
  id,
  name: id,
  homeCountry,
  ranked,
})
const STUDENTS = [
  student('priya', 'Nepal', ['curtin-it', 'ecu-cyber', 'ecu-bsc-cyber']),
  student('anjali', 'India', ['ecu-bsc-cyber']),
  student('rohan', 'India', ['monash-data']),
]

describe('matchAudience', () => {
  it('matches the students who ranked a route at the institution, in their order', () => {
    const matched = matchAudience({ institution: 'ECU', homeCountry: null }, STUDENTS)
    expect(matched.map((m) => m.student.id)).toEqual(['priya', 'anjali'])
  })

  it('narrows to a home country when one is chosen', () => {
    const matched = matchAudience({ institution: 'ECU', homeCountry: 'India' }, STUDENTS)
    expect(matched.map((m) => m.student.id)).toEqual(['anjali'])
    expect(matchAudience({ institution: 'Monash', homeCountry: 'Nepal' }, STUDENTS)).toEqual([])
  })

  it("gives each one's why line from the highest route they ranked there", () => {
    const [priya, anjali] = matchAudience({ institution: 'ECU', homeCountry: null }, STUDENTS)
    expect(priya.why).toBe('Because you ranked ECU Cyber Security')
    expect(anjali.why).toBe('Because you ranked ECU Cyber Security')
    const [rohan] = matchAudience({ institution: 'Monash', homeCountry: null }, STUDENTS)
    expect(rohan.why).toBe('Because you ranked Monash Data Science')
  })

  it('matches Priya, first, in the mock students for ECU', () => {
    const matched = matchAudience({ institution: 'ECU', homeCountry: null }, MOCK_STUDENTS)
    expect(matched[0].student.name).toBe('Priya')
    expect(MOCK_STUDENTS.length).toBeGreaterThanOrEqual(20)
  })
})

describe('matchAudience: all institutions', () => {
  it('reaches every student, in order, because it applies to every student', () => {
    const matched = matchAudience({ institution: ALL_INSTITUTIONS, homeCountry: null }, STUDENTS)
    expect(matched.map((m) => m.student.id)).toEqual(['priya', 'anjali', 'rohan'])
    expect(matched.map((m) => m.why)).toEqual(Array(3).fill('Because it applies to every student'))
    const all = matchAudience({ institution: ALL_INSTITUTIONS, homeCountry: null }, MOCK_STUDENTS)
    expect(all.length).toBe(MOCK_STUDENTS.length)
  })

  it('narrows to a home country, and says so', () => {
    const matched = matchAudience({ institution: ALL_INSTITUTIONS, homeCountry: 'India' }, STUDENTS)
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
