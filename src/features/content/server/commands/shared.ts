import 'server-only'
import { z } from 'zod'
import { db } from '@/shared/lib/db'
import type { ActionResult } from '@/shared/types/action-result'
import type { ArtDeps } from '../../ai/art'
import { dbCache } from '../../ai/cache'
import { layoutStructure, paragraphSites } from '../../layout/engine'
import { fitChecks } from '../../layout/fit'
import { renderSlides } from '../../layout/render'
import { slideColours } from '../../layout/svg'
import { type EditMove, editNote } from '../../lib/back-summary'
import { searchTitleOf } from '../../lib/comic-rules'
import { postSources } from '../../lib/sites'
import {
  actionError,
  editHome,
  kindError,
  type PostAction,
  stepRunningError,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import type { Body, Pointers } from '../../model/artifacts'
import { current } from '../../model/current'
import type { Stage } from '../../model/stages'
import type { LaidSlide, PersonStamp, SlideArt, SourcesAt } from '../../model/types'
import { isLook } from '../../templates'
import { runningSteps } from '../steps'
import {
  changedBy,
  getAsset,
  getAssets,
  type LoadedPost,
  loadPost,
  putArtifact,
  putAsset,
  savePointers,
} from '../store'

// Every feed-post command. Each takes its actor explicitly (../actions.ts reads it from the
// session) and, in order: loads the post, applies lib/workflow.ts's rule for the action at the
// post's stage, checks the step's precondition, runs a model step under the step lock, and writes
// its new records and the post's pointers in one transaction, so a save refused as stale leaves
// no record behind. Records are never edited, only added. No transaction is held across a model
// call. Nothing here throws: a failure is a message.
//
// This module holds what every stage shares: opening a post under the workflow rules, saving
// records and pointers in one transaction, and drawing and storing a render. Each stage's
// commands are in its own module beside it; ./index.ts re-exports them.

/** The account acting: a Staff read from the session, with its id and name. */
export type Actor = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }
/** A saved command; an edit that moved the post back by itself says what will be made again (GD28). */
export type Saved = ActionResult<{ id: string; version: number; note?: string }>

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type Next = { stage: Stage; pointers: Pointers }

export const UNKNOWN = 'Unknown post.'
export const DB_ERROR = 'Could not save. Please try again.'
const ART_MODEL_VERSION = 'image.v1'

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

// Thrown inside a transaction to roll it back, then turned into its message.
export class Refused extends Error {}

/**
 * Everything made from the revision on, in pointer order; the post's social target stays, and so
 * does a reviewer's request for changes, until the post is sent to review again (criterion 120).
 */
const FROM_REVISION = [
  'revisionId',
  'layoutId',
  'renderId',
  'coversId',
  'sourceCheckId',
  'visionId',
  'overrideId',
  'settingsId',
  'approvalId',
  'marketId',
  'marketVisionId',
  'marketOverrideId',
  'captionId',
  'exportId',
  'socialLinkId',
] as const satisfies readonly (keyof Pointers)[]

export function clearFromRevision(pointers: Pointers): Pointers {
  const next = { ...pointers }
  for (const key of FROM_REVISION) next[key] = null
  return next
}

/**
 * Everything from the revision on cleared, the approval with it; a request for changes stays.
 * The source check stays named, so the picked version's own check reads from it.
 */
export const fromRevisionCleared = (post: LoadedPost): Pointers => ({
  ...clearFromRevision(post.pointers),
  sourceCheckId: post.pointers.sourceCheckId,
})

/** Why a move waits while a step of the post runs, naming the step; null when none does. */
export async function waitingFor(id: string): Promise<string | null> {
  const [running] = await runningSteps(id)
  return running === undefined ? null : stepRunningError(running)
}

/**
 * The post as an edit at a passed step sees it (GD28): moved back to the edit's home the way the
 * moves back move it (./back.ts). To the source or the text versions, everything from the
 * revision on is cleared; to the images, only the approval, as withdrawing keeps the rest. The
 * command's one save then lands it there with the edit. A live post's published version is not
 * touched, so students keep it until the next publish (criterion 116).
 */
function movedBack(post: LoadedPost, home: Stage): LoadedPost {
  const pointers =
    home === 'source' || home === 'structures'
      ? fromRevisionCleared(post)
      : { ...post.pointers, approvalId: null }
  return { ...post, stage: home, pointers, current: current(pointers, post.records) }
}

