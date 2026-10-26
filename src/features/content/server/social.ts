import 'server-only'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/shared/lib/db'
import { contentPost } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import { coverArt } from '../ai/art'
import { CAPTION_HASHTAGS, CAPTION_WORDS, HASHTAG, writeCaption } from '../ai/caption'
import { checkClaims } from '../ai/source-check'
import { COMICS_BRAND_ID, FEED_POST_PAGES, PAGE_BRANDS, quoteCardBrand } from '../brands'
import { layoutStructure, paragraphSites } from '../layout/engine'
import { exportName } from '../layout/zip'
import { searchTitleOf } from '../lib/comic-rules'
import { blogUrl } from '../lib/public-blog'
import { postSources, sourceNames } from '../lib/sites'
import { exportError, WORKFLOW_ERRORS } from '../lib/workflow'
import { BODIES, type Body, emptyPointers } from '../model/artifacts'
import { type ShareAccounts, shareChoice } from '../model/share'
import type { Stage } from '../model/stages'
import type { Brand, Structure, Template } from '../model/types'
import { COMIC_TEMPLATE_ID, findSlideSpec, isLook, QUOTE_CARD } from '../templates'
import { sentences } from '../text/sentences'
import { revisionCoverPrompt } from './commands/render'
import {
  type Actor,
  artDeps,
  attempt,
  command,
  DB_ERROR,
  draw,
  imagesOf,
  open,
  putRender,
  type Saved,
  save,
  stamp,
  UNKNOWN,
} from './commands/shared'
import { artifactId } from './hash'
import { type DesignLanguage, designLanguageFor, pageStyleOf, pageStyles } from './page-style'
import { runStep } from './steps'
import { getAsset, insertPost, type LoadedPost, liveGuideOf, loadPost, putArtifact } from './store'

// Social versions (G6, criteria 62–68), with the command rules of ./commands. A social version
// is its own post, linked to a live feed post: it points at that post's source and facts, which
// stay as they are, and carries the approved structure re-skinned in a page brand. Its render
// draws the feed post's art; its caption is written once, and any edit must pass the source check
// again before export. Export only records which render and caption went out: the download
// (src/app/admin/(console)/posts/[id]/export) zips those stored bytes. Nothing here posts anywhere.
// "Make the set" (criterion 108) runs the same path for every page with a design language and
// for one quote card, each to ready with its caption. A comic (RC7) goes to the Comics page only,
// and a feed post never does.

type Platform = 'instagram' | 'linkedin'

export const SOCIAL_ERRORS = {
  brand: 'Choose a page brand and a platform.',
  caption:
    'Write the caption: Instagram takes up to 150 words and 8 hashtags, LinkedIn up to 300 words and none.',
  url: "Paste the post's instagram.com link.",
  set: 'The pages changed since this post was loaded. Reload and press again.',
  quote: 'No bound fact to quote.',
  comic: 'A comic goes to the Comics page.',
} as const

const PLATFORM_NAMES: Record<Platform, string> = { instagram: 'Instagram', linkedin: 'LinkedIn' }

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

const AdaptSchema = z.object({
  brandId: z.string().max(64),
  platform: z.enum(['instagram', 'linkedin']),
  requestId: z.uuid(),
})
/** One request id per version of the set, by page brand id, and `quote` for the quote card. */
const SetSchema = z.object({
  requestIds: z
    .record(z.string().max(64), z.uuid())
    .refine((ids) => Object.keys(ids).length <= PAGE_BRANDS.length + 1),
})
const CaptionSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  hashtags: z.array(z.string().regex(HASHTAG)).max(8),
})
/** A post's own link on Instagram: https, on instagram.com or www.instagram.com (ADR-124). */
const PostUrlSchema = z.url({ protocol: /^https$/, hostname: /^(www\.)?instagram\.com$/ }).max(2048)

