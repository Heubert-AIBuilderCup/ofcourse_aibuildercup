'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ACCESS_ERRORS } from '@/shared/lib/auth/access'
import { BOARD_PATH } from '@/shared/lib/auth/gate'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import { PRESETS } from './brands/guideline'
import { EMOTION_ERROR, emotionError } from './emotions'
import { IDEAS_PATH } from './ideas-queue'
import { LANGUAGE_IDS } from './languages'
import { BLOG_PICTURE_ERRORS } from './lib/blog-pictures'
import { BLOG_TEXT_ERRORS, BlogTextEditSchema } from './lib/blog-text'
import { ASSIGN_ERRORS } from './lib/board'
import { postPath, STEP_IDS, stepPath } from './lib/steps'
import { BACK_TO, WORKFLOW_ERRORS } from './lib/workflow'
import { SEND_BACK_STEPS, SOURCE_ERRORS } from './model/artifacts'
import { SHARE_ERRORS } from './model/share'
import { FeedSettingsSchema, FORMAT_IDS, LAYOUT_IDS, OUTLINE_JOBS } from './model/types'
import { assignPost } from './server/assign'
import {
  type Actor,
  addFact,
  addResearchSource,
  applySourceWording,
  approveAndPublish,
  approveBlogText,
  approveStructure,
  checkSource,
  chooseCover,
  choosePage,
  chooseTheme,
  continueWithSource,
  discardChanges,
  draftPost,
  drawImages,
  editBlogOutline,
  editBlogSection,
  editImageScene,
  editLive,
  editPostOutline,
  editSlot,
  embedPostSlides,
  fixUnbound,
  goBack,
  lightEdit,
  linkToBlog,
  type Made,
  type Measured,
  makeBlogFromPost,
  makeCovers,
  makeMarket,
  makePost,
  makePostsFromBlog,
  markOpinion,
  measureSlot,
  moreIdeas,
  nudgeImage,
  nudgeSlide,
  nudgeVersion,
  pickBlogAngle,
  pickIdeas,
  pickStructure,
  planImages,
  type Researched,
  redraftSlide,
  remakeFromSource,
  removeClaim,
  removeFact,
  renderPost,
  researchClaim,
  restoreVersion,
  retryArt,
  rewordMarket,
  type Saved,
  type Suggested,
  saveSettings,
  sendBack,
  sendToReview,
  setLook,
  setOutlineFormat,
  setPreset,
  setSlideLayout,
  skipPictures,
  suggestSources,
  tickTemplates,
  withdrawFromReview,
  writeBlog,
  writeSlides,
} from './server/commands'
import { recordIdeaPost } from './server/ideas-queue'
import {
  adaptPost,
  approveLayout,
  checkCaption,
  editCaption,
  type MadeSet,
  makeSet,
  markExported,
  recordPostUrl,
  renderSocial,
  resetCaption,
  SOCIAL_ERRORS,
  sharePost,
} from './server/social'
import { TAGS, tagById } from './tags'

// The feed-post actions the workbench calls. Each reads the actor from the session (the proxy and
// the layout only hide the pages), checks the browser's input with zod, hands both to its command
// in ./server/commands, which applies every access rule, and on success refreshes the board
// and the post. Nothing here throws: a failure is a message.

const UNKNOWN = 'Unknown post.'
const INVALID_SOURCE = 'Give the source a title, a kind and its text, or its link.'

const PostId = z.string().uuid()
const Version = z.number().int().positive()
/** The steps "Back to <step>" goes to. */
const BackStep = z.enum(BACK_TO)
/** The step a request for changes names (criterion 120). */
const ChangesStep = z.enum(SEND_BACK_STEPS)
const index = z.number().int().min(0).max(999)

/**
 * The source fields "Make post" and "Save and remake" share (GD18). The command applies the
 * rules, the five-link limit and the framing line's length among them, by name; this only keeps
 * the browser's values to their types and sizes.
 */