/** Whether the post's text is a look's (GD4): its approved revision's, else its picked version's. */
function isLookPost(post: LoadedPost): boolean {
  const { revision, drafts } = post.current
  const template =
    revision?.body.template ?? drafts?.body.items[post.pointers.picked ?? -1]?.template
  return template !== undefined && isLook(template)
}

/** Actions that run on a social version (./social.ts); every other action runs on a feed post only. */
const SOCIAL_ACTIONS: readonly PostAction[] = [
  'socialApproveLayout',
  'socialRender',
  'socialCaption',
  'socialCheck',
  'socialReset',
  'socialExport',
  'socialLink',
]

export const stamp = (actor: Actor): PersonStamp => ({
  userId: actor.id,
  name: actor.name,
  at: new Date().toISOString(),
})

/** Runs a command, turning a refusal into its message and any other failure into DB_ERROR. */
export async function attempt(name: string, work: () => Promise<Saved>): Promise<Saved> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof Refused) return fail(err.message)
    console.error(`[content.commands.${name}]`, err)
    return fail(DB_ERROR)
  }
}

type Opened = { ok: true; post: LoadedPost; moved: EditMove | null } | { ok: false; error: string }

/**
 * Steps 1 and 2: the post, the workflow rule for the action at its stage and the post's kind, and
 * a version not yet moved past. An edit at a passed step (GD28) gets the post moved back to the
 * edit's home, refused while a step of the post runs, naming it (criterion 118); `moved` says
 * from where.
 */
export async function open(
  actor: Actor,
  action: PostAction,
  id: string,
  version: number,
): Promise<Opened> {
  const post = await loadPost(id)
  if (!post) return fail(UNKNOWN)
  const error = actionError(action, actor, post.stage)
  if (error) return fail(error)
  if ((post.kind === 'social') !== SOCIAL_ACTIONS.includes(action)) {
    return fail(WORKFLOW_ERRORS.movedOn)
  }
  // A blog's text steps are its own, and a feed post's slide steps are not a blog's (BR1–BR3).
  const kind = kindError(action, post.kind)
  if (kind) return fail(kind)
  // Refused before any model call is spent on a copy someone has already changed.
  if (post.version !== version) return fail(changedBy(post.updatedByName))
  const home = editHome(action, post.stage)
  if (home === null) return { ok: true, post, moved: null }
  const waiting = await waitingFor(id)
  if (waiting) return fail(waiting)
  const moved = { from: post.stage, to: home, look: isLookPost(post) }
  return { ok: true, post: movedBack(post, home), moved }
}

/** Step 5: the command's new records and the post's pointers, in one transaction. */
export async function save(
  post: LoadedPost,
  version: number,
  actor: Actor,
  write: (tx: Tx) => Promise<Next>,
): Promise<Saved> {
  const saved = await db.transaction(async (tx) => {
    const next = await write(tx)
    // A source check that landed while the command worked stays, unless it set its own.
    const keepSourceCheck = next.pointers.sourceCheckId === post.pointers.sourceCheckId
    const result = await savePointers(tx, post.id, version, next, actor.id, { keepSourceCheck })
    if (!result.ok) throw new Refused(result.error)
    return result.version
  })
  return { ok: true, id: post.id, version: saved }
}

/**
 * Opens the post, then runs the command's own checks and writes. An edit that moved the post back
 * and saved says what will be made again (GD28); one that saved nothing moved nothing.
 */
export function command(
  name: string,
  action: PostAction,
  actor: Actor,
  id: string,
  version: number,
  body: (post: LoadedPost) => Promise<Saved>,
): Promise<Saved> {
  return attempt(name, async () => {
    const opened = await open(actor, action, id, version)
    if (!opened.ok) return opened
    const saved = await body(opened.post)
    const { moved } = opened
    return moved && saved.ok && saved.version !== version
      ? { ...saved, note: editNote(moved) }
      : saved
  })
}

export function artMime(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }
  return 'image/png'
}

const ArtCacheSchema = z.object({ assetId: z.string() })

