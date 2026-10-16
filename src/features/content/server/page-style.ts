import 'server-only'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { canEdit, type Staff } from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import { pageStyle, user } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import type { StyleReference } from '../ai/art'
import { type DesignFields, describeDesign } from '../ai/design-language'
import { artPromptError } from '../ai/draft'
import { isPageBrand, PAGE_BRANDS } from '../brands'
import {
  PAGE_STYLE_ERRORS,
  REFERENCE_MAX_BYTES,
  REFERENCES_MAX,
  type ReferenceType,
  STYLE_MAX,
} from '../lib/page-style'
import { WORKFLOW_ERRORS } from '../lib/workflow'
import { templateById } from '../templates'
import { DB_ERROR } from './commands/shared'
import { getAssets, putAsset } from './store'

// A page brand's design language (criterion 105): one or two reference images, read once by a
// model into an art style, a copy style and the closest template, which an editor edits and
// saves. Mutable settings, one row per page brand (the page_style table): a save replaces the row.
// Editors and superadmins write (canEdit); everyone who may see the Board reads. Every input is a
// claim: the brand is looked up in the registry, an image's type is read from its bytes, never
// from the browser, and an asset id must name a stored PNG or JPEG.

type Actor = Staff & { id: string }

/** A page's saved design language, as the screen and the prompt builders read it. */
export type PageStyle = {
  brandId: string
  artStyle: string
  copyStyle: string
  closestTemplateId: string
  referenceAssetIds: string[]
  updatedAt: string
  updatedByName: string | null
}

/** What a draft and a cover take from a page's design language: its styles and its images. */
export type DesignLanguage = {
  artStyle: string
  copyStyle: string
  references: StyleReference[]
}

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

const isPage = isPageBrand

/** The image's type from its first bytes: a PNG or a JPEG, else null. */
export function referenceType(bytes: Uint8Array): ReferenceType | null {
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= PNG.length && PNG.every((b, i) => bytes[i] === b)) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

/** The saved rows, with who saved each: all of them, or one brand's. One row per brand, so the registry bounds it. */
async function selectStyles(brandId?: string): Promise<PageStyle[]> {
  const rows = await db
    .select({
      brandId: pageStyle.brandId,
      artStyle: pageStyle.artStyle,
      copyStyle: pageStyle.copyStyle,
      closestTemplateId: pageStyle.closestTemplateId,
      referenceAssetIds: pageStyle.referenceAssetIds,
      updatedAt: pageStyle.updatedAt,
      updatedByName: user.name,
    })
    .from(pageStyle)
    .leftJoin(user, eq(user.id, pageStyle.updatedByUserId))
    .where(brandId === undefined ? undefined : eq(pageStyle.brandId, brandId))
    .limit(PAGE_BRANDS.length)
  return rows
    .filter((r) => isPage(r.brandId))
    .map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))
}

/** Every page's saved design language, by brand id; a page with none is absent (Task 57: "pages that have one"). */
export async function pageStyles(): Promise<Map<string, PageStyle>> {
  return new Map((await selectStyles()).map((s) => [s.brandId, s]))
}

/** One page's saved design language, or null: no page, a brand that is not a page, or none saved. */
export async function pageStyleOf(brandId: string | null): Promise<PageStyle | null> {
  if (!isPage(brandId)) return null
  return (await selectStyles(brandId))[0] ?? null
}

/** The stored PNG and JPEG images among these ids, in their order; any other id is left out. */
async function references(ids: string[]): Promise<StyleReference[]> {
  const assets = await getAssets(ids)
  return ids.flatMap((assetId) => {
    const asset = assets.get(assetId)
    const mime = asset ? referenceType(asset.bytes) : null
    if (!asset || !mime || asset.bytes.length > REFERENCE_MAX_BYTES) return []
    return [{ assetId, mime, bytes: asset.bytes }]
  })
}

/**
 * The design language a draft or a cover on this page follows, with its reference images' bytes,
 * or null when the page has none (or there is no page): then everything is as it always was.
 */
