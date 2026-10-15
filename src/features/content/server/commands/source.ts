import 'server-only'
import { z } from 'zod'
import { canEdit } from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import { extractFacts, sentenceFact, sentencesById, splitParagraphs } from '../../ai/extract'
import { isFeedPostPage } from '../../brands'
import { LANGUAGE_IDS, type LanguageId } from '../../languages'
import { claimsIn } from '../../lib/claims'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import {
  BODIES,
  type Body,
  emptyPointers,
  FramingSchema,
  SOURCE_ERRORS,
  SOURCE_LIMITS,
  type SourcePart,
} from '../../model/artifacts'
import type { Fact, Paragraph } from '../../model/types'
import { TEMPLATES } from '../../templates'
import { charCount, firstChars } from '../../text/script'
import { sourceSentences } from '../../text/sentences'
import { findQuote } from '../../text/verbatim'
import { fetchPage, PAGE_ERROR, type Page, type PageResult } from '../fetch-page'
import { artifactId } from '../hash'
import { runStep } from '../steps'
import {
  deletePlaceholder,
  insertPost,
  type LoadedPost,
  loadPost,
  putArtifact,
  savePointers,
} from '../store'
import { checkAfter } from './check'
import { moreIdeas } from './ideas'
import {
  type Actor,
  attempt,
  clearFromRevision,
  command,
  fail,
  Refused,
  type Saved,
  save,
  type Tx,
} from './shared'
import { draftAfter } from './structures'

// The source stage: a pasted source, or one read from up to five links, extracted into a new post
// and, from "Make post", offered as idea cards (criteria 5, 22–24, 93, 94; GD1, GD18–GD21); and the
// editor's own changes to its facts at structures (criterion 95).

const INVALID_SOURCE = 'Give the source a title, a kind and its text, or its link.'
/** Source text that is a web address and nothing else: read as the link, not as the article. */
const ONLY_A_LINK = /^https?:\/\/\S+$/i
const LINK_IN_SOURCE =
  "That looks like a link. Paste it in the Links field, or paste the article's text."
const TITLE_MAX = 200
/** At most `max` characters as a reader sees them, trimmed: a Devanagari conjunct or a Thai letter with its marks is one. */
const trimmedUpTo = (max: number) =>
  z
    .string()
    .trim()
    .refine((text) => charCount(text) <= max)
const TEXT_MAX = 60_000
/** Each article read from a link gives at most its first this many paragraphs (GD19). */
const PART_PARAGRAPHS = 60
const DEFAULT_KIND = 'article'
/** A new post's version while its source is extracted. */
const PLACEHOLDER_VERSION = 1
const StartSchema = z.object({
  requestId: z.uuid(),
  title: trimmedUpTo(TITLE_MAX).min(1),
  kind: z.string().trim().min(1).max(60),
  text: z.string().min(1).max(TEXT_MAX),
})
type Start = z.infer<typeof StartSchema>
/**
 * What "Make post" and "Save and remake" both take (GD18): the links (https; ../fetch-page.ts
 * checks each), else the pasted text, and the framing line and notes. The counts and the framing
 * line's length are refused by name in `sourceFrom`; these bounds only keep the input finite.
 */
const FieldsSchema = z.object({
  links: z.array(z.string().trim().max(2048)).max(100).default([]),
  text: z.string().max(TEXT_MAX).default(''),
  framing: z.string().trim().max(10_000).default(''),
  notes: trimmedUpTo(SOURCE_LIMITS.notes).default(''),
  /** The post's language (GD36); none on a remake keeps the source's. */
  language: z.enum(LANGUAGE_IDS).optional(),
})
type Fields = z.infer<typeof FieldsSchema>
const MakeSchema = FieldsSchema.extend({
  requestId: z.uuid(),
  title: trimmedUpTo(TITLE_MAX).default(''),
  kind: z.string().trim().min(1).max(60).default(DEFAULT_KIND),
  /** The page the post is made for (criterion 105), or none. */
  pageBrandId: z.string().max(64).nullish(),
  /** A feed post, or a blog (BR1); `kind` is the source's kind ("article"). */
  postKind: z.enum(['feed', 'blog']).default('feed'),
  /** English unless the editor chose another (GD36, GD29). */
  language: z.enum(LANGUAGE_IDS).default('en'),
})
type Failed = { url: string; error: string }
/**
 * What a source record keeps beyond its text (criterion 94; GD19–GD21; BR6), and its language
 * (GD36), English when none is given.
 */
