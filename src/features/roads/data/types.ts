// The roads' mock catalogue: visas, occupations, subjects, opportunities, a field graph and
// practical questions, on top of the engine's cities and courses. Australia only. Every Source
// title ends with "· mock" (ADR-107, ADR-097); catalogue.test.ts pins it.
import type { FieldId, Level } from '@/features/engine/types'
import type {
  Badge,
  BadgeId,
  CardCopy,
  HereCopy,
  Lesson,
  Overview,
  StackRow,
} from '@/features/road/model/road-data'

export type Source = { title: string; date: string }
export type StateId = 'WA' | 'SA' | 'NSW' | 'VIC' | 'TAS'
export type VisaId = '500' | '485' | '190' | '491' | '191' | '189' | '186' | '482'
export type Visa = {
  id: VisaId
  name: string
  stage: 'study' | 'post-study' | 'provisional' | 'permanent'
  years: string
  conditions: string[]
  leadsTo: VisaId[]
  source: Source
}
export type Occupation = {
  code: string
  name: string
  courseIds: string[]
  lists: Partial<Record<StateId, ('190' | '491')[]>>
  employerSponsored: boolean
  source: Source
}
/**
 * One occupation in one city: sample openings and a pay range in thousands of dollars. No
 * employer is ever named.
 */
export type JobMarketRow = {
  /** An ANZSCO code from OCCUPATIONS. */
  code: string
  cityId: string
  openings: number
  payLowK: number
  payHighK: number
}
/** A field one step from another on the field graph, named and defined. */
export type FieldNear = { name: string; definition: string }
/** A job a course leads to; with the course detail on, its sample market in the course's city. */
export type CourseJob = { code: string; name: string; market?: JobMarketRow | null }
/**
 * A course's jobs in one of the subjects it combines, named; `primary` for its own field, whose
 * visa, work rights and PR the course follows.
 */
export type CourseJobGroup = { field: FieldId; name: string; primary: boolean; jobs: CourseJob[] }
export type CourseSubjects = {
  courseId: string
  majors: string[]
  units: string[]
  conditions: string[]
  source: Source
}
export type Opportunity = {
  id: string
  kind: 'placement' | 'part-time' | 'graduate-program'
  title: string
  employer: string
  cityId: string
  fields: FieldId[]
  demand: 'low' | 'moderate' | 'high'
  source: Source
}
export type Field = { id: string; name: string; definition: string; niche: boolean }
export type FieldEdge = { from: string; to: string; kind: 'is-a' | 'combines' | 'related' }
export type TileAsk = { question: string; answer: string; source: Source }
export type AskSubject = { kind: 'city'; cityId: string } | { kind: 'course'; courseId: string }
export type TileAsks = { subject: AskSubject; asks: TileAsk[] }

// ── Roads ───────────────────────────────────────────────────────────────────────────────────

/** The board's places, one per tile of Priya's road: every road fills each of them. */
export const SLOTS = [
  'point-a',
  'australia',
  'city',
  'alt-city',
  'more-cities',
  'course',
  'alt-course',
  'more-courses',
  'visa-500',
  'course-years',
  'visa-485',
  'fork',
  'pr-straight',
  'pr-point',
  'pr-lane',
  'pr-lane-end',
  'stack-course',
] as const
export type SlotId = (typeof SLOTS)[number]

/** A slot's tile id, its words on the map, its card and, where she can stand, the card there. */
export type SlotCopy = {
  id: string
  name: string
  short?: string
  kicker?: string
  sub?: string
  gains?: string
  costs?: string
  when?: string
  courseStepName?: string
  /** On a way-to-stay tile, the visa it is: the facts its why rests on. */
  visa?: VisaId
  card: CardCopy
  here?: Omit<HereCopy, 'badges'> & { badges?: BadgeId[] }
}

/** What matching reads of a road, and its label: no copy, so the board's preview can load it. */
export type RoadKey = {
  id: string
  /** "Perth · Cyber Security · 190": the re-match preview's words. */
  label: string
  stays: boolean
  field: FieldId
  level: Level
  cityId: string
  /** The catalogue course it is about. */
  courseId: string
}

export type RoadSpec = RoadKey & {
  altCityId: string
  altCourseId: string
  stackCourseId: string
  prRoute: '190' | '491' | '186' | 'none'
  slots: Record<SlotId, SlotCopy>
  badges: Record<BadgeId, Badge>
  /** The stack's rows, each with its catalogue course; the board's row is marked from it. */
  stackRows: (Omit<StackRow, 'related'> & { courseId: string })[]
  lesson: Omit<Lesson, 'tileIds'>
  overview: Overview
  arrivalLine: string
}

/** Priya's tile id in each slot: the shape every road is built on. */
export const PRIYA_SLOT: Record<SlotId, string> = {
  'point-a': 'point-a',
  australia: 'australia',
  city: 'perth',
  'alt-city': 'adelaide',
  'more-cities': 'more-cities',
  course: 'cyber-security-ecu-perth',
  'alt-course': 'data-science-uwa-perth',
  'more-courses': 'more-courses-perth',
  'visa-500': 'student-visa-500',
  'course-years': 'masters-cyber-security-ecu',
  'visa-485': 'graduate-visa-485',
  fork: 'two-ways-to-pr',
  'pr-straight': 'state-nomination-190',
  'pr-point': 'permanent-residency',
  'pr-lane': 'regional-491',
  'pr-lane-end': 'permanent-191',
  'stack-course': 'information-systems-curtin-perth',
}
