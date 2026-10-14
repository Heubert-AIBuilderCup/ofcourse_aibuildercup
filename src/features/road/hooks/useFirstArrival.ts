'use client'

import { useEffect, useEffectEvent } from 'react'

/** Set once she has seen the board, so the first arrival shows once per browser. */
export const ARRIVED_KEY = 'ofcourse:road-arrived'

/**
 * Calls `arrive` once, after mount, the first time this browser opens the board (nothing is saved
 * to her profile this round). Storage that refuses counts as having been here: no arrival.
 */
export function useFirstArrival(arrive: () => void) {
  const onArrive = useEffectEvent(arrive)
  useEffect(() => {
    try {
      if (localStorage.getItem(ARRIVED_KEY) !== null) return
      localStorage.setItem(ARRIVED_KEY, '1')
    } catch {
      return
    }
    onArrive()
  }, [])
}
