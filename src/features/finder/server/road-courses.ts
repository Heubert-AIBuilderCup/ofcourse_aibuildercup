// Finder courses as road courses, on the server only: loading this module registers the catalogue
// as the roads' fallback (course-fallback.ts), so courseById, occupationsFor and subjectsOf resolve
// an "f-…" id, and a finder course can be composed into a road. The catalogue is 1.4 MiB, so the
// roads modules, which the board runs in the browser, never import it. Server code that resolves a
// finder course imports this module for its side effect. Candidates (ALL_PICKS) never read it.

import 'server-only'
import { registerCourseFallback } from '@/features/roads/data/course-fallback'
import { OCCUPATIONS } from '@/features/roads/data/occupations'
import type { CourseSubjects, Occupation } from '@/features/roads/data/types'
import { FINDER_COURSES, FINDER_EXTRAS } from '../data/catalogue'

const SOURCE = { title: 'OfCourse sample catalogue · sample', date: 'Oct 2026' }

const COURSE_BY_ID = new Map(FINDER_COURSES.map((c) => [c.id, c]))

const OCCUPATIONS_BY_ID = new Map<string, Occupation[]>(
  FINDER_EXTRAS.map((x) => [
    x.courseId,
    OCCUPATIONS.filter((o) => x.occupationCodes.includes(o.code)),
  ]),
)

const SUBJECTS_BY_ID = new Map<string, CourseSubjects>(
  FINDER_EXTRAS.map((x) => [
    x.courseId,
    {
      courseId: x.courseId,
      majors: x.subjects.majors,
      units: x.subjects.units,
      conditions: [],
      source: SOURCE,
    },
  ]),
)

registerCourseFallback({
  courseById: (id) => COURSE_BY_ID.get(id),
  occupationsFor: (courseId) => OCCUPATIONS_BY_ID.get(courseId) ?? [],
  subjectsOf: (courseId) => SUBJECTS_BY_ID.get(courseId),
})
