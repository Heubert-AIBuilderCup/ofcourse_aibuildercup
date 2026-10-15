// The scene: the road as the board draws it now, after what she has done on this roadmap's board
// (its stored choices, then this session's), what an answer she has not saved would change, and
// the marks her saved answers leave. Pure: builds new tiles and lines, never changes the road it
// reads.

import type { RoadmapChoices, StoredAnswers } from '@/shared/types/student'
import type { Badge, BadgeId, LabelPlace, Road, Ruler, Tile, Walk } from './road-data'

/** What she has done on the board this session. */
export type Session = {
  /** Swapped the alternative course onto her road. */
  swapped: boolean
  /** Put a course from the stack on her board. */
  added: boolean
  /** Read the lesson. */
  read: boolean
  /** Her first arrival, before she has walked the board. */
  first: boolean
  /** Walked back from her course to its city: the city level open, the course next. */
  city: boolean
  /** Walked back to her country: where the first arrival stands her, without its hint. */
  country: boolean
  /** What an answer she has not saved would change, by tile id ("If you save"). Never saved. */
  preview?: Record<string, string>
}

export const NEW_SESSION: Session = {
  swapped: false,
  added: false,
  read: false,
  first: false,
  city: false,
  country: false,
}

/** The session a roadmap's board opens with: its stored choices (a missing key is false). */
export const sessionFrom = (choices: RoadmapChoices, firstVisit: boolean): Session => ({
  swapped: choices.swapped ?? false,
  added: choices.added ?? false,
  read: choices.read ?? false,
  first: firstVisit,
  city: choices.city ?? false,
  country: choices.country ?? false,
})

/** What a session keeps on the roadmap: every choice, never the first arrival or the preview. */
export const choicesFrom = ({
  first: _,
  preview: __,
  ...choices
}: Session): Required<RoadmapChoices> => choices

export type Scene = Walk & {
  /** The tiles on the board, each with its state and label placement per stop. */
  tiles: Tile[]
  /** The tile the one-time duck hint rings, else null. */
  hint: string | null
  ruler: Ruler
  /** No road drawn yet: only where she starts and a destination to pick. */
  empty: boolean
  /** The road's badges, with the figures her saved answers give them. */
  badges: Record<BadgeId, Badge>
}

const swapIn = (ids: string[], from: string, to: string) => ids.map((id) => (id === from ? to : id))

/** The alternative and the course on the road trade places; the road ahead re-routes through it. */
function swap(tiles: Tile[], walk: Walk): Walk {
  const here = tiles.find((t) => t.id === walk.here)!
  const alt = tiles.find((t) => t.id === walk.alternative)!
  const slot = { gx: here.gx, gy: here.gy, lab: here.lab }
  Object.assign(here, { gx: alt.gx, gy: alt.gy, lab: alt.lab, state: 'lit', kicker: 'Visited' })
  Object.assign(alt, slot, { state: 'here' })
  const step = tiles.find((t) => t.id === walk.courseStep)
  if (step && alt.courseStepName) step.name = alt.courseStepName
  return {
    ...walk,
    here: alt.id,
    alternative: here.id,
    lit: swapIn(walk.lit, here.id, alt.id),
    next: swapIn(walk.next, here.id, alt.id),
    rows: swapIn(walk.rows, here.id, alt.id),
    courseLine: [
      alt.id,
      here.id,
      ...walk.courseLine.filter((id) => id !== here.id && id !== alt.id),
    ],
  }
}

/** The stacked course takes the alternative's place; the alternative folds into the stack. */
function add(tiles: Tile[], stacked: Tile, walk: Walk): Walk {
  const i = tiles.findIndex((t) => t.id === walk.alternative)
  const alt = tiles[i]
  const { inStack: _, ...course } = stacked
  tiles[i] = { ...course, gx: alt.gx, gy: alt.gy, lab: { ...alt.lab } }
  return {
    ...walk,
    alternative: course.id,
    courseLine: swapIn(walk.courseLine, alt.id, course.id),
    levelIds: swapIn(walk.levelIds, alt.id, course.id),
  }
}

