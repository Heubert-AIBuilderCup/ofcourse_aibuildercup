// The road's data interface: what a student's road is made of (tiles, their cards, badges, the
// stack, the lesson, the overview, the year ruler, the weights) and where she stands on it. Pure
// and client-safe. Today `getRoad` returns Priya's mock road (fixture.ts); real data will arrive
// through the same interface.

import { PRIYA } from './fixture'

/** The map's three zoom stops, widest first. */
export const STOPS = ['whole', 'level', 'tile'] as const
export type Stop = (typeof STOPS)[number]

/** Each stop's name on the zoom control. */
export const STOP_NAMES: Readonly<Record<Stop, string>> = {
  whole: 'Whole road',
  level: 'Level',
  tile: 'Tile',
}

/** junction: the small tile where the road forks after the 485. */
export type TileKind = 'point' | 'place' | 'course' | 'step' | 'stack' | 'slab' | 'junction'

/**
 * lit: visited · here: where she is · alt: not visited · next: the next step · fog: unexplored,
 * dark but named · seen: looked at, dim · unknown: not picked yet, a dotted outline (the empty road).
 */
export type TileState = 'lit' | 'here' | 'alt' | 'next' | 'fog' | 'seen' | 'unknown'

export type LabelPlace = 'above' | 'below' | 'left' | 'right' | 'none'

/** over: a saved budget under the course's fees (`applyAnswers`). */
export type BadgeId = 'offerings' | 'ielts' | 'fork' | 'maths' | 'over'

export type Badge = {
  /** The badge's kind: "Condition", "Several offerings", "Fork ahead". */
  kind: string
  value: string
  /** What its button opens. */
  explanation: string
  icon: 'layers' | 'alert' | 'split'
}

/** A tile on the isometric map, in grid units (gx along the road, gy across it). */
export type Tile = {
  /** Stable, readable, used in the URL (`?tile=`); never a display name. */
  id: string
  kind: TileKind
  state: TileState
  gx: number
  gy: number
  /** A slab's end along the road: a slab is as long as its step lasts. */
  gx1?: number
  /** An angled slab's end across the road: it runs along its own line from (gx, gy). */
  gy1?: number
  /** A slab's half-width across the road, when not the kind's. */
  w?: number
  /** The tile's half-size, when not the kind's. */
  sz?: number
  /** The level line an alternative or a stack sits on. */
  level?: 'city' | 'course'
  name: string
  /** Its name at Whole road. */
  short?: string
  kicker?: string
  sub?: string
  /** "Good for: PR, career": shown on its own line, over `costs`. */
  gains?: string
  /** "Less good for: location" */
  costs?: string
  when?: string
  badges?: BadgeId[]
  /** A course's fees, AUD thousands a year: what her budget is measured against. */
  fees?: number
  /** A course's overall IELTS entry score: what her English answer is measured against. */
  ielts?: number
  /** What an answer she has not saved would change here ("If you save"); the session's preview. */
  prev?: string
  /** On the thinner road that forks off after the 485. */
  branch?: boolean
  /** A route step's id in `/road/route/<route-id>`. */
  routeId?: string
  /** A course's name for the study step ahead, once that course is on the road. */
  courseStepName?: string
  /** In the stack until she puts it on her board. */
  inStack?: boolean
  /** Where its label sits at each stop. */
  lab: Record<Stop, LabelPlace>
}

/** A pressed tile's card text. Route steps carry no kicker or primary: they are look-ahead cards. */
export type CardCopy = {
  kicker?: string
  sub: string
  gains?: string
  costs?: string
  guide?: string
  because: string
  primary?: string
  /** The lesson id the card offers ("What happens here · 3-min lesson"). */
  lesson?: string
  /** Why the tile is on her road, from her answers and the catalogue: only a tile they decided. */
  why?: string
  /** The heading over the why: on her roadmap, or beside it on her board. */
  whyTitle?: string
}

/** The card where she is. */
export type HereCopy = {
  kicker: string
  sub: string
  gains?: string
  costs?: string
  guide: string
  badges: BadgeId[]
  because: string
  primary: string
  secondary?: string
  /** Heading over the alternative and the stack ("Also in Perth"), else ''. */
  siblingsTitle: string
}

export type StackRow = {
  name: string
  sub: string
  tag: string
  blocked?: boolean
  /** The tile "Put on my board" places, when the row has one. */
  tileId?: string
  /** When the row's course is in a field next to the one she picked: that field, defined. */
  related?: { field: string; definition: string }
}

export type Lesson = {
  /** `/road/learn/<id>` */
  id: string
  /** The tiles reading it turns from dark to looked at. */
  tileIds: string[]
  kicker: string
  title: string
  points: string[]
  /** The toast once she has read it. */
  read: string
}

export type Overview = {
  title: string
  looked: number
  total: number
  rows: string[]
  note: string
}

/** The year ruler beside the road ahead, in grid units. */
export type Ruler = {
  ticks: { year: number; gx: number }[]
  /** Where "Now" sits. */
  now: number
  from: number
  to: number
  /** Across the road, on the far side from the fork's lane, so the lane never crosses it. */
  gy: number
}

export type Weight = { name: string; weight: 1 | 2 | 3 }

/** Where she stands and which roads are drawn: the lines are tile ids in road order. */
export type Walk = {
  here: string
  /** The alternative beside where she is. */
  alternative: string
  /** The study step on the road ahead (re-named when the course changes). */
  courseStep: string
  /** The road walked. */
  lit: string[]
  /** The road to the next step. */
  next: string[]
  /** The road ahead, dark. */
  ahead: string[]
  /** The 491 → 191 branch is drawn. */
  fork: boolean
  cityLine: string[]
  courseLine: string[]
  /** The level line drawn open. */
  openLevel: 'city' | 'course' | null
  /** What the Level stop frames. */
  levelIds: string[]
  /** The phone's Road view, top to bottom. */
  rows: string[]
}

/** The first arrival: the duck one step back, the one-time hint on the next tile. */
export type Arrival = {
  hint: string
  /** The duck's line beside the hint. */
  line: string
  walk: Partial<Walk>
  tiles: Record<string, Partial<Pick<Tile, 'state' | 'lab'>>>
}

export type Road = {
  tiles: Tile[]
  badges: Record<BadgeId, Badge>
  /** A pressed tile's card, by tile id. */
  cards: Record<string, CardCopy>
  /** The card where she is, by the tile she is on. */
  here: Record<string, HereCopy>
  stackRows: StackRow[]
  lesson: Lesson
  overview: Overview
  years: Ruler
  weights: Weight[]
  walk: Walk
  arrival: Arrival
}

/** The student's road. Priya's mock road for now. */
export function getRoad(): Road {
  return PRIYA
}
