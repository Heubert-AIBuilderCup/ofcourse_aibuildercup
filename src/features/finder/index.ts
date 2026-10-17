// The finder's public API, for the server: the board's two actions (a search and a card's why), the
// switches for each part, and the text the Find box starts with. Its catalogue and search stay
// inside the feature. The browser imports ./client instead.

export { findCoursesAction, finderWhyAction } from './actions'
export { finderSeedText } from './model/seed'
export { compareOn, courseDetailOn, finderOn } from './switch'
