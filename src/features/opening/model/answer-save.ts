import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import type { AnswerValue, QuestionKey, Relative } from '@/shared/types/student'
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

  const run = useCallback(
    async (key: K, mine: number) => {
      if (!latest.current.has(key)) return
      const value = latest.current.get(key) as V
      let status: SaveStatus
      try {
        status = (await action.current(key, value)).ok ? 'saved' : 'failed'
      } catch {
        status = 'failed'
      }
      if (sequence.current.get(key) === mine) setStatus(key, status)
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

  return { statusOf, save, retry, flush }
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
