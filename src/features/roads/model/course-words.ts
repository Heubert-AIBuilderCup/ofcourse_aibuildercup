// The words a composed road says about its course, from the catalogue alone: the course, the
// courses around it (an alternative and a stack course in the same city), its years, the 485 that
// follows them, the three course badges, the stack's rows, the lesson and the overview's course
// row. Nothing here is about one student: no relative, no degree she holds, no score of hers
// (criterion 58). Each course is named for its own level ("Diploma · Information Technology"),
// and a Diploma's 485 is the post-vocational stream (criterion 89). Pure.

import { COURSES, campusOf, cityById, cityOf } from '@/features/engine/catalogue'
import type { Course, Level } from '@/features/engine/types'
import type { Badge } from '@/features/road/model/road-data'
import { roadCoursesIn } from '../data/candidates'
import { courseById, EXTRA_COURSES } from '../data/courses'
import { relatedFields } from '../data/fields'
import { feesOf } from '../data/figures'
import {
  altCourse,
  type CourseWords,
  course,
  courseYears,
  english,
  lesson,
  moreCourses,
  offerings,
  programming,
  stackCourse,
  visa485,
} from '../data/roads'
import { subjectsOf } from '../data/subjects'
import type { RoadSpec, SlotCopy } from '../data/types'

export type CourseSlots = Pick<
  RoadSpec['slots'],
  'course' | 'alt-course' | 'more-courses' | 'course-years' | 'visa-485' | 'stack-course'
>

export type ComposedCourse = {
  /** The course's name on the map: "Data Science". */
  name: string
  altCourseId: string
  stackCourseId: string
  slots: CourseSlots
  badges: Pick<RoadSpec['badges'], 'offerings' | 'ielts' | 'maths'>
  stackRows: RoadSpec['stackRows']
  lesson: RoadSpec['lesson']
  /** The overview's course row: "Data Science · 2 intakes · walked". */
  courseRow: string
}

const ALL_COURSES = [...COURSES, ...EXTRA_COURSES]

function courseOf(id: string): Course {
  const c = courseById(id)
  if (!c) throw new Error(`No course "${id}"`)
  return c
}

/** "Master of Data Science" reads "Data Science" on the map. */
const shortName = (c: Course): string => c.name.replace(/^Master of /, '')

/** What the course is in: "Information Technology", of a Master's or a Diploma alike. */
const subjectOf = (c: Course): string => c.name.replace(/^(Master|Diploma) of /, '')

/** A level as the board's steps name it. */
const LEVEL_WORD: Record<Level, string> = {
  Diploma: 'Diploma',
  "Bachelor's": 'Bachelor’s',
  "Master's": 'Master’s',
}

/** "Diploma · Information Technology": the study step's name, at the course's own level. */
const stepName = (c: Course): string => `${LEVEL_WORD[c.level]} · ${subjectOf(c)}`

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * "data-science-ecu-perth": the course's own tile id, readable, unique in the catalogue. A finder
 * course's is its own "f-…" id, so a near-copy of a road course never takes the road course's.
 */
const tileIdOf = (c: Course): string =>
  c.id.startsWith('f-') ? c.id : `${slug(shortName(c))}-${slug(c.university)}-${cityOf(c).id}`

/** "Machine learning" → "machine learning"; an acronym ("IT project") keeps its capitals. */
const lowerFirst = (s: string): string =>
  /^[A-Z](?![A-Z])/.test(s) ? s[0].toLowerCase() + s.slice(1) : s
const upperFirst = (s: string): string => s[0].toUpperCase() + s.slice(1)

