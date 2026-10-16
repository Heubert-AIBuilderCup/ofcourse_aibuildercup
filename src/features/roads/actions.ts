'use server'

import { z } from 'zod'
import { asStudent, fail } from '@/shared/lib/auth/as-student'
import type { ActionResult } from '@/shared/types/action-result'
import { ASK_QUESTION_MAX, type AskReply } from './model/ask-words'
import { askTile } from './server/ask'
import { type Why, writeWhy } from './server/why'
import { whyAllowed } from './server/why-limit'

// The student's calls about her road. Each reads the student from the session (never from the
// request) and refuses anyone who is not a student (asStudent); the roadmap id is a claim the
// repository checks against her own rows.

const NOT_FOUND = 'Not found'

/** A roadmap or tile id from the request, bounded before it reaches the repository. */
const idSchema = z.string().min(1).max(64)
/** Her question, trimmed: at least one character and at most ASK_QUESTION_MAX. */
const questionSchema = z.string().trim().min(1).max(ASK_QUESTION_MAX)

/**
 * Why a tile is on her road: the model's words, else the template; only the template once she has
 * asked WHY_PER_HOUR in the hour; refused for a roadmap not hers.
 */
export async function roadWhyAction(roadmapId: string, tileId: string): Promise<ActionResult<Why>> {
  return asStudent('roads.why', async (userId) => {
    const id = idSchema.safeParse(roadmapId)
    const tile = idSchema.safeParse(tileId)
    if (!id.success || !tile.success) return fail(NOT_FOUND)
    const why = await writeWhy(userId, id.data, tile.data, process.env, whyAllowed(userId))
    return why ? { ok: true, ...why } : fail(NOT_FOUND)
  })
}

/** Her typed question about a tile, answered from its rows; refused for a roadmap not hers. */
export async function askTileAction(
  roadmapId: string,
  tileId: string,
  question: string,
): Promise<ActionResult<AskReply>> {
  return asStudent('roads.ask', async (userId) => {
    const id = idSchema.safeParse(roadmapId)
    const tile = idSchema.safeParse(tileId)
    const asked = questionSchema.safeParse(question)
    if (!id.success || !tile.success || !asked.success) return fail(NOT_FOUND)
    const reply = await askTile(userId, id.data, tile.data, asked.data)
    return reply ? { ok: true, ...reply } : fail(NOT_FOUND)
  })
}
