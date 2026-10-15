/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import { getRoad } from '../model/road-data'
import { buildScene, NEW_SESSION } from '../model/scene'
import { SWAP_MS } from '../model/swap'
import { useSwapMotion } from './useSwapMotion'

// The hook runs on the browser's frames and one timer. Here both are driven by hand, so the
// order they land in is the test's to choose.
const road = getRoad()
const atCourse = buildScene(road, NEW_SESSION)
const swapped = buildScene(road, { ...NEW_SESSION, swapped: true })

const realRaf = globalThis.requestAnimationFrame
const realCancel = globalThis.cancelAnimationFrame
const realNow = performance.now
const realTimeout = globalThis.setTimeout
let frames: FrameRequestCallback[] = []
let timers: (() => void)[] = []
let now = 0

beforeEach(() => {
  frames = []
  timers = []
  now = 1000
  globalThis.requestAnimationFrame = (cb) => {
    frames.push(cb)
    return frames.length
  }
  globalThis.cancelAnimationFrame = () => {}
  performance.now = () => now
  // Only the hook's own timer is captured; React's scheduling keeps the real one.
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    if (ms !== SWAP_MS) return realTimeout(fn, ms)
    timers.push(fn)
    return 0
  }) as typeof setTimeout
})

afterEach(() => {
  cleanup()
  globalThis.requestAnimationFrame = realRaf
  globalThis.cancelAnimationFrame = realCancel
  performance.now = realNow
  globalThis.setTimeout = realTimeout
})

const frame = (at: number) => {
  now = at
  const cb = frames.shift()
  if (cb) act(() => cb(at))
}

describe('the swap motion', () => {
  it('moves for the arc, then stops, even when the last frame lands after the timer', () => {
    const { result, rerender } = renderHook(({ scene }) => useSwapMotion(scene), {
      initialProps: { scene: atCourse },
    })
    expect(result.current.moving).toBe(false)

    rerender({ scene: swapped })
    expect(result.current.moving).toBe(true)
    frame(1300)
    expect(result.current.moving).toBe(true)

    // The timer ends the move at 600 ms…
    act(() => {
      for (const t of timers.splice(0)) t()
    })
    // …and a frame queued before it lands afterwards. It must not restart the move.
    frame(1000 + SWAP_MS + 20)
    expect(result.current.moving).toBe(false)
    expect(result.current.drawn).toBe(swapped)
  })
})
