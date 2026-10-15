import 'server-only'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { canEdit, type Staff } from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import { comicCharacter } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import { coverArt } from '../ai/art'
import { type CharacterView, labelError, planViews, sceneError, sheetPrompt } from '../ai/character'
import { artPromptError } from '../ai/draft'
import { COMICS_BRAND_ID, DEFAULT_COMIC_STYLE } from '../brands'
import { WORKFLOW_ERRORS } from '../lib/workflow'
import { charCount } from '../text/script'
import { artDeps, artMime, DB_ERROR } from './commands/shared'
import { designLanguageOf } from './page-style'
import { putAsset } from './store'

// The comic character (RC9): the one student every comic on the Comics page shows. An editor
// describes it in a line, Gemini plans the views of a reference sheet, the editor edits them, has
// the sheet drawn, redraws it with a note until it is right, and approves it; drawing panels
// (RC10) waits for an approved sheet. One row for the Comics page (comic_character), replaced by
// each save. Editors and superadmins act (canEdit); everyone who may see the Board reads. Every
// word that reaches the image model passes the art prompt guard.

type Actor = Staff & { id: string }

/** The character as the page and the panels read it. */
export type Character = {
  description: string
  views: CharacterView[]
  /** The latest drawn sheet (a content_asset id), and the note it was redrawn with. */
  sheetAssetId: string | null
  sheetNote: string | null
  /** The sheet panels are drawn with; stays until another is approved. */
  approvedAssetId: string | null
  approvedBy: string | null
  approvedAt: string | null
}

const DESCRIPTION_MAX = 200
const NOTE_MAX = 80

export const CHARACTER_ERRORS = {
  description: `Describe the character in 1 to ${DESCRIPTION_MAX} characters.`,
  view: 'Unknown view.',
  plan: 'Plan the character first.',
  note: `Keep the note to ${NOTE_MAX} characters.`,
  draw: 'Draw the character first.',
  failed: 'Could not draw the sheet. Try again.',
  dailyLimit: 'Daily image limit reached',
} as const

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const ofComics = eq(comicCharacter.brandId, COMICS_BRAND_ID)

/** A row written by this module, still read through a schema. */
const ViewsSchema = z.array(z.object({ label: z.string(), scene: z.string() }))

async function load() {
  const [row] = await db.select().from(comicCharacter).where(ofComics).limit(1)
  return row ?? null
}

/** The Comics page's character, or null when none has been planned. */
export async function characterOf(): Promise<Character | null> {
  const row = await load()
  if (!row) return null
  const views = ViewsSchema.safeParse(row.views)
  return {
    description: row.description,
    views: views.success ? views.data : [],
    sheetAssetId: row.sheetAssetId,
    sheetNote: row.sheetNote,
    approvedAssetId: row.approvedAssetId,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
  }
}

/** Why the description cannot be used, or null: 1 to 200 characters the art prompt guard passes. */
function descriptionError(description: string): string | null {
  if (description === '' || charCount(description) > DESCRIPTION_MAX) {
    return CHARACTER_ERRORS.description
  }
  return artPromptError(description)
}

/**
 * "Plan the sheet": the views Gemini plans from the description, saved as the character with no
 * sheet yet. The approved sheet stays usable until another is approved.
 */
export async function planCharacter(
  actor: Actor,
  input: { description: string },
): Promise<ActionResult> {
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  const description = input.description.trim()
  const error = descriptionError(description)
  if (error) return fail(error)
  const planned = await planViews({ description })
  if (!planned.ok) return fail(planned.error)
  try {
    const row = {
      description,
      views: planned.views,
      sheetAssetId: null,
      sheetNote: null,
      updatedBy: actor.id,
      updatedAt: new Date(),
    }
    await db
      .insert(comicCharacter)
      .values({ brandId: COMICS_BRAND_ID, ...row })
      .onConflictDoUpdate({ target: comicCharacter.brandId, set: row })
    return { ok: true }
  } catch (err) {
    console.error('[content.character.plan]', err)
    return fail(DB_ERROR)
  }
}

/** One view's label and scene as the editor left them. */
export async function editCharacterView(
  actor: Actor,
  input: { index: number; label: string; scene: string },
): Promise<ActionResult> {
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  const label = input.label.trim()
  const scene = input.scene.trim()
  const error = labelError(label) ?? sceneError(scene)
  if (error) return fail(`View ${input.index + 1}: ${error}`)
  try {
    const character = await characterOf()
    if (!character) return fail(CHARACTER_ERRORS.plan)
    if (!Number.isInteger(input.index) || !character.views[input.index]) {
      return fail(CHARACTER_ERRORS.view)
    }
    const views = character.views.map((v, i) => (i === input.index ? { label, scene } : v))
    await db
      .update(comicCharacter)
      .set({ views, updatedBy: actor.id, updatedAt: new Date() })
      .where(ofComics)
    return { ok: true }
  } catch (err) {
    console.error('[content.character.editView]', err)
    return fail(DB_ERROR)
  }
}

/**
 * "Draw the sheet", or "Redraw with a note": one square image of every view, in the Comics page's
 * art style with its reference images, stored as the latest sheet with the note it was drawn with.
 * Each draw is keyed by the row's last change, so pressing it again draws a new sheet.
 */
export async function drawCharacter(
  actor: Actor,
  input: { note: string | null },
): Promise<ActionResult> {
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  const note = input.note?.trim() || null
  if (note !== null) {
    if (charCount(note) > NOTE_MAX) return fail(CHARACTER_ERRORS.note)
    const error = artPromptError(note)
    if (error) return fail(error)
  }
  try {
    const [row, design] = await Promise.all([load(), designLanguageOf(COMICS_BRAND_ID)])
    const views = ViewsSchema.safeParse(row?.views)
    if (!row || !views.success || views.data.length === 0) return fail(CHARACTER_ERRORS.plan)
    const res = await coverArt(
      {
        prompt: sheetPrompt({
          views: views.data,
          description: row.description,
          note,
          artStyle: design?.artStyle ?? DEFAULT_COMIC_STYLE,
        }),
        demoKey: null,
        postId: COMICS_BRAND_ID,
        set: row.updatedAt.getTime(),
        references: design?.references ?? [],
        aspectRatio: '1:1',
      },
      artDeps,
    )
    if (!res.ok) return fail(res.error)
    const { bytes, fallback } = res.art
    if (!bytes) {
      return fail(
        fallback === 'daily_limit' ? CHARACTER_ERRORS.dailyLimit : CHARACTER_ERRORS.failed,
      )
    }
    const sheetAssetId = await putAsset(null, bytes, artMime(bytes))
    await db
      .update(comicCharacter)
      .set({ sheetAssetId, sheetNote: note, updatedBy: actor.id, updatedAt: new Date() })
      .where(ofComics)
    return { ok: true }
  } catch (err) {
    console.error('[content.character.draw]', err)
    return fail(DB_ERROR)
  }
}

/** "Approve this character": the latest sheet becomes the one panels are drawn with (RC10). */
export async function approveCharacter(actor: Actor): Promise<ActionResult> {
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  try {
    const approved = await db
      .update(comicCharacter)
      .set({
        approvedAssetId: sql`${comicCharacter.sheetAssetId}`,
        approvedBy: actor.id,
        approvedAt: new Date(),
      })
      .where(and(ofComics, isNotNull(comicCharacter.sheetAssetId)))
      .returning({ brandId: comicCharacter.brandId })
    return approved.length > 0 ? { ok: true } : fail(CHARACTER_ERRORS.draw)
  } catch (err) {
    console.error('[content.character.approve]', err)
    return fail(DB_ERROR)
  }
}
