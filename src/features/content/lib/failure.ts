// Why a step's last run failed, read from the error its content_step row keeps (server/steps.ts),
// and the one sentence the workbench adds after the step's failed line. Pure and client-safe.

/**
 * Why a step failed: the day's cap, the model refusing calls for a while, too slow, a draft with no
 * facts to write from, or anything else.
 */
export type FailureReason = 'daily_limit' | 'busy' | 'timeout' | 'no_facts' | 'other'

/**
 * A draft that failed with no supported fact to cite (ai/draft.ts): a source with none, such as an
 * idea too short to say one (bug, 18 Oct). Its recorded error, and the sentence after its line.
 */
export const NO_FACTS_ERROR = 'No facts to write from: add sources, or start from a longer idea.'

// ai/client.ts AI_ERRORS.dailyLimit, "The daily limit for this step is reached.", and the client's
// refusal at a cap, lib/limits.ts "Today's limit of 600 images is used up. …".
const DAILY_LIMIT = /\bdaily limit\b|\blimit of \d+ .+ is used up\b/i
// The image and text models' per-minute limit: @google/genai's ApiError, status 429.
const BUSY = /\b429\b|RESOURCE_EXHAUSTED/
// AbortSignal.timeout's TimeoutError ("aborted due to timeout") and a plain abort.
const TIMEOUT = /time(d)? ?out|\babort/i

/** The reason a failed step's recorded error names; 'other' when it names none or none is kept. */
export function failureReason(error: string | null): FailureReason {
  if (error === null) return 'other'
  if (error === NO_FACTS_ERROR) return 'no_facts'
  if (DAILY_LIMIT.test(error)) return 'daily_limit'
  if (BUSY.test(error)) return 'busy'
  if (TIMEOUT.test(error)) return 'timeout'
  return 'other'
}

const SENTENCES: Record<Exclude<FailureReason, 'other'>, string> = {
  busy: "Google's model is busy. Try again in a minute.",
  timeout: 'It took too long. Try again.',
  daily_limit: "Today's limit is reached. It resets tomorrow.",
  no_facts: NO_FACTS_ERROR,
}

/** The sentence after a failed step's line for its reason, or null when there is nothing more to say. */
export const failureSentence = (reason: FailureReason | undefined): string | null =>
  reason === undefined || reason === 'other' ? null : SENTENCES[reason]

/**
 * A version or slide chip that did not apply, named for every kind of failure: "Couldn't apply
 * “Shorter”." then why (the reason's sentence), or else the refusal's own words, or else, for a
 * failed check with nothing more to say (`null`), Try again.
 */
export function chipFailed(label: string, error: string | null): string {
  const why = failureSentence(failureReason(error)) ?? error ?? 'Try again.'
  return `Couldn't apply “${label}”. ${why}`
}
