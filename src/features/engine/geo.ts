// Distances from the person she knows in Australia: minutes by road. Estimates from
// straight-line distance, never a maps service (out of scope).

import type { Relationship, Relative } from '@/shared/types/student'
import type { Point } from './types'

const EARTH_RADIUS_KM = 6371
/** Roads wind: a trip is about 1.3 times the straight line, at about 40 km/h, plus parking. */
const ROAD_FACTOR = 1.3
const ROAD_KMH = 40
const ROAD_EXTRA_MIN = 10

const radians = (degrees: number) => (degrees * Math.PI) / 180

export function haversineKm(a: Point, b: Point): number {
  const dLat = radians(b.lat - a.lat)
  const dLng = radians(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Minutes by road, to the nearest 5. */
export function minutesBetween(a: Point, b: Point): number {
  const minutes = ((haversineKm(a, b) * ROAD_FACTOR) / ROAD_KMH) * 60 + ROAD_EXTRA_MIN
  return Math.round(minutes / 5) * 5
}

/** How a relationship names her contact; Other names no one in particular. */
const RELATIONSHIP_WHO: Readonly<Record<Relationship, string | null>> = {
  Cousin: 'your cousin',
  Sibling: 'your sibling',
  'Aunt or uncle': 'your aunt or uncle',
  Friend: 'your friend',
  Other: null,
}

/** Her contact, by the name, else the relationship, else "the person you know". */
export function whoOf(relative: Relative): string {
  if (relative.name) return relative.name
  return (relative.relationship && RELATIONSHIP_WHO[relative.relationship]) || 'the person you know'
}
