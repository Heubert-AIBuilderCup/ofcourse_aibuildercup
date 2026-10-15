'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { Tile } from '../model/road-data'
import { historyMode, parseRoadState, type RoadState, serializeRoadState } from '../model/road-url'

/** The board's own keys in the query; any other (a draft's `from`) is the page's, and stays. */
const BOARD_KEYS = ['tile', 'zoom', 'view', 'open']

/**
 * The board's state in the query (`tile`, `zoom`, `view`, `open`), read against the tiles on the
 * board now, a bad value dropped. Writing goes through the browser's history, which Next keeps in
 * step with useSearchParams: opening the stack's list pushes an entry (Back closes it), anything
 * else replaces it; the page's own params are kept ahead of the board's. The state follows the
 * query when it changes under it (Back, Forward).
 */
export function useRoadUrl(tiles: readonly Pick<Tile, 'id' | 'kind'>[]) {
  const params = useSearchParams()
  const pathname = usePathname()
  const query = params.toString()
  const [state, setLocal] = useState(() => parseRoadState(params, tiles))
  const [read, setRead] = useState(query)
  if (read !== query) {
    setRead(query)
    setLocal(parseRoadState(params, tiles))
  }

  function setState(next: RoadState) {
    const page = new URLSearchParams(query)
    for (const key of BOARD_KEYS) page.delete(key)
    const q = [page.toString(), serializeRoadState(next)].filter(Boolean).join('&')
    const url = q ? `${pathname}?${q}` : pathname
    if (historyMode(state, next) === 'push') window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
    setLocal(next)
  }

  return { state, setState }
}
