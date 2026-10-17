import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { coverArt, coverOptions, coverPrompt, type StyleReference } from '../../ai/art'
import { ART_PROMPT_ERROR, artPromptError } from '../../ai/draft'
import { LIBRARY } from '../../assets/library'
import { fitPasses } from '../../layout/fit'
import { replaceSentence } from '../../lib/claims'
import { claimFitError } from '../../lib/version-status'
import { coverIdeaError, renderError, WORKFLOW_ERRORS } from '../../lib/workflow'
import { BODIES, type Body } from '../../model/artifacts'
import type { ClaimResult, Structure } from '../../model/types'
import { isLook } from '../../templates'
import { artifactId, assetId } from '../hash'
import { designLanguageOf } from '../page-style'
import { runStep } from '../steps'
import {
  getAsset,
  type LoadedPost,
  listRenderArt,
  listSlideArt,
  putArtifact,
  putAsset,
} from '../store'
import { checkAfter } from './check'
import {
  type Actor,
  artDeps,
  artMime,
  command,
  type Drawn,
  draw,
  fail,
  imagesOf,
  layoutOf,
  movedImages,
  putRender,
  putRevision,
  type RenderImages,
  type Saved,
  save,
  sourcesAtOf,
  stamp,
  withSlideImage,
} from './shared'

// The render stage: the render and its art, a claim removed or put in the source's words, light
// edits, and cover options to choose from (criteria 34–41, 102–104). Each new revision is
// source-checked after the response (./check.ts).

/** A cover with no art, which "Try again" draws again: failed, or refused for the day's cap. */
const NO_ART: readonly Body<'render'>['art']['fallback'][] = ['no_art', 'daily_limit']

/** What a cover is drawn from: its prompt, and its page's reference images (none without a design language). */
type CoverInput = { prompt: string; references: StyleReference[] }

/**
 * The cover art prompt for the post's revision (criterion 102): its scene, the cover slide's
 * words, the picked version's angle, the emotion, the look and the editor's idea when given. The
 * look is the art style of the post's page when that page has a design language, whose reference
 * images go with it (criterion 105); else the brand's tone, with none. Null with no revision.
 */
async function coverFor(post: LoadedPost, idea: string | null): Promise<CoverInput | null> {
  const { revision, drafts } = post.current
  if (!revision) return null
  const design = await designLanguageOf(post.pointers.pageBrandId ?? null)
  const picked = post.pointers.picked
  const prompt = revisionCoverPrompt(revision.body, {
    angle: (picked === null ? null : drafts?.body.items[picked]?.angle) || null,
    artStyle: design?.artStyle ?? null,
    idea,
  })
  return { prompt, references: design?.references ?? [] }
}

/** The cover prompt for a revision's words and its emotion, in a look when given. */
export function revisionCoverPrompt(
  revision: Body<'revision'>,
  input: { angle: string | null; artStyle: string | null; idea: string | null },
): string {
  const { structure, emotion } = revision
  const cover = structure.slides.find((s) => s.kind === 'cover') ?? structure.slides[0]
  return coverPrompt({
    scene: structure.artPrompt,
    message: Object.values(cover?.slots ?? {})
      .map((slot) => slot.text)
      .join(' '),
    angle: input.angle,
    emotion: emotion ?? null,
    artStyle: input.artStyle,
    idea: input.idea,
  })
}

export async function renderPost(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('renderPost', 'render', actor, id, version, async (post) => {
    const error = renderError(post.current)
    if (error) return fail(error)
    const { source, revision, layout } = post.current
    // A look draws an image per art box (./images.ts, GD12).
    if (revision && isLook(revision.body.template)) return fail(WORKFLOW_ERRORS.drawImages)
    const input = await coverFor(post, null)
    if (!source || !revision || !layout || input === null) return fail(WORKFLOW_ERRORS.movedOn)
    const { prompt, references } = input

    return runStep(id, 'render', version, async () => {
      const cover = await coverArt(
        { prompt, demoKey: source.body.demoKey, postId: id, references },
        artDeps,
      )
      if (!cover.ok) return fail(cover.error)
      const drawn = draw(revision.body, layout.body, cover.art.bytes)
      return save(post, version, actor, async (tx) => {
        const renderId = await putRender(tx, post, actor, {
          revisionId: revision.id,
          layoutId: layout.id,
          drawn,
          art: { bytes: cover.art.bytes, prompt, version: 1, fallback: cover.art.fallback },
        })
        return { stage: 'rendered', pointers: { ...post.pointers, renderId } }
      })
    })
  })
}

