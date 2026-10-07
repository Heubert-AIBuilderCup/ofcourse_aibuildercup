// Distances from the person she knows in Australia: minutes by road within a city or to a nearby
// one, flight hours between cities farther apart. Estimates from straight-line distance, never a maps service (out of scope).

import type { Relative } from '@/shared/types/student'
import { campusOf, cityById, cityOf, placeById } from './catalogue'
import type { Course, Point } from './types'

const EARTH_RADIUS_KM = 6371
/** Roads wind: a trip is about 1.3 times the straight line, at about 40 km/h, plus parking. */
const ROAD_FACTOR = 1.3
const ROAD_KMH = 40
const ROAD_EXTRA_MIN = 10
/** At about 750 km/h, plus 45 minutes of taxi, climb and descent. */
const FLIGHT_KMH = 750
const FLIGHT_EXTRA_H = 0.75
/** Cities closer than this are a drive apart, not a flight (Melbourne to Geelong is about 65 km). */
const ROAD_MAX_KM = 300

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

/** Hours of flying, to the nearest half hour. */
export function flightHours(a: Point, b: Point): number {
  const hours = haversineKm(a, b) / FLIGHT_KMH + FLIGHT_EXTRA_H
  return Math.round(hours * 2) / 2
}

/** 3.5 → "a 3½-hour flight". */
export function formatFlight(hours: number): string {
  const whole = Math.floor(hours)
  return `a ${whole}${hours > whole ? '½' : ''}-hour flight`
}

/**
 * The course's distance from her person, marked as an estimate (criteria 32 and 33); a promise
 * when the place is not one the preview can measure; null when she named no one.
 */
export function distanceLine(course: Course, relative: Relative | null): string | null {
  if (!relative) return null
  const who = relative.name ?? `your ${relative.relationship.toLowerCase()}`
  const place = relative.placeId === null ? undefined : placeById(relative.placeId)
  if (!place) {
    return `Distances from ${who} in ${relative.place} will show once we can work them out.`
  }
  const campus = campusOf(course)
  if (campus.cityId === place.cityId) {
    return `${campus.name}: about ${minutesBetween(place, campus)} min from ${who} in ${place.name} · estimate`
  }
  const city = cityOf(course)
  const from = cityById(place.cityId)
  if (haversineKm(from, city) < ROAD_MAX_KM) {
    return `${city.name}: about ${minutesBetween(place, campus)} min by road from ${who} in ${from.name} · estimate`
  }
  return `${city.name}: ${formatFlight(flightHours(place, city))} from ${who} in ${from.name} · estimate`
}
