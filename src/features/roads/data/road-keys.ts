// The six roads' keys: what matching reads (whether it stays, its field, level and city) and the
// label the re-match preview says, kept apart from the roads' copy so the board's preview loads
// these lines and never the cards. ROADS takes each road's key from here, in this order: the order
// the matcher breaks a tie by. Each names its course, so a candidate road (candidates.ts) knows
// the six hand-written combinations without loading their text. Pure.

import type { RoadKey } from './types'

export const ROAD_KEYS: readonly RoadKey[] = [
  {
    id: 'perth-cyber',
    label: 'Perth · Cyber Security · 190',
    stays: true,
    field: 'cyber',
    level: "Master's",
    cityId: 'perth',
    courseId: 'ecu-cyber',
  },
  {
    id: 'adelaide-it',
    label: 'Adelaide · Information Technology · 491',
    stays: true,
    field: 'it',
    level: "Master's",
    cityId: 'adelaide',
    courseId: 'unisa-it',
  },
  {
    id: 'sydney-data',
    label: 'Sydney · Data Science · 186',
    stays: true,
    field: 'data',
    level: "Master's",
    cityId: 'sydney',
    courseId: 'uts-data',
  },
  {
    id: 'geelong-business',
    label: 'Geelong · Business Analytics · 491',
    stays: true,
    field: 'business',
    level: "Master's",
    cityId: 'geelong',
    courseId: 'deakin-ba',
  },
  {
    id: 'hobart-it',
    label: 'Hobart · Information Technology · 491',
    stays: true,
    field: 'it',
    level: "Master's",
    cityId: 'hobart',
    courseId: 'utas-it',
  },
  {
    id: 'melbourne-home',
    label: 'Melbourne · Data Science · home',
    stays: false,
    field: 'data',
    level: "Master's",
    cityId: 'melbourne',
    courseId: 'monash-data',
  },
]

/** A road's key by its id; a road without one is a mistake in the data, so it throws. */
export function keyOf(id: string): RoadKey {
  const key = ROAD_KEYS.find((k) => k.id === id)
  if (!key) throw new Error(`No road key "${id}"`)
  return key
}