export type Extras = Pick<
  Body<'source'>,
  'url' | 'site' | 'parts' | 'blogSections' | 'failed' | 'framing' | 'notes'
> & { language?: LanguageId }
/**
 * A feed post made from a live blog (BR6; ./blog-links.ts makePostsFromBlog): the source given,
 * the blog's sections, extracted into a new post with the first template ticked and linked to the
 * blog (blog_id, and a from_blog record in the same save), then its idea cards, as "Make post"
 * makes them (GD1). The request id is the new post's, so a second submit finds the first one's.
 */
export async function makePostFromBlog(
  actor: Actor,
  input: { requestId: string; title: string; text: string; extras: Extras },
  blogId: string,
): Promise<Saved> {
  const start = StartSchema.safeParse({
    requestId: input.requestId,
    title: firstChars(input.title, TITLE_MAX).trim(),
    kind: DEFAULT_KIND,
    text: input.text,
  })
  if (!start.success) return fail(INVALID_SOURCE)
  const { saved, made } = await extractNew(
    actor,
    start.data,
    input.extras,
    [TEMPLATES[0].id],
    null,
    'feed',
    blogId,
  )
  if (!saved.ok || !made) return saved
  return ideasAfter(actor, saved)
}

/** A refusal, with each link that could not be read when none could. */
type Refusal = { ok: false; error: string; failed?: Failed[] }
/** "Make post"'s and "Save and remake"'s result: when every link failed, which. */
export type Made = Saved | Refusal

export async function startFeedPost(
  actor: Actor,
  input: { requestId: string; title: string; kind: string; text: string },
): Promise<Saved> {
  // No post exists yet: the rule is who may make one.
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  const parsed = StartSchema.safeParse(input)
  if (!parsed.success) return fail(INVALID_SOURCE)
  return attempt('startFeedPost', async () => (await extractNew(actor, parsed.data)).saved)
}

/**
 * "Make post" (criteria 93, 94; GD18–GD21): the pasted text, or when there is none (or it is only
 * a web address, which is then the link) the pages at up to five links, read on the server at
 * once, extracted in one call into a new post with the first template ticked; then the idea
 * cards (GD1, ./ideas.ts moreIdeas), and no draft: the editor picks an idea next. A link that
 * cannot be read is listed on the source while the others go on; when none can be read nothing
 * is made, and the result lists each. A failed ideas step keeps the source and facts, and the
 * step shows "Try again". "Make blog" (BR1, `postKind` 'blog') is the same, into a blog, with
 * no template ticked: its cards are blog angles.
 */