const SourceFields = {
  text: z.string().max(100_000).optional(),
  links: z.array(z.string().max(10_000)).max(20).optional(),
  framing: z.string().max(10_000).optional(),
  notes: z.string().max(10_000).optional(),
  /** The post's language (GD36), one of the language file's. */
  language: z.enum(LANGUAGE_IDS).optional(),
}
const StartInput = z.object({
  requestId: PostId,
  title: z.string().max(10_000).optional(),
  kind: z.string().max(10_000).optional(),
  ...SourceFields,
  /** The page the post is made for (criterion 105); the command checks it is a page. */
  pageBrandId: z.string().max(64).nullish(),
  /** A feed post, or a blog (BR1). */
  postKind: z.enum(['feed', 'blog']).optional(),
  /** The Ideas queue idea New post was started from, when it was; the post made is recorded on it. */
  ideaId: z.string().max(64).optional(),
})
/** A changed source (criterion 113): the same fields; the command applies the rules. */
const RemakeInput = z.object(SourceFields).strict()
const Ticks = z.array(z.string().max(64)).max(20)
/** Settings from the form: every tag id must be in the tag file (criterion 80). */
const SettingsInput = FeedSettingsSchema.extend({
  tags: z
    .array(
      z
        .string()
        .max(64)
        .refine((id) => tagById(id) !== null),
    )
    .max(TAGS.length)
    .default([]),
})
const FixAt = z.object({
  slide: z.number().int().positive().max(99),
  slot: z.string().max(64),
  factId: z.string().max(64),
})
// The command applies the text's rules; this only keeps the browser's values to their types.
const SlotEdit = z.object({
  slide: z.number().int().positive().max(99),
  slot: z.string().max(64),
  text: z.string().max(10_000),
})
/** A source sentence's id, like ¶2.3: paragraph 2, sentence 3. */
const SentenceId = z
  .string()
  .max(16)
  .regex(/^¶\d+\.\d+$/)
const FactId = z.string().min(1).max(64)
const slideNo = z.number().int().positive().max(99)
const Edit = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('phrase'),
    slide: slideNo,
    slot: z.enum(['phrase', 'underline']),
    text: z.string().max(10_000),
  }),
  z.object({
    kind: z.literal('swapImage'),
    image: z.union([
      z.object({ assetId: z.string().min(1).max(128) }),
      z.object({ library: z.string().min(1).max(64) }),
    ]),
    /** On a look post, the slide whose image goes back to an earlier take (GD13). */
    slide: slideNo.optional(),
  }),
  z.object({ kind: z.literal('reorder'), from: slideNo, to: slideNo }),
])

/** A version's slide and the layout to lay it out in (GD5). */
const SlideLayout = z.object({ index, slide: slideNo, layout: z.enum(LAYOUT_IDS) })
/** A version and the look to move it to (GD4); the command matches the id to a look. */
const LookChoice = z.object({ index, look: z.string().max(64) })
// A text chip by id (GD10); the command matches it to a chip.
const nudgeId = z.string().max(64)
/** A text chip on one slide of the picked version (GD10). */
const SlideNudge = z.object({ slide: slideNo, nudge: nudgeId })
/** A text chip on a whole version (GD10). */
const VersionNudge = z.object({ index, nudge: nudgeId })
/** A planned scene in the editor's words (GD12); the command applies the length and the art prompt guard. */
const SceneEdit = z.object({ slide: slideNo, text: z.string().max(10_000) })
/** An image chip on one drawn slide (GD13), or none for "New picture"; the command matches it to a chip. */
const ImageNudge = z.object({ slide: slideNo, nudge: nudgeId.nullable() })
/** One idea card, or up to four to combine, by place (GD2); the command checks each is shown. */
const IdeaPick = z.object({ cards: z.array(index).min(1).max(4) })
/** An outline slide's point; the command applies its length (lib/outline.ts). */
const Point = z.string().max(10_000)
/**
 * One change to the outline (GD32), slides and places by number; the command checks they are in
 * the outline and that the look takes the change.
 */
