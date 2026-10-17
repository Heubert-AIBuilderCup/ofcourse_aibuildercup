// The finder's public API, for the server: the board's actions (a search, a card's why and a found
// course compared with her roadmap), "What changes" on the board's other-city and other-course
// tiles, the switches for each part, and the text the Find box starts with. Its catalogue and
// search stay inside the feature. The browser imports ./client instead.

export { compareCourseAction, findCoursesAction, finderWhyAction } from './actions'
export { compareByTile } from './model/compare'
export { finderSeedText } from './model/seed'
export { compareOn, courseDetailOn, finderOn } from './switch'
