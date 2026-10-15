import 'server-only'
import { outlineBlog, writeBlogText } from '../../ai/blog'
import { type BlogOutlineOp, blogOutlineNote, editBlogSections } from '../../lib/blog-outline'
import { BLOG_PICTURE_ERRORS, withEmbed } from '../../lib/blog-pictures'
import {
  BLOG_TEXT_ERRORS,
  type BlogTextEdit,
  BlogTextEditSchema,
  blogTextNote,
  editBlogText,
} from '../../lib/blog-text'
import { approveBlogTextError, stepRunningError, WORKFLOW_ERRORS } from '../../lib/workflow'
import { runStep, runStepAfter, type StepRun } from '../steps'
import { type LoadedPost, linkedBlogOf, liveById, putArtifact } from '../store'
import { checkAfter } from './check'
import { OUTLINE_STEP } from './ideas'
import { planAfter } from './images'
import { type Actor, attempt, command, fail, type Saved, save } from './shared'

// A blog (BR1–BR3): made by "Make blog" (./source.ts makePost) with angle cards for its facts
// (./ideas.ts), the editor picks one and it is outlined as sections with question headings, key
// takeaways and an FAQ, which the editor shapes before any text is written. A change to the
// outline sets aside the text written to the one before. "Write the blog" writes the text from
// the outline in the background; the editor edits it in place, the source check reading each
// change after (./check.ts), and approves it across the gate once every sentence is found.
// Its pictures are then planned by themselves and drawn (./images.ts, BR4), and a linked live
// post's slides can sit after a section in place of a picture (embedPostSlides).

/** The longest post id a command reads: ids are UUIDs, so anything longer is not one. */
const POST_ID_MAX = 100

/** Only a blog has angles to pick and an outline of sections; on any other post the action is moved on. */
const notABlog = (post: LoadedPost) => post.kind !== 'blog'

/**
 * "Use this angle" (BR1, BR2): the card outlined by the model from the supported facts, the
 * framing line and the brand's voice, saved as the blog's outline with the card on it. The same
 * card picked again is the same call, its outline as the editor first saw it. Refused, before any
 * call, for a card not shown; a failed outline saves nothing, and the outline step shows failed.
 */
export async function pickBlogAngle(
  actor: Actor,
  id: string,
  version: number,
  input: { card: number },
): Promise<Saved> {
  return command('pickBlogAngle', 'pickBlogAngle', actor, id, version, async (post) => {
    if (notABlog(post)) return fail(WORKFLOW_ERRORS.movedOn)
    const { source, facts } = post.current
    const cards = post.current.ideas?.body.cards
    if (!source || !facts || !cards) return fail(WORKFLOW_ERRORS.movedOn)
    const { card } = input
    if (!Number.isInteger(card) || card < 0 || card >= cards.length) {
      return fail(WORKFLOW_ERRORS.angle)
    }
    const idea = cards[card]

    return runStep(id, OUTLINE_STEP, version, async () => {
      const outlined = await outlineBlog({
        idea,
        framing: source.body.framing ?? null,
        facts: facts.body.facts,
        language: source.body.language,
        postId: id,
        attempt: 1,
      })
      if (!outlined.ok) return fail(outlined.error)
      return save(post, version, actor, async (tx) => {
        const blogOutlineId = await putArtifact(tx, {
          kind: 'blog_outline',
          postId: id,
          actorId: actor.id,
          body: {
            factsId: facts.id,
            idea,
            sections: outlined.sections,
            takeaways: outlined.takeaways,
            faq: outlined.faq,
            note: 'Outlined',
          },
        })
        const pointers = { ...post.pointers, blogOutlineId, blogTextId: null }
        return { stage: post.stage, pointers }
      })
    })
  })
}

/**
 * One change to the blog's sections (lib/blog-outline.ts editBlogSections): saved as a new
 * outline record with its note, the text written to the old one set aside. Refused, saving
 * nothing, when there is no outline, the section is not there, the heading is not a question, a
 * line is empty or long, or the sections would be none or more than eight.
 */
