// The engine's one definition of its types. Pure: the engine runs on the server and in the
// browser, and the UI imports these type-only.

export const DIMENSIONS = ['cost', 'time', 'work', 'pr', 'location', 'career'] as const
export type Dimension = (typeof DIMENSIONS)[number]
export const DIMENSION_LABELS: Record<Dimension, string> = {
  cost: 'Cost',
  time: 'Time',
  work: 'Work',
  pr: 'PR',
  location: 'Location',
  career: 'Career',
}
export type Weight = 0 | 1 | 2 | 3
export type Weights = Record<Dimension, Weight>
export type Effect = 'gives' | 'neutral' | 'costs'
export type Feel = 'relieved' | 'fine' | 'stretched' | 'hard'
export const FEELS: readonly Feel[] = ['relieved', 'fine', 'stretched', 'hard']
export type DataState = 'confirmed' | 'estimated' | 'unknown' | 'out of date' | 'conflicting'
export type Pips = 1 | 2 | 3 | 4 | 5
export const BANDS: Record<Pips, string> = {
  1: 'low',
  2: 'moderate',
  3: 'fair',
  4: 'strong',
  5: 'very strong',
}
export type Claim = {
  pips: Pips
  state: DataState
  source: string
  date: string
  detail: string[]
  notSure: boolean
}
export type LineData = { effect: Effect; text: string; claim: Claim }
export type FieldId = 'cyber' | 'data' | 'business' | 'it' | 'psych'
export type Level = 'Diploma' | "Bachelor's" | "Master's"
export type Point = { lat: number; lng: number }
export type City = Point & {
  id: string
  name: string
  regional: boolean
  livingK: number
  location: { text: string; claim: Claim }
}
export type Place = Point & { id: string; name: string; cityId: string }
export type Campus = Point & { id: string; name: string; cityId: string }
export type Course = {
  id: string
  name: string
  university: string
  campusId: string
  field: FieldId
  level: Level
  feeK: number
  years: number
  route: string
  /** 0 = no road to PR (sealed when she wants to stay). */
  prScore: 0 | 1 | 2 | 3
  /** The job market the route enters. */
  careerScore: 1 | 2 | 3 | 4 | 5
  placements: boolean
  feeClaim: Claim
  lines: Record<'time' | 'work' | 'pr' | 'career', LineData>
  keepOpen: { text: string; doors: string }
}
