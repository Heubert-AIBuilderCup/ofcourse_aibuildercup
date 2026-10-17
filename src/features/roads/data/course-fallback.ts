// Where the roads' three course lookups (courseById, occupationsFor, subjectsOf) look when their own
// data has no such course. Empty by default: the roads modules run in the browser too, and the
// finder's catalogue is too large to ship there, so only the server registers it
// (src/features/finder/server/road-courses.ts). Client-safe: no data of its own.

import type { Course } from '@/features/engine/types'
import type { CourseSubjects, Occupation } from './types'

export type CourseFallback = {
  courseById: (id: string) => Course | undefined
  occupationsFor: (courseId: string) => Occupation[]
  subjectsOf: (courseId: string) => CourseSubjects | undefined
}

export const NO_COURSE_FALLBACK: CourseFallback = {
  courseById: () => undefined,
  occupationsFor: () => [],
  subjectsOf: () => undefined,
}

let fallback = NO_COURSE_FALLBACK

/** Sets the lookups the roads fall back to; the server calls it once, at load. */
export function registerCourseFallback(next: CourseFallback): void {
  fallback = next
}

/** The lookups registered, else none. */
export const courseFallback = (): CourseFallback => fallback