/** Whether the live post is a comic (RC2): its revision is in the comic template. */
const isComic = (post: LoadedPost): boolean =>
  post.current.revision?.body.template.id === COMIC_TEMPLATE_ID

/** The pages the post may be adapted for: a comic only the Comics page, a feed post any other (RC7). */
const pagesFor = (post: LoadedPost): readonly Brand[] =>
  isComic(post) ? PAGE_BRANDS.filter((b) => b.id === COMICS_BRAND_ID) : FEED_POST_PAGES

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

/** A post's title by id, or null: a social version names its feed post by it. */
export async function postTitle(id: string): Promise<string | null> {
  const [row] = await db
    .select({ title: contentPost.title })
    .from(contentPost)
    .where(eq(contentPost.id, id))
    .limit(1)
  return row?.title ?? null
}

/**
 * A social version of a live feed post (criteria 62, 63): a new post with the request's id, at
 * structures, pointing at the feed post's source and facts, with a revision of its approved
 * structure and frozen template in a frozen copy of the page brand, and that revision's layout.
 * No fit checks run on it in this slice (ADR-109). The feed post itself is not changed. A comic
 * is adapted for the Comics page only, and a feed post for any page but that one (RC7).
 */
export async function adaptPost(
  actor: Actor,
  feedId: string,
  version: number,
  input: { brandId: string; platform: Platform; requestId: string },
): Promise<Saved> {
  return attempt('adaptPost', async () => {
    const opened = await open(actor, 'adapt', feedId, version)
    if (!opened.ok) {
      // A feed post that is not live, or a social version: either way, nothing to adapt.
      return opened.error === WORKFLOW_ERRORS.movedOn ? fail(WORKFLOW_ERRORS.notLive) : opened
    }
    const parsed = AdaptSchema.safeParse(input)
    if (parsed.success && isComic(opened.post) && parsed.data.brandId !== COMICS_BRAND_ID) {
      return fail(SOCIAL_ERRORS.comic)
    }
    const pages = pagesFor(opened.post)
    const brand = parsed.success ? pages.find((b) => b.id === parsed.data.brandId) : undefined
    if (!parsed.success || !brand) return fail(SOCIAL_ERRORS.brand)
    const { platform, requestId: id } = parsed.data
    const revision = opened.post.current.revision
    if (!revision) return fail(WORKFLOW_ERRORS.movedOn)
    return createVersion(actor, opened.post, {
      id,
      brand,
      platform,
      structure: revision.body.structure,
      template: revision.body.template,
      title: `${PLATFORM_NAMES[platform]} · ${brand.name}`,
      note: `social: ${brand.name}`,
    })
  })
}

/**
 * A social version of the opened live feed post: a new post with the given id, at structures,
 * pointing at the feed post's source and facts, with a revision of the structure in a frozen copy
 * of the page brand, and that revision's layout. The id is the browser's request id, so a double
 * submit finds the first one.
 */