export async function retryArt(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('retryArt', 'retryArt', actor, id, version, async (post) => {
    const { source, revision, layout, render } = post.current
    const input = await coverFor(post, null)
    if (
      !source ||
      !revision ||
      !layout ||
      !render ||
      input === null ||
      !NO_ART.includes(render.body.art.fallback)
    ) {
      return fail(WORKFLOW_ERRORS.movedOn)
    }
    const { prompt, references } = input

    return runStep(id, 'render', version, async () => {
      const cover = await coverArt(
        { prompt, demoKey: source.body.demoKey, postId: id, references },
        artDeps,
      )
      if (!cover.ok) return fail(cover.error)
      const drawn = draw(revision.body, layout.body, cover.art.bytes)
      return save(post, version, actor, async (tx) => {
        const renderId = await putRender(tx, post, actor, {
          revisionId: revision.id,
          layoutId: layout.id,
          drawn,
          art: {
            bytes: cover.art.bytes,
            prompt,
            version: render.body.art.version + 1,
            fallback: cover.art.fallback,
          },
        })
        return { stage: post.stage, pointers: { ...post.pointers, renderId } }
      })
    })
  })
}

/**
 * One sentence the source check read in the post's revision, replaced by what `change` gives (''
 * takes it out; null refuses it as moved on), as a new revision and layout (criteria 43, 104).
 * A change whose layout fails a fit check that passed before is refused, naming the slot, with
 * nothing saved (18 Oct: it dropped the post back to Images with nothing it could render). Fits:
 * redrawn with the art it already has, no model call; else back to approved, unrendered. The
 * source check runs again after, reading only what changed.
 */
export async function reviseClaim(
  post: LoadedPost,
  version: number,
  actor: Actor,
  claim: number,
  change: (claim: ClaimResult) => string | null,
  note: string,
  kind: 'remove' | 'wording',
): Promise<Saved> {
  const { id } = post
  const { source, facts, revision, render, sourceCheck } = post.current
  if (!sourceCheck) return fail(WORKFLOW_ERRORS.checkFirst)
  const target = sourceCheck.body.claims[claim]
  if (!source || !facts || !revision || !target) return fail(WORKFLOW_ERRORS.movedOn)
  const slides = revision.body.structure.slides
  const slot = slides[target.slide - 1]?.slots[target.slot]
  const replacement = change(target)
  const text =
    slot && replacement !== null ? replaceSentence(slot.text, target.text, replacement) : null
  if (!slot || text === null) return fail(WORKFLOW_ERRORS.movedOn)

  const next: Body<'revision'> = {
    ...revision.body,
    structure: {
      ...revision.body.structure,
      slides: slides.map((s, i) =>
        i === target.slide - 1
          ? { ...s, slots: { ...s.slots, [target.slot]: { ...slot, text } } }
          : s,
      ),
    },
    by: stamp(actor),
    note,
  }
  const revisionId = artifactId('revision', id, BODIES.revision.parse(next))
  const layout = layoutOf(revisionId, next, source.body, facts.body, sourcesAtOf(post), post)
  const before = post.current.layout?.body.fitChecks ?? []
  const refusal = claimFitError(kind, next, before, layout.fitChecks)
  if (refusal) return fail(refusal)

  let drawn: Drawn | null = null
  let artBytes: Uint8Array | null = null
  let images: RenderImages | null = null
  if (fitPasses(layout.fitChecks)) {
    const artId = render?.body.art.assetId ?? null
    ;[artBytes, images] = await Promise.all([
      artId ? getAsset(artId).then((a) => a?.bytes ?? null) : null,
      render ? imagesOf(render.body) : null,
    ])
    drawn = draw(next, layout, artBytes, undefined, images)
  }

  const saved = await save(post, version, actor, async (tx) => {
    await putRevision(tx, id, next, revisionId, actor)
    const layoutId = await putArtifact(tx, {
      kind: 'layout',
      postId: id,
      body: layout,
      actorId: actor.id,
    })
    if (!drawn || !render) {
      return {
        stage: 'approved',
        pointers: { ...post.pointers, revisionId, layoutId, renderId: null },
      }
    }
    const renderId = await putRender(tx, post, actor, {
      revisionId,
      layoutId,
      drawn,
      art: { ...render.body.art, bytes: artBytes },
      images,
    })
    return { stage: post.stage, pointers: { ...post.pointers, revisionId, layoutId, renderId } }
  })
  return checkAfter(id, actor, saved)
}

