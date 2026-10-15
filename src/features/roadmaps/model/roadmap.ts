// What the list knows about a roadmap: its name, its order, whether it is new and when it was last
// opened (its URL is in shared/lib/student-paths). Pure and client-safe: the list page (server)
// and its rows (client) share it.
// Roadmaps are never ranked: the only orders are last opened, date made and name.

import type { Roadmap, StoredAnswers } from '@/shared/types/student'

/** One roadmap on the list (a row, or a table row), everything resolved by the page. */
export type RoadmapSummary = {
  id: string
  name: string
  /** "Cyber Security · ECU · Perth": course, university, city. */
  line: string
  /** "Permanent residency · 2032" */
  pointB: string
  /** From its board: the steps lit on its road, of the road's rows. */
  progress: { walked: number; steps: number }
  /** From its board: "Student visa · Late 2026", or "Pick a course in Perth" when nothing is next. */
  next: string
  /** "From onboarding" or "Copy of …" */
  from: string
  /** One chip per answer that differs from its source. */
  diffs: string[]
  openedLabel: string
  isNew: boolean
  archived: boolean
  /** The two times the sorts read (orderRoadmaps). */
  createdAt: Date
  lastOpenedAt: Date | null
}

/** The names a roadmap without her own name is called by: the course where she is, its city. */
export type RoadNames = { here: string; city: string }

/** Her own name for it, else "Cyber Security in Perth" from where she is on its road. */
export const roadmapName = (r: Pick<Roadmap, 'name'>, road: RoadNames): string =>
  r.name ?? `${road.here} in ${road.city}`

export type RoadmapOrder = 'opened' | 'made' | 'name'

/** The sorts she can pick, the first the default, each with its label. */
export const SORTS: readonly (readonly [RoadmapOrder, string])[] = [
  ['opened', 'Last opened'],
  ['made', 'Date made'],
  ['name', 'Name'],
]

/** The two times the last-opened order reads. */
type Openable = { createdAt: Date; lastOpenedAt: Date | null }
/** What ordering needs: the name already resolved (`roadmapName`) and the two times. */
type Orderable = Openable & { name: string }

const newestMade = (a: Openable, b: Openable) => b.createdAt.getTime() - a.createdAt.getTime()
/** When she last opened it, or, never opened, when it was made (as listRoadmaps orders). */
const lastTouched = (r: Openable) => (r.lastOpenedAt ?? r.createdAt).getTime()
// Last opened first, a never opened one by when it was made, so a new one comes first.
const lastOpenedFirst = (a: Openable, b: Openable) =>
  lastTouched(b) - lastTouched(a) || newestMade(a, b)

const ORDERS: Record<RoadmapOrder, (a: Orderable, b: Orderable) => number> = {
  opened: lastOpenedFirst,
  made: newestMade,
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
}

/** A new list in that order; the one given is left as it was. */
export const orderRoadmaps = <T extends Orderable>(list: readonly T[], by: RoadmapOrder): T[] =>
  [...list].sort(ORDERS[by])

/** Out of the archive: by the list's flag (RoadmapSummary) or the stored time (Roadmap). */
type Outable = { archived: boolean } | { archivedAt: Date | null }
const isOut = (r: Outable) => ('archived' in r ? !r.archived : r.archivedAt === null)

/**
 * The one she opened last out of the archive, by the last-opened order (one just made counts);
 * null when every one is archived. `/road` opens it; the list marks it.
 */
export const lastOpenedOut = <T extends Openable & Outable>(roadmaps: readonly T[]): T | null =>
  roadmaps.reduce<T | null>(
    (last, r) => (isOut(r) && (last === null || lastOpenedFirst(r, last) < 0) ? r : last),
    null,
  )

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