const OutlineEdit = z.discriminatedUnion('op', [
  z.object({ op: z.literal('move'), slide: slideNo, to: slideNo }).strict(),
  z
    .object({
      op: z.literal('add'),
      at: slideNo,
      slide: z.object({ job: z.enum(OUTLINE_JOBS), layout: z.enum(LAYOUT_IDS), point: Point }),
    })
    .strict(),
  z.object({ op: z.literal('remove'), slide: slideNo }).strict(),
  z
    .object({
      op: z.literal('change'),
      slide: slideNo,
      job: z.enum(OUTLINE_JOBS).optional(),
      layout: z.enum(LAYOUT_IDS).optional(),
      point: Point.optional(),
    })
    .strict(),
])

/** One of a blog's angle cards, by place (BR1); the command checks it is shown. */
const AnglePick = z.object({ card: index })
/** A blog outline section's heading or point; the command applies the question rule and lengths (lib/blog-outline.ts). */
const SectionText = z.string().max(10_000)
/** One change to a blog's sections (BR2), sections and places by number; the command checks them. */
const BlogOutlineEdit = z.discriminatedUnion('op', [
  z.object({ op: z.literal('move'), section: slideNo, to: slideNo }).strict(),
  z
    .object({
      op: z.literal('add'),
      at: slideNo,
      section: z.object({ heading: SectionText, point: SectionText }),
    })
    .strict(),
  z.object({ op: z.literal('remove'), section: slideNo }).strict(),
  z
    .object({
      op: z.literal('reword'),
      section: slideNo,
      heading: SectionText.optional(),
      point: SectionText.optional(),
    })
    .strict(),
])

/** A linked live post's slides after a section of a blog (BR4); the command checks the post is linked and live. */
const Embed = z.object({ postId: PostId, at: slideNo })
/** A new post or blog's id, so a double press is one (BR6, BR8). */
const Request = z.object({ requestId: PostId })
/** The blog a post is linked to, or none to unlink it (BR8); the command checks it is a blog. */
const BlogLink = z.object({ blogId: PostId.nullable() })

const Adapt = z.object({
  brandId: z.string().max(64),
  platform: z.enum(['instagram', 'linkedin']),
  requestId: PostId,
})
// The command matches the ids to the pages; this only keeps the browser's values to post ids.
const SetIds = z.object({ requestIds: z.record(z.string().max(64), PostId) })
// The command applies the caption rules; this only keeps the browser's values to their types.
const Caption = z.object({
  text: z.string().max(10_000),
  hashtags: z.array(z.string().max(100)).max(20),
})
// The command applies the instagram.com rule; this only keeps the browser's value to text.
const PostUrl = z.string().trim().max(2048)
/** The accounts a share goes to, as two lists of ids; the command checks each is listed (9). */
const ShareInput = z.object({
  instagram: z.array(z.string().max(64)).max(20),
  linkedin: z.array(z.string().max(64)).max(20),
})

/** A text record's id as server/hash.ts writes it: the kind, then 32 hex characters (criterion 101). */
const TextRecordId = z.string().regex(/^(drafts|revision)_[0-9a-f]{32}$/)

/** The market id the browser chose, as a string for the command to look up; anything else is nothing chosen. */
const MarketChoice = z.string().max(8).catch('')

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

async function asActor<R extends { ok: boolean }>(
  run: (actor: Actor) => Promise<R>,
): Promise<R | { ok: false; error: string }> {
  const s = await getSession()
  if (!s) return fail(ACCESS_ERRORS.notAuthorised)
  const { id, role, editor, reviewer, name } = s.user
  return run({ id, role: role ?? '', editor: editor === true, reviewer: reviewer === true, name })
}

/**
 * The board and the post: its address and each step screen (GD27), each by its literal path,
 * which takes no type (next/dist/docs revalidatePath.md). The route pattern with 'layout' would
 * refresh every post.
 */
function changed(id: string) {
  revalidatePath('/admin/board')
  revalidatePath(postPath(id))
  for (const step of STEP_IDS) revalidatePath(stepPath(id, step))
}