export async function designLanguageOf(brandId: string | null): Promise<DesignLanguage | null> {
  const style = await pageStyleOf(brandId)
  return style ? designLanguageFor(style) : null
}

/** A saved style with its reference images' bytes, read in one query. */
export async function designLanguageFor(style: PageStyle): Promise<DesignLanguage> {
  return {
    artStyle: style.artStyle,
    copyStyle: style.copyStyle,
    references: await references(style.referenceAssetIds),
  }
}

/**
 * One reference image for a page, stored as a content asset (criterion 105): a PNG or a JPEG by
 * its bytes, up to 5 MB. The browser's file name and type are never read.
 */
export async function uploadReference(
  actor: Actor,
  brandId: string,
  bytes: Uint8Array,
): Promise<ActionResult<{ assetId: string }>> {
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  if (!isPage(brandId)) return fail(PAGE_STYLE_ERRORS.brand)
  const mime = referenceType(bytes)
  if (!mime) return fail(PAGE_STYLE_ERRORS.type)
  if (bytes.length > REFERENCE_MAX_BYTES) return fail(PAGE_STYLE_ERRORS.size)
  try {
    return { ok: true, assetId: await putAsset(null, bytes, mime) }
  } catch (err) {
    console.error('[content.pageStyle.upload]', err)
    return fail(DB_ERROR)
  }
}

/** One or two distinct ids, each a stored PNG or JPEG; null when any is not. */
async function checkedReferences(ids: string[]): Promise<StyleReference[] | null> {
  if (ids.length < 1 || ids.length > REFERENCES_MAX || new Set(ids).size !== ids.length) {
    return null
  }
  const found = await references(ids)
  return found.length === ids.length ? found : null
}

/**
 * "Describe the style": the page's reference images read by the model into the three fields, for
 * the editor to edit (criterion 105). Nothing is saved here.
 */
export async function describePageStyle(
  actor: Actor,
  brandId: string,
  referenceAssetIds: string[],
): Promise<ActionResult<{ fields: DesignFields }>> {
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  const brand = PAGE_BRANDS.find((b) => b.id === brandId)
  if (!brand) return fail(PAGE_STYLE_ERRORS.brand)
  try {
    const images = await checkedReferences(referenceAssetIds)
    if (!images) return fail(PAGE_STYLE_ERRORS.images)
    const res = await describeDesign({ brand, images })
    return res.ok ? { ok: true, fields: res.value } : fail(res.error)
  } catch (err) {
    console.error('[content.pageStyle.describe]', err)
    return fail(DB_ERROR)
  }
}

const Field = z.string().trim().min(1).max(STYLE_MAX)
const FieldsSchema = z.object({
  artStyle: Field,
  copyStyle: Field,
  closestTemplateId: z.string().refine((id) => templateById(id) !== null),
})

/**
 * Saves the page's design language as the editor left it (criterion 105), replacing what it had.
 * The art style reaches every cover prompt on the page, so it passes the art prompt guard.
 */
export async function savePageStyle(
  actor: Actor,
  input: {
    brandId: string
    artStyle: string
    copyStyle: string
    closestTemplateId: string
    referenceAssetIds: string[]
  },
): Promise<ActionResult> {
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  if (!isPage(input.brandId)) return fail(PAGE_STYLE_ERRORS.brand)
  const fields = FieldsSchema.safeParse(input)
  if (!fields.success) return fail(PAGE_STYLE_ERRORS.fields)
  if (artPromptError(fields.data.artStyle)) return fail(PAGE_STYLE_ERRORS.artStyle)
  try {
    if (!(await checkedReferences(input.referenceAssetIds))) return fail(PAGE_STYLE_ERRORS.images)
    const row = {
      ...fields.data,
      referenceAssetIds: [...input.referenceAssetIds],
      updatedByUserId: actor.id,
      updatedAt: new Date(),
    }
    await db
      .insert(pageStyle)
      .values({ brandId: input.brandId, ...row })
      .onConflictDoUpdate({ target: pageStyle.brandId, set: row })
    return { ok: true }
  } catch (err) {
    console.error('[content.pageStyle.save]', err)
    return fail(DB_ERROR)
  }
}
