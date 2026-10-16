'use client'

import { useState, useSyncExternalStore } from 'react'

export type ListView = 'cards' | 'table'

const KEY = 'ofcourse:roadmaps-view'

/** Her last choice in this browser; null when none, an unknown value, or storage refused. */
function stored(): ListView | null {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === 'cards' || value === 'table' ? value : null
  } catch {
    return null
  }
}

// Storage changes only through `set` here, which also keeps the choice in state.
const subscribe = () => () => {}

/**
 * The list as cards or a table, remembered per browser (never on the server). Cards until she
 * picks; the server renders cards and the browser's choice follows at hydration. With storage
 * refused (private browsing, a full quota) the switch still works, for this visit.
 */
export function useListView() {
  const remembered = useSyncExternalStore(subscribe, stored, () => null)
  const [picked, setPicked] = useState<ListView | null>(null)

  function set(view: ListView) {
    setPicked(view)
    try {
      window.localStorage.setItem(KEY, view)
    } catch {
      // Refused: kept for this visit only.
    }
  }

  return { view: picked ?? remembered ?? 'cards', set }
}