const andList = (items: string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

function subjects(c: Course) {
  const s = subjectsOf(c.id)
  if (!s) throw new Error(`No subjects for course "${c.id}"`)
  return s
}

/** The units the course-years card and the lesson name: its first three. */
const unitsOf = (c: Course): string => andList(subjects(c).units.slice(0, 3).map(lowerFirst))

/**
 * A course's trade-offs, from its fees and its four lines: what it gives, what it costs. A side
 * with no words is left out, as compose.ts's `weighPr` leaves it out of the city cards.
 */
function tradeOffs(c: Course): { gains?: string; costs?: string } {
  const dims: [string, 'gives' | 'neutral' | 'costs'][] = [
    ['cost', c.feeK <= 30 ? 'gives' : 'costs'],
    ['PR', c.lines.pr.effect],
    ['work', c.lines.work.effect],
    ['career', c.lines.career.effect],
    ['time', c.lines.time.effect],
  ]
  const say = (prefix: string, effect: string) => {
    const list = dims.filter(([, e]) => e === effect).map(([d]) => d)
    return list.length ? `${prefix}${list.join(', ')}` : undefined
  }
  const gains = say('Good for: ', 'gives')
  const costs = say('Less good for: ', 'costs')
  return { ...(gains && { gains }), ...(costs && { costs }) }
}

/** Its intakes, as the catalogue's time line names them ("intakes in February and July"). */
function intakesOf(c: Course): { value: string; when: string } {
  const phrase = c.lines.time.text.split(' · ')[1]
  if (!phrase) return { value: 'Intakes', when: `${c.university}’s course page lists its intakes.` }
  const value = /\band\b/.test(phrase)
    ? '2 intakes'
    : upperFirst(phrase.replace(/ keeps it open$/, ''))
  return { value, when: `${upperFirst(phrase)}.` }
}

function words(c: Course): CourseWords {
  const city = cityOf(c)
  return {
    id: tileIdOf(c),
    name: shortName(c),
    sub: `${c.university} · ${city.name}`,
    ...tradeOffs(c),
    guide: `${campusOf(c).name}. About ${feesOf(c.id)}. Majors: ${subjects(c).majors.join(' · ')}.`,
    step: shortName(c),
  }
}

/** The badge the alternative carries: the first condition its handbook sets. */
function conditionBadge(c: Course): Badge {
  const condition = subjects(c).conditions[0] ?? 'An entry condition on its course page'
  if (/programming bridging unit/.test(condition)) return programming(c.university)
  if (/maths bridging unit/.test(condition)) {
    return {
      kind: 'Condition',
      value: 'Maths unit in year 1',
      explanation: `${c.university} asks students whose degree had little maths to take a maths bridging unit in the first semester.`,
      icon: 'alert',
    }
  }
  return {
    kind: 'Condition',
    value: condition,
    explanation: `${c.university} asks for this before you enrol: ${lowerFirst(condition)}.`,
    icon: 'alert',
  }
}

const LEVEL_RANK: Record<Level, number> = { Diploma: 0, "Bachelor's": 1, "Master's": 2 }
const levelGap = (a: Course, b: Course): number =>
  Math.abs(LEVEL_RANK[a.level] - LEVEL_RANK[b.level])

/**
 * The alternative and the stack course, from the city's road courses: her course's level first,
 * then the nearest level; at each, her course's field first, then a field next to it on the field
 * graph, then the rest, in catalogue order. With only one other course, the stack course is the
 * alternative again.
 */
export function coursesAround(
  courseId: string,
  pool: readonly string[],
): { altCourseId: string; stackCourseId: string } {
  const c = courseOf(courseId)
  const field = c.field
  const others = pool.filter((id) => id !== courseId)
  const fieldOf = (id: string) => courseOf(id).field
  const same = others.filter((id) => fieldOf(id) === field)
  const related = others.filter(
    (id) => fieldOf(id) !== field && relatedFields(field).includes(fieldOf(id)),
  )
  const ordered = [
    ...same,
    ...related,
    ...others.filter((id) => !same.includes(id) && !related.includes(id)),
  ].sort((a, b) => levelGap(courseOf(a), c) - levelGap(courseOf(b), c))
  const [altCourseId, second] = ordered
  if (!altCourseId) throw new Error(`No other course beside "${courseId}"`)
  return { altCourseId, stackCourseId: second ?? altCourseId }
}

/** Whether a course's field is her course's own or one next to it on the field graph. */
const near = (field: string, c: Course): boolean =>
  c.field === field || relatedFields(field).includes(c.field)

/** The stack's rows: the stack course first, on her board's tile, then the city's other courses. */
function rowsOf(
  c: Course,
  alt: Course,
  stack: Course,
  stackTileId: string,
  pool: readonly string[],
): RoadSpec['stackRows'] {
  const city = cityOf(c)
  const only = pool.length === 2 ? ` · the only other course in ${city.name}` : ''
  const row = (o: Course) => ({
    name: o.level === "Master's" ? shortName(o) : o.name,
    sub: `${o.university} · ${city.name}${o.years === 2 ? '' : ` · ${o.years} years`}`,
    courseId: o.id,
    tag: o.level === c.level && pool.includes(o.id) && near(c.field, o) ? 'Match well' : '',
  })
  const rest = ALL_COURSES.filter(
    (o) => cityOf(o).id === city.id && ![c.id, alt.id, stack.id].includes(o.id),
  )
  return [{ ...row(stack), sub: `${row(stack).sub}${only}`, tileId: stackTileId }, ...rest.map(row)]
}

/** "4 more in Perth": the rows' courses, and how many of them are at master's level. */
function moreIn(cityId: string, rows: RoadSpec['stackRows']) {
  const city = cityById(cityId)
  const masters = rows.filter((r) => courseById(r.courseId)?.level === "Master's").length
  const all = masters === rows.length
  const sub = all
    ? rows.length === 1
      ? 'At master’s level'
      : rows.length === 2
        ? 'Both at master’s level'
        : `All ${rows.length} at master’s level`
    : `${masters} at master’s level`
  return moreCourses({
    id: `more-courses-${cityId}`,
    where: city.name,
    count: rows.length,
    sub,
    guide: all
      ? `The other courses in ${city.name}, all at master’s level.`
      : `The other courses in ${city.name}. Some aren’t at master’s level; the list says which.`,
  })
}

/** A course tile's slot, its study step named for the course's own level. */
const atLevel = (slot: SlotCopy, c: Course): SlotCopy => ({ ...slot, courseStepName: stepName(c) })

/** The course's years: "Master’s · Data Science", or "Diploma · Information Technology". */
function yearsOf(c: Course, when: string, lessonId: string): SlotCopy {
  const level = c.level === 'Diploma' ? 'diploma' : 'masters'
  const slot = courseYears(
    `${level}-${slug(subjectOf(c))}-${slug(c.university)}`,
    subjectOf(c),
    when,
    `Two years of units such as ${unitsOf(c)}.`,
  )
  return {
    ...slot,
    name: stepName(c),
    short: LEVEL_WORD[c.level],
    card: { ...slot.card, lesson: lessonId },
  }
}

/** The 485 after the course: a Diploma's post-vocational stream, else the graduate stream. */
function visaAfter(c: Course, regional: boolean): SlotCopy {
  const graduate = visa485(regional)
  if (c.level !== 'Diploma') return graduate
  return {
    ...graduate,
    card: {
      ...graduate.card,
      guide:
        'The post-vocational stream: about 18 months of work rights after a diploma, in any job.',
      because: 'It follows the Diploma',
    },
  }
}

/** The 3-minute lesson on the course's years, at its own level. */
function lessonOf(c: Course, cityName: string, regional: boolean): RoadSpec['lesson'] {
  const masters = lesson(unitsOf(c), cityName, regional)
  if (c.level !== 'Diploma') return masters
  return {
    ...masters,
    id: 'diploma-years',
    title: 'The Diploma years, in 3 minutes',
    points: [
      ...masters.points.slice(0, 2),
      'Finish the diploma and the Graduate visa (485) that follows is its post-vocational stream: about 18 months, wherever you studied.',
    ],
    read: 'Lesson read. The Diploma years now show as looked at.',
  }
}

/** A course's words on a road in its city, with the courses around it taken from `pool`. */
export function courseWords(
  cityId: string,
  courseId: string,
  pool: readonly string[] = roadCoursesIn(cityId),
): ComposedCourse {
  const c = courseOf(courseId)
  const city = cityById(cityId)
  const { altCourseId, stackCourseId } = coursesAround(courseId, pool)
  const alt = courseOf(altCourseId)
  const stack = courseOf(stackCourseId)
  const also = `Also in ${city.name}`
  // The stack's tile is its own, even when it shows the alternative's course again.
  const stackTileId = stackCourseId === altCourseId ? `${tileIdOf(stack)}-stack` : tileIdOf(stack)
  const stackRows = rowsOf(c, alt, stack, stackTileId, pool)
  const intakes = intakesOf(c)
  const start = intakes.when.includes('March') ? 'Mar 2027' : 'Feb 2027'
  const lessonOfCourse = lessonOf(c, city.name, city.regional)

  return {
    name: shortName(c),
    altCourseId,
    stackCourseId,
    slots: {
      course: atLevel(course(words(c), also), c),
      'alt-course': atLevel(altCourse(words(alt), city.name, also), alt),
      'more-courses': moreIn(cityId, stackRows),
      'course-years': yearsOf(c, `${start} – Dec ${2026 + c.years}`, lessonOfCourse.id),
      'visa-485': visaAfter(c, city.regional),
      'stack-course': atLevel(
        stackCourse({
          id: stackTileId,
          name: shortName(stack),
          sub: `${stack.university} · ${city.name}`,
          step: shortName(stack),
          courseId: stack.id,
        }),
        stack,
      ),
    },
    badges: {
      offerings: offerings(intakes.value, intakes.when),
      ielts: english(c.university),
      maths: conditionBadge(alt),
    },
    stackRows,
    lesson: lessonOfCourse,
    courseRow: `${shortName(c)} · ${lowerFirst(intakes.value)} · walked`,
  }
}
