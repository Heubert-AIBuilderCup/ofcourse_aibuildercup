// What the list knows about a roadmap: its name, its order, whether it is new and when it was last
// opened (its URL is in shared/lib/student-paths). Pure and client-safe: the list page (server)
// and its cards (client) share it.
// Roadmaps are never ranked: the only orders are last opened, date made and name.

import type { Roadmap, StoredAnswers } from '@/shared/types/student'

/** One card on the list, everything resolved by the page. */
export type RoadmapSummary = {
  id: string
  name: string
  /** "Master's · ECU · Perth" */
  line: string
  /** "Permanent residency · 2032" */
  pointB: string
  /** "Australia · Perth": where its road goes, named on its drawing. */
  place: string
  /** "From onboarding" or "Copy of …" */
  from: string
  /** One chip per answer that differs from its source. */
  diffs: string[]
  openedLabel: string
  isNew: boolean
  /** The small drawing: tiles lit up to `here`; `alt` when the course was swapped. */
  thumb: { here: number; alt: boolean }
}

/** The names a roadmap without her own name is called by: the course where she is, its city. */
export type RoadNames = { here: string; city: string }

/** Her own name for it, else "Cyber Security in Perth" from where she is on its road. */
export const roadmapName = (r: Pick<Roadmap, 'name'>, road: RoadNames): string =>
  r.name ?? `${road.here} in ${road.city}`

export type RoadmapOrder = 'opened' | 'made' | 'name'

/** What ordering needs: the name already resolved (`roadmapName`) and the two times. */
type Orderable = { name: string; createdAt: Date; lastOpenedAt: Date | null }

const newestMade = (a: Orderable, b: Orderable) => b.createdAt.getTime() - a.createdAt.getTime()
/** When she last opened it, or, never opened, when it was made (as listRoadmaps orders). */
const lastTouched = (r: Orderable) => (r.lastOpenedAt ?? r.createdAt).getTime()

const ORDERS: Record<RoadmapOrder, (a: Orderable, b: Orderable) => number> = {
  // Last opened first, a never opened one by when it was made, so a new one comes first.
  opened: (a, b) => lastTouched(b) - lastTouched(a) || newestMade(a, b),
  made: newestMade,
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
}

/** A new list in that order; the one given is left as it was. */
export const orderRoadmaps = <T extends Orderable>(list: readonly T[], by: RoadmapOrder): T[] =>
  [...list].sort(ORDERS[by])

/** New until she first opens it. */
export const isNew = (r: Pick<Roadmap, 'lastOpenedAt'>): boolean => r.lastOpenedAt === null

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole calendar days from `then` to `now`, in this runtime's time zone. */
function daysBetween(then: Date, now: Date): number {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((midnight(now) - midnight(then)) / DAY_MS)
}

/** "Opened today", "Opened yesterday", "Opened 3 days ago"; never opened, "Made just now" and on. */
export function openedLabel(lastOpenedAt: Date | null, createdAt: Date, now: Date): string {
  const verb = lastOpenedAt ? 'Opened' : 'Made'
  const days = daysBetween(lastOpenedAt ?? createdAt, now)
  if (days <= 0) return lastOpenedAt ? 'Opened today' : 'Made just now'
  if (days === 1) return `${verb} yesterday`
  return `${verb} ${days} days ago`
}

/**
 * One chip's text per answer the copy changed from its source. Part 4 fills it (the answers'
 * labels); a roadmap with no source has none.
 */
export const answerDiffs = (_source: StoredAnswers | null, _copy: StoredAnswers): string[] => []