/**
 * Runs a command on a post: the session first, then the id and version, then the command (which
 * parses its other arguments in `run`), then the refresh.
 */
async function onPost<R extends Made = Saved>(
  id: unknown,
  at: unknown,
  run: (actor: Actor, id: string, version: number) => Promise<R>,
): Promise<R | Saved> {
  return asActor(async (actor) => {
    const i = PostId.safeParse(id)
    const v = Version.safeParse(at)
    if (!i.success || !v.success) return fail(UNKNOWN)
    const result = await run(actor, i.data, v.data)
    if (result.ok) changed(i.data)
    return result
  })
}

/**
 * "Make post" from pasted text or up to five links: extraction, then the drafts after the
 * response (criteria 93, 94; GD18). The request id is the post's id, so a double submit is one
 * post. When no link could be read, the refusal lists each.
 */
export async function makePostAction(input: unknown): Promise<Made> {
  return asActor(async (actor) => {
    const parsed = StartInput.safeParse(input)
    if (!parsed.success) return fail(INVALID_SOURCE)
    const { ideaId, ...start } = parsed.data
    const result = await makePost(actor, start)
    if (result.ok) {
      changed(result.id)
      // The post stands either way; a failure to record it is logged there.
      if (ideaId) {
        await recordIdeaPost(actor, ideaId, result.id)
        revalidatePath(IDEAS_PATH)
      }
    }
    return result
  })
}

/** The idea "Find sources" searches for (BR12); the command applies its rules. */
const IdeaInput = z.object({ idea: z.string().max(10_000) })

/**
 * "Find sources" for an idea (BR12): the pages Google Search suggests, and its entry point. A
 * lookup: no post is made and nothing is refreshed.
 */
export async function suggestSourcesAction(input: unknown): Promise<Suggested> {
  return asActor(async (actor) => {
    const parsed = IdeaInput.safeParse(input)
    if (!parsed.success) return fail(SOURCE_ERRORS.ideaEmpty)
    return suggestSources(actor, { idea: parsed.data.idea })
  })
}

export async function tickTemplatesAction(id: unknown, at: unknown, ids: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = Ticks.safeParse(ids)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.ticks)
    return tickTemplates(actor, postId, v, parsed.data)
  })
}

/**
 * A chip's id or the editor's own word, trimmed; none is null. The rule is the emotion file's
 * (criterion 100), its length counted as a reader sees it.
 */
const EmotionInput = z
  .string()
  .max(10_000)
  .trim()
  .refine((e) => emotionError(e) === null)
  .nullish()

export async function draftAction(
  id: unknown,
  at: unknown,
  again: unknown,
  emotion?: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = EmotionInput.safeParse(emotion)
    if (!parsed.success) return fail(EMOTION_ERROR)
    return draftPost(actor, postId, v, again === true, parsed.data ?? null)
  })
}

export async function pickAction(id: unknown, at: unknown, pick: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = index.safeParse(pick)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return pickStructure(actor, postId, v, parsed.data)
  })
}

export async function themeAction(id: unknown, at: unknown, themeId: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = z.string().max(64).safeParse(themeId)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.noTheme)
    return chooseTheme(actor, postId, v, parsed.data)
  })
}

/** The page the post is made for, or none (criterion 105); the command checks it is a page. */
export async function choosePageAction(id: unknown, at: unknown, page: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = z.string().max(64).nullable().safeParse(page)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.page)
    return choosePage(actor, postId, v, parsed.data)
  })
}

export async function fixUnboundAction(id: unknown, at: unknown, slot: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = FixAt.safeParse(slot)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return fixUnbound(actor, postId, v, parsed.data)
  })
}

/** The editor's words in one slot of the picked version, typed on its slide (criterion 98). */
export async function editSlotAction(id: unknown, at: unknown, edit: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = SlotEdit.safeParse(edit)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return editSlot(actor, postId, v, parsed.data)
  })
}

