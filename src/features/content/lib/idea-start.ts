import { SOURCE_LIMITS } from '../model/artifacts'
import { firstChars } from '../text/script'

// A new post started from an idea (BR12): the address that opens New post on "Start from an idea"
// with the idea typed in, and its reading on arrival. The Ideas queue's Accept and the Insights
// evidence gaps' "Research this" both open it; from the queue it also names the idea, so the post
// made is recorded on it.

const NEW_POST_PATH = '/admin/posts/new'
/** An idea id is a short slug from the ideas file; anything longer is no id. */
const ID_MAX = 64

/** New post, started from this idea (held to the idea field's 200 characters). */
export function ideaPostHref({ text, ideaId }: { text: string; ideaId?: string }): string {
  const query = new URLSearchParams({ idea: firstChars(text.trim(), SOURCE_LIMITS.idea) })
  if (ideaId) query.set('ideaId', ideaId)
  return `${NEW_POST_PATH}?${query}`
}

export type IdeaStart = { text: string; ideaId: string | null }

/**
 * The idea New post was opened with: its text, held to 200 characters, and the queue idea it came
 * from when the id is one the ideas file knows. Null when there is no idea text.
 */
export function parseIdeaStart(
  query: Record<string, string | string[] | undefined>,
  knownIds: readonly string[],
): IdeaStart | null {
  const { idea, ideaId } = query
  if (typeof idea !== 'string' || idea.trim() === '') return null
  const id =
    typeof ideaId === 'string' && ideaId.length <= ID_MAX && knownIds.includes(ideaId)
      ? ideaId
      : null
  return { text: firstChars(idea.trim(), SOURCE_LIMITS.idea), ideaId: id }
}