/** Art by its cache key: the ai_cache row names a content_asset, which holds the bytes. */
export const artDeps: ArtDeps = {
  async cached(key) {
    const hit = ArtCacheSchema.safeParse(await dbCache.get(key))
    if (!hit.success) return null
    return (await getAsset(hit.data.assetId))?.bytes ?? null
  },
  async remember(key, bytes) {
    const assetId = await putAsset(null, bytes, artMime(bytes))
    await dbCache.put(key, {
      useCase: 'art',
      model: process.env.GEMINI_IMAGE_MODEL ?? '',
      promptVersion: ART_MODEL_VERSION,
      value: { assetId },
    })
  },
}

export type Drawn = { slides: { svg: Uint8Array; png: Uint8Array }[] }

/** A slide's image as drawn: its record entry, with the bytes stored for it in place of the asset id. */
export type SlideImage = Omit<SlideArt, 'assetId'> & { bytes: Uint8Array | null }

/**
 * A look render's images with their bytes (GD12): an image per art box by slide number, and for
 * a panorama (Postcard, GD4) the one wide image, null when it could not be drawn. The one shape
 * every redraw of a look post carries from its render into the next, so no picture is dropped.
 */
export type RenderImages = { slideArt: SlideImage[]; panorama?: Uint8Array | null }

/** The render's images with their bytes, read in one query; null for a render drawn with its single art. */
export async function imagesOf(render: Body<'render'>): Promise<RenderImages | null> {
  if (!render.slideArt) return null
  const ids = [...render.slideArt.map((a) => a.assetId), render.panorama?.assetId ?? null]
  const assets = await getAssets(ids.filter((id): id is string => id !== null))
  const bytes = (id: string | null) => (id ? (assets.get(id)?.bytes ?? null) : null)
  return {
    slideArt: render.slideArt.map(({ assetId, ...a }) => ({ ...a, bytes: bytes(assetId) })),
    ...(render.panorama !== undefined && { panorama: bytes(render.panorama?.assetId ?? null) }),
  }
}

/**
 * The images after the slides moved: `from[i]` is the index the slide now at index i came from,
 * so each image goes with its slide. A panorama runs across the slides wherever they are.
 */
export function movedImages(images: RenderImages, from: number[]): RenderImages {
  if (images.panorama !== undefined) return images
  const slideArt = images.slideArt
    .map((a) => ({ ...a, slide: from.indexOf(a.slide - 1) + 1 }))
    .filter((a) => a.slide > 0)
    .sort((a, b) => a.slide - b.slide)
  return { ...images, slideArt }
}

/** The images with one slide's replaced; for a panorama, slide 1's image is the wide one. */
export function withSlideImage(images: RenderImages, image: SlideImage): RenderImages {
  const slideArt = images.slideArt.map((a) => (a.slide === image.slide ? image : a))
  if (images.panorama === undefined || image.slide !== 1) return { ...images, slideArt }
  return { slideArt, panorama: image.bytes }
}

/**
 * The layout drawn with its art (and a market's rate lines), encoded for storage. CPU only: run
 * before the transaction. A look's `images` (GD12, GD4) take the place of the single `art`: an
 * image per slide by its number, or the one panorama across them. A look draws in its preset's
 * surfaces with its art tinted (GD9, GD16).
 */
export function draw(
  revision: Body<'revision'>,
  layout: { slides: LaidSlide[] },
  art: Uint8Array | null,
  rateLines?: Record<number, string>,
  images?: RenderImages | null,
): Drawn {
  const wide = images?.panorama
  const arts =
    images && wide === undefined
      ? layout.slides.map((_, i) => images.slideArt.find((a) => a.slide === i + 1)?.bytes ?? null)
      : undefined
  const colours = slideColours({
    template: revision.template,
    brand: revision.brand,
    themeId: revision.themeId,
  })
  if (!colours) throw new Error(`Theme ${revision.themeId} is not in the revision's brand`)
  const { svgs, pngs } = renderSlides({
    layout: layout.slides,
    ...colours,
    brand: revision.brand,
    art,
    arts,
    panorama: wide,
    rateLines,
  })
  const encoder = new TextEncoder()
  return { slides: svgs.map((svg, i) => ({ svg: encoder.encode(svg), png: pngs[i] })) }
}

