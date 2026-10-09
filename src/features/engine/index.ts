// The engine's public API: the three futures, the mock catalogue they are drawn from, and the
// distance estimates. Pure, so the server and the browser import the same rules.

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
// Priya and her cousin: test data the opening's screen tests share with the engine's.
export { ANJALI, PRIYA_ANSWERS } from './fixtures'
export {
  buildFutures,
  diffFutures,
  type Future,
  type FutureLine,
  type FuturesResult,
  type Notice,
  type SealedRoute,
} from './futures'
export { minutesBetween, whoOf } from './geo'
export {
  BANDS,
  DIMENSION_LABELS,
  DIMENSIONS,
  type Dimension,
  FEELS,
  type Weights,
} from './types'