export async function makePost(
  actor: Actor,
  input: {
    requestId: string
    links?: string[]
    text?: string
    title?: string
    kind?: string
    framing?: string
    notes?: string
    pageBrandId?: string | null
    postKind?: 'feed' | 'blog'
    language?: LanguageId
  },
  read: (url: string) => Promise<PageResult> = fetchPage,
): Promise<Made> {
  // No post exists yet: the rule is who may make one, before any page is read.
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  const parsed = MakeSchema.safeParse(input)
  if (!parsed.success) return fail(INVALID_SOURCE)
  const { requestId: id, title, kind, postKind } = parsed.data
  const pageBrandId = parsed.data.pageBrandId ?? null
  if (pageBrandId !== null && !isFeedPostPage(pageBrandId)) return fail(WORKFLOW_ERRORS.page)
  const from = sourceFrom(parsed.data, parsed.data.language)
  if (!from.ok) return from

  let failed: Failed[] | undefined
  const saved = await attempt('makePost', async () => {
    if ('links' in from) {
      // A second submit finds the first one's post without reading the pages again.
      const existing = await loadPost(id)
      if (existing && existing.stage !== 'source')
        return { ok: true, id, version: existing.version }
    }
    const got = await readSource(id, title, kind, from, read)
    if (!got.ok) {
      failed = got.failed
      return fail(got.error)
    }

    const { saved, made } = await extractNew(
      actor,
      got.start,
      got.extras,
      postKind === 'blog' ? [] : [TEMPLATES[0].id],
      pageBrandId,
      postKind,
    )
    if (!saved.ok || !made) return saved
    return ideasAfter(actor, saved)
  })
  return withFailed(saved, failed)
}

/** A refusal with the links that could not be read, when there were any. */
function withFailed(saved: Saved, failed: Failed[] | undefined): Made {
  return !saved.ok && failed ? { ...saved, failed } : saved
}

/**
 * Where a source comes from: pasted text, or web addresses to read; with the framing line and
 * notes either way (null when none), and the post's language.
 */
type From = ({ text: string } | { links: string[]; pasted: boolean }) & {
  framing: string | null
  notes: string | null
  language: LanguageId
}

/**
 * The pasted text, or when there is none the links. Text that is only a web address (smoke test,
 * 12 Oct) is read as the link; `pasted` says so, for the refusal's words. More than five links, a
 * framing line over 200 characters, both links and text, or neither is refused by name (GD18).
 */
function sourceFrom(fields: Fields, language: LanguageId): ({ ok: true } & From) | Refusal {
  const links = fields.links.filter((l) => l !== '')
  if (links.length > SOURCE_LIMITS.links) return fail(SOURCE_ERRORS.links)
  if (!FramingSchema.safeParse(fields.framing).success) return fail(SOURCE_ERRORS.framing)
  const chosen = { framing: fields.framing || null, notes: fields.notes || null, language }
  const trimmed = fields.text.trim()
  if (links.length > 0 && trimmed !== '') return fail(SOURCE_ERRORS.both)
  if (ONLY_A_LINK.test(trimmed)) return { ok: true, links: [trimmed], pasted: true, ...chosen }
  if (trimmed !== '') return { ok: true, text: fields.text, ...chosen }
  if (links.length === 0) return fail(SOURCE_ERRORS.empty)
  return { ok: true, links, pasted: false, ...chosen }
}

/**
 * The source to extract: the pasted text as given, or the pages at the links, read on the server
 * at once (criterion 94), their paragraphs in one sequence, each article's first 60 and all of
 * them within the length rule; titled `title`, else by the first page read (GD19).
 */
async function readSource(
  requestId: string,
  title: string,
  kind: string,
  from: From,
  read: (url: string) => Promise<PageResult>,
): Promise<{ ok: true; start: Start; extras: Extras } | Refusal> {
  const chosen = { framing: from.framing, notes: from.notes, language: from.language }
  if ('text' in from) {
    const pasted = StartSchema.safeParse({ requestId, title, kind, text: from.text })
    return pasted.success ? { ok: true, start: pasted.data, extras: chosen } : fail(INVALID_SOURCE)
  }
  const results = await Promise.allSettled(from.links.map((link) => read(link)))
  const { parts, paragraphs, failed } = joinPages(from.links, results)
  if (parts.length === 0) {
    return from.pasted ? fail(LINK_IN_SOURCE) : { ...fail(PAGE_ERROR), failed }
  }
  const fromPages = StartSchema.safeParse({
    requestId,
    title: firstChars(title || parts[0].title || parts[0].site, TITLE_MAX).trim(),
    kind,
    text: paragraphs.join('\n\n'),
  })
  if (!fromPages.success) return from.pasted ? fail(LINK_IN_SOURCE) : fail(PAGE_ERROR)
  // One part is a source read from a link, as before parts (criterion 94).
  const link = parts.length === 1 ? { url: parts[0].url, site: parts[0].site } : {}
  const extras: Extras = {
    ...link,
    parts,
    ...(failed.length > 0 ? { failed } : {}),
    ...chosen,
  }
  return { ok: true, start: fromPages.data, extras }
}