/** Stores each drawn slide's SVG and PNG; the same bytes again are the same rows. */
export async function putSlides(tx: Tx, drawn: Drawn): Promise<Body<'render'>['slides']> {
  const slides: Body<'render'>['slides'] = []
  for (const slide of drawn.slides) {
    slides.push({
      svgAssetId: await putAsset(tx, slide.svg, 'image/svg+xml'),
      pngAssetId: await putAsset(tx, slide.png, 'image/png'),
    })
  }
  return slides
}

/**
 * Stores the drawn slides and the art, and the render record that names them. A look's render
 * also names its `images`: one per art box (`slideArt`) and, for a panorama, the wide one.
 */
export async function putRender(
  tx: Tx,
  post: LoadedPost,
  actor: Actor,
  input: {
    revisionId: string
    layoutId: string
    drawn: Drawn
    art: {
      bytes: Uint8Array | null
      prompt: string
      version: number
      fallback: Body<'render'>['art']['fallback']
    }
    images?: RenderImages | null
  },
): Promise<string> {
  const { revisionId, layoutId, drawn, art, images } = input
  const panorama = images?.panorama
  const slides = await putSlides(tx, drawn)
  const assetId = art.bytes ? await putAsset(tx, art.bytes, artMime(art.bytes)) : null
  const stored = async (bytes: Uint8Array | null) =>
    bytes ? await putAsset(tx, bytes, artMime(bytes)) : null
  let slideArt: SlideArt[] | undefined
  if (images) {
    slideArt = []
    for (const { bytes, ...image } of images.slideArt) {
      slideArt.push({ ...image, assetId: await stored(bytes) })
    }
  }
  const wide = panorama === undefined ? undefined : await stored(panorama)
  return putArtifact(tx, {
    kind: 'render',
    postId: post.id,
    actorId: actor.id,
    body: {
      revisionId,
      layoutId,
      art: { assetId, prompt: art.prompt, version: art.version, fallback: art.fallback },
      slides,
      ...(slideArt && { slideArt }),
      ...(wide !== undefined && { panorama: wide ? { assetId: wide } : null }),
      // The page is chosen only before approval, so a look's images were drawn for this one.
      ...(images && { pageBrandId: post.pointers.pageBrandId ?? null }),
    },
  })
}

/** Stores the revision under the id its layout already names; any other id would orphan the layout. */
export async function putRevision(
  tx: Tx,
  postId: string,
  body: Body<'revision'>,
  expectedId: string,
  actor: Actor,
): Promise<void> {
  const stored = await putArtifact(tx, { kind: 'revision', postId, body, actorId: actor.id })
  if (stored !== expectedId) throw new Error('The stored revision id differs from its layout')
}

/** Where the post's saved settings put its sources (GD31): the caption until they are saved. */
export const sourcesAtOf = (post: LoadedPost): SourcesAt =>
  post.current.settings?.body.sourcesAt ?? 'caption'

/**
 * The layout body for a revision: the same engine and inputs as the draft's preview, a look's
 * contrast checked on its preset's surfaces (GD9), its sources where the post's settings put
 * them (GD31; the caption until settings are saved), its search line naming the post's title
 * when it is a comic (searchTitleOf, RC7), its fixed lines in the post's language (GD39).
 */
export function layoutOf(
  revisionId: string,
  revision: Body<'revision'>,
  source: Body<'source'>,
  facts: Body<'facts'>,
  sourcesAt: SourcesAt,
  post: { courseId: string | null; title: string },
): Body<'layout'> {
  const colours = slideColours({
    template: revision.template,
    brand: revision.brand,
    themeId: revision.themeId,
  })
  if (!colours) throw new Error(`Theme ${revision.themeId} is not in the revision's brand`)
  const laid = layoutStructure({
    structure: revision.structure,
    template: revision.template,
    brand: revision.brand,
    sourceTitle: source.title,
    title: searchTitleOf(post, source.title),
    sourceSite: source.site,
    sites: paragraphSites(source),
    facts: facts.facts,
    sourcesAt,
    sources: postSources(source),
    language: source.language,
  })
  const checks = fitChecks({
    structure: revision.structure,
    template: revision.template,
    theme: colours.theme,
    surfaces: colours.surfaces,
    brand: revision.brand,
    layout: laid,
  })
  return { revisionId, slides: laid.slides, fits: laid.fits, fitChecks: checks }
}