/**
 * The fit rows one slot would have with the words being typed (criterion 98), for the slot editor
 * while the editor types. Saves nothing, so nothing is refreshed.
 */
export async function measureSlotAction(
  id: unknown,
  at: unknown,
  edit: unknown,
): Promise<Measured> {
  return asActor(async (actor) => {
    const i = PostId.safeParse(id)
    const v = Version.safeParse(at)
    if (!i.success || !v.success) return fail(UNKNOWN)
    const parsed = SlotEdit.safeParse(edit)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return measureSlot(actor, i.data, v.data, parsed.data)
  })
}

/** Another take on one slide of the picked version, by its number (criterion 99). */
export async function redraftSlideAction(id: unknown, at: unknown, slide: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = slideNo.safeParse(slide)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return redraftSlide(actor, postId, v, parsed.data)
  })
}

/** A text chip on one slide of the picked version (GD10); the command checks the chip. */
export async function nudgeSlideAction(id: unknown, at: unknown, input: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = SlideNudge.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return nudgeSlide(actor, postId, v, parsed.data)
  })
}

/** A text chip on a whole version, by its place (GD10); the command checks the chip. */
export async function nudgeVersionAction(id: unknown, at: unknown, input: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = VersionNudge.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return nudgeVersion(actor, postId, v, parsed.data)
  })
}

/** One slide of a version laid out in another layout (GD5); the command checks the slide can fill it. */
export async function setSlideLayoutAction(
  id: unknown,
  at: unknown,
  input: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = SlideLayout.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return setSlideLayout(actor, postId, v, parsed.data)
  })
}

/** A version moved to another look (GD4); the command checks the id names a look. */
export async function setLookAction(id: unknown, at: unknown, input: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = LookChoice.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.look)
    return setLook(actor, postId, v, parsed.data)
  })
}

/** The post's colour preset, Pop or Subdued (GD9). */
export async function setPresetAction(id: unknown, at: unknown, preset: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = z.enum(PRESETS).safeParse(preset)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.preset)
    return setPreset(actor, postId, v, { preset: parsed.data })
  })
}

/** "Use this idea", or two to four ticked and "Combine" (GD2): the cards by their place; the command checks they are shown. */
export async function pickIdeasAction(id: unknown, at: unknown, pick: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = IdeaPick.safeParse(pick)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.ideas)
    return pickIdeas(actor, postId, v, parsed.data)
  })
}

/** "More ideas" (GD3), and the failed ideas step's "Try again". */
export async function moreIdeasAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, moreIdeas)
}

/** A slide of the outline moved, added, removed or changed (GD32). */
export async function editOutlineAction(id: unknown, at: unknown, op: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = OutlineEdit.safeParse(op)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return editPostOutline(actor, postId, v, parsed.data)
  })
}

/** "Use this angle" on a blog (BR1, BR2): the card by its place; the command checks it is shown and outlines it. */
export async function pickBlogAngleAction(id: unknown, at: unknown, pick: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = AnglePick.safeParse(pick)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.angle)
    return pickBlogAngle(actor, postId, v, parsed.data)
  })
}

/** A section of a blog's outline moved, added, removed or reworded (BR2). */
export async function editBlogOutlineAction(id: unknown, at: unknown, op: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = BlogOutlineEdit.safeParse(op)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return editBlogOutline(actor, postId, v, parsed.data)
  })
}

/** "Write the blog" (BR3), and the failed writing's "Try again": the text written from the outline. */
export async function writeBlogAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, writeBlog)
}

/** A section, takeaway or FAQ of a blog's text edited in place, or a takeaway or question removed (BR3). */
export async function editBlogSectionAction(
  id: unknown,
  at: unknown,
  edit: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = BlogTextEditSchema.safeParse(edit)
    if (!parsed.success) return fail(BLOG_TEXT_ERRORS.part)
    return editBlogSection(actor, postId, v, parsed.data)
  })
}

/** "Approve text" on a blog (BR3): across the gate to its images. */
export async function approveBlogTextAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, approveBlogText)
}

