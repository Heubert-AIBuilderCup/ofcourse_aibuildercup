import { COURSES } from '@/features/engine'
import type { Course } from '@/features/engine/types'
import type { MockStudent } from '..'

// An update's audience, pure: the students who ranked a route at an institution (or every
// student, for an update that applies to all institutions), optionally only those from one home
// country, each with the line that tells her why she sees it.

/**
 * Students who ranked a route at `institution`, or every student when it is ALL_INSTITUTIONS;
 * from `homeCountry` only, when one is chosen.
 */
export type AudienceRule = { institution: string; homeCountry: string | null }

export type Match = { student: MockStudent; why: string }

/** The catalogue's institutions, once each, sorted. */
export const INSTITUTIONS: readonly string[] = [...new Set(COURSES.map((c) => c.university))].sort(
  (a, b) => a.localeCompare(b),
)

/** An update not tied to one institution (a visa rule, a national grant): it reaches everyone. */
export const ALL_INSTITUTIONS = 'All institutions'

const DEGREE = /^(Master|Bachelor|Diploma|Graduate Certificate|Graduate Diploma) of /

/** "ECU Cyber Security": the institution, then the course without its degree. */
export const routeName = (course: Course) =>
  `${course.university} ${course.name.replace(DEGREE, '')}`

/**
 * The students the rule reaches, in the order given, each with her why line, named from the
 * highest route she ranked at the institution ("Because you ranked ECU Cyber Security"); for all
 * institutions, "Because it applies to every student" (from her country, when one is chosen).
 */
export function matchAudience(
  rule: AudienceRule,
  students: readonly MockStudent[],
  courses: readonly Course[] = COURSES,
): Match[] {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const everyone = `Because it applies to every student${rule.homeCountry === null ? '' : ` from ${rule.homeCountry}`}`
  return students.flatMap((student) => {
    if (rule.homeCountry !== null && student.homeCountry !== rule.homeCountry) return []
    if (rule.institution === ALL_INSTITUTIONS) return [{ student, why: everyone }]
    const course = student.ranked
      .map((id) => byId.get(id))
      .find((c) => c?.university === rule.institution)
    return course ? [{ student, why: `Because you ranked ${routeName(course)}` }] : []
  })
}
