import 'server-only'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/shared/lib/db'
import { contentArtifact } from '@/shared/lib/db/schema'
import {
  coverArt,
  type ImageAspect,
  imageAspect,
  type StyleReference,
  slidePrompt,
} from '../../ai/art'
import { AI_ERRORS, IMAGE_TIMEOUT_MS } from '../../ai/client'
import { ART_PROMPT_ERROR, artPromptError } from '../../ai/draft'
import { type PlannedScene, planBlogScenes, planScenes, SCENE_MAX } from '../../ai/scene-plan'
import { DEFAULT_COMIC_STYLE } from '../../brands'
import type { Preset } from '../../brands/guideline'
import { tintedPng } from '../../layout/png'
import { blogAspect, blogPictureTargets, embeddedAt } from '../../lib/blog-pictures'
import { renderError, stepRunningError, WORKFLOW_ERRORS } from '../../lib/workflow'
import type { Body } from '../../model/artifacts'
import type { BlogEmbed, BlogTarget, Slide } from '../../model/types'
import { imageNudge } from '../../nudges'
import { artSlides, COMIC_TEMPLATE_ID, isLook, isPanorama } from '../../templates'
import { charCount } from '../../text/script'
import { characterOf } from '../character'
import { drawBudget } from '../draw-budget'
import { canonicalJson } from '../hash'
import { type DesignLanguage, designLanguageOf, referenceType } from '../page-style'
import { runStep, runStepAfter, type StepRun } from '../steps'
import { bodyOf, getAssets, type LoadedPost, listSlideArt, putArtifact, putAsset } from '../store'
import {
  type Actor,
  artDeps,
  artMime,
  attempt,
  command,
  draw,
  fail,
  imagesOf,
  putRender,
  type RenderImages,
  type Saved,
  type SlideImage,
  save,
  withSlideImage,
} from './shared'

// A look post's images (GD12–GD14): planned in words, a scene per art box (one wide scene for
// Postcard's panorama), the scenes edited in place, then drawn one image per planned slide, which
// renders the post. At the daily image limit the images drawn so far are kept and the rest wait
// for "Draw remaining". A drawn image is nudged on its own, as another take. Posts in an old
// template keep "Make covers" (./render.ts), and these commands refuse them as moved on.
//
// A blog's pictures (BR4) go the same way, planned for its approved text: a 16:9 cover and up to
// three 4:3 pictures between sections (lib/blog-pictures.ts), drawn, resumed and nudged as a look's
// are, and stored as a blog_images record rather than a render, since a blog has no slides. Each
// is kept beside a copy tinted to the palette (GD16), which the blog shows. A spot where a linked
// post's slides are embedded (./blog.ts embedPostSlides) is not drawn.
//
// A comic's panels (RC6, RC10) are a look's images: planned from its storyboard's own scenes with
// no model call, then drawn, resumed, nudged and kept as any look's are, each with the Comics
// page's approved character sheet as its first reference image. With no sheet approved, drawing
// is refused.

/** The steps these commands run as: their locks, and what the page shows running (lib/running.ts). */
const PLAN_STEP = 'scene_plan'
const IMAGES_STEP = 'images'

type Look = {
  revision: NonNullable<LoadedPost['current']['revision']>
  layout: NonNullable<LoadedPost['current']['layout']>
}

/** The post's revision and layout when they are a look's; null for an old template or a post moved on. */
function lookOf(post: LoadedPost): Look | null {
  const { revision, layout } = post.current
  return revision && layout && isLook(revision.body.template) ? { revision, layout } : null
}

/** A blog's approved text, which its pictures are planned for (BR4); null for a post, or a blog moved on. */
function blogTextOf(post: LoadedPost): LoadedPost['current']['blogText'] {
  return post.kind === 'blog' ? post.current.blogText : null
}

/** Whether the post has images to plan: a look's slides, or a blog's text. */
const pictured = (post: LoadedPost): boolean => lookOf(post) !== null || blogTextOf(post) !== null

/** Whether the look is a comic's (RC2): its panels drawn with the character sheet. */
const isComic = (look: Look): boolean => look.revision.body.template.id === COMIC_TEMPLATE_ID

/**
 * The Comics page's approved character sheet (RC9), as the image reference a comic's panels are
 * drawn with (RC6); null when none is approved (RC10), or its image is not a PNG or a JPEG.
 */
async function approvedSheet(): Promise<StyleReference | null> {
  const assetId = (await characterOf())?.approvedAssetId
  if (!assetId) return null
  const bytes = (await getAssets([assetId])).get(assetId)?.bytes
  const mime = bytes ? referenceType(bytes) : null
  return bytes && mime ? { assetId, mime, bytes } : null
}

/**
 * What the look's pictures are drawn with: for a comic, its approved character sheet; null for any
 * other look. False for a comic with no sheet approved, which is refused (RC10).
 */
async function sheetFor(look: Look): Promise<StyleReference | null | false> {
  if (!isComic(look)) return null
  return (await approvedSheet()) ?? false
}

