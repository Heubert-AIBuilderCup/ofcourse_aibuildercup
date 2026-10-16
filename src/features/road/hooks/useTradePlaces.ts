'use client'

import { type RefObject, useLayoutEffect, useRef } from 'react'
import type { Scene } from '../model/scene'
import { movedTiles, SWAP_MS } from '../model/swap'
import { prefersReducedMotion, rootScale } from './motion'

/** How far each path bows sideways at its middle, in rem. */
const BOW_REM = 2

type Place = { x: number; y: number }

/**
 * The swap on the phone's road: the elements marked with a tile (`data-swap-id`) whose tile changed
 * place on the map trade places in the list along short arcs, bowed to either side, in 0.6 s (the
 * map's swap, spec §7). Places are kept against the scrolling list, so a scroll between two swaps
 * does not throw them. Under reduced motion they jump.
 */
export function useTradePlaces(ref: RefObject<HTMLElement | null>, scene: Scene) {
  const last = useRef<{ scene: Scene; places: Map<string, Place> } | null>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const base = root.getBoundingClientRect()
    const marked = [...root.querySelectorAll<HTMLElement>('[data-swap-id]')]
    const places = new Map<string, Place>()
    for (const el of marked) {
      const r = el.getBoundingClientRect()
      places.set(el.dataset.swapId ?? '', {
        x: r.left - base.left + root.scrollLeft,
        y: r.top - base.top + root.scrollTop,
      })
    }
    const before = last.current
    last.current = { scene, places }
    if (!before || before.scene === scene || prefersReducedMotion()) return

    const bow = BOW_REM * 16 * rootScale()
    for (const id of movedTiles(before.scene, scene)) {
      const was = before.places.get(id)
      const now = places.get(id)
      const el = marked.find((m) => m.dataset.swapId === id)
      if (!was || !now || typeof el?.animate !== 'function') continue
      const dx = was.x - now.x
      const dy = was.y - now.y
      const side = id === scene.here ? 1 : -1
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx / 2 + side * bow}px, ${dy / 2}px)` },
          { transform: 'none' },
        ],
        { duration: SWAP_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
    }
  }, [ref, scene])
}