/** A linked live post's slides after a section of the blog, in place of a picture there (BR4). */
export async function embedPostSlidesAction(
  id: unknown,
  at: unknown,
  embed: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = Embed.safeParse(embed)
    if (!parsed.success) return fail(BLOG_PICTURE_ERRORS.notLinked)
    return embedPostSlides(actor, postId, v, parsed.data)
  })
}

/** "Make posts from this blog" (BR6): a new feed post from the live blog, linked to it. Returns the post. */
export async function makePostsFromBlogAction(
  id: unknown,
  at: unknown,
  input: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = Request.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return makePostsFromBlog(actor, postId, v, parsed.data)
  })
}

/** "Make a blog" (BR8): a new blog from the post's source and facts, the post linked to it. Returns the blog. */
export async function makeBlogFromPostAction(
  id: unknown,
  at: unknown,
  input: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = Request.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return makeBlogFromPost(actor, postId, v, parsed.data)
  })
}

/** "Link to an existing blog" (BR8), or none to unlink the post. */
export async function linkToBlogAction(id: unknown, at: unknown, input: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = BlogLink.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.notABlog)
    return linkToBlog(actor, postId, v, parsed.data)
  })
}

/** The outline's format changed (GD33): one of the ten by id; the command outlines the idea again in it. */
export async function outlineFormatAction(
  id: unknown,
  at: unknown,
  format: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = z.enum(FORMAT_IDS).safeParse(format)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.format)
    return setOutlineFormat(actor, postId, v, { format: parsed.data })
  })
}

/** "Write the slides" (GD32), and the failed draft's "Try again": a version to the outline. */

export async function writeSlidesAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, writeSlides)
}

/** The source sentence in place of a claim the check could not find, by its place in the check (criterion 104). */
export async function applySourceWordingAction(
  id: unknown,
  at: unknown,
  claim: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = index.safeParse(claim)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return applySourceWording(actor, postId, v, parsed.data)
  })
}

/** A sentence of the source, by its id (¶2.3), as a new fact (criterion 95). */
export async function addFactAction(id: unknown, at: unknown, sentence: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = SentenceId.safeParse(sentence)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return addFact(actor, postId, v, parsed.data)
  })
}

/** The sentence "Research this" searches for (BR14); the command checks the source check flagged it. */
const ResearchSentence = z.string().max(10_000)
/** A page "Research this" offered, and its sentence, for the sentence of the slide (BR14). */
const ResearchSource = z.object({
  claim: z.string().max(10_000),
  url: z.string().max(2048),
  sentence: z.string().max(10_000),
})

/**
 * "Research this" on a sentence the source check did not find (BR14): the pages Google Search
 * finds that support it, and its entry point. A lookup: nothing is saved or refreshed.
 */
export async function researchClaimAction(
  id: unknown,
  at: unknown,
  sentence: unknown,
): Promise<Researched> {
  return asActor(async (actor) => {
    const i = PostId.safeParse(id)
    const v = Version.safeParse(at)
    if (!i.success || !v.success) return fail(UNKNOWN)
    const parsed = ResearchSentence.safeParse(sentence)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return researchClaim(actor, i.data, v.data, { sentence: parsed.data })
  })
}

/** "Add as a source" (BR14): the page read again, a new part of the source, its sentence a fact. */
export async function addResearchSourceAction(
  id: unknown,
  at: unknown,
  input: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = ResearchSource.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    const { claim, url, sentence } = parsed.data
    return addResearchSource(actor, postId, v, { claim, url, sentence })
  })
}

/** A fact taken out of the post's facts (criterion 95). */
export async function removeFactAction(id: unknown, at: unknown, fact: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = FactId.safeParse(fact)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return removeFact(actor, postId, v, parsed.data)
  })
}

export async function approveStructureAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, approveStructure)
}

/** "Back to <step>" (criterion 112): the source or the text versions. */
export async function backAction(id: unknown, at: unknown, to: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = BackStep.safeParse(to)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return goBack(actor, postId, v, parsed.data)
  })
}

