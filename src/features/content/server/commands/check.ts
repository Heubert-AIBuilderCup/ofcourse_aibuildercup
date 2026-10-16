import 'server-only'
import { db } from '@/shared/lib/db'
import { type CheckClaim, checkClaims } from '../../ai/source-check'
import { blogClaims } from '../../lib/blog-text'
import { claimsWithEvidence } from '../../lib/claims'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import type { Body } from '../../model/artifacts'
import { afterResponse } from '../after'
import { runStep, runStepAfter } from '../steps'
import {
  type LoadedPost,
  loadPost,
  putArtifact,
  type SourceCheckLink,
  setSourceCheckPointer,
} from '../store'
import { type Actor, fail, type Saved } from './shared'

// The source check runs by itself (criterion 98): after every saved change to the text, and after
// approval, on the text the post points at then: the approved revision, or before approval the
// picked version, or a blog's text (BR3). It runs after the response (../after.ts), and lands
// only while the post still points at what it read. A sentence read before on the same basis is
// not read again (ai/source-check.ts), so a change re-reads only what changed.

/** The step the check runs as: its lock, and what the page shows running or failed. */
export const CHECK_STEP = 'source_check'

/** What the check reads on a post now: its sentences with their evidence, and the link its record carries. */
export type CheckTarget = {
  claims: CheckClaim[]
  source: Body<'source'>
  link: SourceCheckLink
}

/**
 * The approved revision, or with none, the picked version; a blog's text (BR3). Null when there
 * is none.
 */
export function checkTarget(post: LoadedPost): CheckTarget | null {
  const { source, facts, drafts, revision, blogText } = post.current
  if (!source || !facts) return null
  const base = { source: source.body }
  if (post.kind === 'blog') {
    if (!blogText) return null
    const claims = blogClaims(blogText.body, facts.body.facts)
    return { ...base, claims, link: { revisionId: null, blogTextId: blogText.id } }
  }
  if (revision) {
    const { structure, template } = revision.body
    const claims = claimsWithEvidence(structure, template, facts.body.facts)
    return { ...base, claims, link: { revisionId: revision.id } }
  }
  const index = post.pointers.picked
  const item = index === null ? undefined : drafts?.body.items[index]
  if (!drafts || index === null || !item) return null
  return {
    ...base,
    claims: claimsWithEvidence(item.structure, item.template, facts.body.facts),
    link: { revisionId: null, draft: { draftsId: drafts.id, index } },
  }
}

/**
 * The check the post points at, current or not: an "opinion" mark and every sentence read on the
 * same basis carry over from it.
 */
export function previousCheck(post: LoadedPost): Body<'source_check'> | null {
  const id = post.pointers.sourceCheckId
  const record = id ? post.records.get(id) : undefined
  return record?.kind === 'source_check' ? (record.body as Body<'source_check'>) : null
}

/** The check of a target, read now. */
export function checkNow(post: LoadedPost, target: CheckTarget) {
  return checkClaims({
    claims: target.claims,
    source: target.source,
    previous: previousCheck(post),
    postId: post.id,
  })
}

/** How many texts one run reads: the editor may save again while it reads. */
const CHECK_TRIES = 3

/**
 * Checks the text the post points at and records the result. Text saved while it read has no
 * check yet, so that is read too, a few times at most.
 */
async function checkCurrent(id: string, actor: Actor): Promise<Saved> {
  let result: Saved = fail(WORKFLOW_ERRORS.movedOn)
  for (let i = 0; i < CHECK_TRIES; i++) {
    const post = await loadPost(id)
    const target = post && checkTarget(post)
    if (!post || !target || (i > 0 && post.current.sourceCheck)) return result
    const checked = await checkNow(post, target)
    if (!checked.ok) return fail(checked.error)
    const checkId = await db.transaction((tx) =>
      putArtifact(tx, {
        kind: 'source_check',
        postId: id,
        actorId: actor.id,
        body: { ...target.link, claims: checked.claims, replays: checked.replays },
      }),
    )
    const version = await setSourceCheckPointer(id, checkId, target.link)
    result = version === null ? fail(WORKFLOW_ERRORS.movedOn) : { ok: true, id, version }
  }
  return result
}

/**
 * Runs the source check on a post just saved, after the response: the command returns once it is
 * saved, and the page, polling while the step runs, shows the result when it lands. What was
 * saved stands whatever happens there: a failed check leaves none, the step records the failure
 * for the page to show with "Try again" (./review.ts checkSource).
 */
export async function checkAfter(id: string, actor: Actor, saved: Saved): Promise<Saved> {
  if (!saved.ok) return saved
  const started = await runStepAfter(id, CHECK_STEP, saved.version, () => checkCurrent(id, actor))
  // A run already in flight may finish without seeing this text: once it has, check again.
  if (!started) afterResponse(() => checkOnceFree(id, actor, saved.version))
  return saved
}

/** How often, and for how long, a check waits for one in flight to finish. */
const WAIT_MS = 250
const WAIT_TRIES = 240

/**
 * Waits for the check in flight to finish, then checks the text the post points at, unless a
 * check of it already counts. Gives up after WAIT_TRIES; the page then offers "Try again".
 */
async function checkOnceFree(id: string, actor: Actor, version: number): Promise<void> {
  for (let i = 0; i < WAIT_TRIES; i++) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS))
    const post = await loadPost(id)
    if (!post || !checkTarget(post) || post.current.sourceCheck) return
    const result = await runStep(id, CHECK_STEP, version, () => checkCurrent(id, actor))
    if (result.ok || result.error !== WORKFLOW_ERRORS.running) return
  }
}
