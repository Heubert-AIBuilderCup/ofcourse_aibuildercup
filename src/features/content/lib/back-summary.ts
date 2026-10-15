// What a move back makes again (GD28, amending criterion 121's confirm), as the one line an edit
// at a passed step returns once it has moved the post back by itself. Pure and client-safe:
// nothing is deleted by a move, so the history still holds what came before.

import type { Stage } from '../model/stages'

/** An edit's move back (GD28): the stage it was made at, its home, and whether the post is a look. */
export type EditMove = { from: Stage; to: Stage; look: boolean }

/** What each home's edit makes again, as the note says it. */
function remade(to: Stage, look: boolean): string {
  switch (to) {
    case 'source':
      return 'Source changed: the facts and text versions will be made again'
    case 'rendered':
      return 'Scene changed: draw it, then send the post to review again'
    default:
      return look
        ? 'Text changed: the pictures of changed slides will be planned again'
        : 'Text changed: the slides will be rendered again'
  }
}

/**
 * The one line an edit at a passed step returns once it has moved the post back (GD28): what will
 * be made again, and on a live post that students keep its published version (criterion 116).
 */
export function editNote({ from, to, look }: EditMove): string {
  const line = remade(to, look)
  return from === 'live'
    ? `${line} · students keep the live version until it is published again`
    : line
}
