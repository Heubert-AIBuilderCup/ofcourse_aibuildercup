// Finder courses resolve as road courses (courseById, occupationsFor, subjectsOf) once the server
// module registers the catalogue, and never become candidates (criterion 30). The roads modules run
// in the browser too, so on their own they know no finder course: the catalogue stays on the server.

import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { cityOf } from '@/features/engine/catalogue'
import { ALL_PICKS } from '@/features/roads/data/candidates'
import { NO_COURSE_FALLBACK, registerCourseFallback } from '@/features/roads/data/course-fallback'
import { courseById } from '@/features/roads/data/courses'
import { entryOf } from '@/features/roads/data/entry'
import { OCCUPATIONS, occupationsFor } from '@/features/roads/data/occupations'
import { subjectsOf } from '@/features/roads/data/subjects'
import { buildRoad } from '@/features/roads/model/build'
import { composeRoad } from '@/features/roads/model/compose'
import { courseConditions } from '@/features/roads/model/conditions'
import { courseWords } from '@/features/roads/model/course-words'
import { expectSound } from '@/features/roads/model/sound.test-helpers'
import type { StoredAnswers } from '@/shared/types/student'
import { FINDER_COURSES, FINDER_EXTRAS } from '../data/catalogue'

mock.module('server-only', () => ({}))

/** Loads the server module afresh (Bun keys a module by its specifier, query included), so its
 * registration runs here even when another test file loaded it first. */
let loads = 0
const loadRoadCourses = () => import(`../server/road-courses?load=${++loads}`)

const course = FINDER_COURSES[0]
const extra = FINDER_EXTRAS.find((x) => x.courseId === course.id)

describe('before the server registers the catalogue', () => {
  test('no roads lookup knows a finder course', () => {
    registerCourseFallback(NO_COURSE_FALLBACK)
    expect(courseById(course.id)).toBeUndefined()
    expect(occupationsFor(course.id)).toHaveLength(0)
    expect(subjectsOf(course.id)).toBeUndefined()
  })
})

describe('after the server module is loaded', () => {
  beforeAll(loadRoadCourses)

  test('courseById returns the finder course', () => {
    expect(courseById(course.id)).toBe(course)
  })

  test('occupationsFor returns the occupations its extras name', () => {
    const codes = extra?.occupationCodes ?? []
    expect(codes.length).toBeGreaterThan(0)
    expect(occupationsFor(course.id).map((o) => o.code)).toEqual(
      OCCUPATIONS.filter((o) => codes.includes(o.code)).map((o) => o.code),
    )
  })

  test('subjectsOf returns its majors and units with the sample source', () => {
    expect(subjectsOf(course.id)).toEqual({
      courseId: course.id,
      majors: extra?.subjects.majors ?? [],
      units: extra?.subjects.units ?? [],
      conditions: [],
      source: { title: 'OfCourse sample catalogue · sample', date: 'Oct 2026' },
    })
  })

  test('the roads own courses still come first', () => {
    expect(courseById('ecu-cyber')?.id).toBe('ecu-cyber')
    expect(occupationsFor('ecu-cyber').map((o) => o.code)).toEqual(['262112'])
    expect(subjectsOf('ecu-cyber')?.source.title).toBe('ECU course handbook · mock')
    expect(courseById('nope')).toBeUndefined()
  })

  test('no finder course is ever a candidate (criterion 30)', () => {
    expect(ALL_PICKS.filter((p) => p.courseId.startsWith('f-'))).toHaveLength(0)
  })

  test('a finder course with no entry rule asks a sample IELTS by level: 5.5 for a Diploma, 6.5 for a Master’s', () => {
    expect(entryOf('f-diploma-of-business-administration-tafe-perth')).toStrictEqual({
      minQual: 'High school',
      needsDegreeIn: null,
      ielts: 5.5,
      sample: true,
    })
    expect(entryOf('f-master-of-data-science-ecu-joondalup')).toStrictEqual({
      minQual: "Bachelor's",
      needsDegreeIn: null,
      ielts: 6.5,
      sample: true,
    })
  })

  test('its English badge and condition say the figure is a sample; a road course’s do not', () => {
    const master = 'f-master-of-data-science-ecu-joondalup'
    const diploma = 'f-diploma-of-business-administration-tafe-perth'
    const english = (courseId: string) =>
      courseConditions(courseId, {}).find((c) => c.id === 'english')?.text
    expect(english(master)).toBe('Needs IELTS 6.5 (sample)')
    expect(english(diploma)).toBe('Needs IELTS 5.5 (sample)')
    expect(english('uts-data')).toBe('Needs IELTS 7.0')

    const badge = (courseId: string, answers: StoredAnswers = {}) =>
      buildRoad(composeRoad({ cityId: 'perth', courseId, stays: true }), { answers }).badges.ielts
        .value
    expect(badge(master)).toBe('IELTS 6.5 overall (sample)')
    expect(badge(master, { eng: { value: 'IELTS 6.0', state: 'stated' } })).toBe(
      'Not met: IELTS 6.5 overall (sample)',
    )
    expect(badge('ecu-cyber')).toBe('IELTS 6.5 overall')
  })

  test('a road course keeps its own entry rule', () => {
    expect(entryOf('uts-data')).toStrictEqual({
      minQual: "Bachelor's",
      needsDegreeIn: null,
      ielts: 7,
    })
  })

  test('a course with nothing on one side of its trade-offs shows only the other side', () => {
    const onlyGains = courseWords('perth', 'f-diploma-of-business-administration-tafe-perth').slots
      .course
    expect(onlyGains.gains).toMatch(/^Good for: \S/)
    expect(onlyGains.costs).toBeUndefined()
    expect(onlyGains.card.costs).toBeUndefined()
    const onlyCosts = courseWords(
      'geelong',
      'f-master-of-human-factors-and-usability-deakin-waurn-ponds',
    ).slots.course
    expect(onlyCosts.costs).toMatch(/^Less good for: \S/)
    expect(onlyCosts.gains).toBeUndefined()
    expect(onlyCosts.card.gains).toBeUndefined()
  })

  test('a finder near-copy of a road course has a tile id of its own; the road course keeps its own', () => {
    const words = courseWords('perth', 'ecu-data', [
      'ecu-data',
      'f-master-of-data-science-ecu-joondalup',
    ])
    expect(words.slots.course.id).toBe('data-science-ecu-perth')
    expect(words.slots['alt-course'].id).not.toBe('data-science-ecu-perth')
  })

  // Thirty two-year finder courses spread evenly through the catalogue, staying and going home.
  const twoYear = FINDER_COURSES.filter((c) => c.years === 2)
  const sample = Array.from(
    { length: 30 },
    (_, i) => twoYear[Math.floor((i * twoYear.length) / 30)],
  )

  for (const c of sample) {
    for (const stays of [true, false]) {
      test(`${c.id} ${stays ? 'stay' : 'home'} composes a sound road`, () => {
        const spec = composeRoad({ cityId: cityOf(c).id, courseId: c.id, stays })
        expectSound(buildRoad(spec, { answers: {} }), spec)
      })
    }
  }
})