async function createVersion(
  actor: Actor,
  parent: LoadedPost,
  input: {
    id: string
    brand: Brand
    platform: Platform
    structure: Structure
    template: Template
    title: string
    note: string
  },
): Promise<Saved> {
  const { id, brand, platform } = input
  const existing = await loadPost(id)
  if (existing) {
    return existing.kind === 'social' && existing.parentId === parent.id
      ? { ok: true, id, version: existing.version }
      : fail(WORKFLOW_ERRORS.movedOn)
  }

  const { source, facts, revision, approval } = parent.current
  if (!source || !facts || !revision || !approval) return fail(WORKFLOW_ERRORS.movedOn)
  // A look keeps the post's preset (GD8): its surfaces come from it, the page brand gives fonts.
  const themeId = isLook(input.template) ? revision.body.themeId : brand.themes[0].id
  const next: Body<'revision'> = {
    factsId: facts.id,
    structure: input.structure,
    template: input.template,
    brand: structuredClone(brand),
    themeId,
    by: stamp(actor),
    note: input.note,
    emotion: revision.body.emotion ?? null,
  }
  const revisionId = artifactId('revision', id, BODIES.revision.parse(next))
  const laid = layoutStructure({
    structure: next.structure,
    template: next.template,
    brand: next.brand,
    sourceTitle: source.body.title,
    title: searchTitleOf(parent, source.body.title),
    sourceSite: source.body.site,
    sites: paragraphSites(source.body),
    facts: facts.body.facts,
    language: source.body.language,
  })
  const layout: Body<'layout'> = {
    revisionId,
    slides: laid.slides,
    fits: laid.fits,
    fitChecks: [],
  }
  const layoutId = artifactId('layout', id, BODIES.layout.parse(layout))

  try {
    await db.transaction(async (tx) => {
      await insertPost(tx, {
        id,
        kind: 'social',
        parentId: parent.id,
        title: input.title,
        stage: 'structures',
        pointers: {
          ...emptyPointers(),
          sourceId: source.id,
          factsId: facts.id,
          themeId,
          revisionId,
          layoutId,
          social: { brandId: brand.id, platform },
        },
        actorId: actor.id,
      })
      const stored = [
        await putArtifact(tx, { kind: 'revision', postId: id, body: next, actorId: actor.id }),
        await putArtifact(tx, { kind: 'layout', postId: id, body: layout, actorId: actor.id }),
      ]
      if (stored[0] !== revisionId || stored[1] !== layoutId) {
        throw new Error('A stored record id differs from its pointer')
      }
    })
  } catch (err) {
    // Two submits racing: the other one made the post.
    const raced = await loadPost(id)
    if (raced) return { ok: true, id, version: raced.version }
    throw err
  }
  return { ok: true, id, version: 1 }
}

/**
 * The post's strongest fact as a quote-card structure (criterion 108): the first sentence of the
 * first factual slot that binds a fact, in slide and slot order, bound to that slot's facts, so
 * the source line, the caption and the source check read it as they read the slide. Null when no
 * slot binds one.
 */
function quoteStructure(revision: Body<'revision'>): Structure | null {
  const { structure, template } = revision
  for (const slide of structure.slides) {
    const spec = findSlideSpec(template, slide)
    for (const slotSpec of spec?.slots ?? []) {
      const slot = slide.slots[slotSpec.key]
      if (!slotSpec.factual || !slot || slot.factIds.length === 0) continue
      const [text] = sentences(slot.text)
      if (!text) continue
      return {
        templateId: QUOTE_CARD.id,
        slides: [
          { kind: 'single', slots: { quote: { text, factIds: slot.factIds, factual: true } } },
        ],
        artPrompt: structure.artPrompt,
      }
    }
  }
  return null
}

/** One version of a set as the live panel lists it: where it got to, why it stopped if it did, and whether it drew its own cover. */
export type SetVersion = {
  id: string
  title: string
  brandId: string
  kind: 'page' | 'quote'
  stage: Stage
  error: string | null
  /** False when the render draws the feed post's art: the quote card always, a look post's versions, a page's version past the day's image cap or with no clean cover. */
  ownCover: boolean
}
export type MadeSet = ActionResult<{ id: string; version: number; versions: SetVersion[] }>