/**
 * The pages read, in the links' order, as parts of one sequence of paragraphs: each page's first
 * 60, while the whole stays within the length rule. A link that could not be read, or whose page
 * gives no paragraph that fits, is failed.
 */
function joinPages(
  links: string[],
  results: PromiseSettledResult<PageResult>[],
): { parts: SourcePart[]; paragraphs: string[]; failed: Failed[] } {
  const parts: SourcePart[] = []
  const paragraphs: string[] = []
  const failed: Failed[] = []
  let length = 0
  results.forEach((result, i) => {
    const got = result.status === 'fulfilled' ? result.value : null
    if (!got?.ok) {
      failed.push({ url: links[i], error: SOURCE_ERRORS.unread })
      return
    }
    const { page } = got
    const own = splitParagraphs(page.paragraphs.join('\n\n')).slice(0, PART_PARAGRAPHS)
    const first = paragraphs.length + 1
    for (const { text } of own) {
      const next = length + (paragraphs.length > 0 ? 2 : 0) + text.length
      if (next > TEXT_MAX) break
      paragraphs.push(text)
      length = next
    }
    if (paragraphs.length < first) {
      failed.push({ url: links[i], error: SOURCE_ERRORS.unread })
      return
    }
    const { url, site, title } = page
    parts.push({ url, site, title, from: first, to: paragraphs.length })
  })
  return { parts, paragraphs, failed }
}

type Extracted = { source: Body<'source'>; facts: Body<'facts'> }

/** The source's facts from the model, with the records they make; nothing is saved here. */
async function extract(
  postId: string,
  input: Start,
  extras: Extras,
): Promise<({ ok: true } & Extracted) | { ok: false; error: string }> {
  const { title, kind, text } = input
  // The framing line steers the key ideas; the notes are never source text (GD20, GD21).
  const framing = extras.framing ?? null
  const extracted = await extractFacts({ title, kind, text, postId, framing })
  if (!extracted.ok) return fail(extracted.error)
  const source = BODIES.source.parse({ ...extracted.source, ...extras })
  const facts: Body<'facts'> = {
    sourceId: artifactId('source', postId, source),
    keyIdeas: extracted.keyIdeas,
    facts: extracted.facts,
    replays: extracted.replays,
  }
  return { ok: true, source, facts }
}

/** The source and facts records, by id. */
async function putExtracted(
  tx: Tx,
  postId: string,
  actor: Actor,
  { source, facts }: Extracted,
): Promise<{ sourceId: string; factsId: string }> {
  const sourceId = await putArtifact(tx, {
    kind: 'source',
    postId,
    body: source,
    actorId: actor.id,
  })
  const factsId = await putArtifact(tx, { kind: 'facts', postId, body: facts, actorId: actor.id })
  return { sourceId, factsId }
}

/**
 * "Save and remake" at the source step (criterion 113; GD18): the same fields as "Make post", the
 * changed text or the pages at the changed links, extracted as a new source and facts, then, for
 * a post made through the idea cards, new cards for those facts, as "Make post" makes them (GD1);
 * for a post from before them, three versions of each ticked template after the response
 * (criteria 93, 94). It lands at structures. The old source, facts and versions stay in the
 * history. A failed extraction moves nothing; a failed ideas or draft step keeps the new source and
 * facts, and the step shows "Try again".
 */