const UNNAMED = { whole: 'none', level: 'none', tile: 'none' } as const

/** The duck one step back, at the city: her course is next, the courses beside it unnamed. */
function walkBack(tiles: Tile[], walk: Walk): Walk {
  const byId = (id: string) => tiles.find((t) => t.id === id)
  const at = walk.lit.indexOf(walk.here)
  const city = walk.lit[at - 1]
  const course = walk.here
  const cityTile = byId(city)
  const courseTile = byId(course)
  if (!cityTile || !courseTile) return walk
  cityTile.state = 'here'
  cityTile.lab = { ...cityTile.lab, level: 'below', tile: 'below' }
  courseTile.state = 'next'
  courseTile.lab = { ...courseTile.lab, level: 'right', tile: 'right' }
  for (const id of walk.courseLine) {
    const t = byId(id)
    if (t && id !== course) t.lab = { ...UNNAMED }
  }
  const step = byId(walk.next[walk.next.length - 1])
  if (step && step.id !== course) Object.assign(step, { state: 'fog', lab: { ...UNNAMED } })
  const study = byId(walk.courseStep)
  if (study) study.lab = { ...study.lab, level: 'none' }
  return {
    ...walk,
    here: city,
    lit: walk.lit.slice(0, at),
    next: [city, course],
    ahead: [course, ...walk.ahead],
    openLevel: 'city',
    levelIds: [walk.lit[at - 2], ...walk.cityLine, course].filter((id): id is string => !!id),
  }
}

/**
 * The duck back at her country, as the first arrival draws it: the country level open, her city
 * next, no course on her road yet (each course an alternative). The road ahead is the road she has
 * walked so far, so a swap she made stays on it.
 */
function toCountry(tiles: Tile[], walk: Walk, arrival: Road['arrival']): Walk {
  const country = arrival.walk.here
  if (!country) return walk
  const byId = (id: string) => tiles.find((t) => t.id === id)
  for (const [id, change] of Object.entries(arrival.tiles)) {
    const t = byId(id)
    if (t) Object.assign(t, change, change.lab && { lab: { ...change.lab } })
  }
  for (const id of walk.courseLine) {
    const t = byId(id)
    if (t?.state === 'here') t.state = 'alt'
  }
  const at = walk.lit.indexOf(country)
  return { ...walk, ...arrival.walk, ahead: [...walk.lit.slice(at + 1), ...walk.ahead] }
}

/** Where she starts: a press on it opens her answers, which it is built from. */
export const POINT_A = 'point-a'

const EVERY_STOP = (place: LabelPlace) => ({ whole: place, level: place, tile: place })

/**
 * A road with no tiles yet: she stands at Point A (its line is her start card's) with the
 * destination she has not picked drawn as a dotted outline after it (the reference's empty board).
 */
function emptyScene(road: Road): Scene {
  const start: Tile = {
    id: 'point-a',
    kind: 'point',
    state: 'here',
    gx: 0,
    gy: 0,
    kicker: 'You',
    name: 'Point A',
    sub: road.here['point-a']?.sub,
    lab: EVERY_STOP('left'),
  }
  const destination: Tile = {
    id: 'destination',
    kind: 'place',
    state: 'unknown',
    gx: 2.4,
    gy: 0,
    name: 'Destination',
    lab: EVERY_STOP('below'),
  }
  return {
    here: start.id,
    alternative: '',
    courseStep: '',
    lit: [start.id],
    next: [start.id, destination.id],
    ahead: [],
    fork: false,
    cityLine: [],
    courseLine: [],
    openLevel: null,
    levelIds: [start.id, destination.id],
    rows: [start.id],
    tiles: [start, destination],
    hint: null,
    ruler: { ticks: [], now: 0, from: 0, to: 0, gy: 0 },
    empty: true,
    badges: road.badges,
  }
}

