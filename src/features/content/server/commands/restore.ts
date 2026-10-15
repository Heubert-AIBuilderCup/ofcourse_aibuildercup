import 'server-only'
import { fitPasses } from '../../layout/fit'
import { restoreError, WORKFLOW_ERRORS } from '../../lib/workflow'
import type { Body } from '../../model/artifacts'
import { getAsset, type LoadedPost, loadRecord, putArtifact } from '../store'
import { checkAfter } from './check'
import {
  type Actor,
  clearFromRevision,
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
  sourcesAtOf,
} from './shared'

// Version history (criterion 101): every structure and revision is already an immutable record,
// so "Restore" writes no text. It points the post back at the record as a new version through the
// same save as every edit, so a stale copy is refused with who changed it, and the source check
// follows. Records are only ever added: a restored revision gets its layout and render again.

/**
 * An earlier structure as the post's structures again: before the gate the pick stays while the
 * record has that version clean; past the gate this reopens the structures with it, as "Reopen
 * structures" does, and the render-stage records stop counting.
 */
async function restoreDrafts(
  post: LoadedPost,
  version: number,
  actor: Actor,
  record: { id: string; body: Body<'drafts'> },
  madeFrom: { sourceId: string; factsId: string },
): Promise<Saved> {
  const picked = post.pointers.picked
  const item = picked === null ? undefined : record.body.items[picked]
  const pick = item && (item.problems ?? []).length === 0 ? picked : null
  const saved = await save(post, version, actor, async () => ({
    stage: 'structures',
    pointers: {
      ...clearFromRevision(post.pointers),
      // The check stays named, so sentences read on the same basis are not read again.
      sourceCheckId: post.pointers.sourceCheckId,
      ...madeFrom,
      draftsId: record.id,
      picked: pick,
    },
  }))
  return checkAfter(post.id, actor, saved)
}

/**
 * The facts and source a structure was drafted from, when they are the post's own records: the
 * current ones, or an earlier source's (criterion 113). Null when either is missing.
 */
async function draftedFrom(
  post: LoadedPost,
  factsId: string,
): Promise<{ sourceId: string; factsId: string } | null> {
  const { source, facts } = post.current
  if (source && facts?.id === factsId) return { sourceId: source.id, factsId }
  const earlier = await loadRecord(post.id, factsId)
  if (earlier?.kind !== 'facts') return null
  const { sourceId } = earlier.body as Body<'facts'>
  const made = await loadRecord(post.id, sourceId)
  return made?.kind === 'source' ? { sourceId, factsId } : null
}

/**
 * An earlier revision as the post's approved text again, as reviseClaim moves to a new one: its
 * layout from the same engine, and when the fits pass and the post has a render, the slides drawn
 * again with the art it already has (a look's images, slide by slide); else back to approved, unrendered. The covers pointer is not
 * touched: current() keeps a covers record only for the revision it was made for, so covers count
 * again when that very text comes back and stop counting otherwise.
 */
async function restoreRevision(
  post: LoadedPost,
  version: number,
  actor: Actor,
  record: { id: string; body: Body<'revision'> },
): Promise<Saved> {
  const { source, facts, revision, render } = post.current
  if (!source || !facts) return fail(WORKFLOW_ERRORS.movedOn)
  if (record.id === revision?.id) return { ok: true, id: post.id, version }
  const layout = layoutOf(record.id, record.body, source.body, facts.body, sourcesAtOf(post), post)

  let drawn: Drawn | null = null
  let artBytes: Uint8Array | null = null
  let images: RenderImages | null = null
  if (render && fitPasses(layout.fitChecks)) {
    const artId = render.body.art.assetId
    ;[artBytes, images] = await Promise.all([
      artId ? getAsset(artId).then((a) => a?.bytes ?? null) : null,
      imagesOf(render.body),
    ])
    drawn = draw(record.body, layout, artBytes, undefined, images)
  }

  const saved = await save(post, version, actor, async (tx) => {
    const layoutId = await putArtifact(tx, {
      kind: 'layout',
      postId: post.id,
      body: layout,
      actorId: actor.id,
    })
    if (!drawn || !render) {
      return {
        stage: 'approved',
        pointers: { ...post.pointers, revisionId: record.id, layoutId, renderId: null },
      }
    }
    const renderId = await putRender(tx, post, actor, {
      revisionId: record.id,
      layoutId,
      drawn,
      art: { ...render.body.art, bytes: artBytes },
      images,
    })
    return {
      stage: post.stage,
      pointers: { ...post.pointers, revisionId: record.id, layoutId, renderId },
    }
  })
  return checkAfter(post.id, actor, saved)
}

/**
 * "Restore" on a version in the history (criterion 101): the post's own structure or revision
 * record by id. A structure points the post back at the facts and source it was drafted from, so
 * its fact bindings still resolve after the source was remade (criterion 113); a revision must be
 * made from the facts the post still points at. Anything else is moved on.
 */
export async function restoreVersion(
  actor: Actor,
  id: string,
  version: number,
  recordId: string,
): Promise<Saved> {
  return command('restoreVersion', 'restore', actor, id, version, async (post) => {
    const record = await loadRecord(id, recordId)
    const facts = post.current.facts
    if (!record || !facts || (record.kind !== 'drafts' && record.kind !== 'revision')) {
      return fail(WORKFLOW_ERRORS.movedOn)
    }
    const error = restoreError(record.kind, post.stage)
    if (error) return fail(error)
    // Both kinds name the facts they were made from; current() drops a record made from others.
    if (record.kind === 'drafts') {
      const body = record.body as Body<'drafts'>
      const madeFrom = await draftedFrom(post, body.factsId)
      if (!madeFrom) return fail(WORKFLOW_ERRORS.movedOn)
      return restoreDrafts(post, version, actor, { id: record.id, body }, madeFrom)
    }
    const body = record.body as Body<'revision'>
    if (body.factsId !== facts.id) return fail(WORKFLOW_ERRORS.earlierFacts)
    return restoreRevision(post, version, actor, { id: record.id, body })
  })
}