export async function remakeFromSource(
  actor: Actor,
  id: string,
  version: number,
  input: {
    links?: string[]
    text?: string
    framing?: string
    notes?: string
    language?: LanguageId
  },
  read: (url: string) => Promise<PageResult> = fetchPage,
): Promise<Made> {
  let failed: Failed[] | undefined
  // Refused before any page is read: the workflow rule runs first.
  const saved = await command('remakeFromSource', 'remake', actor, id, version, async (post) => {
    const parsed = FieldsSchema.strict().safeParse(input)
    if (!parsed.success) return fail(INVALID_SOURCE)
    const current = post.current.source?.body
    if (!current) return fail(WORKFLOW_ERRORS.movedOn)
    // A remake keeps the source's language unless another is chosen (GD36, GD28).
    const from = sourceFrom(parsed.data, parsed.data.language ?? current.language)
    if (!from.ok) return fail(from.error)
    // Pasted text keeps the source's title; a page brings its own.
    const title = 'text' in from ? current.title : ''
    const got = await readSource(id, title, current.kind, from, read)
    if (!got.ok) {
      failed = got.failed
      return fail(got.error)
    }

    const saved = await runStep(id, 'extract', version, async () => {
      const made = await extract(id, got.start, got.extras)
      if (!made.ok) return made
      return save(post, version, actor, async (tx) => {
        const { sourceId, factsId } = await putExtracted(tx, id, actor, made)
        return {
          stage: 'structures',
          pointers: {
            ...clearFromRevision(post.pointers),
            sourceId,
            factsId,
            draftsId: null,
            picked: null,
          },
        }
      })
    })
    if (!saved.ok) return saved
    if (madeWithIdeas(post)) return ideasAfter(actor, saved)
    await draftAfter(actor, id, saved.version)
    return checkAfter(id, actor, saved)
  })
  return withFailed(saved, failed)
}

/** A post made through the idea cards (GD1): its drafts come from a card, not ticked templates. */
function madeWithIdeas(post: LoadedPost): boolean {
  return (post.pointers.ideasId ?? null) !== null
}

/**
 * The idea cards for the facts just saved, as "Make post" makes them: a failed ideas step keeps
 * the post at its facts, and the step shows failed with "Try again".
 */
export async function ideasAfter(
  actor: Actor,
  saved: { id: string; version: number },
): Promise<Saved> {
  const offered = await moreIdeas(actor, saved.id, saved.version)
  return offered.ok ? offered : { ok: true, ...saved }
}

/**
 * "Continue with this source" (criterion 113): back to the text versions with the source, facts,
 * versions and pick the post still points at, and no model call; the picked version's check
 * follows, as after any move to the text, reading again only what it has not read. Facts with no
 * versions stop at the idea cards for a post made through them: the cards it has while they were
 * offered for these facts, else new ones (GD1). A post from before them is drafted on after the
 * response (criterion 93).
 */
export async function continueWithSource(
  actor: Actor,
  id: string,
  version: number,
): Promise<Saved> {
  return command('continueWithSource', 'continueSource', actor, id, version, async (post) => {
    const { facts, drafts, ideas } = post.current
    if (!facts) return fail(WORKFLOW_ERRORS.movedOn)
    const saved = await save(post, version, actor, async () => ({
      stage: 'structures',
      pointers: post.pointers,
    }))
    if (saved.ok && !drafts && madeWithIdeas(post)) {
      // The cards it has while they were offered for these facts; else new ones (GD1).
      return ideas ? saved : ideasAfter(actor, saved)
    }
    if (saved.ok && !drafts) await draftAfter(actor, id, saved.version)
    return checkAfter(id, actor, saved)
  })
}

/**
 * The source extracted into a new post (a feed post unless `kind` says blog) at structures, with
 * these templates ticked, for this page (criterion 105), and when made from a blog linked to it
 * (BR6) with its from_blog record. `made` is false when the request's post was made before, so
 * nothing after it runs twice.
 */