/** "Withdraw from review" (criterion 115). */
export async function withdrawAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, withdrawFromReview)
}

/** "Edit" on a live post (criterion 116). */
export async function editLiveAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, editLive)
}

/** "Discard changes": a published post being worked on again, back to its live version (criterion 119). */
export async function discardChangesAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, discardChanges)
}

/** "Save and remake" at the source step (criterion 113): the changed text or links, framing line and notes. */
export async function remakeAction(id: unknown, at: unknown, input: unknown): Promise<Made> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = RemakeInput.safeParse(input)
    if (!parsed.success) return fail(INVALID_SOURCE)
    return remakeFromSource(actor, postId, v, parsed.data)
  })
}

/** "Continue with this source" (criterion 113). */
export async function continueWithSourceAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, continueWithSource)
}

export async function renderAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, renderPost)
}

export async function retryArtAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, retryArt)
}

export async function checkSourceAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, checkSource)
}

export async function markOpinionAction(id: unknown, at: unknown, claim: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = index.safeParse(claim)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return markOpinion(actor, postId, v, parsed.data)
  })
}

export async function removeClaimAction(id: unknown, at: unknown, claim: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = index.safeParse(claim)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return removeClaim(actor, postId, v, parsed.data)
  })
}

export async function saveSettingsAction(id: unknown, at: unknown, input: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = SettingsInput.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.missingSetting)
    return saveSettings(actor, postId, v, parsed.data)
  })
}

export async function sendToReviewAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, sendToReview)
}

export async function approvePublishAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, approveAndPublish)
}

/** "Request changes" (criteria 47, 120): the reviewer's note and the step it names. */
export async function sendBackAction(
  id: unknown,
  at: unknown,
  reason: unknown,
  step: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const named = ChangesStep.safeParse(step)
    if (!named.success) return fail(WORKFLOW_ERRORS.changesStep)
    // Any length reaches the command, which owns the length rule; anything not text is no reason.
    const parsed = z.string().max(10_000).safeParse(reason)
    return sendBack(actor, postId, v, parsed.success ? parsed.data : '', named.data)
  })
}

export async function lightEditAction(id: unknown, at: unknown, edit: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = Edit.safeParse(edit)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return lightEdit(actor, postId, v, parsed.data)
  })
}

/** Three cover options for the rendered post, steered by the editor's optional idea (criterion 102). */
export async function makeCoversAction(id: unknown, at: unknown, idea: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    // Any text reaches the command, which owns the idea rules; anything not text is no idea.
    const parsed = z.string().max(10_000).safeParse(idea)
    return makeCovers(actor, postId, v, parsed.success ? parsed.data : '')
  })
}

/** "Use this cover": one of the post's cover options, by its place in the list (criterion 102). */
export async function chooseCoverAction(id: unknown, at: unknown, option: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = index.safeParse(option)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return chooseCover(actor, postId, v, parsed.data)
  })
}

/** "Plan images" (GD12): a scene in words for each art box of a look post. */
export async function planImagesAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, planImages)
}

/** A planned scene edited in place (GD12); the command checks its length and the art prompt guard. */
export async function editImageSceneAction(
  id: unknown,
  at: unknown,
  input: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = SceneEdit.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return editImageScene(actor, postId, v, parsed.data)
  })
}

/** "Draw images", which approves the plan, and "Draw remaining" after the daily limit (GD12, GD14). */
export async function drawImagesAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, drawImages)
}

/** "Skip pictures": the slides saved as they look now, without drawing; the command checks who and when. */
export async function skipPicturesAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, skipPictures)
}

/** An image chip on one drawn slide (GD13); the command checks the chip. */
export async function nudgeImageAction(id: unknown, at: unknown, input: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = ImageNudge.safeParse(input)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return nudgeImage(actor, postId, v, parsed.data)
  })
}

