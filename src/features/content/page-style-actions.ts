'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ACCESS_ERRORS } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import { PAGE_STYLE_ERRORS, REFERENCE_MAX_BYTES, REFERENCES_MAX } from './lib/page-style'
import { describePageStyle, savePageStyle, uploadReference } from './server/page-style'

// The Page styles screen's actions (criterion 105). Each reads the actor from the session (the
// proxy and the layout only hide the page), keeps the browser's values to their types, and hands
// both to server/page-style.ts, which applies the access rule (editors and superadmins), checks
// each image by its bytes and each field by its rules. Nothing here throws: a failure is a message.

const PAGE_STYLES_PATH = '/admin/page-styles'

const Brand = z.string().max(64)
const AssetIds = z.array(z.string().min(1).max(128)).min(1).max(REFERENCES_MAX)
// The module applies the field rules; this only keeps the browser's values to their types.
const SaveInput = z.object({
  brandId: Brand,
  artStyle: z.string().max(10_000),
  copyStyle: z.string().max(10_000),
  closestTemplateId: z.string().max(64),
  referenceAssetIds: AssetIds,
})

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

/**
 * One reference image for a page, as form data (`brandId`, `file`). Only the file's bytes are
 * read, and only when it is at most 5 MB; its name and type are the browser's and never trusted.
 */
export async function uploadReferenceAction(
  data: unknown,
): Promise<ActionResult<{ assetId: string }>> {
  return asActor(async (actor) => {
    if (!(data instanceof FormData)) return fail(PAGE_STYLE_ERRORS.type)
    const brandId = Brand.safeParse(data.get('brandId'))
    const file = data.get('file')
    if (!(file instanceof Blob)) return fail(PAGE_STYLE_ERRORS.type)
    if (file.size > REFERENCE_MAX_BYTES) return fail(PAGE_STYLE_ERRORS.size)
    if (!brandId.success) return fail(PAGE_STYLE_ERRORS.brand)
    return uploadReference(actor, brandId.data, new Uint8Array(await file.arrayBuffer()))
  })
}

/** "Describe the style": the page's uploaded images read into the three fields, nothing saved. */
export async function describePageStyleAction(
  brandId: unknown,
  referenceAssetIds: unknown,
): ReturnType<typeof describePageStyle> {
  return asActor(async (actor) => {
    const brand = Brand.safeParse(brandId)
    if (!brand.success) return fail(PAGE_STYLE_ERRORS.brand)
    const ids = AssetIds.safeParse(referenceAssetIds)
    if (!ids.success) return fail(PAGE_STYLE_ERRORS.images)
    return describePageStyle(actor, brand.data, ids.data)
  })
}

/** "Save": the page's design language as the editor left it; the screen is refreshed. */
export async function savePageStyleAction(input: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const parsed = SaveInput.safeParse(input)
    if (!parsed.success) return fail(PAGE_STYLE_ERRORS.fields)
    const result = await savePageStyle(actor, parsed.data)
    if (result.ok) revalidatePath(PAGE_STYLES_PATH)
    return result
  })
}
