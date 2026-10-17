// The finder's client-safe API, for the Find section in the browser: the panel the board opens
// (with what it takes), and the types of a search's result, its hits and keyword hits, the filters
// a hit fails, and a card's why. Everything else is in ./index, for the server.

export { FinderPanel, type FinderProps } from './components/FinderPanel'
export type { FilterKey, FinderHit, FinderResult, FinderWhy, KeywordHit } from './model/types'
