// The engine's public API: the mock catalogue and the distance estimates. Pure, so the server and
// the browser import the same rules.

export {
  AREA_FIELDS,
  CAMPUSES,
  CITIES,
  COURSES,
  cityById,
  cityOf,
  PLACES,
  placeById,
  placeLabel,
} from './catalogue'
export { minutesBetween, whoOf } from './geo'
