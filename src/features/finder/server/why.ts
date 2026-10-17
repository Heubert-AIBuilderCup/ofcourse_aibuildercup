import 'server-only'
// Why a course the finder found fits what she said (criterion 6): the model links her words to the
// course description, quoting it, and code checks every word (finderWhyProblems); anything else
// gives the template. Her words are never cached. Past the deadline the template stays and a late
// answer is not read.

import { ai } from '@/features/content/ai/client'
import { STUDENT_FINDER_WHY } from '@/features/content/ai/prompts'
import { FINDER_COURSES, FINDER_EXTRAS } from '../data/catalogue'
import type { FinderWhy } from '../model/types'
import { finderWhyProblems, finderWhyTemplate } from '../model/why'

/** One model attempt; the client may try again, on a higher tier. */
export const FINDER_WHY_TIMEOUT_MS = 6000
/** The whole why, every attempt included: past it the template stays. */
export const FINDER_WHY_DEADLINE_MS = 8000

/** Each catalogue course's name and description by id, built once. */
const NAMES = new Map(FINDER_COURSES.map((c) => [c.id, c.name]))
const COURSES = new Map(
  FINDER_EXTRAS.flatMap((e) => {
    const name = NAMES.get(e.courseId)
    return name ? [[e.courseId, { name, description: e.description }] as const] : []
  }),
)

/** The why for a catalogue course; null for a course the catalogue does not have. */
export async function writeFinderWhy(
  said: string,
  courseId: string,
  deadlineMs = FINDER_WHY_DEADLINE_MS,
): Promise<FinderWhy | null> {
  const course = COURSES.get(courseId)
  if (!course) return null
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)

  let timer: ReturnType<typeof setTimeout> | undefined
  // The deadline also stops the client: no rung starts once the template is shown.
  const deadline = new AbortController()
  const res = await Promise.race([
    ai.generateJson(STUDENT_FINDER_WHY, {
      data: { said, course },
      cache: false,
      verify: (v) => finderWhyProblems(v, course.description),
      timeoutMs: FINDER_WHY_TIMEOUT_MS,
      signal: deadline.signal,
    }),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        deadline.abort()
        resolve(null)
      }, deadlineMs)
    }),
  ])
  clearTimeout(timer)
  if (res?.ok) {
    const { why, quote } = res.value
    return { courseId, text: why.trim(), quote, source: 'model', ms: elapsed() }
  }
  return {
    courseId,
    text: finderWhyTemplate(said, course.description),
    quote: null,
    source: 'template',
    ms: elapsed(),
  }
}
