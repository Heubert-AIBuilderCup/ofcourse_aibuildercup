'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ACCESS_ERRORS } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import { postPath, STEP_IDS, stepPath } from './lib/steps'
import { WORKFLOW_ERRORS } from './lib/workflow'
import {
  approveCharacter,
  CHARACTER_ERRORS,
  drawCharacter,
  editCharacterView,
  planCharacter,
} from './server/character'
import { COMIC_ERRORS, editPanels, editScene, makeComic, retryStory } from './server/commands/comic'
import type { Saved } from './server/commands/shared'

// The comic screens' actions (RC1, RC3, RC9). Each reads the actor from the session (the proxy and the
// layout only hide the page), keeps the browser's values to their types, and hands both to
// server/commands/comic.ts, which applies the access rule (editors) and the input rules. Nothing
// here throws: a failure is a message.

const BOARD_PATH = '/admin/board'
const CHARACTER_PATH = '/admin/comics/character'
const UNKNOWN = 'Unknown post.'

// The command applies the rules; this only keeps the browser's values to their types and bounds.
const MakeInput = z.object({
  courseId: z.string().max(200),
  premise: z.string().max(1000).nullable(),
  emotion: z.string().max(200).nullable(),
  requestId: z.uuid(),
})

const PostId = z.uuid()
const Version = z.number().int().positive()
const slideNo = z.number().int().positive().max(99)
const place = z.number().int().min(0).max(99)
/** A panel's planned scene, by slide number; the command applies its length and the art prompt guard. */
const SceneEdit = z.object({ slide: slideNo, text: z.string().max(10_000) })
/** A panel added after one, removed or moved, panels by place; the command checks the 3 to 6 rule. */
const PanelOpInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), after: place }),
  z.object({ kind: z.literal('remove'), at: place }),
  z.object({ kind: z.literal('move'), at: place, to: place }),
])

// The character's inputs, kept to their types and bounds; the command applies the rules.
const DescriptionInput = z.object({ description: z.string().max(1000) })
const ViewInput = z.object({
  index: z.number().int().min(0).max(99),
  label: z.string().max(1000),
  scene: z.string().max(10_000),
})
const NoteInput = z.object({ note: z.string().max(1000).nullable() })

type Actor = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

async function asActor<T>(
  run: (actor: Actor) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const s = await getSession()
  if (!s) return fail(ACCESS_ERRORS.notAuthorised)
  const { id, role, editor, reviewer, name } = s.user
  return run({ id, role: role ?? '', editor: editor === true, reviewer: reviewer === true, name })
}

/** "Make storyboard": a comic post for the path, at its storyboard; the board is refreshed. */
export async function makeComicAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return asActor(async (actor) => {
    const parsed = MakeInput.safeParse(input)
    if (!parsed.success) return fail(COMIC_ERRORS.path)
    const result = await makeComic(actor, parsed.data)
    if (result.ok) revalidatePath(BOARD_PATH)
    return result
  })
}

/**
 * A command on a comic, as actions.ts runs one on a post: the session first, then the id and
 * version, then the command, then the board and each of the post's step screens refreshed.
 */
async function onComic(
  id: unknown,
  at: unknown,
  run: (actor: Actor, id: string, version: number) => Promise<Saved>,
): Promise<Saved> {
  return asActor(async (actor) => {
    const i = PostId.safeParse(id)
    const v = Version.safeParse(at)
    if (!i.success || !v.success) return fail(UNKNOWN)
    const result = await run(actor, i.data, v.data)
    if (result.ok) {
      revalidatePath(BOARD_PATH)
      revalidatePath(postPath(i.data))
      for (const step of STEP_IDS) revalidatePath(stepPath(i.data, step))
    }
    return result
  })
}

/** A panel's planned scene edited in its art area (RC3). */
export async function editSceneAction(id: unknown, at: unknown, input: unknown): Promise<Saved> {
  return onComic(id, at, async (actor, postId, v) => {
    const parsed = SceneEdit.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return editScene(actor, postId, v, parsed.data)
  })
}

/** "Add after", "Remove", "Move earlier" and "Move later" on a panel (RC3). */
export async function editPanelsAction(id: unknown, at: unknown, op: unknown): Promise<Saved> {
  return onComic(id, at, async (actor, postId, v) => {
    const parsed = PanelOpInput.safeParse(op)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return editPanels(actor, postId, v, parsed.data)
  })
}

/** "Try again" on a comic whose story failed: the story drafted again (RC2). */
export async function retryStoryAction(id: unknown, at: unknown): Promise<Saved> {
  return onComic(id, at, retryStory)
}

/** A character command (RC9): the session first, then the command, then the character page refreshed. */
async function onCharacter(run: (actor: Actor) => Promise<ActionResult>): Promise<ActionResult> {
  return asActor(async (actor) => {
    const result = await run(actor)
    if (result.ok) revalidatePath(CHARACTER_PATH)
    return result
  })
}

/** "Plan the sheet": the character's views planned from its description. */
export async function planCharacterAction(input: unknown): Promise<ActionResult> {
  return onCharacter(async (actor) => {
    const parsed = DescriptionInput.safeParse(input)
    if (!parsed.success) return fail(CHARACTER_ERRORS.description)
    return planCharacter(actor, parsed.data)
  })
}

/** One view's label and scene edited on its card. */
export async function editCharacterViewAction(input: unknown): Promise<ActionResult> {
  return onCharacter(async (actor) => {
    const parsed = ViewInput.safeParse(input)
    if (!parsed.success) return fail(CHARACTER_ERRORS.view)
    return editCharacterView(actor, parsed.data)
  })
}

/** "Draw the sheet", or "Redraw with a note". */
export async function drawCharacterAction(input: unknown): Promise<ActionResult> {
  return onCharacter(async (actor) => {
    const parsed = NoteInput.safeParse(input)
    if (!parsed.success) return fail(CHARACTER_ERRORS.note)
    return drawCharacter(actor, parsed.data)
  })
}

/** "Approve this character": the latest sheet is the one panels are drawn with. */
export async function approveCharacterAction(): Promise<ActionResult> {
  return onCharacter(approveCharacter)
}