export async function removeClaim(
  actor: Actor,
  id: string,
  version: number,
  claim: number,
): Promise<Saved> {
  return command('removeClaim', 'removeClaim', actor, id, version, (post) =>
    reviseClaim(post, version, actor, claim, () => '', 'remove claim', 'remove'),
  )
}

// ── Light edits ─────────────────────────────────────────────────────────────────────────────────

export type LightEdit =
  | { kind: 'phrase'; slide: number; slot: 'phrase' | 'underline'; text: string }
  /** On a look post, `slide` names the slide whose image goes back to an earlier take (GD13). */
  | { kind: 'swapImage'; image: { assetId: string } | { library: string }; slide?: number }
  | { kind: 'reorder'; from: number; to: number } // body slides, numbered from 1

/** An image "Swap image" offers: generated art from one of the post's earlier renders. */
export type ArtChoice = { assetId: string; version: number; prompt: string }

const LIBRARY_DIR = join(process.cwd(), 'src/features/content/assets/library')

/** A library image's bytes by its id in LIBRARY; null for any other id, so input never names a path. */
async function libraryBytes(id: string): Promise<Uint8Array | null> {
  const entry = LIBRARY.find((l) => l.id === id)
  return entry ? new Uint8Array(await readFile(join(LIBRARY_DIR, entry.file))) : null
}

/** Generated art from the post's earlier renders, one per image, oldest version first. Library images and fallbacks are not offered here. */
export async function earlierArt(postId: string): Promise<ArtChoice[]> {
  const [arts, library] = await Promise.all([
    listRenderArt(postId),
    Promise.all(LIBRARY.map(async (l) => assetId((await libraryBytes(l.id)) ?? new Uint8Array()))),
  ])
  const choices = new Map<string, ArtChoice>()
  for (const { assetId: id, version, prompt, fallback } of arts) {
    if (!id || fallback !== null || library.includes(id) || choices.has(id)) continue
    choices.set(id, { assetId: id, version, prompt })
  }
  return [...choices.values()].sort((a, b) => a.version - b.version)
}

/** The structure with one slot's text changed; null when the slide has no such slot. */
function withPhrase(
  structure: Structure,
  edit: Extract<LightEdit, { kind: 'phrase' }>,
): Structure | null {
  const at = edit.slide - 1
  const slot = structure.slides[at]?.slots[edit.slot]
  if (!slot) return null
  return {
    ...structure,
    slides: structure.slides.map((s, i) =>
      i === at
        ? { ...s, slots: { ...s.slots, [edit.slot]: { ...slot, text: edit.text.trim() } } }
        : s,
    ),
  }
}

/**
 * Where each slide comes from after one body slide moves: index i of the result is the index of
 * the slide that goes there; every other slide keeps its place. Null when either number is not a
 * body slide.
 */
function reorderedFrom(
  structure: Structure,
  edit: Extract<LightEdit, { kind: 'reorder' }>,
): number[] | null {
  const bodies = structure.slides.flatMap((s, i) => (s.kind === 'body' ? [i] : []))
  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= bodies.length
  if (!valid(edit.from) || !valid(edit.to) || edit.from === edit.to) return null
  const [moved] = bodies.splice(edit.from - 1, 1)
  bodies.splice(edit.to - 1, 0, moved)
  let next = 0
  return structure.slides.map((s, i) => (s.kind === 'body' ? bodies[next++] : i))
}

/**
 * A light edit, as new records (criterion 40). A phrase or reorder is a new revision and layout,
 * refused with the first failing fit row, and a render with the art it already has; facts and
 * bindings are untouched, the old source check stops counting with the old revision, and the
 * new one is checked after. A swap is a new render of the same revision with other art, so the
 * source check still counts.
 */