/** The road walked as this session's choices walk it. */
function walkedScene(road: Road, session: Session): Scene {
  const tiles = road.tiles.map((t) => ({ ...t, lab: { ...t.lab } }))
  const onBoard = tiles.filter((t) => !t.inStack)
  const byId = (id: string) => onBoard.find((t) => t.id === id)
  let walk: Walk = { ...road.walk }

  if (session.swapped) walk = swap(onBoard, walk)
  // After a swap, the added course takes the place of the one she swapped off.
  const stacked = tiles.find((t) => t.inStack)
  if (session.added && stacked) walk = add(onBoard, stacked, walk)
  if (session.first || session.country) walk = toCountry(onBoard, walk, road.arrival)
  else if (session.city) walk = walkBack(onBoard, walk)
  if (session.read) {
    for (const id of road.lesson.tileIds) {
      const t = byId(id)
      if (t?.state !== 'fog') continue
      t.state = 'seen'
      // Looked at, it is named at Level.
      if (t.lab.level === 'none') t.lab.level = 'right'
    }
  }

  return {
    ...walk,
    tiles: onBoard,
    hint: session.first ? road.arrival.hint : null,
    ruler: road.years,
    empty: false,
    badges: road.badges,
  }
}

/** Each tile the preview names carries its words. */
function previewed(scene: Scene, preview: Record<string, string>): Scene {
  return {
    ...scene,
    tiles: scene.tiles.map((t) =>
      preview[t.id] === undefined ? t : { ...t, prev: preview[t.id] },
    ),
  }
}

/**
 * The road as the board draws it after this session: its preview on the tiles it names, then the
 * marks her saved answers leave when they are passed.
 */
export function buildScene(road: Road, session: Session, answers?: StoredAnswers): Scene {
  const walked = road.tiles.length === 0 ? emptyScene(road) : walkedScene(road, session)
  const scene = session.preview ? previewed(walked, session.preview) : walked
  return answers ? applyAnswers(scene, answers) : scene
}

/** What the English test's "Not taken yet" stores (the opening's question model). */
const NOT_TAKEN = 'Not taken yet'
/** The budget question's answer that drops "roughly" (the opening's question model). */
const HARD_LIMIT = 'Hard limit'

/** AUD thousands to one decimal, as the mock's figures read: 3.5, 9.5, 1. */
const thousands = (n: number) => String(Math.round(n * 10) / 10)

/**
 * The marks her saved answers leave on the course on her road (the first on its course line) and
 * its city: a budget under the course's fees makes the city "A stretch on your budget" and puts
 * the over-budget badge first on the course, with the cost in its trade-off; "Not taken yet" on the
 * English test leaves the course's IELTS condition not met. Anything else changes nothing. Returns
 * a new scene; the one given is never changed.
 */
export function applyAnswers(scene: Scene, answers: StoredAnswers): Scene {
  const course = scene.tiles.find((t) => t.id === scene.courseLine[0])
  if (!course) return scene
  const amount = answers.amount?.value
  const over = typeof amount === 'number' && course.fees !== undefined ? course.fees - amount : 0
  const unmet = answers.eng?.value === NOT_TAKEN && (course.badges ?? []).includes('ielts')
  if (over <= 0 && !unmet) return scene

  const badges = { ...scene.badges }
  const changes: Record<string, Partial<Tile>> = {}
  if (over > 0 && typeof amount === 'number') {
    const roughly = answers.hard?.value === HARD_LIMIT ? '' : ', roughly'
    badges.over = {
      ...badges.over,
      value: `Over budget by AUD ${thousands(over)}k`,
      explanation: `Your budget is AUD ${amount}k a year for fees${roughly}. This course is AUD ${course.fees}k a year.`,
    }
    changes[course.id] = {
      badges: ['over', ...(course.badges ?? []).filter((b) => b !== 'over')],
      costs: `Less good for: cost (AUD ${thousands(over)}k a year over budget)`,
    }
    const city = scene.cityLine[0]
    if (city) changes[city] = { kicker: 'A stretch on your budget' }
  }
  if (unmet) {
    badges.ielts = {
      ...badges.ielts,
      value: `Not met: ${badges.ielts.value}`,
      explanation: 'You haven’t taken an English test yet, so this condition isn’t met.',
    }
  }
  return {
    ...scene,
    badges,
    tiles: scene.tiles.map((t) => (changes[t.id] ? { ...t, ...changes[t.id] } : t)),
  }
}
