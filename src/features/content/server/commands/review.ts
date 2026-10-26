import 'server-only'
import { replaceSentence } from '../../lib/claims'
import {
  normaliseSettings,
  publishError,
  sendBackError,
  sendToReviewError,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import type { Body, SendBackStep } from '../../model/artifacts'
import { wordingCheck } from '../../model/current'
import { type FeedSettings, FeedSettingsSchema, type SourcesAt } from '../../model/types'
import { isLook } from '../../templates'
import { sourceWordingRefusal } from '../../text/script'
import { runStep } from '../steps'
import { getAsset, type LoadedPost, publishApproval, putArtifact } from '../store'
import { CHECK_STEP, checkNow, checkTarget } from './check'
import { reviseClaim } from './render'
import {
  type Actor,
  command,
  type Drawn,
  draw,
  fail,
  imagesOf,
  layoutOf,
  putRender,
  type RenderImages,
  type Saved,
  save,
  stamp,
} from './shared'
import { editPickedSlot } from './structures'

// The check and review stage: the source check's "Try again", the source's wording for a flagged
// sentence, editorial opinion, feed settings, sending to review, and the reviewer's approval and
// send-back (criteria 42–54, 103, 104). The check itself runs by itself (./check.ts).

/**
 * The source check run now, on the text the post points at: "Try again" when the automatic one
 * failed (criterion 98).
 */
export async function checkSource(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('checkSource', 'sourceCheck', actor, id, version, async (post) => {
    const target = checkTarget(post)
    if (!target) return fail(WORKFLOW_ERRORS.movedOn)

    return runStep(id, CHECK_STEP, version, async () => {
      const checked = await checkNow(post, target)
      if (!checked.ok) return fail(checked.error)
      return save(post, version, actor, async (tx) => {
        const sourceCheckId = await putArtifact(tx, {
          kind: 'source_check',
          postId: id,
          actorId: actor.id,
          body: { ...target.link, claims: checked.claims, replays: checked.replays },
        })
        return { stage: post.stage, pointers: { ...post.pointers, sourceCheckId } }
      })
    })
  })
}

/**
 * "Use the source's wording" (criterion 104): a sentence the check could not find, replaced by
 * the source sentence it shows beside it, in the picked version before approval or in the
 * rendered post's revision; the check runs again after.
 */
export async function applySourceWording(
  actor: Actor,
  id: string,
  version: number,
  claim: number,
): Promise<Saved> {
  return command('applySourceWording', 'sourceWording', actor, id, version, async (post) => {
    // From Images the edit has moved the post back to its text, where the revision's check the
    // editor read the claim from no longer counts; it is still the one she pressed (18 Oct).
    const check = wordingCheck(post.pointers, post.current, post.records)
    if (!check) return fail(WORKFLOW_ERRORS.checkFirst)
    const target = check.body.claims[claim]
    const wording = target?.result === 'not_found' ? target.suggestion?.text : undefined
    if (!target || wording === undefined) return fail(WORKFLOW_ERRORS.movedOn)
    // Only a sentence in the post's own script: a stale page may still offer it.
    const refused = sourceWordingRefusal(wording, post.current.source?.body.language)
    if (refused) return fail(refused)
    if (post.stage === 'structures') {
      return editPickedSlot(
        post,
        version,
        actor,
        target,
        (text) => replaceSentence(text, target.text, wording),
        `Source wording used on slide ${target.slide}`,
      )
    }
    return reviseClaim(post, version, actor, claim, () => wording, 'source wording', 'wording')
  })
}

/**
 * "Mark as editor's opinion" (criteria 42, 43): a sentence the check could not find counts as
 * the editor's opinion, in the Text step's Checks before approval or at Settings once rendered.
 * The checks after keep the mark on the same text (ai/source-check.ts), so a mark made on the
 * Text step stands on the approved revision's check, and review is not blocked by it.
 */
export async function markOpinion(
  actor: Actor,
  id: string,
  version: number,
  claim: number,
): Promise<Saved> {
  return command('markOpinion', 'markOpinion', actor, id, version, async (post) => {
    // The check that counts: the picked version's on the Text step, the revision's once rendered.
    // The mark never moves the post back, so no check is left over from a move here; after one,
    // the revision's check no longer counts, and the mark waits for the picked version's.
    const check = post.current.sourceCheck
    if (!check) return fail(WORKFLOW_ERRORS.checkFirst)
    if (check.body.claims[claim]?.result !== 'not_found') return fail(WORKFLOW_ERRORS.movedOn)
    const claims = check.body.claims.map((c, i) =>
      i === claim ? { ...c, result: 'opinion' as const } : c,
    )
    return save(post, version, actor, async (tx) => {
      const sourceCheckId = await putArtifact(tx, {
        kind: 'source_check',
        postId: id,
        actorId: actor.id,
        body: { ...check.body, claims },
      })
      return { stage: post.stage, pointers: { ...post.pointers, sourceCheckId } }
    })
  })
}

/** A rendered look post laid out and drawn again: what saveSettings stores beside the settings. */
type Redraw = {
  layout: Body<'layout'>
  drawn: Drawn
  art: Uint8Array | null
  images: RenderImages | null
}

/**
 * A rendered look post's slides with its sources where `sourcesAt` puts them (GD31): its layout
 * again and the slides drawn again with the pictures it has, no model call. Null when the slides
 * would not change; the first failing fit row's label when they would not fit.
 */
async function sourcesRedrawn(
  post: LoadedPost,
  sourcesAt: SourcesAt,
): Promise<Redraw | string | null> {
  const { source, facts, revision, layout, render } = post.current
  if (!source || !facts || !revision || !layout || !render) return null
  if (!isLook(revision.body.template)) return null
  const next = layoutOf(revision.id, revision.body, source.body, facts.body, sourcesAt, post)
  if (JSON.stringify(next.slides) === JSON.stringify(layout.body.slides)) return null
  const failing = next.fitChecks.find((c) => !c.pass)
  if (failing) return failing.label
  const artId = render.body.art.assetId
  const [art, images] = await Promise.all([
    artId ? getAsset(artId).then((a) => a?.bytes ?? null) : null,
    imagesOf(render.body),
  ])
  const drawn = draw(revision.body, next, art, undefined, images)
  return { layout: next, drawn, art, images }
}

/**
 * The feed settings saved. Where the sources go (GD31) is drawn on a look's slides, so a change
 * to it lays the rendered post out again and draws it with the pictures it has; the revision, and
 * so the source check, stay.
 */
export async function saveSettings(
  actor: Actor,
  id: string,
  version: number,
  settings: FeedSettings,
): Promise<Saved> {
  return command('saveSettings', 'settings', actor, id, version, async (post) => {
    const parsed = FeedSettingsSchema.safeParse(settings)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.missingSetting)
    const redraw = await sourcesRedrawn(post, parsed.data.sourcesAt)
    if (typeof redraw === 'string') return fail(redraw)
    const { revision, render } = post.current
    return save(post, version, actor, async (tx) => {
      const settingsId = await putArtifact(tx, {
        kind: 'settings',
        postId: id,
        actorId: actor.id,
        body: normaliseSettings(parsed.data),
      })
      if (!redraw || !revision || !render) {
        return { stage: post.stage, pointers: { ...post.pointers, settingsId } }
      }
      const layoutId = await putArtifact(tx, {
        kind: 'layout',
        postId: id,
        body: redraw.layout,
        actorId: actor.id,
      })
      const renderId = await putRender(tx, post, actor, {
        revisionId: revision.id,
        layoutId,
        drawn: redraw.drawn,
        art: { ...render.body.art, bytes: redraw.art },
        images: redraw.images,
      })
      return { stage: post.stage, pointers: { ...post.pointers, settingsId, layoutId, renderId } }
    })
  })
}