/** A version of the set from its request id to ready: made, its layout approved, rendered with its caption. */
async function makeVersion(
  actor: Actor,
  parent: LoadedPost,
  want: { kind: SetVersion['kind']; brand: Brand; id: string },
): Promise<SetVersion> {
  const { kind, brand, id } = want
  const base = { id, brandId: brand.id, kind }
  const stopped = (title: string, stage: Stage, error: string): SetVersion => ({
    ...base,
    title,
    stage,
    error,
    ownCover: false,
  })
  const revision = parent.current.revision
  const title =
    kind === 'page' ? `${PLATFORM_NAMES.instagram} · ${brand.name}` : `Quote card · ${brand.name}`
  if (!revision) return stopped(title, 'structures', WORKFLOW_ERRORS.movedOn)

  // The adapt path for a page; the quote card's structure in its template for the quote card.
  const version =
    kind === 'page'
      ? { structure: revision.body.structure, template: revision.body.template, note: 'social' }
      : { structure: quoteStructure(revision.body), template: QUOTE_CARD, note: 'quote card' }
  if (!version.structure) return stopped(title, 'structures', SOCIAL_ERRORS.quote)
  let step = await createVersion(actor, parent, {
    id,
    brand,
    platform: 'instagram',
    structure: version.structure,
    template: version.template,
    title,
    note: `${version.note}: ${brand.name}`,
  })
  if (!step.ok) return stopped(title, 'structures', step.error)

  // From wherever the version stands: a second press finds the first one further on.
  const made = await loadPost(id)
  if (!made) return stopped(title, 'structures', UNKNOWN)
  if (made.stage === 'structures') step = await approveLayout(actor, id, step.version)
  if (step.ok && (made.stage === 'structures' || made.stage === 'approved')) {
    step = await renderSocial(actor, id, step.version)
  }
  const post = await loadPost(id)
  if (!post) return stopped(title, made.stage, UNKNOWN)
  // A cover of the version's own carries its page's prompt; the feed post's art keeps the feed post's.
  const art = post.current.render?.body.art ?? null
  const parentArt = parent.current.render?.body.art ?? null
  return {
    ...base,
    title: post.title,
    stage: post.stage,
    error: step.ok ? null : step.error,
    ownCover: art !== null && art.prompt !== parentArt?.prompt,
  }
}

/**
 * "Make the set" (criterion 108): on a live feed post, an Instagram version for each page brand
 * with a design language, in the registry's order, plus one quote card from the post's strongest
 * fact on the post's own page (or the first page), each through the social path to ready: made,
 * its layout approved, rendered with its caption, for the editor to export. One request id per
 * version, so a double press finds the set it made. Pages without a design language get none.
 * A version that stops short says why, and the rest go on. Who may is the adapt rule: editors on
 * a live post. Each styled page's cover counts against the day's image cap; past it, a version
 * keeps the feed post's art (renderSocial), and `ownCover` says so. A comic's set is its one
 * Instagram version for the Comics page, styled or not, with no quote card; a feed post's leaves
 * the Comics page out (RC7).
 */
export async function makeSet(
  actor: Actor,
  feedId: string,
  version: number,
  input: { requestIds: Record<string, string> },
): Promise<MadeSet> {
  try {
    const opened = await open(actor, 'adapt', feedId, version)
    if (!opened.ok) {
      return opened.error === WORKFLOW_ERRORS.movedOn ? fail(WORKFLOW_ERRORS.notLive) : opened
    }
    const parsed = SetSchema.safeParse(input)
    if (!parsed.success) return fail(SOCIAL_ERRORS.set)
    const ids = parsed.data.requestIds
    const parent = opened.post
    const styles = await pageStyles()
    const comic = isComic(parent)
    const pages = pagesFor(parent).filter((b) => comic || styles.has(b.id))
    const wanted = [
      ...pages.map((brand) => ({ kind: 'page' as const, brand, id: ids[brand.id] })),
      ...(comic
        ? []
        : [
            {
              kind: 'quote' as const,
              brand: quoteCardBrand(parent.pointers.pageBrandId),
              id: ids.quote,
            },
          ]),
    ]
    const named = wanted.filter((w): w is typeof w & { id: string } => !!w.id)
    if (named.length !== wanted.length) return fail(SOCIAL_ERRORS.set)
    const versions = await Promise.all(named.map((w) => makeVersion(actor, parent, w)))
    return { ok: true, id: parent.id, version: parent.version, versions }
  } catch (err) {
    console.error('[content.commands.makeSet]', err)
    return fail(DB_ERROR)
  }
}