async function extractNew(
  actor: Actor,
  input: Start,
  extras: Extras = {},
  ticked: string[] = [],
  pageBrandId: string | null = null,
  kind: 'feed' | 'blog' = 'feed',
  blogId: string | null = null,
): Promise<{ saved: Saved; made: boolean }> {
  const { requestId: id, title } = input
  // The browser's request id is the post id, so a later submit finds the first one's post.
  const existing = await loadPost(id)
  if (existing && existing.stage !== 'source') {
    return { saved: { ok: true, id, version: existing.version }, made: false }
  }

  // A placeholder at source first, so the extraction runs under the post's step lock: a
  // second submit overlapping this one is refused as running, and no second model call is made.
  if (!existing) {
    await db.transaction((tx) =>
      insertPost(tx, {
        id,
        kind,
        parentId: null,
        title,
        stage: 'source',
        pointers: emptyPointers(),
        actorId: actor.id,
        ifAbsent: true,
        blogId,
      }),
    )
  }

  const saved = await runStep(id, 'extract', PLACEHOLDER_VERSION, async () => {
    const made = await extract(id, input, extras)
    if (!made.ok) {
      // Nothing is left behind (criterion 5): the same request can try again.
      await deletePlaceholder(id)
      return made
    }

    const version = await db.transaction(async (tx) => {
      const { sourceId, factsId } = await putExtracted(tx, id, actor, made)
      if (blogId !== null) {
        await putArtifact(tx, {
          kind: 'blog_link',
          postId: id,
          actorId: actor.id,
          body: { kind: 'from_blog', blogId, postId: id },
        })
      }
      const result = await savePointers(
        tx,
        id,
        PLACEHOLDER_VERSION,
        {
          stage: 'structures',
          pointers: { ...emptyPointers(), sourceId, factsId, ticked, pageBrandId },
        },
        actor.id,
      )
      if (!result.ok) throw new Refused(result.error)
      return result.version
    })
    return { ok: true, id, version }
  })
  return { saved, made: saved.ok }
}

const NOT_A_SENTENCE = 'That sentence is not in the source.'
const ALREADY_A_FACT = 'That sentence is already a fact.'

/**
 * The next fact id: one past every id the facts or the drafts name, so a removed fact's id never
 * comes back bound to another sentence.
 */
function nextFactId(facts: Fact[], drafts: Body<'drafts'> | undefined): string {
  const named = [
    ...facts.map((f) => f.id),
    ...(drafts?.items ?? []).flatMap((item) =>
      item.structure.slides.flatMap((s) => Object.values(s.slots).flatMap((slot) => slot.factIds)),
    ),
  ]
  const most = Math.max(0, ...named.map((id) => Number(/^f(\d+)$/.exec(id)?.[1] ?? 0)))
  return `f${most + 1}`
}

/**
 * A new facts record with this list, and the drafts, idea cards and outline carried onto it (the
 * drafts noted `note` in the history), so none is lost. With `more`, a new source record the facts
 * are read from, and the drafts' versions as changed.
 */