export async function editBlogOutline(
  actor: Actor,
  id: string,
  version: number,
  op: BlogOutlineOp,
): Promise<Saved> {
  return command('editBlogOutline', 'editBlogOutline', actor, id, version, async (post) => {
    if (notABlog(post)) return fail(WORKFLOW_ERRORS.movedOn)
    const outline = post.current.blogOutline
    if (!outline) return fail(WORKFLOW_ERRORS.movedOn)
    const language = post.current.source?.body.language
    const edited = editBlogSections(outline.body.sections, op, language)
    if (!edited.ok) return fail(edited.error)
    return save(post, version, actor, async (tx) => {
      const blogOutlineId = await putArtifact(tx, {
        kind: 'blog_outline',
        postId: id,
        actorId: actor.id,
        body: { ...outline.body, sections: edited.sections, note: blogOutlineNote(op) },
      })
      const pointers = { ...post.pointers, blogOutlineId, blogTextId: null }
      return { stage: post.stage, pointers }
    })
  })
}

/** The step a blog's text is written as: its lock, its progress, and what the page shows running or failed. */
export const BLOG_TEXT_STEP = 'blog_text'

/**
 * The text written from the outline under the step's lock, its sections counted for the page
 * (lib/running.ts), saved as a blog_text record; the source check runs after. A failed writing
 * saves nothing, and the step shows failed with "Try again".
 */
async function writeText(
  post: LoadedPost,
  version: number,
  actor: Actor,
  run: StepRun,
): Promise<Saved> {
  const { source, facts, blogOutline, blogText } = post.current
  if (!source || !facts || !blogOutline) return fail(WORKFLOW_ERRORS.movedOn)
  // A run that lost its lock stops; the run that holds it goes on.
  if (!(await run.progress(0, blogOutline.body.sections.length))) {
    return fail(WORKFLOW_ERRORS.movedOn)
  }
  const written = await writeBlogText({
    outline: blogOutline.body,
    framing: source.body.framing ?? null,
    notes: source.body.notes ?? null,
    facts: facts.body.facts,
    language: source.body.language,
    postId: post.id,
    // The post's version moves with every save, so each press is its own call.
    attempt: version,
  })
  if (!written.ok) return fail(written.error)
  const saved = await save(post, version, actor, async (tx) => {
    const blogTextId = await putArtifact(tx, {
      kind: 'blog_text',
      postId: post.id,
      actorId: actor.id,
      body: {
        outlineId: blogOutline.id,
        ...written.text,
        emotion: null,
        note: blogText ? 'Written again' : 'Written',
      },
    })
    return { stage: post.stage, pointers: { ...post.pointers, blogTextId } }
  })
  return checkAfter(post.id, actor, saved)
}

/**
 * "Write the blog" (BR3): the outline written as text from the supported facts, after the
 * response, so the page shows the sections being written and then the text, or the step failed.
 * Refused, before any call, with no outline, and while it is already being written.
 */
export async function writeBlog(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('writeBlog', 'writeBlog', actor, id, version, async (post) => {
    const { source, facts, blogOutline } = post.current
    if (!source || !facts || !blogOutline) return fail(WORKFLOW_ERRORS.movedOn)
    const started = await runStepAfter(id, BLOG_TEXT_STEP, version, (run) =>
      attempt('writeBlog', () => writeText(post, version, actor, run)),
    )
    return started ? { ok: true, id, version } : fail(stepRunningError(BLOG_TEXT_STEP))
  })
}

/**
 * One change to the text in place (BR3; lib/blog-text.ts editBlogText): a section's heading or
 * body, a takeaway, an FAQ question or answer, or a takeaway or question removed, saved as a new
 * blog_text record with its note, its facts bound as they were. The source check runs after and
 * reads again only the sentences that changed (ai/source-check.ts keeps the rest). Text that does
 * not change saves nothing; a change that is not one, or would leave a part out of bounds, is
 * refused.
 */