/** "Quick approve layout": the re-skinned layout as it stands, to render. */
export async function approveLayout(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('approveLayout', 'socialApproveLayout', actor, id, version, async (post) => {
    if (!post.current.revision || !post.current.layout) return fail(WORKFLOW_ERRORS.movedOn)
    return save(post, version, actor, async () => ({ stage: 'approved', pointers: post.pointers }))
  })
}

/**
 * The render, drawn with the feed post's current art, and its caption, written once and stored
 * as the approved wording, checked (criteria 64, 65). The facts stay the feed post's. When the
 * version's page has a design language (criterion 105), its caption follows the page's copy
 * style, and on a page other than the feed post's own it draws its own cover in the page's art
 * style with the page's reference images, checked for text like any cover; when that cover cannot
 * be made it keeps the feed post's art. A page without one renders as it always did. A template
 * with no art box (the quote card) has nowhere for a cover, so none is drawn or spent. A look
 * post's version draws no cover: it keeps the feed post's images, an image per slide or the
 * panorama, tinted in the post's preset (GD8, GD12). While the feed post's blog is live, the caption
 * ends with "Read the full guide" and the blog's address (BR7).
 */
export async function renderSocial(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('renderSocial', 'socialRender', actor, id, version, async (post) => {
    const { source, facts, revision, layout } = post.current
    const social = post.pointers.social
    const parentId = post.parentId
    if (!source || !facts || !revision || !layout || !social || !parentId) {
      return fail(WORKFLOW_ERRORS.movedOn)
    }

    return runStep(id, 'render', version, async () => {
      const [parent, guide] = await Promise.all([loadPost(parentId), liveGuideOf(parentId)])
      const parentRender = parent?.current.render
      if (!parent || !parentRender) return fail(WORKFLOW_ERRORS.movedOn)
      const style = await pageStyleOf(social.brandId)
      const ownPage = social.brandId === (parent.pointers.pageBrandId ?? null)
      const hasArtBox = layout.body.slides.some((s) => s.artBox !== null)
      // A look keeps the feed post's pictures, slide by slide or its panorama (GD8, GD12).
      const look = isLook(revision.body.template)
      const picked = parent.pointers.picked
      const angle =
        (picked === null ? null : parent.current.drafts?.body.items[picked]?.angle) || null
      const [written, own, images] = await Promise.all([
        writeCaption({
          platform: social.platform,
          brand: revision.body.brand,
          revision: revision.body,
          facts: facts.body.facts,
          demoKey: source.body.demoKey,
          postId: id,
          title: source.body.title,
          // The hashtags come from the feed post's tags; a post from before the tag file has none.
          tags: parent.current.settings?.body.tags ?? [],
          sources: sourceNames(postSources(source.body)),
          guide: guide ? blogUrl(guide.slug) : null,
          copyStyle: style?.copyStyle ?? null,
          language: source.body.language,
        }),
        // Only for an old template on another page, with somewhere to put it, is a cover drawn,
        // so only then are the reference images read.
        style && !ownPage && hasArtBox && !look
          ? designLanguageFor(style).then((design) => pageCover(id, revision.body, design, angle))
          : null,
        look ? imagesOf(parentRender.body) : null,
      ])
      if (!written.ok) return fail(written.error)
      const parentArt = parentRender.body.art
      const art = own
        ? { assetId: null, prompt: own.prompt, version: 1, fallback: null }
        : parentArt
      const artBytes = own
        ? own.bytes
        : parentArt.assetId
          ? ((await getAsset(parentArt.assetId))?.bytes ?? null)
          : null
      const drawn = draw(revision.body, layout.body, artBytes, undefined, images)

      return save(post, version, actor, async (tx) => {
        const renderId = await putRender(tx, post, actor, {
          revisionId: revision.id,
          layoutId: layout.id,
          drawn,
          art: { ...art, bytes: artBytes },
          images,
        })
        const captionId = await putArtifact(tx, {
          kind: 'caption',
          postId: id,
          actorId: actor.id,
          body: {
            renderId,
            platform: social.platform,
            text: written.text,
            hashtags: written.hashtags,
            approvedText: written.text,
            approvedHashtags: written.hashtags,
            checked: true,
            notFound: [],
          },
        })
        return { stage: 'ready', pointers: { ...post.pointers, renderId, captionId } }
      })
    })
  })
}

