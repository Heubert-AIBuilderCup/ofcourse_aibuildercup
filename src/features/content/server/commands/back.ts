import 'server-only'
import { type BackTo, type PostAction, WORKFLOW_ERRORS } from '../../lib/workflow'
import type { Body, Pointers } from '../../model/artifacts'
import { canonicalJson } from '../hash'
import { type LoadedPost, listHistory, loadRecord } from '../store'
import { checkAfter } from './check'
import {
  type Actor,
  command,
  fail,
  fromRevisionCleared,
  type Next,
  type Saved,
  save,
  waitingFor,
} from './shared'

// The moves back (criteria 112, 115, 116, 118, 119): "Back to <step>", "Withdraw from review",
// "Edit" on a live post and "Discard changes". Records are never deleted; only the stage and the
// pointers move, in one save. Each waits while any step of the post runs, naming it. A live
// post's published version (content_post.published_approval_id) is never touched here, so
// students keep it until the next publish names another. A reviewer's request for changes stays
// through every move (criterion 120) until the post is sent to review again. An edit made at a
// passed step makes the same move by itself, in the edit's own save (./shared.ts open, GD28).

/** Opens the post for the move, refuses it while a step runs, then saves where it moves to. */
function move(
  name: string,
  action: PostAction,
  actor: Actor,
  id: string,
  version: number,
  to: (post: LoadedPost) => Next,
): Promise<Saved> {
  return command(name, action, actor, id, version, async (post) => {
    const waiting = await waitingFor(id)
    if (waiting) return fail(waiting)
    return save(post, version, actor, async () => to(post))
  })
}

/** Back to the text versions; the picked version is checked again after, as any text change is. */
async function toStructures(
  name: string,
  action: PostAction,
  actor: Actor,
  id: string,
  version: number,
): Promise<Saved> {
  const saved = await move(name, action, actor, id, version, (post) => ({
    stage: 'structures',
    pointers: fromRevisionCleared(post),
  }))
  return checkAfter(id, actor, saved)
}

/**
 * "Back to <step>" (criterion 112). To the text versions: what "Reopen structures" did. To the
 * source: the source, facts, versions and pick stay pointed at, so going forward unchanged finds
 * them again; nothing is checked, since nothing at the source step reads a check.
 */
export async function goBack(
  actor: Actor,
  id: string,
  version: number,
  to: BackTo,
): Promise<Saved> {
  if (to === 'structures') return toStructures('goBack', 'backToStructures', actor, id, version)
  return move('goBack', 'backToSource', actor, id, version, (post) => ({
    stage: 'source',
    pointers: fromRevisionCleared(post),
  }))
}

/** "Withdraw from review" (criterion 115): back to rendered, no reason and no send-back record. */
export async function withdrawFromReview(
  actor: Actor,
  id: string,
  version: number,
): Promise<Saved> {
  return move('withdrawFromReview', 'withdraw', actor, id, version, (post) => ({
    stage: 'rendered',
    pointers: post.pointers,
  }))
}

/**
 * "Edit" on a live post (criteria 116, 117): back to its text versions as a working copy, the
 * approval cleared for the working version only. Students keep the published version until
 * approveAndPublish names a new one at the same slug.
 */
export async function editLive(actor: Actor, id: string, version: number): Promise<Saved> {
  return toStructures('editLive', 'editLive', actor, id, version)
}

type Published = {
  pointers: Pick<
    Pointers,
    | 'approvalId'
    | 'revisionId'
    | 'renderId'
    | 'sourceCheckId'
    | 'settingsId'
    | 'marketId'
    | 'layoutId'
    | 'factsId'
    | 'sourceId'
    | 'themeId'
  >
  /** The page pinned at publish; undefined on approvals written before it was, which keep the working page. */
  pageBrandId: string | null | undefined
  factsId: string
  approvedAt: string
  revision: Body<'revision'>
}

/**
 * The pointers the published approval pins: its own records, the render's layout, the revision's
 * facts and the facts' source. Null when any is not this post's record of its kind.
 */
async function publishedPointers(postId: string, approvalId: string): Promise<Published | null> {
  const approval = await loadRecord(postId, approvalId)
  if (approval?.kind !== 'approval') return null
  const pinned = approval.body as Body<'approval'>
  const { revisionId, renderId } = pinned
  if (revisionId === undefined || renderId === undefined) return null
  const [render, revision] = await Promise.all([
    loadRecord(postId, renderId),
    loadRecord(postId, revisionId),
  ])
  if (render?.kind !== 'render' || revision?.kind !== 'revision') return null
  const revisionBody = revision.body as Body<'revision'>
  const facts = await loadRecord(postId, revisionBody.factsId)
  if (facts?.kind !== 'facts') return null
  return {
    factsId: facts.id,
    pageBrandId: pinned.pageBrandId,
    approvedAt: approval.createdAt,
    revision: revisionBody,
    pointers: {
      approvalId,
      revisionId,
      renderId,
      sourceCheckId: pinned.sourceCheckId,
      settingsId: pinned.settingsId,
      marketId: pinned.marketId,
      layoutId: (render.body as Body<'render'>).layoutId,
      factsId: facts.id,
      sourceId: (facts.body as Body<'facts'>).sourceId,
      themeId: revisionBody.themeId,
    },
  }
}