/** "Restore" on a version in the history: the post's own structure or revision record, by id (criterion 101). */
export async function restoreVersionAction(
  id: unknown,
  at: unknown,
  record: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = TextRecordId.safeParse(record)
    if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
    return restoreVersion(actor, postId, v, parsed.data)
  })
}

/** The market version of a rendered post, for the market the editor chose; the command refuses an unknown one. */
export async function makeMarketAction(id: unknown, at: unknown, market: unknown): Promise<Saved> {
  return onPost(id, at, (actor, postId, v) =>
    makeMarket(actor, postId, v, MarketChoice.parse(market)),
  )
}

/** The optional rewording of the post's market version by the model; the command refuses it before one exists (criterion 110). */
export async function rewordMarketAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, (actor, postId, v) => rewordMarket(actor, postId, v))
}

// ── Social versions ──────────────────────────────────────────────────────────────────────

/** A social version of a live feed post. The request id is the new post's id, so a double submit is one post. */
export async function adaptAction(id: unknown, at: unknown, input: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = Adapt.safeParse(input)
    if (!parsed.success) return fail(SOCIAL_ERRORS.brand)
    return adaptPost(actor, postId, v, parsed.data)
  })
}

/**
 * "Make the set" (108): an Instagram version per page with a design language and a quote card,
 * each to ready with its caption. One request id per version, so a double press finds the set.
 */
export async function makeSetAction(id: unknown, at: unknown, input: unknown): Promise<MadeSet> {
  return asActor(async (actor) => {
    const i = PostId.safeParse(id)
    const v = Version.safeParse(at)
    if (!i.success || !v.success) return fail(UNKNOWN)
    const parsed = SetIds.safeParse(input)
    if (!parsed.success) return fail(SOCIAL_ERRORS.set)
    const result = await makeSet(actor, i.data, v.data, parsed.data)
    if (result.ok) changed(i.data)
    return result
  })
}

export async function approveLayoutAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, approveLayout)
}

export async function renderSocialAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, renderSocial)
}

export async function editCaptionAction(
  id: unknown,
  at: unknown,
  text: unknown,
  hashtags: unknown,
): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = Caption.safeParse({ text, hashtags })
    if (!parsed.success) return fail(SOCIAL_ERRORS.caption)
    return editCaption(actor, postId, v, parsed.data.text, parsed.data.hashtags)
  })
}

export async function checkCaptionAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, checkCaption)
}

export async function resetCaptionAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, resetCaption)
}

export async function markExportedAction(id: unknown, at: unknown): Promise<Saved> {
  return onPost(id, at, markExported)
}

/** Where the exported Instagram version was posted: a new record on it, never a settings change (89). */
export async function recordPostUrlAction(id: unknown, at: unknown, url: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = PostUrl.safeParse(url)
    if (!parsed.success) return fail(SOCIAL_ERRORS.url)
    return recordPostUrl(actor, postId, v, parsed.data)
  })
}

/** A live feed post shared to the pages' accounts: recorded, nothing posted (criteria 9–11). */
export async function sharePostAction(id: unknown, at: unknown, accounts: unknown): Promise<Saved> {
  return onPost(id, at, async (actor, postId, v) => {
    const parsed = ShareInput.safeParse(accounts)
    if (!parsed.success) return fail(SHARE_ERRORS.unknown)
    return sharePost(actor, postId, v, parsed.data)
  })
}

/**
 * The browser's assignment, kept to its types; the module applies the rules (the owner is board
 * staff, the note at most NOTE_MAX characters). The note's cap here only bounds the request.
 */
const AssignInput = z.object({
  postId: PostId,
  assigneeId: z.string().min(1).max(128).nullable(),
  note: z.string().max(10_000),
})

/** A post's owner and note on the board (server/assign.ts); not an edit, so only the board is refreshed. */
export async function assignPostAction(input: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const parsed = AssignInput.safeParse(input)
    if (!parsed.success) return fail(ASSIGN_ERRORS.unknown)
    const result = await assignPost(actor, parsed.data)
    if (result.ok) revalidatePath(BOARD_PATH)
    return result
  })
}