/**
 * A cover of the version's own, in its page's design language (criterion 105): the revision's
 * prompt in the page's art style, with the page's reference images, checked for text. Null when
 * no clean image came, so the version keeps the feed post's art.
 */
async function pageCover(
  postId: string,
  revision: Body<'revision'>,
  design: DesignLanguage,
  angle: string | null,
): Promise<{ prompt: string; bytes: Uint8Array } | null> {
  const prompt = revisionCoverPrompt(revision, { angle, artStyle: design.artStyle, idea: null })
  const cover = await coverArt(
    { prompt, demoKey: null, postId, references: design.references },
    artDeps,
  )
  return cover.ok && cover.art.bytes ? { prompt, bytes: cover.art.bytes } : null
}

/** A new caption record: checked only when it is the approved wording exactly (criterion 66). */
export async function editCaption(
  actor: Actor,
  id: string,
  version: number,
  text: string,
  hashtags: string[],
): Promise<Saved> {
  return command('editCaption', 'socialCaption', actor, id, version, async (post) => {
    const caption = post.current.caption
    if (!caption) return fail(WORKFLOW_ERRORS.movedOn)
    const { platform, approvedText, approvedHashtags } = caption.body
    const parsed = CaptionSchema.safeParse({ text, hashtags })
    if (
      !parsed.success ||
      parsed.data.hashtags.length > CAPTION_HASHTAGS[platform] ||
      parsed.data.text.split(/\s+/).length > CAPTION_WORDS[platform]
    ) {
      return fail(SOCIAL_ERRORS.caption)
    }
    const next = parsed.data
    const approved = next.text === approvedText && sameList(next.hashtags, approvedHashtags)
    return save(post, version, actor, async (tx) => {
      const captionId = await putArtifact(tx, {
        kind: 'caption',
        postId: id,
        actorId: actor.id,
        body: { ...caption.body, ...next, checked: approved, notFound: [] },
      })
      return { stage: post.stage, pointers: { ...post.pointers, captionId } }
    })
  })
}

/**
 * The source check, code first, on the caption's new wording against the feed post's source. A
 * sentence of the approved wording is already checked (the post's own lines, the model's hook and
 * call to action, which code refused with any number) and is not asked again (criterion 66).
 */
export async function checkCaption(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('checkCaption', 'socialCheck', actor, id, version, async (post) => {
    const { source, caption } = post.current
    if (!source || !caption) return fail(WORKFLOW_ERRORS.movedOn)

    return runStep(id, 'caption_check', version, async () => {
      const approved = new Set(sentences(caption.body.approvedText))
      const claims = sentences(caption.body.text)
        .filter((text) => !approved.has(text))
        .map((text) => ({ slide: 0, slot: 'caption', text }))
      const checked = await checkClaims({ claims, source: source.body, previous: null, postId: id })
      if (!checked.ok) return fail(checked.error)
      const notFound = checked.claims.filter((c) => c.result === 'not_found').map((c) => c.text)
      return save(post, version, actor, async (tx) => {
        const captionId = await putArtifact(tx, {
          kind: 'caption',
          postId: id,
          actorId: actor.id,
          body: { ...caption.body, checked: notFound.length === 0, notFound },
        })
        return { stage: post.stage, pointers: { ...post.pointers, captionId } }
      })
    })
  })
}