function saveFacts(
  post: LoadedPost,
  version: number,
  actor: Actor,
  list: Fact[],
  note: string,
  more: { source?: Body<'source'>; items?: Body<'drafts'>['items'] } = {},
): Promise<Saved> {
  const { facts, drafts, ideas, outline } = post.current
  if (!facts) return Promise.resolve(fail(WORKFLOW_ERRORS.movedOn))
  return save(post, version, actor, async (tx) => {
    const sourceId = more.source
      ? await putArtifact(tx, {
          kind: 'source',
          postId: post.id,
          actorId: actor.id,
          body: more.source,
        })
      : facts.body.sourceId
    const factsId = await putArtifact(tx, {
      kind: 'facts',
      postId: post.id,
      actorId: actor.id,
      body: { ...facts.body, sourceId, facts: list },
    })
    const draftsId = drafts
      ? await putArtifact(tx, {
          kind: 'drafts',
          postId: post.id,
          actorId: actor.id,
          body: { ...drafts.body, items: more.items ?? drafts.body.items, factsId, note },
        })
      : post.pointers.draftsId
    // The idea cards too (GD1): they count only for the facts they were offered for.
    const ideasId = ideas
      ? await putArtifact(tx, {
          kind: 'ideas',
          postId: post.id,
          actorId: actor.id,
          body: { ...ideas.body, factsId },
        })
      : post.pointers.ideasId
    // And the outline (GD32), which counts only for the facts it was made for.
    const outlineId = outline
      ? await putArtifact(tx, {
          kind: 'post_outline',
          postId: post.id,
          actorId: actor.id,
          body: { ...outline.body, factsId },
        })
      : post.pointers.outlineId
    return {
      stage: post.stage,
      pointers: {
        ...post.pointers,
        ...(more.source && { sourceId }),
        factsId,
        draftsId,
        ideasId,
        outlineId,
      },
    }
  })
}

/** A source sentence, by its id (¶2.3), as a new fact: its exact text, supported (criterion 95). */
export async function addFact(
  actor: Actor,
  id: string,
  version: number,
  sentenceId: string,
): Promise<Saved> {
  return command('addFact', 'addFact', actor, id, version, async (post) => {
    const { source, facts, drafts } = post.current
    if (!source || !facts) return fail(WORKFLOW_ERRORS.movedOn)
    const sentence = sentencesById(source.body.paragraphs).get(sentenceId)
    if (!sentence) return fail(NOT_A_SENTENCE)
    const list = facts.body.facts
    if (list.some((f) => f.sentenceId === sentence.id || f.text === sentence.text)) {
      return fail(ALREADY_A_FACT)
    }
    const fact = sentenceFact(sentence, nextFactId(list, drafts?.body))
    return saveFacts(post, version, actor, [...list, fact], 'Fact added')
  })
}

/** A fact taken out; a draft slot bound to it becomes unbound until the editor fixes it. */
export async function removeFact(
  actor: Actor,
  id: string,
  version: number,
  factId: string,
): Promise<Saved> {
  return command('removeFact', 'removeFact', actor, id, version, async (post) => {
    const list = post.current.facts?.body.facts ?? []
    if (!list.some((f) => f.id === factId)) return fail(WORKFLOW_ERRORS.movedOn)
    return saveFacts(
      post,
      version,
      actor,
      list.filter((f) => f.id !== factId),
      'Fact removed',
    )
  })
}

const ResearchSourceSchema = z.object({
  claim: z.string().trim().min(1).max(TEXT_MAX),
  url: z.string().trim().min(1).max(2048),
  sentence: z.string().trim().min(1).max(TEXT_MAX),
})
const NOT_ON_PAGE = 'That sentence is no longer on the page.'
const ALREADY_A_SOURCE = 'That page is already a source.'

/**
 * The source with a page read for it appended as its next part (GD19): the page's first 60
 * paragraphs, numbered on from the source's, while the whole stays within the length rule. A
 * source with no parts (pasted, or read from one link) becomes its own first part, so it stays
 * listed; a pasted one is named by its title. No longer a demo source exactly.
 */
