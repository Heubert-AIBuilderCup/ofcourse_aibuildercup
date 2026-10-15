// A path is one course in the catalogue, with the city it is in. A comic about a path is built from
// its facts: one plain sentence per catalogue line, each its own paragraph, so every fact quotes
// its paragraph exactly and the number checks can run on them like on any other source.

import { COURSES, cityOf } from '@/features/engine'
import type { Fact } from '../model/types'
import { numbersIn } from '../text/numbers'

type Course = (typeof COURSES)[number]

export type Path = { id: string; label: string; city: string; course: string; university: string }

/** One path per course: each course has exactly one city, so the course id is the path id. */
export const PATHS: readonly Path[] = COURSES.map((course) => {
  const city = cityOf(course)
  return {
    id: course.id,
    label: `${city.name} · ${course.name}, ${course.university}`,
    city: city.name,
    course: course.name,
    university: course.university,
  }
})

export function pathById(id: string): Path | null {
  return PATHS.find((path) => path.id === id) ?? null
}

export type PathFacts = {
  title: string
  paragraphs: { ref: string; text: string }[]
  facts: Fact[]
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

/** A location line joins after a semicolon, so its capital drops ("Counts" to "counts"); "AUD" and names stay. */
const lowerFirst = (text: string) =>
  /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text

function sentencesOf(course: Course): string[] {
  const city = cityOf(course)
  return [
    city.regional
      ? `${city.name} counts as a regional city.`
      : `${city.name} is not a regional city.`,
    `${course.university} teaches the ${course.name}.`,
    `The course takes ${course.years} ${course.years === 1 ? 'year' : 'years'}.`,
    sentence(course.feeClaim.detail[0]),
    sentence(`Living costs about AUD ${city.livingK}k a year; ${lowerFirst(city.location.text)}`),
    sentence(`The road to PR: ${course.route}`),
    sentence(course.lines.pr.text),
    sentence(course.lines.work.text),
    sentence(course.lines.career.text),
    sentence(course.lines.time.text),
  ]
}

function firstNumber(text: string): Fact['value'] {
  const first = numbersIn(text)[0]
  return first ? { number: first.value, unit: first.unit ?? 'number' } : null
}

/** The facts a story about this path is built from, or null when no course has the id. */
export function pathFacts(id: string): PathFacts | null {
  const course = COURSES.find((c) => c.id === id)
  if (!course) return null
  const texts = sentencesOf(course)
  return {
    title: `${course.name} at ${course.university}, ${cityOf(course).name}`,
    paragraphs: texts.map((text, i) => ({ ref: `¶${i + 1}`, text })),
    facts: texts.map((text, i) => ({
      id: `f${i + 1}`,
      text,
      value: firstNumber(text),
      ref: `¶${i + 1}`,
      quote: text,
      supported: true,
      why: null,
      span: null,
      sentenceId: `¶${i + 1}.1`,
    })),
  }
}