/** "Reset to approved wording": the approved text and hashtags, checked (criterion 66). */
export async function resetCaption(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('resetCaption', 'socialReset', actor, id, version, async (post) => {
    const caption = post.current.caption
    if (!caption) return fail(WORKFLOW_ERRORS.movedOn)
    const { approvedText, approvedHashtags } = caption.body
    return save(post, version, actor, async (tx) => {
      const captionId = await putArtifact(tx, {
        kind: 'caption',
        postId: id,
        actorId: actor.id,
        body: {
          ...caption.body,
          text: approvedText,
          hashtags: approvedHashtags,
          checked: true,
          notFound: [],
        },
      })
      return { stage: post.stage, pointers: { ...post.pointers, captionId } }
    })
  })
}

/** The export record: which render and caption go out, under which file name; stage exported (criterion 67). */
export async function markExported(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('markExported', 'socialExport', actor, id, version, async (post) => {
    const error = exportError(post.current)
    if (error) return fail(error)
    const { render, caption, revision } = post.current
    const social = post.pointers.social
    const parentTitle = post.parentId ? await postTitle(post.parentId) : null
    if (!render || !caption || !revision || !social || parentTitle === null) {
      return fail(WORKFLOW_ERRORS.movedOn)
    }
    const fileName = exportName(revision.body.brand.name, parentTitle, social.platform)
    return save(post, version, actor, async (tx) => {
      const exportId = await putArtifact(tx, {
        kind: 'export',
        postId: id,
        actorId: actor.id,
        body: { renderId: render.id, captionId: caption.id, fileName, by: stamp(actor) },
      })
      return { stage: 'exported', pointers: { ...post.pointers, exportId } }
    })
  })
}

/**
 * Where the exported Instagram version was posted (criterion 89, ADR-124): a new immutable record
 * on that version, naming its export and who added it, never a change to its settings; a later
 * URL is another record. Only an exported Instagram version takes one, and only a link on
 * instagram.com over https.
 */
export async function recordPostUrl(
  actor: Actor,
  id: string,
  version: number,
  url: string,
): Promise<Saved> {
  return command('recordPostUrl', 'socialLink', actor, id, version, async (post) => {
    const exported = post.current.export
    if (!exported || post.pointers.social?.platform !== 'instagram') {
      return fail(WORKFLOW_ERRORS.movedOn)
    }
    const parsed = PostUrlSchema.safeParse(url)
    if (!parsed.success) return fail(SOCIAL_ERRORS.url)
    return save(post, version, actor, async (tx) => {
      const socialLinkId = await putArtifact(tx, {
        kind: 'social_link',
        postId: id,
        actorId: actor.id,
        body: { exportId: exported.id, platform: 'instagram', url: parsed.data, by: stamp(actor) },
      })
      return { stage: 'exported', pointers: { ...post.pointers, socialLinkId } }
    })
  })
}

/**
 * A live feed post shared to the pages' accounts (criteria 9–11): a new immutable record naming
 * the accounts ticked and who shared, the stage and every pointer kept; sharing again is another
 * record (server/store.ts listShares lists them). Nothing is posted to Instagram or LinkedIn
 * (ADR-033). Only a feed post shares here: a blog has no social versions and a comic keeps its
 * own Live step. Only the accounts listed (model/share.ts), at least one.
 */
export async function sharePost(
  actor: Actor,
  id: string,
  version: number,
  accounts: ShareAccounts,
): Promise<Saved> {
  return command('sharePost', 'share', actor, id, version, async (post) => {
    if (post.kind !== 'feed' || isComic(post)) return fail(WORKFLOW_ERRORS.movedOn)
    const choice = shareChoice(accounts)
    if (!choice.ok) return fail(choice.error)
    return save(post, version, actor, async (tx) => {
      await putArtifact(tx, {
        kind: 'share',
        postId: id,
        actorId: actor.id,
        body: { ...choice.accounts, by: stamp(actor) },
      })
      return { stage: post.stage, pointers: post.pointers }
    })
  })
}