/**
 * The versions the published text was picked from: the current drafts when they share the
 * published facts, else the newest drafts record made from them by the time of the approval, read
 * from the history. Either way the pick is the version whose structure the revision copied, so a
 * pick changed since is not kept. The current ones when the history has none, since a live post
 * shows without them.
 */
async function publishedDrafts(
  post: LoadedPost,
  published: Published,
): Promise<Pick<Pointers, 'draftsId' | 'picked' | 'ticked'>> {
  const { draftsId, picked, ticked } = post.pointers
  const kept = { draftsId, picked, ticked }
  const drafts = post.current.drafts
  const record =
    drafts?.body.factsId === published.factsId ? drafts : await historyDrafts(post.id, published)
  if (!record) return kept
  const { items } = record.body
  const structure = canonicalJson(published.revision.structure)
  const index = items.findIndex((item) => canonicalJson(item.structure) === structure)
  return {
    draftsId: record.id,
    picked: index === -1 ? null : index,
    ticked: [...new Set(items.map((item) => item.template.id))].slice(0, 3),
  }
}

/** The newest drafts record made from the published facts by the time of the approval, or null. */
async function historyDrafts(
  postId: string,
  published: Published,
): Promise<{ id: string; body: Body<'drafts'> } | null> {
  const entry = (await listHistory(postId)).find(
    (h) => h.kind === 'drafts' && h.factsId === published.factsId && h.at <= published.approvedAt,
  )
  const record = entry ? await loadRecord(postId, entry.id) : null
  return record?.kind === 'drafts' ? { id: record.id, body: record.body as Body<'drafts'> } : null
}

/**
 * The pointers a blog's published approval pins (BR5): its text and pictures, the check and
 * settings, the text's outline, the outline's facts and the facts' source. Null when any is not
 * this post's record of its kind.
 */
async function publishedBlogPointers(
  postId: string,
  approvalId: string,
): Promise<{ pointers: Partial<Pointers>; pageBrandId: string | null | undefined } | null> {
  const approval = await loadRecord(postId, approvalId)
  if (approval?.kind !== 'approval') return null
  const pinned = approval.body as Body<'approval'>
  if (!pinned.blogTextId) return null
  const text = await loadRecord(postId, pinned.blogTextId)
  if (text?.kind !== 'blog_text') return null
  const outline = await loadRecord(postId, (text.body as Body<'blog_text'>).outlineId)
  if (outline?.kind !== 'blog_outline') return null
  const facts = await loadRecord(postId, (outline.body as Body<'blog_outline'>).factsId)
  if (facts?.kind !== 'facts') return null
  return {
    pageBrandId: pinned.pageBrandId,
    pointers: {
      approvalId,
      blogTextId: text.id,
      blogImagesId: pinned.blogImagesId ?? null,
      sourceCheckId: pinned.sourceCheckId,
      settingsId: pinned.settingsId,
      blogOutlineId: outline.id,
      factsId: facts.id,
      sourceId: (facts.body as Body<'facts'>).sourceId,
    },
  }
}

/** What Discard points a published post back at: its published approval's records. */
async function publishedOf(
  post: LoadedPost,
  approvalId: string,
): Promise<{ pointers: Partial<Pointers>; pageBrandId: string | null | undefined } | null> {
  if (post.kind === 'blog') return publishedBlogPointers(post.id, approvalId)
  const published = await publishedPointers(post.id, approvalId)
  if (!published) return null
  const drafts = await publishedDrafts(post, published)
  return { pageBrandId: published.pageBrandId, pointers: { ...published.pointers, ...drafts } }
}

/**
 * "Discard changes" (criterion 119): a published post being worked on again goes back to its live
 * version, pointing at the records its published approval pins, at stage live; a blog to its
 * published text and pictures (BR5). Nothing is deleted, so the discarded work stays in the
 * history; a request for changes on it goes too.
 */
export async function discardChanges(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('discardChanges', 'discardChanges', actor, id, version, async (post) => {
    if (post.publishedApprovalId === null) return fail(WORKFLOW_ERRORS.noPublished)
    const waiting = await waitingFor(id)
    if (waiting) return fail(waiting)
    const published = await publishedOf(post, post.publishedApprovalId)
    if (!published) return fail(WORKFLOW_ERRORS.movedOn)
    return save(post, version, actor, async () => ({
      stage: 'live',
      pointers: {
        ...post.pointers,
        ...published.pointers,
        pageBrandId:
          published.pageBrandId === undefined ? post.pointers.pageBrandId : published.pageBrandId,
        sendBackId: null,
      },
    }))
  })
}
