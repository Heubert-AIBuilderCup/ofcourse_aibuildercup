'use server'

import { z } from 'zod'
import { getRoadmap } from '@/features/roadmaps/server/roadmaps'
import { whyAllowed } from '@/features/roads/server/why-limit'
import { asStudent, fail } from '@/shared/lib/auth/as-student'
import type { ActionResult } from '@/shared/types/action-result'
import { FINDER_EXTRAS } from './data/catalogue'
import type { FinderResult, FinderWhy } from './model/types'
import { finderWhyTemplate } from './model/why'
import { finderAllowed } from './server/limit'
import { searchWithRetry, TIMED_OUT } from './server/retry'
import { searchCourses } from './server/search'
import { writeFinderWhy } from './server/why'
import { finderOn } from './switch'

// The finder's calls from her board. Each reads the student from the session (never from the
// request) and refuses anyone who is not a student (asStudent); the roadmap id is a claim the
// repository checks against her own rows. With the switch off both are not found. Her words are
// trimmed and capped before they reach the model, and never logged (criterion 11).

const NOT_FOUND = 'Not found'
const SAY_MORE = 'Tell us a bit more'
const SEARCH_FAILED = "Couldn't search right now"

/** A roadmap id from the request, bounded before it reaches the repository. */
const idSchema = z.string().min(1).max(64)
/** A catalogue course id: the longest real one is 74 characters, so the bound is 80. */
const courseIdSchema = z.string().min(1).max(80)
/** Her words, trimmed: at least one character and at most 300. */
const textSchema = z.string().trim().min(1).max(300)

/** Each catalogue course's description by id, for the template past the why limit. */
const DESCRIPTIONS = new Map(FINDER_EXTRAS.map((e) => [e.courseId, e.description]))

/** "You have searched a lot this hour…", naming the minutes until she may search again. */
function limitReached(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return `You have searched a lot this hour. You can search again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/**
 * The courses nearest her words, filtered by her roadmap's answers; refused for a roadmap not
 * hers, and past FINDER_PER_HOUR searches in the hour. A search gets SEARCH_TIMEOUT_MS, and one
 * that runs out gets one quiet retry of SEARCH_RETRY_MS (a cold start); a failed or late search
 * is said, not thrown. Each search logs one line: its outcome, time and cache, never her words.
 */
export async function findCoursesAction(
  roadmapId: string,
  text: string,
): Promise<ActionResult<{ result: FinderResult }>> {
  return asStudent('finder.search', async (userId) => {
    if (!finderOn(process.env)) return fail(NOT_FOUND)
    const id = idSchema.safeParse(roadmapId)
    if (!id.success) return fail(NOT_FOUND)
    const said = textSchema.safeParse(text)
    if (!said.success) return fail(SAY_MORE)
    const started = performance.now()
    const line = (outcome: string, cached: boolean) =>
      `[finder.search] ${outcome} ms=${Math.round(performance.now() - started)} cached=${cached}`
    try {
      const roadmap = await getRoadmap(userId, id.data)
      if (!roadmap) return fail(NOT_FOUND)
      const allowed = finderAllowed(userId)
      if (!allowed.ok) {
        console.info(line('limit', false))
        return fail(limitReached(allowed.retryAfterSeconds))
      }
      const search = (signal: AbortSignal) =>
        searchCourses(userId, said.data, roadmap.answers, signal)
      const result = await searchWithRetry(search)
      if (result === TIMED_OUT) {
        console.error(`${line('failed', false)} error=timeout`)
        return fail(SEARCH_FAILED)
      }
      console.info(line(result.kind, result.cached))
      return { ok: true, result }
    } catch (err) {
      // The error's name only: a failed query's message and cause can carry her words.
      console.error(`${line('failed', false)} error=${err instanceof Error ? err.name : 'error'}`)
      return fail(SEARCH_FAILED)
    }
  })
}

/**
 * Why a course the finder found fits her words: the model's, else the template; only the
 * template once she has asked WHY_PER_HOUR whys in the hour. Refused for a roadmap not hers and
 * a course the catalogue does not have.
 */
export async function finderWhyAction(
  roadmapId: string,
  courseId: string,
  text: string,
): Promise<ActionResult<{ why: FinderWhy }>> {
  return asStudent('finder.why', async (userId) => {
    if (!finderOn(process.env)) return fail(NOT_FOUND)
    const id = idSchema.safeParse(roadmapId)
    const course = courseIdSchema.safeParse(courseId)
    if (!id.success || !course.success) return fail(NOT_FOUND)
    const said = textSchema.safeParse(text)
    if (!said.success) return fail(SAY_MORE)
    const description = DESCRIPTIONS.get(course.data)
    if (description === undefined || !(await getRoadmap(userId, id.data))) return fail(NOT_FOUND)
    if (!whyAllowed(userId)) {
      const template = finderWhyTemplate(said.data, description)
      return {
        ok: true,
        why: { courseId: course.data, text: template, quote: null, source: 'template', ms: 0 },
      }
    }
    const why = await writeFinderWhy(said.data, course.data)
    return why ? { ok: true, why } : fail(NOT_FOUND)
  })
}
