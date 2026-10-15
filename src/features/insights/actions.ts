'use server'

import { z } from 'zod/mini'
import { DIMENSIONS } from '@/features/engine'
import { ACCESS_ERRORS, isStudent } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import { FUTURE_IDS } from '@/shared/types/student'
import { recordFuturesShown } from './server/views'

// Recording a redraw of the futures (RC17): the futures screen calls this after it redraws in the
// browser. The student comes from the session, never the request; the result is checked against
// the engine's shape and only what a showing keeps passes (the other fields are dropped).

const SIGN_IN = 'Please sign in again.'
const INVALID = 'That is not a futures result.'
const FAILED = 'Could not record the futures shown.'

const courseId = z.string().check(z.minLength(1), z.maxLength(80))
const dimensions = z.array(z.enum(DIMENSIONS)).check(z.maxLength(DIMENSIONS.length))

const resultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('futures'),
    futures: z
      .array(
        z.object({
          id: z.enum(FUTURE_IDS),
          courseId,
          strongOn: dimensions,
          costsOn: dimensions,
        }),
      )
      .check(z.maxLength(FUTURE_IDS.length)),
  }),
  z.object({
    kind: z.literal('sealed'),
    nearest: z
      .array(z.object({ courseId, overByK: z.number().check(z.gte(0), z.lte(10_000)) }))
      .check(z.maxLength(3)), // the engine offers its three nearest routes (futures.ts NEAREST)
  }),
])

/** Records the futures a student was shown after a redraw; refuses anyone but a student. */
export async function recordRedrawAction(result: unknown): Promise<ActionResult> {
  try {
    const session = await getSession()
    if (!session) return { ok: false, error: SIGN_IN }
    if (!isStudent(session.user)) return { ok: false, error: ACCESS_ERRORS.notAuthorised }
    const parsed = resultSchema.safeParse(result)
    if (!parsed.success) return { ok: false, error: INVALID }
    await recordFuturesShown(session.user.id, parsed.data, { redraw: true })
    return { ok: true }
  } catch (err) {
    console.error('[insights.recordRedrawAction]', err)
    return { ok: false, error: FAILED }
  }
}
