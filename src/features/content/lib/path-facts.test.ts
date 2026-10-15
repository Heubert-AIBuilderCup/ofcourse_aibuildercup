import { describe, expect, test } from 'bun:test'
import { COURSES } from '@/features/engine'
import { PATHS, pathById, pathFacts } from './path-facts'

describe('PATHS', () => {
  test('one path per course, id is the course id, in catalogue order', () => {
    expect(PATHS.length).toBe(COURSES.length)
    expect(PATHS.map((p) => p.id)).toEqual(COURSES.map((c) => c.id))
  })

  test('the label names city, course and university', () => {
    const path = pathById('ecu-cyber')
    expect(path?.label).toBe('Perth · Master of Cyber Security, ECU')
    expect(path?.city).toBe('Perth')
  })

  test('an unknown id is null', () => {
    expect(pathById('nope')).toBeNull()
  })
})

describe('pathFacts', () => {
  test('holds the fee in thousands and names the city', () => {
    const course = COURSES.find((c) => c.id === 'ecu-cyber')
    const result = pathFacts('ecu-cyber')
    expect(result?.facts.some((f) => f.text.includes(`AUD ${course?.feeK}k`))).toBe(true)
    expect(result?.facts.some((f) => f.text.includes('Perth'))).toBe(true)
  })

  test('every fact is its own sentence: quote is text, ref is a paragraph', () => {
    for (const path of PATHS) {
      const result = pathFacts(path.id)
      expect(result).not.toBeNull()
      for (const [i, fact] of (result?.facts ?? []).entries()) {
        expect(fact.quote).toBe(fact.text)
        expect(fact.ref).toBe(`¶${i + 1}`)
        expect(fact.sentenceId).toBe(`¶${i + 1}.1`)
        expect(fact.supported).toBe(true)
        expect(result?.paragraphs.find((p) => p.ref === fact.ref)?.text).toBe(fact.text)
      }
    }
  })

  test('a fact carries the first number it states, with its unit', () => {
    const fee = pathFacts('ecu-cyber')?.facts.find((f) => f.text.includes('Tuition'))
    expect(fee?.value).toEqual({ number: 33000, unit: 'aud' })
  })

  test('an unknown id gives null', () => {
    expect(pathFacts('nope')).toBeNull()
  })

  test('two calls give the same result', () => {
    expect(pathFacts('curtin-it')).toEqual(pathFacts('curtin-it'))
  })
})
