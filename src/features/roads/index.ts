// The roads' public API: the six hand-written roads, the one lookup for any road (hand-written or
// composed), the builder that turns one into a board's Road on Priya's road's shape, the reverse
// lookup from a tile to its slot, the matcher, the road a roadmap shows, each Ask tile's suggested
// questions, each card's details, the posts and updates on its tiles, and each course's English
// score (the onboarding's English line counts them). Pure, for the server: it
// loads every road's copy.
// The browser imports ./client instead.

export { englishScores } from './data/entry'
export {
  JUDGE_STORIES,
  type JudgeStory,
  judgeStoryById,
  OFFERED_JUDGE_STORIES,
} from './data/judge-stories'
export { ROADS, roadById } from './data/roads'
export {
  PRIYA_SLOT,
  type RoadSpec,
  SLOTS,
  type SlotCopy,
  type SlotId,
  type TileAsk,
} from './data/types'
export { ASK_SLOTS, suggestedAsks } from './model/ask'
export { buildRoad, type RoadContext, slotOf } from './model/build'
export { specById } from './model/compose'
export { DEMO_PROFILES } from './model/demo-profiles'
export { detailsByTile } from './model/details'
export { areasWithoutRoads, type Difference, type Match, matchRoad } from './model/match'
export { type RoadFor, roadFor } from './model/road-for'
export { herCountry, type TilePost, tilePosts } from './model/tile-posts'
export { studentAiOff, studentRoadsOff } from './switch'