export async function editBlogSection(
  actor: Actor,
  id: string,
  version: number,
  edit: BlogTextEdit,
): Promise<Saved> {
  return command('editBlogSection', 'editBlogText', actor, id, version, async (post) => {
    const parsed = BlogTextEditSchema.safeParse(edit)
    if (!parsed.success) return fail(BLOG_TEXT_ERRORS.part)
    const text = post.current.blogText
    if (!text) return fail(WORKFLOW_ERRORS.movedOn)
    const edited = editBlogText(text.body, parsed.data, post.current.source?.body.language)
    if (!edited.ok) return fail(edited.error)
    const { sections, takeaways, faq } = text.body
    if (JSON.stringify(edited.text) === JSON.stringify({ sections, takeaways, faq })) {
      return { ok: true, id, version }
    }
    const saved = await save(post, version, actor, async (tx) => {
      const blogTextId = await putArtifact(tx, {
        kind: 'blog_text',
        postId: id,
        actorId: actor.id,
        body: { ...text.body, ...edited.text, note: blogTextNote(parsed.data) },
      })
      return { stage: post.stage, pointers: { ...post.pointers, blogTextId } }
    })
    return checkAfter(id, actor, saved)
  })
}

/**
 * "Approve text" (BR3, criterion 43): the blog crosses the gate to its images once its text is
 * written, every question answered and the source check of this very text clean. The pin is the
 * post's blogTextId: records never change, and any edit to the text takes the blog back to its
 * text (lib/workflow.ts editHome), so at the images it points at the text approved. The
 * reviewer's approval names it in turn (model/artifacts.ts approval.blogTextId). Its pictures are
 * planned after the response (BR4), as a look post's images are (GD12).
 */
export async function approveBlogText(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('approveBlogText', 'approveBlogText', actor, id, version, async (post) => {
    const error = approveBlogTextError(post.current)
    if (error) return fail(error)
    const saved = await save(post, version, actor, async () => ({
      stage: 'approved',
      pointers: post.pointers,
    }))
    if (saved.ok) await planAfter(actor, id, saved.version)
    return saved
  })
}

/**
 * A linked live post's slides after section `at` of the blog (BR4, BR7), in place of the picture
 * planned there, which is then not drawn: saved as a new blog_images record with the pictures as
 * they were. The same post again moves it; one that sat there gives way. Refused, saving nothing,
 * for a place that is not a section, a fourth post, a post not linked to this blog (or none), and
 * one students cannot see now (unpublished or expired). The post's id is only a claim until the
 * database says it is linked here and live.
 */
export async function embedPostSlides(
  actor: Actor,
  id: string,
  version: number,
  input: { postId: string; at: number },
): Promise<Saved> {
  return command('embedPostSlides', 'embedPostSlides', actor, id, version, async (post) => {
    const text = post.current.blogText
    if (notABlog(post) || !text) return fail(WORKFLOW_ERRORS.movedOn)
    const { postId, at } = input
    if (typeof postId !== 'string' || postId.length === 0 || postId.length > POST_ID_MAX) {
      return fail(BLOG_PICTURE_ERRORS.notLinked)
    }
    const pictures = post.current.blogImages?.body ?? null
    const placed = withEmbed(
      pictures?.embeds ?? [],
      { after: at, postId },
      text.body.sections.length,
    )
    if (!placed.ok) return fail(placed.error)
    if ((await linkedBlogOf(postId)) !== id) return fail(BLOG_PICTURE_ERRORS.notLinked)
    if (!(await liveById(postId))) return fail(BLOG_PICTURE_ERRORS.notLive)
    return save(post, version, actor, async (tx) => {
      const blogImagesId = await putArtifact(tx, {
        kind: 'blog_images',
        postId: id,
        actorId: actor.id,
        body: {
          blogTextId: text.id,
          version: pictures?.version ?? 1,
          images: pictures?.images ?? [],
          embeds: placed.embeds,
        },
      })
      return { stage: post.stage, pointers: { ...post.pointers, blogImagesId } }
    })
  })
}
