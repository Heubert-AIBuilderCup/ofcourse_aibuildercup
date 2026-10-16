import 'server-only'
// What the cards' posts and updates are drawn from (criteria 44-47): the live feed posts not yet
// expired and the live updates, which tilePosts puts on the tiles of her road. It reads nothing of
// her roadmap, so the board's layout starts it beside the roadmap's read. A read that fails gives
// nothing, so a failing feed never breaks the board.

import { type FeedPost, isLive } from '@/features/content/lib/feed'
import { listLive } from '@/features/content/server/store'
import { type LiveUpdateRow, listLiveUpdates } from '@/features/updates/server/updates'
import type { LiveUpdate } from '../model/tile-posts'

export type TileFeed = { posts: FeedPost[]; updates: LiveUpdate[] }

type Sources = {
  listLive: () => Promise<FeedPost[]>
  listLiveUpdates: () => Promise<LiveUpdateRow[]>
  now: () => Date
}

const SOURCES: Sources = { listLive, listLiveUpdates, now: () => new Date() }

/** An update the team made live, as a tile needs it; any other is none (the read's second gate). */
function liveUpdate(u: LiveUpdateRow): LiveUpdate[] {
  if (u.status !== 'live') return []
  return [
    {
      id: u.id,
      status: 'live',
      institution: u.institution,
      title: u.title,
      body: u.body,
      audience: u.audience,
    },
  ]
}

/** The live posts and updates the tiles are drawn from; nothing when a read fails. Never throws. */
export async function readTileFeed(sources: Sources = SOURCES): Promise<TileFeed> {
  try {
    const [posts, updates] = await Promise.all([sources.listLive(), sources.listLiveUpdates()])
    const now = sources.now()
    return { posts: posts.filter((p) => isLive(p, now)), updates: updates.flatMap(liveUpdate) }
  } catch (error) {
    console.error('[roads.tilePosts]', error)
    return { posts: [], updates: [] }
  }
}
