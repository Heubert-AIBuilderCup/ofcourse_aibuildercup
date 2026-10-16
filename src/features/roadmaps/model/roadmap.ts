// What the list knows about a roadmap: its name, its order, whether it is new and when it was last
// opened (its URL is in shared/lib/student-paths). Pure and client-safe: the list page (server)
// and its rows (client) share it.
// Roadmaps are never ranked: the only orders are last opened, date made and name.

// The question model's own files, not the opening's index: that index loads the end screen, which
// loads this feature, and this model is pure.
import { answerLabel } from '@/features/opening/model/answers-panel'
import { PERSON, QUESTION_STEPS } from '@/features/opening/model/onboarding'
import { NOT_SURE, SCREENS } from '@/features/opening/model/questions'
import {
  type QuestionKey,
  ROADMAP_NAME_MAX,
  type Roadmap,
  type StoredAnswer,
  type StoredAnswers,
} from '@/shared/types/student'

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
  /** "From onboarding", "From scratch" or "Copy of …" */
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

/** What a road says for its names: its tiles' names, where she is and the cities on her road. */
type NamedRoad = {
  tiles: readonly { id: string; name: string }[]
  walk: { here: string; cityLine: readonly string[] }
}

/** The road's names for `roadmapName`, read once for the board's breadcrumb and the list alike. */
export function roadNames(road: NamedRoad): RoadNames {
  const nameOf = (id: string | undefined) => road.tiles.find((t) => t.id === id)?.name ?? ''
  return { here: nameOf(road.walk.here), city: nameOf(road.walk.cityLine[0]) }
}

/**
 * Her own name for it, else "Cyber Security in Perth" from where she is on its road; from scratch,
 * with nowhere on its road yet, "New roadmap".
 */
export const roadmapName = (r: Pick<Roadmap, 'name'>, road: RoadNames): string =>
  r.name ?? (road.here ? `${road.here} in ${road.city}` : 'New roadmap')

/** A copy's name until she renames it: "Copy of" its source's name, cut to the longest a name is. */
export const copyName = (source: string): string =>
  [...`Copy of ${source}`].slice(0, ROADMAP_NAME_MAX).join('')

/**
 * Her first roadmap, the oldest she has: onboarding made it. Nothing stores where a roadmap came
 * from but `copiedFrom`, so one without it is from onboarding when it is her first, else from
 * scratch (fromLine).
 */
export const firstMade = <T extends Pick<Roadmap, 'createdAt'>>(roadmaps: readonly T[]): T | null =>
  roadmaps.reduce<T | null>(
    (first, r) => (first && first.createdAt <= r.createdAt ? first : r),
    null,
  )

/**
 * The list's "from" line: a copy names its source ("Copy of …", or that it was deleted); one with
 * no source is "From onboarding" when it is her first (firstMade), else "From scratch".
 */
export function fromLine(
  r: Pick<Roadmap, 'copiedFrom'>,
  { first, source }: { first: boolean; source?: string },
): string {
  if (r.copiedFrom !== null) return source ? `Copy of ${source}` : 'Copy of a roadmap you deleted'
  return first ? 'From onboarding' : 'From scratch'
}

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

/** Item titles that head their questions on Your answers' rows ("Your budget per year · Amount"). */
const titled = (): Set<string> =>
  new Set(
    SCREENS.flatMap((screen) =>
      screen.items.filter((item) => item.questions.length > 1).map((item) => item.title),
    ),
  )

/** Every stored question, in the question model's order, with its words as Your answers shows them. */
function questionWords(): [QuestionKey, string][] {
  const titles = titled()
  return ([1, 2, 3, 4] as const).flatMap((step) =>
    QUESTION_STEPS[step].questions.flatMap((q): [QuestionKey, string][] =>
      q.key === PERSON
        ? []
        : [[q.key, titles.has(q.group) ? `${q.group} · ${q.question}` : q.question]],
    ),
  )
}

/** "Not sure" for an assumed answer; else the answer as it reads. */
const labelOf = (key: QuestionKey, answer: StoredAnswer) =>
  answer.state === 'assumed' ? NOT_SURE : answerLabel(key, answer.value)

/** The same answer: the same state and value, areas in any order. */
const sameAnswer = (a: StoredAnswer, b: StoredAnswer) =>
  a.state === b.state &&
  (Array.isArray(a.value) && Array.isArray(b.value)
    ? a.value.length === b.value.length && a.value.every((v) => (b.value as string[]).includes(v))
    : a.value === b.value)

/**
 * One chip per answer a copy changed from its source, "Question: label" ("Question: cleared" for
 * one no longer answered), in the question model's order; none without a source.
 */
export function answerDiffs(source: StoredAnswers | null, answers: StoredAnswers): string[] {
  if (!source) return []
  return questionWords().flatMap(([key, words]) => {
    const was = source[key]
    const now = answers[key]
    if (!now) return was ? [`${words}: cleared`] : []
    return was && sameAnswer(was, now) ? [] : [`${words}: ${labelOf(key, now)}`]
  })
}
