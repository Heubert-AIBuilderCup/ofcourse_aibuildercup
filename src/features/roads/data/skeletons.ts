// A city's skeleton: the slots of its hand-written road that hold no course and no way to stay or
// go home (Point A, Australia, the city, the other city, the stack of cities, the Student visa),
// and its arrival line. A composed road (model/compose.ts) puts a course and an ending on it; the
// city's guide and where it walks to follow the course, so compose writes those. Melbourne's comes
// from the road home, whose city words assume nothing about going home. Pure.

import { COURSES, cityById, cityOf } from '@/features/engine/catalogue'
import { EXTRA_COURSES } from './courses'
import { ROADS } from './roads'
import type { RoadSpec } from './types'

export type Skeleton = {
  cityId: string
  altCityId: string
  slots: Pick<
    RoadSpec['slots'],
    'point-a' | 'australia' | 'city' | 'alt-city' | 'more-cities' | 'visa-500'
  >
  arrivalLine: string
}

/** How many courses the catalogue has in a city, at every level and length. */
const coursesIn = (cityId: string): number =>
  [...COURSES, ...EXTRA_COURSES].filter((c) => cityOf(c).id === cityId).length

function skeletonOf(road: RoadSpec): Skeleton {
  const { slots } = road
  return {
    cityId: road.cityId,
    altCityId: road.altCityId,
    slots: {
      'point-a': slots['point-a'],
      australia: slots.australia,
      city: {
        ...slots.city,
        short: `${cityById(road.cityId).name} · ${coursesIn(road.cityId)} courses`,
      },
      'alt-city': slots['alt-city'],
      'more-cities': slots['more-cities'],
      'visa-500': slots['visa-500'],
    },
    arrivalLine: road.arrivalLine,
  }
}

export const SKELETONS: Readonly<Record<string, Skeleton>> = Object.fromEntries(
  ROADS.map((road) => [road.cityId, skeletonOf(road)]),
)
