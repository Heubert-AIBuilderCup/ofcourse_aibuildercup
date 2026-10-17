import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import type { AnswerValue, QuestionKey, Relative } from '@/shared/types/student'
import { SAVE_FAILED } from './messages'
import type { PERSON } from './onboarding'

// Per-question saving for the onboarding steps: every tap (or every change to her person) is
// saved, a failure keeps it on screen and can be retried. One timer and one sequence number per
// key, so a late reply to an older change never overwrites what a newer one has since set.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'
export const SAVE_DEBOUNCE_MS = 300
/** A `null` clears the answer, as if it was never given. */
export type SaveAnswers = (
  patch: Partial<Record<QuestionKey, AnswerValue | null>>,
) => Promise<ActionResult>
/** Her person, or `null` for no one. */
export type SaveRelative = (relative: Relative | null) => Promise<ActionResult>

/** Debounced saves, one stream per key, each sent with `send`. */
function useKeyedSave<K extends string, V>(send: (key: K, value: V) => Promise<ActionResult>) {
  const [statuses, setStatuses] = useState<Partial<Record<K, SaveStatus>>>({})
  const timers = useRef(new Map<K, ReturnType<typeof setTimeout>>())
  const sequence = useRef(new Map<K, number>())
  const latest = useRef(new Map<K, V>())
  const action = useRef(send)
  action.current = send

  const setStatus = useCallback((key: K, status: SaveStatus) => {
    setStatuses((prev) => ({ ...prev, [key]: status }))
  }, [])

  /** Sends the key's latest value; its outcome, or null when there was nothing to send. */
  const run = useCallback(
    async (key: K, mine: number): Promise<SaveStatus | null> => {
      if (!latest.current.has(key)) return null
      const value = latest.current.get(key) as V
      let status: SaveStatus
      try {
        status = (await action.current(key, value)).ok ? 'saved' : 'failed'
      } catch {
        status = 'failed'
      }
      if (sequence.current.get(key) === mine) setStatus(key, status)
      return status
    },
    [setStatus],
  )

  const start = useCallback(
    (key: K, delay: number) => {
      const mine = (sequence.current.get(key) ?? 0) + 1
      sequence.current.set(key, mine)
      clearTimeout(timers.current.get(key))
      setStatus(key, 'saving')
      if (delay === 0) {
        timers.current.delete(key)
        void run(key, mine)
      } else {
        timers.current.set(
          key,
          setTimeout(() => {
            timers.current.delete(key)
            void run(key, mine)
          }, delay),
        )
      }
    },
    [run, setStatus],
  )

  const save = useCallback(
    (key: K, value: V) => {
      latest.current.set(key, value)
      start(key, SAVE_DEBOUNCE_MS)
    },
    [start],
  )

  /**
   * Saves `value` now, with no debounce, replacing any save of the key still waiting; resolves to
   * how it went, for a screen that moves on once it lands.
   */
  const saveNow = useCallback(
    (key: K, value: V): Promise<SaveStatus | null> => {
      latest.current.set(key, value)
      const mine = (sequence.current.get(key) ?? 0) + 1
      sequence.current.set(key, mine)
      clearTimeout(timers.current.get(key))
      timers.current.delete(key)
      setStatus(key, 'saving')
      return run(key, mine)
    },
    [run, setStatus],
  )

  const retry = useCallback(
    (key: K) => {
      if (latest.current.has(key)) start(key, 0)
    },
    [start],
  )

  /**
   * Sends every save still waiting on its debounce at once. A save already in flight has no
   * timer, so it is never sent again.
   */
  const flush = useCallback(() => {
    for (const [key, timer] of timers.current) {
      clearTimeout(timer)
      timers.current.delete(key)
      void run(key, sequence.current.get(key) ?? 0)
    }
  }, [run])

  // Leaving by any way (browser Back, Sign out, a link) sends what is still waiting.
  useEffect(() => flush, [flush])

  const statusOf = useCallback((key: K): SaveStatus => statuses[key] ?? 'idle', [statuses])

  return { statusOf, save, saveNow, retry, flush }
}

export function useAnswerSave(saveAnswersAction: SaveAnswers) {
  return useKeyedSave<QuestionKey, AnswerValue | null>((key, value) =>
    saveAnswersAction({ [key]: value }),
  )
}

/** Step 03's person, saved as the answers are, under the one key PERSON. */
export function useRelativeSave(saveRelativeAction: SaveRelative) {
  return useKeyedSave<typeof PERSON, Relative | null>((_person, relative) =>
    saveRelativeAction(relative),
  )
}

/**
 * One save at a time, for a screen that moves on once it lands (step 00's character, step 05's
 * coins), beside the per-tap saves above. A refused save keeps what was sent and what the server
 * said (SAVE_FAILED when it never got there), for Try again; a save that lands calls `onSaved` and
 * stays pending, so nothing can be sent again while the next screen opens.
 */
export function useSubmit<V>(action: (value: V) => Promise<ActionResult>, onSaved: () => void) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState<{ value: V; error: string } | null>(null)

  async function submit(value: V) {
    if (pending) return
    setPending(true)
    setFailed(null)
    let error = SAVE_FAILED
    try {
      const result = await action(value)
      if (result.ok) return onSaved()
      error = result.error
    } catch {
      // It never reached the server: said as a refusal is.
    }
    setFailed({ value, error })
    setPending(false)
  }

  async function retry() {
    if (failed) await submit(failed.value)
  }

  return { pending, failed, submit, retry, clear: () => setFailed(null) }
}
