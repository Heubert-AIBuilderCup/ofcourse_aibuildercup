'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** How often the page looks again while a step runs. */
const RUNNING_POLL_MS = 3000

/**
 * Refreshes the page every few seconds while one of the post's steps runs, so a busy button frees
 * itself when the step ends and a step that runs after the response (the source check) shows
 * its result when it lands.
 */
export function useRefreshWhileRunning(running: boolean): void {
  const router = useRouter()
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => router.refresh(), RUNNING_POLL_MS)
    return () => clearInterval(timer)
  }, [running, router])
}
