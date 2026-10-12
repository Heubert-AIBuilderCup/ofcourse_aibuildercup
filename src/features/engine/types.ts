// The engine's one definition of its types. Pure: the engine runs on the server and in the
// browser, and the UI imports these type-only.

export type Effect = 'gives' | 'neutral' | 'costs'
export type DataState = 'confirmed' | 'estimated' | 'unknown' | 'out of date' | 'conflicting'
export type Pips = 1 | 2 | 3 | 4 | 5
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