export async function lightEdit(
  actor: Actor,
  id: string,
  version: number,
  edit: LightEdit,
): Promise<Saved> {
  return command('lightEdit', 'lightEdit', actor, id, version, async (post) => {
    const { source, facts, revision, layout, render } = post.current
    if (!source || !facts || !revision || !layout || !render) return fail(WORKFLOW_ERRORS.movedOn)
    // A look's images go with every redraw (GD12); null on a render with its single art.
    const images = await imagesOf(render.body)

    if (edit.kind === 'swapImage' && images) {
      // An earlier take of that slide, from the post's renders (GD13).
      const wanted = 'assetId' in edit.image ? edit.image.assetId : null
      const take = wanted
        ? (await listSlideArt(id)).find((a) => a.slide === edit.slide && a.assetId === wanted)
        : undefined
      const bytes = take?.assetId ? (await getAsset(take.assetId))?.bytes : null
      if (!take || !bytes) return fail(WORKFLOW_ERRORS.movedOn)
      const { assetId: _, ...entry } = take
      const next = withSlideImage(images, { ...entry, fallback: null, bytes })
      const drawn = draw(revision.body, layout.body, null, undefined, next)
      return save(post, version, actor, async (tx) => {
        const renderId = await putRender(tx, post, actor, {
          revisionId: revision.id,
          layoutId: layout.id,
          drawn,
          art: { ...render.body.art, bytes: null },
          images: next,
        })
        return { stage: post.stage, pointers: { ...post.pointers, renderId } }
      })
    }

    if (edit.kind === 'swapImage') {
      let art: { bytes: Uint8Array; prompt: string; version: number } | null = null
      if ('library' in edit.image) {
        // Library art made by no prompt: the cover keeps its prompt and version to regenerate from.
        const bytes = await libraryBytes(edit.image.library)
        if (bytes) art = { bytes, prompt: render.body.art.prompt, version: render.body.art.version }
      } else {
        const wanted = edit.image.assetId
        const earlier = (await earlierArt(id)).find((a) => a.assetId === wanted)
        const bytes = earlier && (await getAsset(earlier.assetId))?.bytes
        if (earlier && bytes) art = { bytes, prompt: earlier.prompt, version: earlier.version }
      }
      if (!art) return fail(WORKFLOW_ERRORS.movedOn)
      const chosen = art
      const drawn = draw(revision.body, layout.body, chosen.bytes)
      return save(post, version, actor, async (tx) => {
        const renderId = await putRender(tx, post, actor, {
          revisionId: revision.id,
          layoutId: layout.id,
          drawn,
          art: { ...chosen, fallback: null },
        })
        return { stage: post.stage, pointers: { ...post.pointers, renderId } }
      })
    }

    const from = edit.kind === 'reorder' ? reorderedFrom(revision.body.structure, edit) : null
    const structure =
      edit.kind === 'phrase'
        ? withPhrase(revision.body.structure, edit)
        : from && {
            ...revision.body.structure,
            slides: from.map((i) => revision.body.structure.slides[i]),
          }
    if (!structure) return fail(WORKFLOW_ERRORS.movedOn)
    // Each image goes with its slide.
    const moved = images && from ? movedImages(images, from) : images
    const next: Body<'revision'> = {
      ...revision.body,
      structure,
      by: stamp(actor),
      note: edit.kind === 'phrase' ? 'light edit: phrase' : 'reorder',
    }
    const revisionId = artifactId('revision', id, BODIES.revision.parse(next))
    const nextLayout = layoutOf(revisionId, next, source.body, facts.body, sourcesAtOf(post), post)
    const failing = nextLayout.fitChecks.find((c) => !c.pass)
    if (failing) return fail(failing.label)

    const artId = render.body.art.assetId
    const artBytes = artId ? ((await getAsset(artId))?.bytes ?? null) : null
    const drawn = draw(next, nextLayout, artBytes, undefined, moved)
    const saved = await save(post, version, actor, async (tx) => {
      await putRevision(tx, id, next, revisionId, actor)
      const layoutId = await putArtifact(tx, {
        kind: 'layout',
        postId: id,
        body: nextLayout,
        actorId: actor.id,
      })
      const renderId = await putRender(tx, post, actor, {
        revisionId,
        layoutId,
        drawn,
        art: { ...render.body.art, bytes: artBytes },
        images: moved,
      })
      return { stage: post.stage, pointers: { ...post.pointers, revisionId, layoutId, renderId } }
    })
    return checkAfter(id, actor, saved)
  })
}

// ── Covers ──────────────────────────────────────────────────────────────────────────────────────

/** The step "Make covers" runs as: its lock, and what the page shows running. */
const COVERS_STEP = 'covers'
/** The most cover options a covers record keeps, newest last: four sets of three. */
const COVERS_KEPT = 12

