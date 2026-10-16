'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  LOADER_MIN_MS,
  LOADER_SLOW_MS,
  LOADER_STEPS,
  type LoaderKind,
  loaderSteps,
} from '../model/loader'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Runs the loader's three steps' work in order, from the moment it mounts. A step ticks when its
 * work has finished and it has stayed at least LOADER_MIN_MS; as the last ticks, `onDone` is
 * called, and the loader stays in full until the page it covers is replaced (it never fades
 * first: faded, it showed that page before the next one had arrived). A step whose work rejects
 * is `bad` and the run stops; `retry` runs again from that step. `slow` once a run has gone
 * LOADER_SLOW_MS without finishing; `announce` is the step working now, for the live region.
 *
 * Started once (a ref, so React's development double mount does not run the work twice); nothing
 * is set and `onDone` is not called after it unmounts.
 */
export function useLoaderRun({
  kind,
  work,
  onDone,
}: {
  kind: LoaderKind
  work: ReadonlyArray<() => Promise<void>>
  onDone: () => void
}) {
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState(false)
  const [slow, setSlow] = useState(false)
  const alive = useRef(false)
  const started = useRef(false)
  const slowTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  async function run(from: number) {
    clearTimeout(slowTimer.current)
    setSlow(false)
    slowTimer.current = setTimeout(() => {
      if (alive.current) setSlow(true)
    }, LOADER_SLOW_MS)
    for (let i = from; i < work.length; i++) {
      try {
        await Promise.all([work[i](), wait(LOADER_MIN_MS)])
      } catch {
        clearTimeout(slowTimer.current)
        if (alive.current) setFailed(true)
        return
      }
      if (!alive.current) return
      setDone(i + 1)
    }
    clearTimeout(slowTimer.current)
    onDone()
  }

  const start = useEffectEvent(() => {
    if (started.current) return
    started.current = true
    void run(0)
  })
  useEffect(() => {
    alive.current = true
    start()
    return () => {
      alive.current = false
    }
  }, [])

  function retry() {
    setFailed(false)
    void run(done)
  }

  const finished = done >= LOADER_STEPS[kind].length
  return {
    steps: loaderSteps(kind, { done, failed }),
    failed,
    slow: slow && !failed && !finished,
    announce: failed || finished ? '' : LOADER_STEPS[kind][done],
    retry,
  }
}
