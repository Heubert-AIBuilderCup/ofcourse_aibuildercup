// The rules a comic keeps, pure: what a caption may say, how many panels a comic has and the
// title its search line names.

import type { Fact } from '../model/types'
import { bannedPhrases, outcomePromises } from '../text/lint'
import { missingNumbers } from '../text/numbers'

export const COMIC_PANELS = { min: 3, max: 6 } as const

/** The longest premise an editor may give a new comic (RC1), in characters. */
export const PREMISE_MAX = 120

/** The longest planned scene of a panel (RC2, RC3), in characters, as a slide's `scene` holds it (model/types.ts). */
export const SCENE_MAX = 300

/**
 * The first thing wrong with a panel caption, or null when it is fine: an outcome promise, a banned
 * phrase, or a number no fact of the path holds (same value, same unit when both have one).
 */
export function comicCaptionError(text: string, facts: Fact[]): string | null {
  const [promise] = outcomePromises(text)
  if (promise) return `Remove "${promise}": a comic never promises an outcome.`
  const [banned] = bannedPhrases(text)
  if (banned) return `Remove "${banned}".`
  // The pipe keeps one fact's number words from running into the next fact's.
  const [missing] = missingNumbers(text, facts.map((fact) => fact.text).join(' | '))
  if (missing) return `${text.slice(missing.start, missing.end)} is not a fact of this path.`
  return null
}

export type PanelOp =
  | { kind: 'add'; after: number }
  | { kind: 'remove'; at: number }
  | { kind: 'move'; at: number; to: number }

/** Why the operation cannot be done to a comic of this many panels, or null when it can. */
export function panelOpsError(count: number, op: PanelOp): string | null {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < count
  if (op.kind === 'add') {
    if (!inRange(op.after)) return 'No such panel.'
    return count >= COMIC_PANELS.max ? `A comic has at most ${COMIC_PANELS.max} panels.` : null
  }
  if (op.kind === 'remove') {
    if (!inRange(op.at)) return 'No such panel.'
    return count <= COMIC_PANELS.min ? `A comic has at least ${COMIC_PANELS.min} panels.` : null
  }
  return inRange(op.at) && inRange(op.to) ? null : 'No such panel.'
}

/** The slides after the operation, as a new list; the same slides when the operation is refused. */
export function applyPanelOp<T>(slides: T[], op: PanelOp, blank: T): T[] {
  const next = [...slides]
  if (panelOpsError(slides.length, op)) return next
  if (op.kind === 'add') next.splice(op.after + 1, 0, blank)
  else if (op.kind === 'remove') next.splice(op.at, 1)
  else next.splice(op.to, 0, ...next.splice(op.at, 1))
  return next
}

/**
 * The title a post's search line names (RC7, criterion 106): a comic's own, set from its story,
 * since its source title is the path's label; a feed post's source title, as it always was.
 */
export function searchTitleOf(
  post: { courseId: string | null; title: string },
  sourceTitle: string,
): string {
  return post.courseId === null ? sourceTitle : post.title
}
