import type { ActionResult } from '@/shared/types/action-result'
import { ACCESS_ERRORS, canUseStudentApp } from './access'
import { getSession } from './session'

// The guard every student action runs in: the student is read from the session (never from the
// request), anyone who is not a student is refused, and a failure is logged and said, never thrown.

const SIGN_IN = 'Please sign in again.'
/** The same words the student screens show for a failed save (features/opening/model/messages). */
const SAVE_FAILED = 'Could not save. Please try again.'

/** A refusal, said to the student. */
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/**
 * Runs `run` for a signed-in student; a failed lookup or write is logged under `[log]` (the
 * feature and the action, `opening.saveAnswers`) and said, never thrown.
 */
export async function asStudent<T extends object>(
  log: string,
  run: (userId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const session = await getSession()
    if (!session) return fail(SIGN_IN)
    if (!canUseStudentApp(session.user.role)) return fail(ACCESS_ERRORS.notAuthorised)
    return await run(session.user.id)
  } catch (err) {
    // The cause, not the wrapper: a failed query's message carries her answers as parameters.
    console.error(`[${log}]`, err instanceof Error && err.cause ? err.cause : err)
    return fail(SAVE_FAILED)
  }
}
