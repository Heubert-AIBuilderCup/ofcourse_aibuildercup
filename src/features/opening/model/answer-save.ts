import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import type { AnswerValue, QuestionKey } from '@/shared/types/student'

// Per-question saving for step 01: every tap is saved, a failure keeps the answer on screen and
// can be retried. One timer and one sequence number per key, so a late reply to an older tap
// never overwrites what a newer tap has since set.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'
export const SAVE_DEBOUNCE_MS = 300
/** A `null` clears the answer, as if it was never given. */
export type SaveAnswers = (
  patch: Partial<Record<QuestionKey, AnswerValue | null>>,
) => Promise<ActionResult>

export function useAnswerSave(saveAnswersAction: SaveAnswers) {
  const [statuses, setStatuses] = useState<Partial<Record<QuestionKey, SaveStatus>>>({})
  const timers = useRef(new Map<QuestionKey, ReturnType<typeof setTimeout>>())
  const sequence = useRef(new Map<QuestionKey, number>())
  const latest = useRef(new Map<QuestionKey, AnswerValue | null>())
  const action = useRef(saveAnswersAction)
  action.current = saveAnswersAction

  const setStatus = useCallback((key: QuestionKey, status: SaveStatus) => {
    setStatuses((prev) => ({ ...prev, [key]: status }))
  }, [])

  const run = useCallback(
    async (key: QuestionKey, mine: number) => {
      const value = latest.current.get(key)
      if (value === undefined) return
      let status: SaveStatus
      try {
        status = (await action.current({ [key]: value })).ok ? 'saved' : 'failed'
      } catch {
        status = 'failed'
      }
      if (sequence.current.get(key) === mine) setStatus(key, status)
    },
    [setStatus],
  )

  const start = useCallback(
    (key: QuestionKey, delay: number) => {
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
    (key: QuestionKey, raw: AnswerValue | null) => {
      latest.current.set(key, raw)
      start(key, SAVE_DEBOUNCE_MS)
    },
    [start],
  )

  const retry = useCallback(
    (key: QuestionKey) => {
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

  const statusOf = useCallback(
    (key: QuestionKey): SaveStatus => statuses[key] ?? 'idle',
    [statuses],
  )

  return { statusOf, save, retry, flush }
}
