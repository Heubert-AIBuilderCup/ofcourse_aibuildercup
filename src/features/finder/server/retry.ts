// A search's time limit and its one retry, shared by the action and the eval (scripts/finder-eval.ts)
// so the eval measures what a student gets: SEARCH_TIMEOUT_MS, then, if that runs out, one quiet
// retry of SEARCH_RETRY_MS (a cold start).

import { SEARCH_RETRY_MS, SEARCH_TIMEOUT_MS } from '../model/config'
import type { FinderResult } from '../model/types'

export const TIMED_OUT = Symbol('timed out')

/**
 * The whole search, its embedding and both queries, within `ms`: its result, or TIMED_OUT once the
 * time runs out (an answer after that is dropped). The signal then cancels the embedding call.
 */
async function within(
  ms: number,
  search: (signal: AbortSignal) => Promise<FinderResult>,
): Promise<FinderResult | typeof TIMED_OUT> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => {
      resolve(TIMED_OUT)
      controller.abort()
    }, ms)
  })
  try {
    return await Promise.race([search(controller.signal), late])
  } catch (err) {
    if (controller.signal.aborted) return TIMED_OUT
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** The search within SEARCH_TIMEOUT_MS, else once more within SEARCH_RETRY_MS, else TIMED_OUT. */
export async function searchWithRetry(
  search: (signal: AbortSignal) => Promise<FinderResult>,
): Promise<FinderResult | typeof TIMED_OUT> {
  const result = await within(SEARCH_TIMEOUT_MS, search)
  return result === TIMED_OUT ? within(SEARCH_RETRY_MS, search) : result
}
