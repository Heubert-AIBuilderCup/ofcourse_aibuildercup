import 'server-only'
import { draftStructures, VERSIONS_PER_TEMPLATE } from '../../ai/draft'
import { outlinePost } from '../../ai/outline'
import { formatById } from '../../formats'
import { editOutline, type OutlineOp } from '../../lib/outline'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import { isLook, templateById } from '../../templates'
import { pageStyleOf } from '../page-style'
import { runStep } from '../steps'
import { putArtifact } from '../store'
import { OUTLINE_STEP } from './ideas'
import { type Actor, command, fail, type Saved, save } from './shared'

// A picked idea's outline (GD32), made by ./ideas.ts pickIdeas: the editor reorders, adds,
// removes or changes its slides, or changes its format (GD33), then "Write the slides" drafts
// three versions that follow it. A change to the outline sets aside the versions written to the
// one before, so the post is back at its outline (GD28).

/** The history's line for an outline change. */
function noteOf(op: OutlineOp): string {
  switch (op.op) {
    case 'move':
      return `Slide ${op.slide} moved`
    case 'add':
      return 'Slide added'
    case 'remove':
      return `Slide ${op.slide} removed`
    case 'change':
      return `Slide ${op.slide} changed`
  }
}

/**
 * One change to the outline (lib/outline.ts editOutline): saved as a new outline record with its
 * note, the versions written to the old one set aside. Refused, saving nothing, when there is no
 * outline, the slide is not there, the point is empty or long, or the look would not take it.
 */
export async function editPostOutline(
  actor: Actor,
  id: string,
  version: number,
  op: OutlineOp,
): Promise<Saved> {
  return command('editPostOutline', 'editOutline', actor, id, version, async (post) => {
    const outline = post.current.outline
    if (!outline) return fail(WORKFLOW_ERRORS.movedOn)
    const template = templateById(outline.body.ideas[0].look)
    if (!template || !isLook(template)) return fail(WORKFLOW_ERRORS.movedOn)
    const edited = editOutline(template, outline.body.slides, op)
    if (!edited.ok) return fail(edited.error)
    return save(post, version, actor, async (tx) => {
      const outlineId = await putArtifact(tx, {
        kind: 'post_outline',
        postId: id,
        actorId: actor.id,
        body: { ...outline.body, slides: edited.slides, note: noteOf(op) },
      })
      const pointers = { ...post.pointers, outlineId, draftsId: null, picked: null }
      return { stage: post.stage, pointers }
    })
  })
}

/**
 * The outline's format changed (GD33): the idea outlined again in it, one lite call, saved as a
 * new outline with its note, the versions written to the old one set aside. Each change is a new
 * attempt, so the same idea and format asked again is outlined again rather than read back from
 * the cache. Refused, before any call, for a format the file lacks or a post with no outline; a
 * failed outline saves nothing, and the outline step shows failed.
 */
export async function setOutlineFormat(
  actor: Actor,
  id: string,
  version: number,
  input: { format: string },
): Promise<Saved> {
  return command('setOutlineFormat', 'editOutline', actor, id, version, async (post) => {
    const format = formatById(input.format)
    if (!format) return fail(WORKFLOW_ERRORS.format)
    const { facts, outline } = post.current
    if (!facts || !outline) return fail(WORKFLOW_ERRORS.movedOn)
    const template = templateById(outline.body.ideas[0].look)
    if (!template || !isLook(template)) return fail(WORKFLOW_ERRORS.movedOn)

    return runStep(id, OUTLINE_STEP, version, async () => {
      const attempt = (outline.body.attempt ?? 1) + 1
      const outlined = await outlinePost({
        template,
        ideas: outline.body.ideas,
        format: format.id,
        facts: facts.body.facts,
        language: post.current.source?.body.language,
        postId: id,
        attempt,
      })
      if (!outlined.ok) return fail(outlined.error)
      return save(post, version, actor, async (tx) => {
        const outlineId = await putArtifact(tx, {
          kind: 'post_outline',
          postId: id,
          actorId: actor.id,
          body: {
            ...outline.body,
            format: format.id,
            attempt,
            slides: outlined.slides,
            note: `Format: ${format.label}`,
          },
        })
        const pointers = { ...post.pointers, outlineId, draftsId: null, picked: null }
        return { stage: post.stage, pointers }
      })
    })
  })
}

/**
 * "Write the slides" (GD32): three versions drafted in the outline's look for its idea, each
 * following the outline, its slides in order with their layouts and points (ai/draft.ts refuses
 * a version that departs from it). The drafts record keeps the idea, so each version shows the
 * idea it serves. Nothing is picked yet. A failed draft saves nothing, and the draft step shows
 * failed.
 */
export async function writeSlides(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('writeSlides', 'writeSlides', actor, id, version, async (post) => {
    const { source, facts, drafts, outline } = post.current
    if (!source || !facts || !outline) return fail(WORKFLOW_ERRORS.movedOn)
    const idea = { cards: outline.body.ideas }
    const look = idea.cards[0].look

    return runStep(id, 'draft', version, async (run) => {
      // How many versions are on their way, for the page to say (lib/running.ts).
      await run.progress(0, VERSIONS_PER_TEMPLATE)
      // Written again from the text, each press is its own call.
      const attemptNo = (drafts?.body.attempt ?? 0) + 1
      const drafted = await draftStructures({
        templateIds: [look],
        source: source.body,
        facts: facts.body.facts,
        attempt: attemptNo,
        postId: id,
        emotion: null,
        copyStyle: (await pageStyleOf(post.pointers.pageBrandId ?? null))?.copyStyle ?? null,
        idea,
        outline: { format: outline.body.format, slides: outline.body.slides },
      })
      if (!drafted.ok) return fail(drafted.error)
      return save(post, version, actor, async (tx) => {
        const draftsId = await putArtifact(tx, {
          kind: 'drafts',
          postId: id,
          actorId: actor.id,
          body: {
            factsId: facts.id,
            attempt: attemptNo,
            items: drafted.items,
            replays: drafted.replays,
            emotion: null,
            note: attemptNo > 1 ? 'Drafted again' : 'Drafted',
            idea,
          },
        })
        // "Draft again" drafts the same look.
        const pointers = { ...post.pointers, draftsId, ticked: [look], picked: null, themeId: null }
        return { stage: post.stage, pointers }
      })
    })
  })
}
