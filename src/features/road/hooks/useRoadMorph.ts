'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import type { Scene } from '../model/scene'
import { type Morph, type MorphFrame, morphFrame } from '../model/start'

const STILL = { fade: {}, was: {} }

/**
 * The scene as the road ahead turns into a new roadmap's (`morph`), frame by frame for its `ms`,
 * then held turned while the morph stays; without one, the scene as it is. Like the swap, on the
 * browser's frames with a timer to end it.
 */
export function useRoadMorph(scene: Scene, morph: Morph | null): MorphFrame {
  const [at, setAt] = useState<{ of: Morph; ms: number } | null>(null)

  useLayoutEffect(() => {
    if (!morph) return
    const start = performance.now()
    let frame = 0
    let ended = false
    // Whichever lands first ends the turn: the frame past its end, or the timer.
    const end = () => {
      if (ended) return
      ended = true
      cancelAnimationFrame(frame)
      setAt({ of: morph, ms: morph.ms })
    }
    const tick = (now: number) => {
      if (ended) return
      const ms = now - start
      if (ms >= morph.ms) return end()
      setAt({ of: morph, ms })
      frame = requestAnimationFrame(tick)
    }
    setAt({ of: morph, ms: 0 })
    frame = requestAnimationFrame(tick)
    const done = setTimeout(end, morph.ms)
    return () => {
      ended = true
      cancelAnimationFrame(frame)
      clearTimeout(done)
    }
  }, [morph])

  return useMemo(() => {
    if (!morph) return { scene, ...STILL }
    return morphFrame(scene, morph, at?.of === morph ? at.ms : 0)
  }, [scene, morph, at])
}
