// The roads' client-safe API: what the board may load in the browser. The re-match preview reads
// the roads' keys only (data/road-keys.ts), never their copy, which the server builds into the
// road it sends (client.test.ts pins it). Ask's card gets its words and the question's bound from
// a module with no imports, and its types; a card's details and a tile's posts are types only.
// Everything else is in ./index, for the server.

export type { TileAsk } from './data/types'
export {
  ASK_CAPPED,
  ASK_FAILED,
  ASK_QUESTION_MAX,
  type AskReply,
  NO_DATA,
} from './model/ask-words'
export type { CardDetails } from './model/details'
export { roadChange } from './model/road-change'
export type { TilePost } from './model/tile-posts'