/**
 * Three cover options for the post's text (criteria 102, 103), drawn from the prompt code builds
 * and the editor's optional idea, each checked for text in its art as it arrives. Each press adds
 * a set to the options made for this revision before ("Another set"), as a new covers record; the
 * render stands until the editor uses one. The idea is refused before any call when it is over
 * 120 characters or asks for text, a number or a brand. Each option carries the cover slide drawn
 * with its art, for the editor to choose from.
 */
export async function makeCovers(
  actor: Actor,
  id: string,
  version: number,
  idea: string,
): Promise<Saved> {
  return command('makeCovers', 'makeCovers', actor, id, version, async (post) => {
    const ideaError = coverIdeaError(idea)
    if (ideaError) return fail(ideaError)
    const wanted = idea.trim()
    if (artPromptError(wanted)) return fail(ART_PROMPT_ERROR)
    const { source, revision, layout, render, covers } = post.current
    if (revision && isLook(revision.body.template)) return fail(WORKFLOW_ERRORS.drawImages)
    const input = await coverFor(post, wanted || null)
    if (!source || !revision || !layout || !render || input === null) {
      return fail(WORKFLOW_ERRORS.movedOn)
    }
    const { prompt, references } = input
    const earlier = covers?.body.options ?? []
    const set = (earlier.at(-1)?.set ?? 0) + 1

    return runStep(id, COVERS_STEP, version, async () => {
      const made = await coverOptions(
        { prompt, demoKey: source.body.demoKey, postId: id, set, references },
        artDeps,
      )
      if (!made.ok) return fail(made.error)
      // The cover slide alone, drawn with each option's art. CPU only: before the transaction.
      const at = layout.body.slides.findIndex((s) => s.artBox !== null)
      const previews = made.options.map((o) =>
        o.bytes && at >= 0
          ? draw(revision.body, { slides: [layout.body.slides[at]] }, o.bytes).slides[0].png
          : null,
      )
      return save(post, version, actor, async (tx) => {
        const options: Body<'covers'>['options'] = [...earlier]
        for (const [i, option] of made.options.entries()) {
          const preview = previews[i]
          options.push({
            assetId: option.bytes ? await putAsset(tx, option.bytes, artMime(option.bytes)) : null,
            previewAssetId: preview ? await putAsset(tx, preview, 'image/png') : null,
            prompt,
            set,
            fallback: option.fallback,
          })
        }
        const coversId = await putArtifact(tx, {
          kind: 'covers',
          postId: id,
          actorId: actor.id,
          body: {
            revisionId: revision.id,
            options: options.slice(-COVERS_KEPT),
            pageBrandId: post.pointers.pageBrandId,
          },
        })
        return { stage: post.stage, pointers: { ...post.pointers, coversId } }
      })
    })
  })
}

/**
 * "Use this cover" (criteria 41, 102): the option's art as a new render, numbered one past the
 * highest art version of any of the post's renders, so a swap back never repeats a number. The
 * other slides draw the same SVGs, so their asset ids are the same rows. No model call. Refused as
 * moved on for an option with no art, or one made for text the post no longer points at.
 */
export async function chooseCover(
  actor: Actor,
  id: string,
  version: number,
  option: number,
): Promise<Saved> {
  return command('chooseCover', 'chooseCover', actor, id, version, async (post) => {
    const { revision, layout, render, covers } = post.current
    const chosen = Number.isInteger(option) ? covers?.body.options[option] : undefined
    if (!revision || !layout || !render || !chosen?.assetId) return fail(WORKFLOW_ERRORS.movedOn)
    const bytes = (await getAsset(chosen.assetId))?.bytes
    if (!bytes) return fail(WORKFLOW_ERRORS.movedOn)
    const drawn = draw(revision.body, layout.body, bytes)
    const versions = (await listRenderArt(id)).map((a) => a.version)
    const next = Math.max(render.body.art.version, ...versions) + 1
    return save(post, version, actor, async (tx) => {
      const renderId = await putRender(tx, post, actor, {
        revisionId: revision.id,
        layoutId: layout.id,
        drawn,
        art: { bytes, prompt: chosen.prompt, version: next, fallback: chosen.fallback },
      })
      return { stage: post.stage, pointers: { ...post.pointers, renderId } }
    })
  })
}
