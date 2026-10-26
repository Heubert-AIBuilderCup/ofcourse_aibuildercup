import { describe, expect, it } from 'bun:test'
import { chipFailed, failureReason, failureSentence } from './failure'

// The texts as they reach content_step.error: the app's own refusals (ai/client.ts AI_ERRORS,
// server/steps.ts), and what @google/genai and AbortSignal.timeout throw.
const DAILY_LIMIT = 'The daily limit for this step is reached.'
const FAILED = 'This step failed. Your work so far is kept.'
const DB_ERROR = 'Could not save. Please try again.'
const RATE_LIMITED =
  'got status: 429 Too Many Requests. {"error":{"code":429,"message":"Resource exhausted. Please try again later.","status":"RESOURCE_EXHAUSTED"}}'
const EXHAUSTED = '{"error":{"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED"}}'
const TIMED_OUT = 'TimeoutError: The operation was aborted due to timeout'
const ABORTED = 'AbortError: This operation was aborted'
// ai/draft.ts's refusal when a draft fails with no supported fact to write from (bug, 18 Oct).
const NO_FACTS = 'No facts to write from: add sources, or start from a longer idea.'

describe('failureReason', () => {
  it("reads the app's daily-limit refusal as the daily limit", () => {
    expect(failureReason(DAILY_LIMIT)).toBe('daily_limit')
  })

  it('reads a 429 or RESOURCE_EXHAUSTED as the model being busy', () => {
    expect(failureReason(RATE_LIMITED)).toBe('busy')
    expect(failureReason(EXHAUSTED)).toBe('busy')
  })

  it('reads a timeout or an abort as taking too long', () => {
    expect(failureReason(TIMED_OUT)).toBe('timeout')
    expect(failureReason(ABORTED)).toBe('timeout')
  })

  it('reads a draft with no facts to write from as no facts', () => {
    expect(failureReason(NO_FACTS)).toBe('no_facts')
  })

  it('reads any other failure, or none recorded, as other', () => {
    expect(failureReason(FAILED)).toBe('other')
    expect(failureReason(DB_ERROR)).toBe('other')
    expect(failureReason(null)).toBe('other')
  })
})

describe('failureSentence', () => {
  it('says each reason in one sentence, and nothing more for any other failure', () => {
    expect(failureSentence('busy')).toBe("Google's model is busy. Try again in a minute.")
    expect(failureSentence('timeout')).toBe('It took too long. Try again.')
    expect(failureSentence('daily_limit')).toBe("Today's limit is reached. It resets tomorrow.")
    expect(failureSentence('no_facts')).toBe(NO_FACTS)
    expect(failureSentence('other')).toBeNull()
    expect(failureSentence(undefined)).toBeNull()
  })
})

describe('chipFailed (a version or slide chip that did not apply)', () => {
  // ai/client.ts AI_ERRORS.busy and .timeout, as a rate-limited or slow fake returns them.
  const BUSY = 'The model is busy right now (429). Try again in a minute.'
  const TIMEOUT = 'The model took too long (timeout). Try again.'

  it('names the chip for every kind of failure, then says why', () => {
    expect(chipFailed('Shorter', BUSY)).toBe(
      "Couldn't apply “Shorter”. Google's model is busy. Try again in a minute.",
    )
    expect(chipFailed('Shorter', TIMEOUT)).toBe(
      "Couldn't apply “Shorter”. It took too long. Try again.",
    )
    expect(chipFailed('Shorter', DAILY_LIMIT)).toBe(
      "Couldn't apply “Shorter”. Today's limit is reached. It resets tomorrow.",
    )
  })

  it('keeps a refusal’s own words, and says Try again when it has none (a failed check)', () => {
    expect(chipFailed('Warmer', DB_ERROR)).toBe(
      "Couldn't apply “Warmer”. Could not save. Please try again.",
    )
    expect(chipFailed('Warmer', null)).toBe("Couldn't apply “Warmer”. Try again.")
  })
})
