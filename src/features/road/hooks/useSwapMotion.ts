'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { ease } from '../model/camera'
import type { Scene } from '../model/scene'
import { movedTiles, SWAP_MS, swapFrame } from '../model/swap'
import { prefersReducedMotion } from './motion'

/**
 * The scene to draw: when tiles change place (a swap, or its Undo), they travel the arc for 0.6 s
 * and `moving` is true meanwhile; under reduced motion the scene jumps to its end.
 */
export function useSwapMotion(scene: Scene): { drawn: Scene; moving: boolean } {
  const [move, setMove] = useState<{ from: Scene; to: Scene; k: number } | null>(null)
  const last = useRef(scene)

  useLayoutEffect(() => {
    const from = last.current
    last.current = scene
    if (from === scene || prefersReducedMotion() || movedTiles(from, scene).length === 0) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / SWAP_MS)
      setMove({ from, to: scene, k })
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    setMove({ from, to: scene, k: 0 })
    frame = requestAnimationFrame(tick)
    const done = setTimeout(() => setMove(null), SWAP_MS)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(done)
    }
  }, [scene])

  if (!move || move.to !== scene) return { drawn: scene, moving: false }
  return { drawn: swapFrame(move.from, scene, ease(move.k)), moving: true }
}