export async function sendToReview(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('sendToReview', 'sendToReview', actor, id, version, async (post) => {
    const error = sendToReviewError(post.current)
    if (error) return fail(error)
    // A request for changes is answered by sending to review again (criterion 120).
    return save(post, version, actor, async () => ({
      stage: 'in_review',
      pointers: { ...post.pointers, sendBackId: null },
    }))
  })
}

/**
 * What an approval pins of the post as the reviewer read it: a feed post's revision, render and
 * market version, or a blog's text and pictures (BR5), which has none of those. Null when any it
 * needs is not current.
 */
function pinnedRecords(
  post: LoadedPost,
): Pick<
  Body<'approval'>,
  'revisionId' | 'renderId' | 'marketId' | 'blogTextId' | 'blogImagesId'
> | null {
  const { revision, render, market, blogText, blogImages } = post.current
  if (post.kind === 'blog') {
    if (!blogText || !blogImages) return null
    return { blogTextId: blogText.id, blogImagesId: blogImages.id, marketId: null }
  }
  if (!revision || !render) return null
  return { revisionId: revision.id, renderId: render.id, marketId: market?.id ?? null }
}

export async function approveAndPublish(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('approveAndPublish', 'approvePublish', actor, id, version, async (post) => {
    const error = publishError(actor)
    if (error) return fail(error)
    const { sourceCheck, settings } = post.current
    const pinned = pinnedRecords(post)
    if (!pinned || !sourceCheck || !settings) return fail(WORKFLOW_ERRORS.movedOn)

    // What the reviewer saw, pinned by id: the live post is this approval's records.
    return save(post, version, actor, async (tx) => {
      const approvalId = await putArtifact(tx, {
        kind: 'approval',
        postId: id,
        actorId: actor.id,
        body: {
          ...pinned,
          sourceCheckId: sourceCheck.id,
          settingsId: settings.id,
          // No slide vision check gates publishing any more (criterion 103).
          visionId: null,
          overrideId: null,
          pageBrandId: post.pointers.pageBrandId,
          by: stamp(actor),
          selfReviewed: actor.id === post.createdByUserId,
        },
      })
      // What students see from now on, in the same save (criteria 116, 117).
      await publishApproval(tx, id, approvalId)
      return { stage: 'live', pointers: { ...post.pointers, approvalId } }
    })
  })
}

/**
 * "Request changes" (criteria 47, 120): back to rendered with the reviewer's note and the step it
 * names, which stay through the editor's moves until the post is sent to review again. The note
 * names the revision read, or a blog's text (BR5).
 */
export async function sendBack(
  actor: Actor,
  id: string,
  version: number,
  reason: string,
  step: SendBackStep,
): Promise<Saved> {
  return command('sendBack', 'sendBack', actor, id, version, async (post) => {
    const error = sendBackError(reason)
    if (error) return fail(error)
    const { revision, blogText } = post.current
    const read =
      post.kind === 'blog'
        ? blogText && { blogTextId: blogText.id }
        : revision && { revisionId: revision.id }
    if (!read) return fail(WORKFLOW_ERRORS.movedOn)
    return save(post, version, actor, async (tx) => {
      const sendBackId = await putArtifact(tx, {
        kind: 'send_back',
        postId: id,
        actorId: actor.id,
        body: { ...read, reason: reason.trim(), by: stamp(actor), step },
      })
      return { stage: 'rendered', pointers: { ...post.pointers, sendBackId } }
    })
  })
}