/** A new image plan for the revision, as the post's current one. */
function savePlan(
  post: LoadedPost,
  version: number,
  actor: Actor,
  plan: Body<'art_plan'>,
): Promise<Saved> {
  return save(post, version, actor, async (tx) => {
    const artPlanId = await putArtifact(tx, {
      kind: 'art_plan',
      postId: post.id,
      actorId: actor.id,
      body: plan,
    })
    return { stage: post.stage, pointers: { ...post.pointers, artPlanId } }
  })
}

/** A planned scene that keeps the picture drawn for the same slide text before (story 14). */
type KeptScene = PlannedScene & { assetId: string }

/**
 * The newest render of an earlier revision of the post that has a drawn picture, in the same look
 * and emotion and drawn for the same page, with that revision's text (story 14). Renders that do
 * not name their page (before 13 Oct 2026) are not reused, since the page may have changed since.
 * One query over the post's records (content_artifact_post_id_idx); null when none match.
 */
async function earlierPictures(
  postId: string,
  revision: Look['revision'],
  pageBrandId: string | null,
): Promise<{ slides: Slide[]; slideArt: NonNullable<Body<'render'>['slideArt']> } | null> {
  const made = alias(contentArtifact, 'made_for')
  const asJson = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`
  const [row] = await db
    .select({
      id: contentArtifact.id,
      body: contentArtifact.body,
      revisionId: made.id,
      revision: made.body,
    })
    .from(contentArtifact)
    .innerJoin(
      made,
      and(
        eq(made.postId, contentArtifact.postId),
        eq(made.kind, 'revision'),
        eq(made.id, sql`${contentArtifact.body}->>'revisionId'`),
      ),
    )
    .where(
      and(
        eq(contentArtifact.postId, postId),
        eq(contentArtifact.kind, 'render'),
        ne(made.id, revision.id),
        sql`jsonb_path_exists(${contentArtifact.body}, '$.slideArt[*] ? (@.assetId != null)')`,
        sql`${contentArtifact.body}->'pageBrandId' = ${asJson(pageBrandId)}`,
        sql`${made.body}->'template' = ${asJson(revision.body.template)}`,
        sql`${made.body}->>'emotion' is not distinct from ${revision.body.emotion ?? null}`,
      ),
    )
    .orderBy(desc(contentArtifact.createdAt), desc(contentArtifact.id))
    .limit(1)
  if (!row) return null
  const render = bodyOf('render', row.body, row.id)
  const earlier = bodyOf('revision', row.revision, row.revisionId)
  if (!render?.slideArt || !earlier) return null
  return { slides: earlier.structure.slides, slideArt: render.slideArt }
}

/** What a slide's picture was drawn for: its layout and its slots' text. */
const drawnFor = (slide: Slide) =>
  canonicalJson({
    layout: slide.layout ?? null,
    text: Object.fromEntries(Object.entries(slide.slots).map(([key, s]) => [key, s.text])),
  })

/**
 * The scenes the revision keeps from the post's newest earlier picture (story 14): each art-box
 * slide whose layout and slot text equal a slide drawn there, wherever that slide stood, keeps
 * its scene and picture. A panorama, drawn across every slide, is kept only when every slide
 * matches one there. Empty when none is kept.
 */
async function keptScenes(post: LoadedPost, revision: Look['revision']): Promise<KeptScene[]> {
  const earlier = await earlierPictures(post.id, revision, post.pointers.pageBrandId ?? null)
  if (!earlier) return []
  const { template, structure } = revision.body
  const pictures = earlier.slides.map((slide, i) => ({
    text: drawnFor(slide),
    art: earlier.slideArt.find((a) => a.slide === i + 1 && a.assetId !== null),
  }))
  // Each earlier slide is matched once.
  const take = (slide: Slide, from: typeof pictures) => {
    const at = from.findIndex((p) => p.text === drawnFor(slide))
    return at === -1 ? null : from.splice(at, 1)[0]
  }
  const kept = (slide: number, art: (typeof pictures)[number]['art']): KeptScene[] =>
    art?.assetId ? [{ slide, scene: art.scene, assetId: art.assetId }] : []

  if (isPanorama(template)) {
    const all =
      structure.slides.length === pictures.length &&
      structure.slides.every((slide) => take(slide, pictures) !== null)
    return all
      ? kept(
          1,
          earlier.slideArt.find((a) => a.slide === 1),
        )
      : []
  }
  const drawn = pictures.filter((p) => p.art)
  return artSlides(template, structure).flatMap((n) =>
    kept(n, take(structure.slides[n - 1], drawn)?.art),
  )
}

/**
 * A scene in words for each art-box slide of the approved text, or one wide scene for a panorama,
 * from the slides, the idea, the look, the emotion and the guideline, as a new plan in place of
 * any before it. Nothing is drawn. The post's version keys the call, so each plan is asked anew.
 * A first plan keeps the scene and picture of each slide whose text was drawn before (story 14),
 * and asks the model only for the others, or not at all; "Plan again" asks for every slide.
 * A comic's panels take their storyboard's scenes, with no model call (RC6).
 */
async function planFor(post: LoadedPost, version: number, actor: Actor): Promise<Saved> {
  if (post.kind === 'blog') return planBlog(post, version, actor)
  const look = lookOf(post)
  if (!look) return fail(WORKFLOW_ERRORS.movedOn)
  const { revision } = look
  const { template, structure } = revision.body
  const panorama = isPanorama(template)
  const kept = post.current.artPlan ? [] : await keptScenes(post, revision)
  if (isComic(look)) {
    // A comic's panels are planned on its storyboard (RC3): each panel's own scene. A panel keeps
    // an earlier picture only when that picture was drawn for this very scene.
    const scenes = artSlides(template, structure).map((slide) => {
      const scene = structure.slides[slide - 1]?.scene ?? ''
      return kept.find((k) => k.slide === slide && k.scene === scene) ?? { slide, scene }
    })
    return savePlan(post, version, actor, { revisionId: revision.id, scenes, panorama: false })
  }
  const wanted =
    panorama && kept.length > 0
      ? []
      : artSlides(template, structure).filter((n) => !kept.some((k) => k.slide === n))
  let planned: PlannedScene[] = []
  if (wanted.length > 0) {
    const res = await planScenes({
      template,
      structure,
      idea: post.current.drafts?.body.idea?.cards ?? null,
      emotion: revision.body.emotion ?? null,
      postId: post.id,
      attempt: version,
      slides: wanted,
    })
    if (!res.ok) return fail(res.error)
    planned = res.scenes
  }
  return savePlan(post, version, actor, {
    revisionId: revision.id,
    scenes: [...kept, ...planned].sort((a, b) => a.slide - b.slide),
    panorama,
  })
}

/**
 * A blog's pictures in words (BR4): a scene for its cover and for each picture between sections,
 * from the title, takeaways and sections of its approved text, as a new plan linked to that text.
 */
async function planBlog(post: LoadedPost, version: number, actor: Actor): Promise<Saved> {
  const text = blogTextOf(post)
  if (!text) return fail(WORKFLOW_ERRORS.movedOn)
  const targets = blogPictureTargets(text.body.sections.length)
  const res = await planBlogScenes({
    title: post.title,
    text: text.body,
    targets,
    idea: post.current.blogOutline?.body.idea ?? null,
    emotion: text.body.emotion,
    postId: post.id,
    attempt: version,
  })
  if (!res.ok) return fail(res.error)
  // The call's checks hold every scene to one of the targets.
  const scenes = res.scenes.flatMap((s) => {
    const at = targets.find((t) => t.slide === s.slide)
    return at ? [{ ...s, target: at.target }] : []
  })
  return savePlan(post, version, actor, { blogTextId: text.id, scenes, panorama: false })
}

/** "Plan images", and "Plan again" over a plan there is (GD12; a blog's, BR4). */
export async function planImages(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('planImages', 'planImages', actor, id, version, async (post) => {
    if (!pictured(post)) return fail(WORKFLOW_ERRORS.movedOn)
    return runStep(id, PLAN_STEP, version, () => planFor(post, version, actor))
  })
}

/**
 * The images planned by themselves once a look post's or a blog's text is approved (GD12, BR4),
 * after the response: the plan step's lock is taken now, so the Images screen the editor lands on shows
 * planning and polls until the scenes land, or shows "Plan images" again when it failed. The
 * command's rules apply when it runs. False when the step could not start.
 */
export async function planAfter(actor: Actor, id: string, version: number): Promise<boolean> {
  return runStepAfter(id, PLAN_STEP, version, () =>
    command('planImages', 'planImages', actor, id, version, (post) =>
      planFor(post, version, actor),
    ),
  )
}

/**
 * One planned scene in the editor's words (GD12): 1 to 200 characters as a reader sees them that
 * pass the art prompt guard, as a new plan with every other scene as it was. No model call.
 */
export async function editImageScene(
  actor: Actor,
  id: string,
  version: number,
  edit: { slide: number; text: string },
): Promise<Saved> {
  return command('editImageScene', 'editImageScene', actor, id, version, async (post) => {
    const text = edit.text.trim()
    const length = charCount(text)
    if (length === 0 || length > SCENE_MAX) return fail(WORKFLOW_ERRORS.scene)
    if (artPromptError(text)) return fail(ART_PROMPT_ERROR)
    const plan = post.current.artPlan
    if (!pictured(post) || !plan) return fail(WORKFLOW_ERRORS.planFirst)
    if (!plan.body.scenes.some((s) => s.slide === edit.slide)) return fail(WORKFLOW_ERRORS.movedOn)
    // An edited scene draws anew (no kept picture); a blog's picture keeps its place.
    return savePlan(post, version, actor, {
      ...plan.body,
      scenes: plan.body.scenes.map((s) =>
        s.slide === edit.slide
          ? { slide: s.slide, scene: text, ...(s.target && { target: s.target }) }
          : s,
      ),
      edited: true,
    })
  })
}

/** A look's images from one entry per planned slide: a panorama's one wide image is slide 1's. */
function asImages(slideArt: SlideImage[], panorama: boolean): RenderImages {
  if (!panorama) return { slideArt }
  return { slideArt, panorama: slideArt.find((a) => a.slide === 1)?.bytes ?? null }
}

/**
 * The look's slides drawn with their images, stored as a render at `artVersion`, and the post
 * rendered: an image per art box, or the one panorama across every slide.
 */
function saveRender(
  post: LoadedPost,
  version: number,
  actor: Actor,
  input: { look: Look; images: RenderImages; artVersion: number },
): Promise<Saved> {
  const { look, images, artVersion } = input
  const { revision, layout } = look
  // CPU only: before the transaction.
  const drawn = draw(revision.body, layout.body, null, undefined, images)
  return save(post, version, actor, async (tx) => {
    const renderId = await putRender(tx, post, actor, {
      revisionId: revision.id,
      layoutId: layout.id,
      drawn,
      // A look's images are in slideArt; the single art is kept for the readers of older renders.
      art: {
        bytes: null,
        prompt: images.slideArt[0]?.scene ?? '',
        version: artVersion,
        fallback: null,
      },
      images,
    })
    return { stage: 'rendered', pointers: { ...post.pointers, renderId } }
  })
}

/**
 * The pictures a plan keeps from earlier revisions (story 14), by asset: each as the post's
 * renders recorded it, with its scene, take and nudge, and its bytes, read in one query each.
 */
async function keptImages(postId: string, ids: string[]): Promise<Map<string, SlideImage[]>> {
  if (ids.length === 0) return new Map()
  const [entries, assets] = await Promise.all([listSlideArt(postId), getAssets(ids)])
  const kept = new Map<string, SlideImage[]>()
  for (const { assetId, ...entry } of entries) {
    const bytes = assetId ? assets.get(assetId)?.bytes : undefined
    if (!assetId || !bytes) continue
    kept.set(assetId, [...(kept.get(assetId) ?? []), { ...entry, bytes }])
  }
  return kept
}

/**
 * How long an image whose call failed waits before each new attempt, three attempts in all: the
 * image model refuses calls that come too fast for a while (its per-minute limit), and a slow call
 * may pass next time, so each pause is longer than the one before.
 */
const RETRY_WAITS_MS = [2_000, 5_000]

/** Cloud Run's request timeout: work in after() runs within its request's. */
const REQUEST_TIMEOUT_MS = 300_000
/**
 * How long a background draw run (drawEach) may go on starting image calls. The last one may take
 * IMAGE_TIMEOUT_MS more, after a retry's pause, and the save follows; this leaves those 30 s, so
 * the run ends inside the request timeout instead of being cut off with its lock left to go stale.
 * A saved model that falls back to the environment's runs a second attempt, past this bound.
 */
const DRAW_BUDGET_MS = REQUEST_TIMEOUT_MS - IMAGE_TIMEOUT_MS - 30_000

/** Why an image is missing: the day's cap, or a failed call. */
const missing = (fallback: 'replay' | 'no_art' | 'daily_limit' | null) =>
  fallback === 'daily_limit' ? 'daily_limit' : 'no_art'

/**
 * One planned scene drawn by the image model at its shape, with the page's art style and
 * reference images (criterion 105), as take `option` of art version `set`. A comic's panel has its
 * character sheet as the first reference, named in the prompt, and draws in the Comics style when
 * the page has no design language (RC6).
 */
function drawScene(
  postId: string,
  design: DesignLanguage | null,
  sheet: StyleReference | null,
  input: {
    scene: string
    emotion: string | null
    nudge: string | null
    set: number
    option: number
    aspectRatio: ImageAspect
  },
) {
  return coverArt(
    {
      prompt: slidePrompt({
        scene: input.scene,
        emotion: input.emotion,
        nudge: input.nudge,
        artStyle: design?.artStyle ?? (sheet ? DEFAULT_COMIC_STYLE : null),
        character: sheet !== null,
      }),
      demoKey: null,
      postId,
      set: input.set,
      option: input.option,
      references: [...(sheet ? [sheet] : []), ...(design?.references ?? [])],
      aspectRatio: input.aspectRatio,
    },
    artDeps,
  )
}

/**
 * What "Draw images" draws: the planned scenes in order, and for the post's kind how each is
 * drawn and how the images so far are saved (a look's render, or a blog's pictures).
 */
type Drawing = {
  scenes: Body<'art_plan'>['scenes']
  emotion: string | null
  /** A comic's approved character sheet, each panel's first reference (RC6); null for any other post. */
  sheet: StyleReference | null
  /** The art version the images are drawn under, which keys each call. */
  artVersion: number
  /** The images there before, with their bytes: a planned slide not reached yet keeps its own. */
  before: () => Promise<SlideImage[]>
  /** The pictures kept from earlier revisions (story 14), by asset. */
  earlier: () => Promise<Map<string, SlideImage[]>>
  /** Whether the planned slide's picture before is kept: drawn, with its scene unchanged since. */
  kept: (s: PlannedScene) => boolean
  /** The shape the planned slide's image is drawn at; null when its slide has moved on. */
  aspect: (s: PlannedScene) => ImageAspect | null
  /** The images so far, saved at `version`. */
  save: (images: SlideImage[], version: number) => Promise<Saved>
}

/**
 * The images drawn one after another, in slide order, the images so far saved as each picture
 * lands (the first moves the post to rendered), so the slides fill in while the page polls. A
 * slide not reached yet keeps its picture before, if it had one. Pictures kept from before or
 * from an earlier revision (story 14) are not drawn. An image whose call fails is asked again after
 * a growing pause, three attempts in all; failing each time, its slide is saved as no_art ("Could
 * not draw") and the drawing goes on. At the daily limit the drawn pictures stay and the rest are saved as daily_limit. Before each
 * save the run records how far it is (slides done of those planned), which keeps its lock; a run
 * that has lost its lock (taken over after a crash) stops there, and saves nothing more. Each save
 * checks the version the one before left. Past DRAW_BUDGET_MS the run starts no new call, neither a
 * slide nor a retry, and saves what it has: the slides not reached are left for "Draw remaining".
 */
async function drawEach(
  post: LoadedPost,
  version: number,
  drawing: Drawing,
  run: StepRun,
): Promise<Saved> {
  const { scenes, emotion, sheet, artVersion, kept, aspect } = drawing
  const [design, before, earlier] = await Promise.all([
    designLanguageOf(post.pointers.pageBrandId ?? null),
    drawing.before(),
    drawing.earlier(),
  ])
  const done = new Map<number, SlideImage>()
  let at = version
  let saved: Saved | null = null
  let unsaved = false
  // The run lost its lock: what it saved stands, and the run that holds the lock goes on.
  const stopped = () => fail(WORKFLOW_ERRORS.movedOn)
  const saveNow = async (): Promise<Saved | null> => {
    if (!(await run.progress(done.size, scenes.length))) return null
    const images = scenes.flatMap((s) => {
      const image = done.get(s.slide) ?? before.find((a) => a.slide === s.slide)
      return image ? [image] : []
    })
    const result = await drawing.save(images, at)
    if (result.ok) at = result.version
    saved = result
    unsaved = false
    return result
  }

  const budget = drawBudget(DRAW_BUDGET_MS)
  if (!(await run.progress(0, scenes.length))) return stopped()
  for (const planned of scenes) {
    const old = kept(planned) && before.find((a) => a.slide === planned.slide)
    if (old) {
      done.set(planned.slide, old)
      unsaved = true
      continue
    }
    const was = planned.assetId
      ? earlier.get(planned.assetId)?.find((a) => a.scene === planned.scene)
      : undefined
    if (was) {
      done.set(planned.slide, { ...was, slide: planned.slide })
      unsaved = true
      continue
    }
    // Out of time: no new slide. The ones not reached stay as they were (undrawn, never marked
    // failed), so "Draw remaining" draws them.
    if (!budget.allows()) break
    const aspectRatio = aspect(planned)
    if (!aspectRatio) return fail(WORKFLOW_ERRORS.movedOn)
    const ask = () =>
      drawScene(post.id, design, sheet, {
        scene: planned.scene,
        emotion,
        nudge: null,
        set: artVersion,
        option: planned.slide,
        aspectRatio,
      })
    let res = await ask()
    // A failed call is asked again after each pause, while the run has time; the day's cap is not.
    for (const wait of RETRY_WAITS_MS) {
      if (!res.ok || res.art.bytes || res.art.fallback === 'daily_limit') break
      if (!budget.allows()) break
      await new Promise((resolve) => setTimeout(resolve, wait))
      res = await ask()
    }
    if (!res.ok) return fail(res.error)
    const { bytes, fallback, reason } = res.art
    done.set(planned.slide, {
      slide: planned.slide,
      scene: planned.scene,
      take: 1,
      nudge: null,
      fallback: bytes ? null : missing(fallback),
      // Why it could not be drawn, when the last call said (busy or too slow).
      ...(!bytes && reason && { reason }),
      bytes,
    })
    unsaved = true
    if (!bytes) continue
    const landed = await saveNow()
    if (!landed) return stopped()
    if (!landed.ok) return landed
  }
  if (!unsaved && saved !== null) return saved
  return (await saveNow()) ?? stopped()
}

/**
 * "Draw images" (GD12, GD14), which approves the plan: one image per planned slide, in slide
 * order, each from its scene and the guideline at its art box's aspect (21:9 for a panorama),
 * with the page's art style and reference images (criterion 105), the post rendered with the
 * first. It returns at once and draws after the response under the images step's lock, so the
 * page shows the step running and each slide's picture as it lands (drawEach); a second press
 * while it runs is refused with the step in words. Drawn one after another, so at the daily limit
 * the first slides keep their images and the rest are marked daily_limit. Pressed again on the
 * rendered post ("Draw remaining"), it draws only the planned slides the render has no image for,
 * or whose scene has changed since. A scene that keeps an earlier picture (story 14) is not
 * drawn: that picture is used, and only new images count against the day's limit. A blog's
 * pictures are drawn the same way (drawBlog). A comic's panels are refused until the Comics
 * page's character is approved (RC10), then each is drawn with its sheet as the first reference.
 */
export async function drawImages(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('drawImages', 'drawImages', actor, id, version, async (post) => {
    if (post.kind === 'blog') return drawBlog(post, version, actor)
    const error = renderError(post.current)
    if (error) return fail(error)
    const look = lookOf(post)
    if (!look) return fail(WORKFLOW_ERRORS.movedOn)
    const sheet = await sheetFor(look)
    if (sheet === false) return fail(WORKFLOW_ERRORS.character)
    const plan = post.current.artPlan
    if (!plan) return fail(WORKFLOW_ERRORS.planFirst)
    const render = post.stage === 'rendered' ? post.current.render : null
    const drawnBefore = (render?.body.slideArt ?? []).filter((a) => a.assetId !== null)
    const kept = (s: PlannedScene) =>
      drawnBefore.some((a) => a.slide === s.slide && a.scene === s.scene)
    if (render && plan.body.scenes.every(kept)) return { ok: true, id, version }

    const { panorama, scenes } = plan.body
    const artVersion = render?.body.art.version ?? 1
    const drawing: Drawing = {
      scenes,
      emotion: look.revision.body.emotion ?? null,
      sheet,
      artVersion,
      before: async () => (render ? ((await imagesOf(render.body))?.slideArt ?? []) : []),
      earlier: () =>
        keptImages(
          id,
          scenes.flatMap((s) => (s.assetId ? [s.assetId] : [])),
        ),
      kept,
      aspect: (s) => {
        if (panorama) return '21:9'
        const box = look.layout.body.slides[s.slide - 1]?.artBox
        return box ? imageAspect(box) : null
      },
      save: (images, at) =>
        saveRender(post, at, actor, { look, images: asImages(images, panorama), artVersion }),
    }
    const started = await runStepAfter(id, IMAGES_STEP, version, (run) =>
      attempt('drawImages', () => drawEach(post, version, drawing, run)),
    )
    return started ? { ok: true, id, version } : fail(stepRunningError(IMAGES_STEP))
  })
}

/**
 * "Skip pictures": every art-box slide of the look saved as it looks now, text only, with no image
 * model call, the post rendered as a finished drawing leaves it, and so on to its settings
 * (lib/steps.ts picturesDrawn). A slide with a picture keeps it; each other (not drawn, could not
 * draw, or held at the daily limit) is marked 'skipped', with its planned scene when there is a
 * plan, so "Draw remaining" can still draw it. Gated as Draw images is, under its step's lock, so
 * it is refused while the images are drawn. Pressed again over slides all drawn or skipped, it
 * saves nothing. A comic's panels are its pictures, so a comic is refused.
 */
export async function skipPictures(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('skipPictures', 'skipPictures', actor, id, version, async (post) => {
    const error = renderError(post.current)
    if (error) return fail(error)
    const look = lookOf(post)
    if (!look) return fail(WORKFLOW_ERRORS.movedOn)
    if (isComic(look)) return fail(WORKFLOW_ERRORS.panels)
    const { template, structure } = look.revision.body
    const panorama = isPanorama(template)
    const wanted = panorama ? [1] : artSlides(template, structure)
    const render = post.stage === 'rendered' ? post.current.render : null
    const recorded = render?.body.slideArt ?? []
    const done = (slide: number) =>
      recorded.some((a) => a.slide === slide && (a.assetId !== null || a.fallback === 'skipped'))
    if (render && wanted.every(done)) return { ok: true, id, version }

    const scenes = post.current.artPlan?.body.scenes ?? []
    const res = await runStep(id, IMAGES_STEP, version, async () => {
      const before = render ? ((await imagesOf(render.body))?.slideArt ?? []) : []
      const images = wanted.map((slide): SlideImage => {
        const had = before.find((a) => a.slide === slide)
        if (had?.bytes) return had
        const scene = scenes.find((s) => s.slide === slide)?.scene ?? had?.scene ?? ''
        return { slide, scene, take: had?.take ?? 1, nudge: null, fallback: 'skipped', bytes: null }
      })
      return saveRender(post, version, actor, {
        look,
        images: asImages(images, panorama),
        artVersion: render?.body.art.version ?? 1,
      })
    })
    return !res.ok && res.error === WORKFLOW_ERRORS.running
      ? fail(stepRunningError(IMAGES_STEP))
      : res
  })
}

/** The preset a blog's pictures are tinted with (GD16): the light brand wash suits an article. */
const BLOG_PRESET: Preset = 'subdued'

/** A blog's picture with its bytes, as drawn or read back. */
type BlogImage = SlideImage & { target: BlogTarget }

/** A picture's tinted copy, tinted once per run: the copies read back seed it. */
type Tints = Map<Uint8Array, Uint8Array | null>

const tintOf = (tints: Tints, bytes: Uint8Array): Uint8Array | null => {
  if (!tints.has(bytes)) tints.set(bytes, tintedPng(bytes, BLOG_PRESET))
  return tints.get(bytes) ?? null
}

/** A blog's pictures with their bytes and their tinted copies' bytes, read in one query. */
async function blogImagesOf(
  pictures: Body<'blog_images'> | null,
): Promise<{ images: BlogImage[]; tints: Tints }> {
  if (!pictures) return { images: [], tints: new Map() }
  const ids = pictures.images.flatMap((p) => [p.assetId, p.tintedAssetId])
  const assets = await getAssets(ids.filter((a): a is string => a !== null))
  const bytes = (id: string | null) => (id ? (assets.get(id)?.bytes ?? null) : null)
  const tints: Tints = new Map()
  const images = pictures.images.map(({ assetId, tintedAssetId, ...p }) => {
    const original = bytes(assetId)
    if (original) tints.set(original, bytes(tintedAssetId))
    return { ...p, bytes: original }
  })
  return { images, tints }
}

/**
 * A blog's pictures saved as a new blog_images record for its text, each picture's original and
 * tinted copy stored (the same bytes again are the same rows), the post rendered. The tints are
 * worked before the transaction: CPU only.
 */
function saveBlogImages(
  post: LoadedPost,
  version: number,
  actor: Actor,
  input: {
    blogTextId: string
    artVersion: number
    images: BlogImage[]
    embeds: BlogEmbed[]
    tints: Tints
  },
): Promise<Saved> {
  const { blogTextId, artVersion, images, embeds, tints } = input
  const tinted = images.map((p) => (p.bytes ? tintOf(tints, p.bytes) : null))
  return save(post, version, actor, async (tx) => {
    const stored: Body<'blog_images'>['images'] = []
    for (const [i, { bytes, ...picture }] of images.entries()) {
      const copy = tinted[i]
      stored.push({
        ...picture,
        assetId: bytes ? await putAsset(tx, bytes, artMime(bytes)) : null,
        tintedAssetId: copy ? await putAsset(tx, copy, 'image/png') : null,
      })
    }
    const blogImagesId = await putArtifact(tx, {
      kind: 'blog_images',
      postId: post.id,
      actorId: actor.id,
      body: { blogTextId, version: artVersion, images: stored, embeds },
    })
    return { stage: 'rendered', pointers: { ...post.pointers, blogImagesId } }
  })
}

/**
 * "Draw images" on a blog (BR4): each planned picture drawn at its shape (a 16:9 cover, 4:3
 * between sections) as a look's are (drawEach), with the same resume at the daily limit and
 * "Draw remaining"; a spot where a linked post's slides are embedded is not drawn.
 */
async function drawBlog(post: LoadedPost, version: number, actor: Actor): Promise<Saved> {
  const { id } = post
  const text = blogTextOf(post)
  if (!text) return fail(WORKFLOW_ERRORS.movedOn)
  const plan = post.current.artPlan
  if (!plan) return fail(WORKFLOW_ERRORS.planFirst)
  const pictures = post.current.blogImages?.body ?? null
  const embeds = pictures?.embeds ?? []
  const targets = new Map(plan.body.scenes.flatMap((s) => (s.target ? [[s.slide, s.target]] : [])))
  const scenes = plan.body.scenes.filter((s) => s.target && !embeddedAt(embeds, s.target))
  const drawnBefore = (pictures?.images ?? []).filter((p) => p.assetId !== null)
  const kept = (s: PlannedScene) =>
    drawnBefore.some((p) => p.slide === s.slide && p.scene === s.scene)
  if (post.stage === 'rendered' && scenes.every(kept)) return { ok: true, id, version }

  const artVersion = pictures?.version ?? 1
  let tints: Tints = new Map()
  const drawing: Drawing = {
    scenes,
    emotion: text.body.emotion,
    sheet: null,
    artVersion,
    before: async () => {
      const read = await blogImagesOf(pictures)
      tints = read.tints
      return read.images
    },
    earlier: async () => new Map(),
    kept,
    aspect: (s) => {
      const target = targets.get(s.slide)
      return target ? blogAspect(target) : null
    },
    save: (images, at) =>
      saveBlogImages(post, at, actor, {
        blogTextId: text.id,
        artVersion,
        images: images.flatMap((p) => {
          const target = targets.get(p.slide)
          return target ? [{ ...p, target }] : []
        }),
        embeds,
        tints,
      }),
  }
  const started = await runStepAfter(id, IMAGES_STEP, version, (run) =>
    attempt('drawImages', () => drawEach(post, version, drawing, run)),
  )
  return started ? { ok: true, id, version } : fail(stepRunningError(IMAGES_STEP))
}

/**
 * An image chip on one drawn slide (GD13): that slide drawn again from its planned scene with the
 * chip's instruction, as its next take, in a new render under the next art version. With no chip
 * (`nudge: null`) it is "New picture", or "Draw this one" after the scene was edited, or "Try this
 * one again" on a slide that could not be drawn: the scene drawn again with no instruction. The
 * text and every other slide keep theirs, and the render before stays in the history with the
 * earlier take. At the daily limit, or when the call fails, nothing changes and the editor is told.
 * A blog's picture is nudged the same way (nudgeBlog).
 */
export async function nudgeImage(
  actor: Actor,
  id: string,
  version: number,
  at: { slide: number; nudge: string | null },
): Promise<Saved> {
  return command('nudgeImage', 'nudgeImage', actor, id, version, async (post) => {
    const chip = at.nudge === null ? null : imageNudge(at.nudge)
    if (at.nudge !== null && !chip) return fail(WORKFLOW_ERRORS.imageNudge)
    if (post.kind === 'blog') return nudgeBlog(post, version, actor, { slide: at.slide, chip })
    const look = lookOf(post)
    const render = post.current.render
    const target = render?.body.slideArt?.find((a) => a.slide === at.slide)
    const box = look?.layout.body.slides[at.slide - 1]?.artBox
    if (!look || !render || !target || !box) return fail(WORKFLOW_ERRORS.movedOn)
    const sheet = await sheetFor(look)
    if (sheet === false) return fail(WORKFLOW_ERRORS.character)
    // The planned scene, as the editor may have edited it since the picture was drawn.
    const scene =
      post.current.artPlan?.body.scenes.find((s) => s.slide === at.slide)?.scene ?? target.scene
    const panorama = isPanorama(look.revision.body.template)
    const artVersion = render.body.art.version + 1

    return runStep(id, IMAGES_STEP, version, async () => {
      const [design, before] = await Promise.all([
        designLanguageOf(post.pointers.pageBrandId ?? null),
        imagesOf(render.body),
      ])
      const res = await drawScene(id, design, sheet, {
        scene,
        emotion: look.revision.body.emotion ?? null,
        nudge: chip?.instruction ?? null,
        set: artVersion,
        option: at.slide,
        aspectRatio: panorama ? '21:9' : imageAspect(box),
      })
      if (!res.ok) return fail(res.error)
      const { bytes, fallback } = res.art
      if (!bytes) return fail(fallback === 'daily_limit' ? AI_ERRORS.dailyLimit : AI_ERRORS.failed)
      const was = before?.slideArt.find((a) => a.slide === at.slide)
      if (!before || !was) return fail(WORKFLOW_ERRORS.movedOn)
      const images = withSlideImage(before, {
        ...was,
        scene,
        // A slide that could not be drawn had no picture to count as a take.
        take: was.bytes ? was.take + 1 : was.take,
        nudge: chip?.id ?? null,
        fallback: null,
        // Drawn now: why it could not be drawn before no longer holds.
        reason: undefined,
        bytes,
      })
      return saveRender(post, version, actor, { look, images, artVersion })
    })
  })
}

/**
 * An image chip, or "New picture", on one of a blog's pictures (BR4, GD13): drawn again from its
 * planned scene at its shape as its next take, under the next art version, every other picture
 * as it was. At the daily limit, or when the call fails, nothing changes and the editor is told.
 */
async function nudgeBlog(
  post: LoadedPost,
  version: number,
  actor: Actor,
  at: { slide: number; chip: ReturnType<typeof imageNudge> },
): Promise<Saved> {
  const text = blogTextOf(post)
  const pictures = post.current.blogImages?.body
  const target = pictures?.images.find((p) => p.slide === at.slide)
  if (!text || !pictures || !target) return fail(WORKFLOW_ERRORS.movedOn)
  const scene =
    post.current.artPlan?.body.scenes.find((s) => s.slide === at.slide)?.scene ?? target.scene
  const artVersion = pictures.version + 1
  const { chip } = at

  return runStep(post.id, IMAGES_STEP, version, async () => {
    const [design, { images: before, tints }] = await Promise.all([
      designLanguageOf(post.pointers.pageBrandId ?? null),
      blogImagesOf(pictures),
    ])
    const res = await drawScene(post.id, design, null, {
      scene,
      emotion: text.body.emotion,
      nudge: chip?.instruction ?? null,
      set: artVersion,
      option: at.slide,
      aspectRatio: blogAspect(target.target),
    })
    if (!res.ok) return fail(res.error)
    const { bytes, fallback } = res.art
    if (!bytes) return fail(fallback === 'daily_limit' ? AI_ERRORS.dailyLimit : AI_ERRORS.failed)
    const images = before.map((p) =>
      p.slide === at.slide
        ? {
            ...p,
            scene,
            // A picture that could not be drawn had none to count as a take.
            take: p.bytes ? p.take + 1 : p.take,
            nudge: chip?.id ?? null,
            fallback: null,
            reason: undefined,
            bytes,
          }
        : p,
    )
    return saveBlogImages(post, version, actor, {
      blogTextId: text.id,
      artVersion,
      images,
      embeds: pictures.embeds,
      tints,
    })
  })
}