function withPart(
  source: Body<'source'>,
  page: Page,
): { ok: true; source: Body<'source'>; added: Paragraph[] } | { ok: false; error: string } {
  const n = source.paragraphs.length
  const own = source.site ?? source.title
  const parts = source.parts?.length
    ? source.parts
    : [{ url: source.url ?? '', site: own, title: source.title, from: 1, to: n }]
  let length = source.paragraphs.reduce((sum, p, i) => sum + (i > 0 ? 2 : 0) + p.text.length, 0)
  const added: Paragraph[] = []
  for (const { text } of splitParagraphs(page.paragraphs.join('\n\n')).slice(0, PART_PARAGRAPHS)) {
    const next = length + 2 + text.length
    if (next > TEXT_MAX) break
    added.push({ ref: `¶${n + added.length + 1}`, text })
    length = next
  }
  if (added.length === 0) return fail(SOURCE_ERRORS.unread)
  const part = {
    url: page.url,
    site: page.site,
    title: page.title || page.site,
    from: n + 1,
    to: n + added.length,
  }
  const paragraphs = [...source.paragraphs, ...added]
  return {
    ok: true,
    added,
    source: {
      ...source,
      text: paragraphs.map((p) => p.text).join('\n\n'),
      paragraphs,
      parts: [...parts, part],
      demoKey: null,
    },
  }
}

/** The one slot the picked version's sentence is in, with the fact bound to it as well. */
function bindFact(
  item: Body<'drafts'>['items'][number],
  at: { slide: number; slot: string },
  factId: string,
): Body<'drafts'>['items'][number] {
  const slides = item.structure.slides.map((s, i) => {
    const slot = s.slots[at.slot]
    if (i !== at.slide - 1 || !slot || slot.factIds.includes(factId)) return s
    return {
      ...s,
      slots: { ...s.slots, [at.slot]: { ...slot, factIds: [...slot.factIds, factId] } },
    }
  })
  return { ...item, structure: { ...item.structure, slides } }
}

/**
 * "Add as a source" (BR14): a page "Research this" found for a sentence of the picked version,
 * read again with the safe reader (../fetch-page.ts), appended as a new part of a new source
 * record; the page's sentence that supports it, found on the page as read, becomes a fact, bound
 * to the sentence's slot so the check reads the sentence against it; then the check runs again.
 * No search: the page and its sentence come from the press before. Its home is the text versions:
 * a new part changes the sources the slides list, so from a later step the post moves back there
 * by itself (GD28).
 */
export async function addResearchSource(
  actor: Actor,
  id: string,
  version: number,
  input: { claim: string; url: string; sentence: string },
  read: (url: string) => Promise<PageResult> = fetchPage,
): Promise<Saved> {
  const saved = await command(
    'addResearchSource',
    'addResearchSource',
    actor,
    id,
    version,
    async (post) => {
      const parsed = ResearchSourceSchema.safeParse(input)
      if (!parsed.success) return fail(WORKFLOW_ERRORS.movedOn)
      const { claim, url, sentence } = parsed.data
      const { source, facts, drafts } = post.current
      const picked = post.pointers.picked
      const item = picked === null ? undefined : drafts?.body.items[picked]
      if (!source || !facts || !drafts || picked === null || !item) {
        return fail(WORKFLOW_ERRORS.movedOn)
      }
      const at = claimsIn(item.structure, item.template).find((c) => c.text === claim)
      if (!at) return fail(WORKFLOW_ERRORS.movedOn)

      const got = await read(url)
      if (!got.ok) return fail(got.error)
      const listed = [source.body.url, ...(source.body.parts ?? []).map((p) => p.url)]
      if (listed.includes(got.page.url)) return fail(ALREADY_A_SOURCE)
      const next = withPart(source.body, got.page)
      if (!next.ok) return next
      const quoted = next.added
        .flatMap((p) => sourceSentences(p))
        .find((s) => findQuote(sentence, s.text) !== null)
      if (!quoted) return fail(NOT_ON_PAGE)

      const fact = sentenceFact(quoted, nextFactId(facts.body.facts, drafts.body))
      const items = drafts.body.items.map((it, i) =>
        i === picked ? bindFact(it, at, fact.id) : it,
      )
      return saveFacts(post, version, actor, [...facts.body.facts, fact], 'Source added', {
        source: next.source,
        items,
      })
    },
  )
  return checkAfter(id, actor, saved)
}
