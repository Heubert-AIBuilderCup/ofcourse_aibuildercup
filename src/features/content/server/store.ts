import 'server-only'
import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { type AnyPgColumn, alias } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { db } from '@/shared/lib/db'
import { contentArtifact, contentAsset, contentPost, user } from '@/shared/lib/db/schema'
import { brandById } from '../brands'
import { type LanguageId, languageById } from '../languages'
import {
  type BlogGuide,
  cardSourceLine,
  excerptOf,
  type FeedPost,
  type FeedVersion,
  isLive,
  slideAlt,
  slideWords,
} from '../lib/feed'
import { liveLine } from '../lib/lines'
import {
  type ComicCover,
  freeSlug,
  type PublicPost,
  postAssetPath,
  postPath,
  type SitemapRow,
  slugOf,
} from '../lib/public-post'
import { type PostSource, postSources } from '../lib/sites'
import { LIVE_STAGES } from '../lib/workflow'
import { type MarketId, marketById } from '../markets'
import {
  type Artifact,
  type ArtifactKind,
  BODIES,
  type Body,
  type Pointers,
  PointersSchema,
} from '../model/artifacts'
import { type CurrentPost, current } from '../model/current'
import type { Stage } from '../model/stages'
import {
  type BlogTarget,
  BrandSchema,
  type FeedSettings,
  type LaidSlide,
  type RenderedSlide,
  type SlideArt,
  SlideArtSchema,
} from '../model/types'
import { artifactId, assetId } from './hash'

// The post store. Records are written once, by the hash of their content; a post's pointers
// move only when its stored version is still the one the caller read, so a save made on a stale
// copy is refused with who changed it instead of overwriting their change. The commands
// (./commands) write records and pointers in one transaction, so a refused save rolls back
// that command's new records.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Kind = 'feed' | 'social' | 'blog'

/** The most cards the board reads, newest change first. */
const BOARD_LIMIT = 500
/** The most renders of one post read for their art, newest first. */
const RENDER_ART_LIMIT = 100

/**
 * A value read back through its schema (security.md §6): every default added since the row was
 * written applies, so an older record reads in the current shape. One that no longer parses is
 * logged by what it is and where it failed, never its content, and read as missing (null), so one
 * bad row costs its record, never the page.
 */
function readBack<T>(schema: z.ZodType<T>, value: unknown, what: string): T | null {
  const read = schema.safeParse(value)
  if (read.success) return read.data
  const where = read.error.issues.map((i) => i.path.join('.') || '(root)').join(', ')
  console.error(`[content.store] ${what} does not parse at ${where}`)
  return null
}

/** A stored record's body through BODIES[kind], or null when it no longer parses (readBack). */
export const bodyOf = <K extends ArtifactKind>(
  kind: K,
  body: unknown,
  id: string,
): Body<K> | null => readBack(BODIES[kind] as unknown as z.ZodType<Body<K>>, body, `${kind} ${id}`)

/** The pointers that name records (themeId names a theme, ticked names templates). */
const RECORD_POINTERS = [
  'sourceId',
  'factsId',
  'draftsId',
  'revisionId',
  'layoutId',
  'renderId',
  'sourceCheckId',
  'settingsId',
  'sendBackId',
  'approvalId',
  'marketId',
  'captionId',
  'exportId',
  'socialLinkId',
  'coversId',
  'ideasId',
  'artPlanId',
  'outlineId',
  'blogOutlineId',
  'blogTextId',
  'blogImagesId',
] as const satisfies readonly (keyof Pointers)[]

export const changedBy = (name: string | null) => `Changed by ${name ?? 'someone'} just now`

/** Validates the body with BODIES[kind], computes its id, inserts it unless it exists, returns the id. */
export async function putArtifact<K extends ArtifactKind>(
  tx: Tx,
  input: { kind: K; postId: string; body: Body<K>; actorId: string },
): Promise<string> {
  const body = BODIES[input.kind].parse(input.body)
  const id = artifactId(input.kind, input.postId, body)
  await tx
    .insert(contentArtifact)
    .values({ id, postId: input.postId, kind: input.kind, body, createdByUserId: input.actorId })
    .onConflictDoNothing()
  return id
}

/** Stores an image by the hash of its bytes; the same bytes again are the same row. */
export async function putAsset(tx: Tx | null, bytes: Uint8Array, mime: string): Promise<string> {
  const id = assetId(bytes)
  await (tx ?? db).insert(contentAsset).values({ id, mime, bytes }).onConflictDoNothing()
  return id
}

/** The most assets read at once: a post's slides, two files each. */
const ASSETS_LIMIT = 100

/** Stored images by id in one query; an id with no row is absent from the map. */
export async function getAssets(
  ids: string[],
): Promise<Map<string, { mime: string; bytes: Uint8Array }>> {
  const wanted = [...new Set(ids)].slice(0, ASSETS_LIMIT)
  if (wanted.length === 0) return new Map()
  const rows = await db
    .select({ id: contentAsset.id, mime: contentAsset.mime, bytes: contentAsset.bytes })
    .from(contentAsset)
    .where(inArray(contentAsset.id, wanted))
    .limit(ASSETS_LIMIT)
  return new Map(rows.map((r) => [r.id, { mime: r.mime, bytes: r.bytes }]))
}

export async function getAsset(id: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const [row] = await db
    .select({ mime: contentAsset.mime, bytes: contentAsset.bytes })
    .from(contentAsset)
    .where(eq(contentAsset.id, id))
    .limit(1)
  return row ?? null
}

/** The art each of the post's renders used, newest render first: only the art, not the render. */
export async function listRenderArt(postId: string): Promise<Body<'render'>['art'][]> {
  const rows = await db
    .select({ art: sql<unknown>`${contentArtifact.body} -> 'art'` })
    .from(contentArtifact)
    .where(and(eq(contentArtifact.postId, postId), eq(contentArtifact.kind, 'render')))
    .orderBy(desc(contentArtifact.createdAt))
    .limit(RENDER_ART_LIMIT)
  // Parsed for its type: putArtifact validated each body on the way in.
  return rows.map((r) => BODIES.render.shape.art.parse(r.art))
}

/**
 * The images of each of the post's look renders, newest render first: only their slideArt, so
 * "Swap image" can put an earlier take back on its slide (GD13). Renders with none are left out.
 */
export async function listSlideArt(postId: string): Promise<SlideArt[]> {
  const rows = await db
    .select({ art: sql<unknown>`${contentArtifact.body} -> 'slideArt'` })
    .from(contentArtifact)
    .where(
      and(
        eq(contentArtifact.postId, postId),
        eq(contentArtifact.kind, 'render'),
        sql`${contentArtifact.body} ? 'slideArt'`,
      ),
    )
    .orderBy(desc(contentArtifact.createdAt))
    .limit(RENDER_ART_LIMIT)
  // Parsed for its type: putArtifact validated each body on the way in.
  return rows.flatMap((r) => z.array(SlideArtSchema).parse(r.art))
}

export type LoadedPost = {
  id: string
  kind: Kind
  parentId: string | null
  title: string
  stage: Stage
  version: number
  pointers: Pointers
  records: Map<string, Artifact>
  current: CurrentPost
  updatedAt: Date
  updatedByName: string | null
  createdByUserId: string | null
  /** The approval students see (criterion 116), or null before the first publish. */
  publishedApprovalId: string | null
  /** The path a comic tells (RC2), a catalogue course id; null on every other post. */
  courseId: string | null
}

/**
 * The post, every record its pointers name (one query), and current() over them. Null when
 * missing. A social version's pointers also name its feed post's source and facts, so records of
 * the post's parent count too; no other post's do.
 */
export async function loadPost(id: string): Promise<LoadedPost | null> {
  const [post] = await db
    .select({
      id: contentPost.id,
      kind: contentPost.kind,
      parentId: contentPost.parentId,
      title: contentPost.title,
      stage: contentPost.stage,
      version: contentPost.version,
      pointers: contentPost.pointers,
      updatedAt: contentPost.updatedAt,
      updatedByName: user.name,
      createdByUserId: contentPost.createdByUserId,
      publishedApprovalId: contentPost.publishedApprovalId,
      courseId: contentPost.courseId,
    })
    .from(contentPost)
    .leftJoin(user, eq(user.id, contentPost.updatedByUserId))
    .where(eq(contentPost.id, id))
    .limit(1)
  if (!post) return null
  const pointers = readBack(PointersSchema, post.pointers, `pointers of ${id}`)
  if (!pointers) return null

  const ids = RECORD_POINTERS.map((key) => pointers[key]).filter((v): v is string => !!v)
  const rows = ids.length
    ? await db
        .select()
        .from(contentArtifact)
        .where(
          and(
            inArray(contentArtifact.postId, post.parentId ? [id, post.parentId] : [id]),
            inArray(contentArtifact.id, ids),
          ),
        )
    : []
  // Each body through its schema, so the defaults added since it was written apply; one that no
  // longer parses is missing, and current() drops what rests on it.
  const records = new Map<string, Artifact>(
    rows.flatMap((r) => {
      const record = artifactOf(r)
      return record ? [[r.id, record] as const] : []
    }),
  )

  return {
    ...post,
    pointers,
    kind: post.kind as Kind,
    stage: post.stage as Stage,
    records,
    current: current(pointers, records),
  }
}

/** A content_artifact row as a record, its body read back through its kind's schema; null when it no longer parses. */
function artifactOf(row: typeof contentArtifact.$inferSelect): Artifact | null {
  // The kind column is checked against ARTIFACT_KINDS by the database.
  const kind = row.kind as ArtifactKind
  const body = bodyOf(kind, row.body, row.id)
  if (!body) return null
  return {
    id: row.id,
    kind,
    postId: row.postId,
    body,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
  }
}

/** The most versions one post's history lists, newest first. */
const HISTORY_LIMIT = 200
/** The records the history lists: the text versions, which "Restore" points the post back at. */
const HISTORY_KINDS = ['drafts', 'revision'] as const satisfies readonly ArtifactKind[]

/** One saved text version in a post's history (criterion 101). */
export type HistoryEntry = {
  id: string
  kind: (typeof HISTORY_KINDS)[number]
  /** What changed, as the writing command noted it; null on a record written before notes. */
  note: string | null
  /** When it was saved, ISO. */
  at: string
  /** Who saved it, by name; null when the account is gone. */
  by: string | null
  /** The facts it was made from: current() keeps it only while the post still points at them. */
  factsId: string | null
}

/**
 * A post's structure and revision records, newest first, with who wrote each and its note. One
 * query; bodies are read for two text keys only, a missing one as null (the note's own default).
 */
export async function listHistory(postId: string): Promise<HistoryEntry[]> {
  const rows = await db
    .select({
      id: contentArtifact.id,
      kind: contentArtifact.kind,
      note: sql<string | null>`${contentArtifact.body}->>'note'`,
      factsId: sql<string | null>`${contentArtifact.body}->>'factsId'`,
      createdAt: contentArtifact.createdAt,
      by: user.name,
    })
    .from(contentArtifact)
    .leftJoin(user, eq(user.id, contentArtifact.createdByUserId))
    .where(
      and(eq(contentArtifact.postId, postId), inArray(contentArtifact.kind, [...HISTORY_KINDS])),
    )
    .orderBy(desc(contentArtifact.createdAt), desc(contentArtifact.id))
    .limit(HISTORY_LIMIT)
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as HistoryEntry['kind'],
    note: r.note ?? null,
    at: r.createdAt.toISOString(),
    by: r.by,
    factsId: r.factsId,
  }))
}

/** The most shares one post lists, newest first. */
const SHARES_LIMIT = 100

/**
 * A post's shares to the pages' accounts (criterion 10), newest first: no pointer names them, so
 * they are read by kind. One query; a body that no longer parses is left out.
 */
export async function listShares(postId: string): Promise<{ id: string; body: Body<'share'> }[]> {
  const rows = await db
    .select({ id: contentArtifact.id, body: contentArtifact.body })
    .from(contentArtifact)
    .where(and(eq(contentArtifact.postId, postId), eq(contentArtifact.kind, 'share')))
    .orderBy(desc(contentArtifact.createdAt), desc(contentArtifact.id))
    .limit(SHARES_LIMIT)
  return rows.flatMap((r) => {
    const body = bodyOf('share', r.body, r.id)
    return body ? [{ id: r.id, body }] : []
  })
}

/** One of the post's own records by id, whichever its pointers name; null for any other post's or none. */
export async function loadRecord(postId: string, id: string): Promise<Artifact | null> {
  const [row] = await db
    .select()
    .from(contentArtifact)
    .where(and(eq(contentArtifact.postId, postId), eq(contentArtifact.id, id)))
    .limit(1)
  return row ? artifactOf(row) : null
}

export async function insertPost(
  tx: Tx,
  input: {
    id: string
    kind: Kind
    parentId: string | null
    title: string
    stage: Stage
    pointers: Pointers
    actorId: string
    /** Leave a post that already has this id as it is, instead of failing. */
    ifAbsent?: boolean
    /** The blog the new post belongs to (BR6), or none. */
    blogId?: string | null
    /** The path a comic tells (RC2), or none. */
    courseId?: string | null
  },
): Promise<void> {
  const insert = tx.insert(contentPost).values({
    id: input.id,
    kind: input.kind,
    parentId: input.parentId,
    blogId: input.blogId ?? null,
    courseId: input.courseId ?? null,
    title: input.title,
    stage: input.stage,
    pointers: PointersSchema.parse(input.pointers),
    createdByUserId: input.actorId,
    updatedByUserId: input.actorId,
  })
  await (input.ifAbsent ? insert.onConflictDoNothing() : insert)
}

/** Deletes a post still at source, the placeholder a failed extraction leaves: never a post past it. */
export async function deletePlaceholder(id: string): Promise<void> {
  await db.delete(contentPost).where(and(eq(contentPost.id, id), eq(contentPost.stage, 'source')))
}

/** The blog a post is linked to (BR6–BR8), or null for none; undefined when there is no such post. */
export async function linkedBlogOf(postId: string): Promise<string | null | undefined> {
  const [row] = await db
    .select({ blogId: contentPost.blogId })
    .from(contentPost)
    .where(eq(contentPost.id, postId))
    .limit(1)
  return row ? row.blogId : undefined
}

/**
 * Links the post to this blog, or to none (BR8), in the command's transaction: only the column;
 * the command's save moves the version and writes the blog_link record beside it.
 */
export async function setLinkedBlog(tx: Tx, postId: string, blogId: string | null): Promise<void> {
  await tx.update(contentPost).set({ blogId }).where(eq(contentPost.id, postId))
}

/** The most blogs "Link to an existing blog" offers, and the most posts a blog's workbench lists. */
const BLOG_CHOICES_LIMIT = 200
const BLOG_POSTS_LIMIT = 200

/**
 * The blogs a post may be linked to (BR8), draft or live, last changed first, by id and title.
 * No index behind kind, as for the feed: a scan of content_post at the expected size.
 */
export async function blogChoices(): Promise<{ id: string; title: string }[]> {
  return db
    .select({ id: contentPost.id, title: contentPost.title })
    .from(contentPost)
    .where(eq(contentPost.kind, 'blog'))
    .orderBy(desc(contentPost.updatedAt))
    .limit(BLOG_CHOICES_LIMIT)
}

/**
 * The posts linked to a blog (BR6–BR8), last changed first, each with whether it is published
 * (students see it unless it has expired), by content_post_blog_id_idx.
 */
export async function postsOfBlog(
  blogId: string,
): Promise<{ id: string; title: string; live: boolean }[]> {
  const rows = await db
    .select({
      id: contentPost.id,
      title: contentPost.title,
      publishedApprovalId: contentPost.publishedApprovalId,
    })
    .from(contentPost)
    .where(eq(contentPost.blogId, blogId))
    .orderBy(desc(contentPost.updatedAt))
    .limit(BLOG_POSTS_LIMIT)
  return rows.map((r) => ({ id: r.id, title: r.title, live: r.publishedApprovalId !== null }))
}

/** Whether a post with this id exists and is a blog, draft or live (BR8: posts link only to blogs). */
export async function isBlog(id: string): Promise<boolean> {
  const [row] = await db
    .select({ kind: contentPost.kind })
    .from(contentPost)
    .where(eq(contentPost.id, id))
    .limit(1)
  return row?.kind === 'blog'
}

/** What a source check read: an approved revision, or before approval the picked version of one drafts record. */
export type SourceCheckLink =
  | { revisionId: string; draft?: undefined; blogTextId?: undefined }
  | { revisionId: null; draft: { draftsId: string; index: number }; blogTextId?: undefined }
  | { revisionId: null; draft?: undefined; blogTextId: string }

/**
 * Points the post at a source check made after the response (criterion 98), as long as the post
 * still points at the text it read: the same revision, or with none, the same drafts and pick,
 * or a blog's same text (BR3).
 * No person changed the post, so its version and who changed it stay, and nobody's open copy goes
 * stale; savePointers keeps the check when a copy read before it is saved. The version; null when
 * the text moved on.
 */
export async function setSourceCheckPointer(
  postId: string,
  checkId: string,
  link: SourceCheckLink,
): Promise<number | null> {
  const p = contentPost.pointers
  const reads =
    link.revisionId !== null
      ? sql`${p}->>'revisionId' = ${link.revisionId}`
      : link.blogTextId !== undefined
        ? sql`${p}->>'blogTextId' = ${link.blogTextId}`
        : sql`${p}->>'revisionId' is null and ${p}->>'draftsId' = ${link.draft.draftsId}
          and ${p}->'picked' = to_jsonb(${link.draft.index}::int)`
  const rows = await db
    .update(contentPost)
    .set({ pointers: sql`jsonb_set(${p}, '{sourceCheckId}', to_jsonb(${checkId}::text))` })
    .where(and(eq(contentPost.id, postId), reads))
    .returning({ version: contentPost.version })
  return rows[0]?.version ?? null
}

/**
 * The pointers to save, as SQL: the caller's. A command reads the post before its work and saves
 * after, so with `keepSourceCheck` (the command left the source check as it read it) a check that
 * landed in between (setSourceCheckPointer) is not undone; current() still drops it if the text
 * moved on.
 */
function pointersToSave(pointers: Pointers, keepSourceCheck: boolean): SQL {
  const json = sql`${JSON.stringify(pointers)}::jsonb`
  if (!keepSourceCheck) return json
  return sql`${json} || jsonb_build_object('sourceCheckId', ${contentPost.pointers}->'sourceCheckId')`
}

/** Moves the pointers when the stored version is still `expected`; else the "Changed by" refusal. */
export async function savePointers(
  tx: Tx,
  id: string,
  expected: number,
  next: { stage: Stage; pointers: Pointers; title?: string },
  actorId: string,
  options: { keepSourceCheck?: boolean } = {},
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const [saved] = await tx
    .update(contentPost)
    .set({
      stage: next.stage,
      pointers: pointersToSave(
        PointersSchema.parse(next.pointers),
        options.keepSourceCheck === true,
      ),
      ...(next.title === undefined ? {} : { title: next.title }),
      version: sql`${contentPost.version} + 1`,
      updatedByUserId: actorId,
      updatedAt: sql`now()`,
    })
    .where(and(eq(contentPost.id, id), eq(contentPost.version, expected)))
    .returning({ version: contentPost.version })
  if (saved) {
    if (LIVE_STAGES.includes(next.stage)) await giveSlug(tx, id)
    return { ok: true, version: saved.version }
  }

  const [by] = await tx
    .select({ name: user.name })
    .from(contentPost)
    .leftJoin(user, eq(user.id, contentPost.updatedByUserId))
    .where(eq(contentPost.id, id))
    .limit(1)
  return { ok: false, error: changedBy(by?.name ?? null) }
}

/**
 * Names the approval students see (criteria 116, 117), in the publishing save: approveAndPublish
 * calls it inside its transaction, which a refused version check rolls back. No later move clears
 * it, so a live post taken back for editing keeps its published version until the next publish.
 */
export async function publishApproval(tx: Tx, id: string, approvalId: string): Promise<void> {
  await tx
    .update(contentPost)
    .set({ publishedApprovalId: approvalId })
    .where(eq(contentPost.id, id))
}

/**
 * A feed post going live gets its public page's slug (criterion 107), and a blog its own at
 * /blog/<slug> (BR5, BR9): from its title, with the next free number when another post has it
 * (lib/public-post.ts), once, and kept for good after, so a shared or indexed link never changes.
 * The readers keep the two apart by kind; the free number is counted over every slug, since one
 * unique index holds them all. A social version or a post that has one is left as it is. The taken slugs are read without an index (a scan of content_post's slugs, once per
 * publish, is acceptable at the expected size); two posts with the same title published at the
 * same moment meet the unique index, and the second save fails with "Please try again".
 */
async function giveSlug(tx: Tx, id: string): Promise<void> {
  const [post] = await tx
    .select({
      title: contentPost.title,
      slug: contentPost.slug,
      kind: contentPost.kind,
      parentId: contentPost.parentId,
    })
    .from(contentPost)
    .where(eq(contentPost.id, id))
    .limit(1)
  const paged = post?.kind === 'feed' || post?.kind === 'blog'
  if (!post || post.slug !== null || !paged || post.parentId !== null) return
  const base = slugOf(post.title)
  // A slug is only a-z, 0-9 and hyphens, so `base` needs no escaping in the pattern.
  const taken = await tx
    .select({ slug: contentPost.slug })
    .from(contentPost)
    .where(or(eq(contentPost.slug, base), sql`${contentPost.slug} ~ ${`^${base}-[0-9]+$`}`))
    .limit(SLUG_SCAN_LIMIT)
  const slugs = taken.flatMap((t) => (t.slug ? [t.slug] : []))
  await tx
    .update(contentPost)
    .set({ slug: freeSlug(base, slugs) })
    .where(and(eq(contentPost.id, id), isNull(contentPost.slug)))
}

/** The most posts read that share a title's slug. */
const SLUG_SCAN_LIMIT = 1000

export type BoardCard = {
  id: string
  kind: Kind
  parentId: string | null
  title: string
  stage: Stage
  updatedAt: Date
  updatedByName: string | null
  /** The market of the post's market version while it is current, or null. */
  market: MarketId | null
  platform: 'instagram' | 'linkedin' | null
  brandName: string | null
  liveLine: string | null
  /** The approval students see while the post is worked on again (criterion 116), or null. */
  publishedApprovalId: string | null
  /** The path a comic tells (RC2), or null. */
  courseId: string | null
  /** The page it is made for: a social version's own brand, a post's chosen page, or null. */
  pageId: string | null
  /** The language its source is written in (GD36); English when the source is gone. */
  language: LanguageId
  /** Its owner on the board and the note to them (server/assign.ts), or null. */
  assigneeId: string | null
  assigneeName: string | null
  assignmentNote: string | null
}

/**
 * Every post for the board in three queries: the posts with their last editor, their owner and
 * their source's language, their market records, and the live posts' approvals with the settings
 * each pinned.
 */
export async function listCards(): Promise<BoardCard[]> {
  const assignee = alias(user, 'assignee')
  const source = alias(contentArtifact, 'card_source')
  const posts = await db
    .select({
      id: contentPost.id,
      kind: contentPost.kind,
      parentId: contentPost.parentId,
      title: contentPost.title,
      stage: contentPost.stage,
      pointers: contentPost.pointers,
      publishedApprovalId: contentPost.publishedApprovalId,
      courseId: contentPost.courseId,
      updatedAt: contentPost.updatedAt,
      updatedByName: user.name,
      assigneeId: contentPost.assigneeUserId,
      assigneeName: assignee.name,
      assignmentNote: contentPost.assignmentNote,
      language: sql<string | null>`${source.body}->>'language'`,
    })
    .from(contentPost)
    .leftJoin(user, eq(user.id, contentPost.updatedByUserId))
    .leftJoin(assignee, eq(assignee.id, contentPost.assigneeUserId))
    .leftJoin(
      source,
      and(
        eq(source.kind, 'source'),
        eq(source.postId, contentPost.id),
        eq(source.id, sql`${contentPost.pointers}->>'sourceId'`),
      ),
    )
    .orderBy(desc(contentPost.updatedAt))
    .limit(BOARD_LIMIT)

  // A market version counts while it was made from the revision and render the post points at.
  const marketIds = posts.map((p) => p.pointers.marketId).filter((v): v is string => !!v)
  const markets = marketIds.length
    ? await db
        .select({
          id: contentArtifact.id,
          revisionId: sql<string | null>`${contentArtifact.body}->>'revisionId'`,
          renderId: sql<string | null>`${contentArtifact.body}->>'renderId'`,
          market: sql<string | null>`${contentArtifact.body}->>'market'`,
        })
        .from(contentArtifact)
        .where(and(eq(contentArtifact.kind, 'market'), inArray(contentArtifact.id, marketIds)))
    : []
  const marketMadeFrom = new Map(markets.map((m) => [m.id, m]))

  // A live post reads as the settings its approval pinned, counted down from the approval: each
  // approval with its settings record.
  const approvalIds = posts
    .filter((p) => LIVE_STAGES.includes(p.stage as Stage))
    .map((p) => p.pointers.approvalId)
    .filter((v): v is string => !!v)
  const settings = alias(contentArtifact, 'approved_settings')
  const approved = approvalIds.length
    ? await db
        .select({
          id: contentArtifact.id,
          settings: settings.body,
          approvedAt: sql<string>`${contentArtifact.body}->'by'->>'at'`,
        })
        .from(contentArtifact)
        .innerJoin(
          settings,
          and(
            eq(settings.kind, 'settings'),
            eq(settings.postId, contentArtifact.postId),
            eq(settings.id, sql`${contentArtifact.body}->>'settingsId'`),
          ),
        )
        .where(and(eq(contentArtifact.kind, 'approval'), inArray(contentArtifact.id, approvalIds)))
    : []
  // Settings that no longer parse give the card no line.
  const approvedLine = new Map(
    approved.flatMap((a) => {
      const settings = bodyOf('settings', a.settings, `pinned by ${a.id}`)
      return settings ? [[a.id, liveLine(settings, a.approvedAt)] as const] : []
    }),
  )

  return posts.map((p) => {
    const { marketId, revisionId, renderId, social, approvalId } = p.pointers
    const market = marketId ? marketMadeFrom.get(marketId) : undefined
    return {
      id: p.id,
      kind: p.kind as Kind,
      parentId: p.parentId,
      title: p.title,
      stage: p.stage as Stage,
      updatedAt: p.updatedAt,
      updatedByName: p.updatedByName,
      // Validated by putArtifact on the way in: an id the markets file has, or the card shows none.
      market:
        market &&
        revisionId &&
        renderId &&
        market.revisionId === revisionId &&
        market.renderId === renderId
          ? (marketById(market.market ?? '')?.id ?? null)
          : null,
      platform: social?.platform ?? null,
      brandName: social ? (brandById(social.brandId)?.name ?? null) : null,
      liveLine:
        LIVE_STAGES.includes(p.stage as Stage) && approvalId
          ? (approvedLine.get(approvalId) ?? null)
          : null,
      publishedApprovalId: p.publishedApprovalId,
      courseId: p.courseId,
      pageId: social ? social.brandId : (p.pointers.pageBrandId ?? null),
      language: languageById(p.language ?? '')?.id ?? 'en',
      assigneeId: p.assigneeId,
      assigneeName: p.assigneeName,
      assignmentNote: p.assignmentNote,
    }
  })
}

/** The most live posts the feed reads. */
const FEED_LIMIT = 500

/**
 * The posts the student feed shows: published, and a feed post, never a social version (criterion
 * 71). Published is the approval students see, not the stage, so a live post taken back for
 * editing stays (criterion 116). No index behind the predicate: a scan of content_post is
 * acceptable at the expected size (hundreds of posts).
 */
const liveFeedPosts = (): SQL | undefined =>
  and(
    isNotNull(contentPost.publishedApprovalId),
    eq(contentPost.kind, 'feed'),
    isNull(contentPost.parentId),
  )

/** content_artifact, or an alias of it, as the approval joins read it. */
type ArtifactColumns = {
  id: AnyPgColumn
  kind: AnyPgColumn
  postId: AnyPgColumn
  body: AnyPgColumn
}

/** The record an approval pins by `key`, of this kind, on the same post. */
function pinnedBy(
  approval: ArtifactColumns,
  record: ArtifactColumns,
  kind: ArtifactKind,
  key: keyof Body<'approval'>,
): SQL | undefined {
  return and(
    eq(record.kind, kind),
    eq(record.postId, approval.postId),
    eq(record.id, sql`${approval.body}->>${key}`),
  )
}

/** The slides as the feed shows them: each PNG with the alt text of its laid lines. */
function feedVersion(slides: RenderedSlide[], laid: LaidSlide[], excerpt: string): FeedVersion {
  return {
    excerpt,
    slides: slides.map((s, i) => ({
      pngAssetId: s.pngAssetId,
      alt: slideAlt(i + 1, slideWords(laid[i])),
    })),
  }
}

/** A live post as read, with its slug, its last slide's search line and its blog beside it. */
type LiveRead = {
  post: FeedPost
  slug: string | null
  searchLine: string | null
  blogId: string | null
}

/**
 * The live feed posts with what each approval pinned, newest approval first, so the limit keeps
 * the newest; not yet filtered by expiry or pinned by layer (lib/feed.ts does both).
 */
export async function listLive(): Promise<FeedPost[]> {
  return (await readLive(liveFeedPosts(), FEED_LIMIT)).map((r) => r.post)
}

/**
 * The live feed post at /feed/<id>, read by its id (criterion 75), or null: no such post, not
 * live, a social version, or expired at `now` (criterion 73).
 */
export async function liveById(id: string, now: Date = new Date()): Promise<FeedPost | null> {
  const [found] = await readLive(and(liveFeedPosts(), eq(contentPost.id, id)), 1, now)
  return found && isLive(found.post, now) ? found.post : null
}

/**
 * The live feed post at /posts/<slug>, as its public page shows it (criterion 107), or null: none
 * has the slug, or it is no longer live, or it has expired at `now`.
 */
export async function liveBySlug(slug: string, now: Date = new Date()): Promise<PublicPost | null> {
  const [found] = await readLive(and(liveFeedPosts(), eq(contentPost.slug, slug)), 1, now)
  if (!found || !isLive(found.post, now)) return null
  return { ...found.post, slug, searchLine: found.searchLine }
}

/**
 * The comic a futures card shows for each path (RC16), by course id: of the live feed posts telling
 * that path (`course_id`, only comics have one), the newest approval still unexpired at `now`, by
 * its public page and its first panel's public picture. A path with none, or a comic with no slug
 * or no panel, is absent. One readLive over all the paths, newest approval first, at most FEED_LIMIT.
 */
export async function liveComicCovers(
  courseIds: readonly string[],
  now: Date = new Date(),
): Promise<Record<string, ComicCover>> {
  const ids = [...new Set(courseIds)]
  if (ids.length === 0) return {}
  const read = await readLive(
    and(liveFeedPosts(), inArray(contentPost.courseId, ids)),
    FEED_LIMIT,
    now,
  )
  const covers: Record<string, ComicCover> = {}
  for (const { post, slug } of read) {
    const first = post.main.slides[0]
    if (!post.courseId || post.courseId in covers || !slug || !first || !isLive(post, now)) continue
    covers[post.courseId] = {
      title: post.title,
      href: postPath(slug),
      coverSrc: postAssetPath(first.pngAssetId),
    }
  }
  return covers
}

/** The most comics comicStatuses reads; published ones are read first, so a cut drops only drafts. */
const COMICS_LIMIT = 1000

/**
 * Each path's comic for the Comic gaps tab (RC13), by course id: `live` when one of its feed posts
 * has a published approval still unexpired at `now` (taken back for editing or not, as the feed
 * reads it), `in_progress` when one exists at any other stage; live wins. A path with no comic is
 * absent. One query over the feed posts with a course (only comics have one), no index behind it:
 * a scan of content_post is acceptable at the expected size, as for liveFeedPosts.
 */
export async function comicStatuses(
  now: Date = new Date(),
): Promise<Map<string, 'in_progress' | 'live'>> {
  const approval = alias(contentArtifact, 'approval')
  const settings = alias(contentArtifact, 'approved_settings')
  const rows = await db
    .select({
      courseId: contentPost.courseId,
      approvedAt: sql<string | null>`${approval.body}->'by'->>'at'`,
      settingsId: settings.id,
      settings: settings.body,
    })
    .from(contentPost)
    .leftJoin(approval, approvalOf(approval))
    .leftJoin(settings, pinnedBy(approval, settings, 'settings', 'settingsId'))
    .where(
      and(
        eq(contentPost.kind, 'feed'),
        isNull(contentPost.parentId),
        isNotNull(contentPost.courseId),
      ),
    )
    .orderBy(sql`${contentPost.publishedApprovalId} IS NULL`, desc(contentPost.id))
    .limit(COMICS_LIMIT)
  const statuses = new Map<string, 'in_progress' | 'live'>()
  for (const r of rows) {
    if (!r.courseId || statuses.get(r.courseId) === 'live') continue
    // Settings that no longer parse leave the comic in progress, as the feed leaves it out.
    const pinned = r.settingsId ? bodyOf('settings', r.settings, r.settingsId) : null
    const live =
      pinned !== null &&
      r.approvedAt !== null &&
      isLive({ approvedAt: r.approvedAt, settings: pinned }, now)
    statuses.set(r.courseId, live ? 'live' : 'in_progress')
  }
  return statuses
}

/** The most candidates read for a post's related posts (criterion SR10); lib/related.ts keeps four. */
const RELATED_LIMIT = 20

/**
 * The live, unexpired feed posts a post's Related section chooses from (criterion SR10): the
 * ones published on its source (publishedSourceId, never the working pointer) or carrying any of
 * its theme or destination tags, by jsonb containment on the settings each approval pinned (one `@>` per tag,
 * so a post sharing any one of them matches); never the post itself; newest approval first, at
 * most RELATED_LIMIT before expiry is applied, so an old expired candidate can at most leave the
 * list short. A post with no source and no such tags reads nothing. The containment has no index
 * behind it and needs none at the expected size: it is tested only on the settings the live posts'
 * approvals pin (at most FEED_LIMIT posts), as isLiveAsset's is on their renders.
 */
export async function relatedCandidates(
  post: Pick<FeedPost, 'id' | 'sourceId' | 'tags'>,
  now: Date = new Date(),
): Promise<FeedPost[]> {
  const settings = alias(contentArtifact, 'approved_settings')
  const tags = post.tags.filter((t) => t.startsWith('theme:') || t.startsWith('destination:'))
  const sharesTag = or(
    ...tags.map((t) => sql`${settings.body}->'tags' @> ${JSON.stringify([t])}::jsonb`),
  )
  const shares = or(
    post.sourceId === null ? undefined : eq(publishedSourceId, post.sourceId),
    sharesTag &&
      exists(
        db
          .select({ one: sql`1` })
          .from(settings)
          .where(and(pinnedBy(approval, settings, 'settings', 'settingsId'), sharesTag)),
      ),
  )
  if (!shares) return []
  const read = await readLive(
    and(liveFeedPosts(), ne(contentPost.id, post.id), shares),
    RELATED_LIMIT,
    now,
  )
  return read.map((r) => r.post).filter((p) => isLive(p, now))
}

/** The approval students see, as readLive joins it: a `where` given to readLive may name its columns. */
const approval = alias(contentArtifact, 'approval')
/** The revision the approval students see pins, and the facts it was made from, as readLive joins them. */
const publishedRevision = alias(contentArtifact, 'published_revision')
const publishedFacts = alias(contentArtifact, 'published_facts')
/** The source those facts were made from: its titles and links are the post's sources (GD31). */
const publishedSource = alias(contentArtifact, 'published_source')
/**
 * The source students see a post built on: the published approval's revision's facts' source, never
 * the working pointer, so a source remade while the post is edited reaches no student (criteria
 * 113, 116, 117). A `where` given to readLive may name it.
 */
const publishedSourceId = sql<string | null>`${publishedFacts.body}->>'sourceId'`

/**
 * The live feed posts matching `where`, newest approval first, at most `limit`, with what each
 * approval pinned. Two queries: the posts, with the source their published facts name, ordered by
 * their approval's time (ISO, so text order is time order) before the limit, then their approvals joined to the settings, render, revision,
 * layout and (when pinned) market version each names by id; then their Instagram links and the
 * blogs they are linked to that are live at `now` (two more, side by side).
 */
async function readLive(
  where: SQL | undefined,
  limit: number,
  now: Date = new Date(),
): Promise<LiveRead[]> {
  const posts = await db
    .select({
      id: contentPost.id,
      title: contentPost.title,
      slug: contentPost.slug,
      courseId: contentPost.courseId,
      blogId: contentPost.blogId,
      approvalId: contentPost.publishedApprovalId,
      sourceId: publishedSourceId,
      source: sourceLinks(publishedSource),
    })
    .from(contentPost)
    .innerJoin(approval, approvalOf(approval))
    .leftJoin(publishedRevision, pinnedBy(approval, publishedRevision, 'revision', 'revisionId'))
    .leftJoin(
      publishedFacts,
      and(
        eq(publishedFacts.kind, 'facts'),
        eq(publishedFacts.postId, contentPost.id),
        eq(publishedFacts.id, sql`${publishedRevision.body}->>'factsId'`),
      ),
    )
    .leftJoin(
      publishedSource,
      and(
        eq(publishedSource.kind, 'source'),
        eq(publishedSource.postId, contentPost.id),
        eq(publishedSource.id, publishedSourceId),
      ),
    )
    .where(where)
    .orderBy(desc(sql`${approval.body}->'by'->>'at'`), desc(contentPost.id))
    .limit(limit)
  const approvalIds = posts.map((p) => p.approvalId).filter((v): v is string => !!v)
  if (approvalIds.length === 0) return []

  const settings = alias(contentArtifact, 'approved_settings')
  const render = alias(contentArtifact, 'approved_render')
  const revision = alias(contentArtifact, 'approved_revision')
  const layout = alias(contentArtifact, 'approved_layout')
  const market = alias(contentArtifact, 'approved_market')
  const approved = await db
    .select({
      id: contentArtifact.id,
      approvedAt: sql<string>`${contentArtifact.body}->'by'->>'at'`,
      settings: settings.body,
      renderSlides: sql<unknown>`${render.body}->'slides'`,
      structure: sql<unknown>`${revision.body}->'structure'`,
      layoutSlides: sql<unknown>`${layout.body}->'slides'`,
      marketId: market.id,
      marketOf: sql<unknown>`${market.body}->'market'`,
      marketSlides: sql<unknown>`${market.body}->'slides'`,
      marketLayout: sql<unknown>`${market.body}->'layout'`,
      marketExcerpt: sql<unknown>`${market.body}->'feedExcerpt'`,
    })
    .from(contentArtifact)
    .innerJoin(settings, pinnedBy(contentArtifact, settings, 'settings', 'settingsId'))
    .innerJoin(render, pinnedBy(contentArtifact, render, 'render', 'renderId'))
    .innerJoin(revision, pinnedBy(contentArtifact, revision, 'revision', 'revisionId'))
    .innerJoin(
      layout,
      and(
        eq(layout.kind, 'layout'),
        eq(layout.postId, contentArtifact.postId),
        eq(layout.id, sql`${render.body}->>'layoutId'`),
      ),
    )
    .leftJoin(market, pinnedBy(contentArtifact, market, 'market', 'marketId'))
    .where(and(eq(contentArtifact.kind, 'approval'), inArray(contentArtifact.id, approvalIds)))
    .limit(limit)
  const byApproval = new Map(approved.map((a) => [a.id, a]))
  const blogIds = [...new Set(posts.flatMap((p) => (p.blogId ? [p.blogId] : [])))]
  const [instagramOf, guides] = await Promise.all([
    instagramLinks(posts.map((p) => p.id)),
    liveGuides(blogIds, now),
  ])

  return posts.flatMap((p) => {
    const a = p.approvalId ? byApproval.get(p.approvalId) : undefined
    if (!a) return []
    // Each part through its record's schema: a post whose pinned records no longer parse is not
    // shown, and a market version that no longer parses is shown as none.
    const pinned = readBack(PinnedSchema, a, `records pinned by ${a.id}`)
    if (!pinned) return []
    const market =
      a.marketId === null
        ? null
        : readBack(
            PinnedMarketSchema,
            {
              market: a.marketOf,
              slides: a.marketSlides,
              layout: a.marketLayout,
              feedExcerpt: a.marketExcerpt,
            },
            `market ${a.marketId}`,
          )
    // The sources the published facts were made from (GD31); none when its record is gone.
    const source =
      p.source === null ? null : readBack(PublishedSourceSchema, p.source, `source of ${p.id}`)
    const post: FeedPost = {
      id: p.id,
      title: p.title,
      approvedAt: a.approvedAt,
      settings: pinned.settings,
      sourceLine: cardSourceLine(pinned.layoutSlides),
      sourceId: p.sourceId,
      courseId: p.courseId,
      tags: pinned.settings.tags,
      main: feedVersion(pinned.renderSlides, pinned.layoutSlides, excerptOf(pinned.structure)),
      market: market
        ? {
            id: market.market,
            version: feedVersion(market.slides, market.layout, market.feedExcerpt),
          }
        : null,
      instagram: instagramOf.get(p.id) ?? null,
      sources: source ? postSources(source) : [],
      guide: p.blogId ? (guides.get(p.blogId) ?? null) : null,
      // Its fixed lines are written in it (GD39); a post whose source is gone reads as English.
      language: source?.language ?? 'en',
    }
    const searchLine = pinned.layoutSlides.map((s) => s.searchLine).find((l) => l) ?? null
    return [{ post, slug: p.slug, searchLine, blogId: p.blogId }]
  })
}

/** Only what a sources list and the post's language (GD39) read of a source, never the article's text; none without the record. */
const sourceLinks = (source: ArtifactColumns) =>
  sql<unknown>`CASE WHEN ${source.id} IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object('title', ${source.body}->'title', 'url', ${source.body}->'url', 'site', ${source.body}->'site', 'parts', ${source.body}->'parts', 'language', ${source.body}->'language')) END`

/** What readLive reads of the records an approval pins, each part by its own record's schema. */
const PinnedSchema = z.object({
  settings: BODIES.settings,
  renderSlides: BODIES.render.shape.slides,
  structure: BODIES.revision.shape.structure,
  layoutSlides: BODIES.layout.shape.slides,
})
/** What readLive reads of the published source: its title and links, never its text. */
const PublishedSourceSchema = BODIES.source.pick({
  title: true,
  url: true,
  site: true,
  parts: true,
  language: true,
})
const PinnedMarketSchema = BODIES.market.pick({
  market: true,
  slides: true,
  layout: true,
  feedExcerpt: true,
})

/**
 * Every live feed post's slug with its approval time and settings, newest approval first, for the
 * sitemap (criterion 107; lib/public-post.ts leaves out the expired ones). At most
 * SITEMAP_LIMIT, the sitemap protocol's own bound for one file.
 */
export async function listLiveSlugs(): Promise<SitemapRow[]> {
  const approval = alias(contentArtifact, 'approval')
  const settings = alias(contentArtifact, 'approved_settings')
  const approvedAt = sql<string>`${approval.body}->'by'->>'at'`
  const rows = await db
    .select({ slug: contentPost.slug, approvedAt, settings: settings.body })
    .from(contentPost)
    .innerJoin(approval, approvalOf(approval))
    .innerJoin(settings, pinnedBy(approval, settings, 'settings', 'settingsId'))
    .where(and(liveFeedPosts(), isNotNull(contentPost.slug)))
    .orderBy(desc(approvedAt))
    .limit(SITEMAP_LIMIT)
  return rows.flatMap((r) => {
    const settings = r.slug ? bodyOf('settings', r.settings, `of /posts/${r.slug}`) : null
    return r.slug && settings ? [{ slug: r.slug, approvedAt: r.approvedAt, settings }] : []
  })
}

/** The most URLs one sitemap file may hold (sitemaps.org). */
const SITEMAP_LIMIT = 50_000

/** The approval students see of a post, never its working one (criterion 116), joined as `approval`. */
const approvalOf = (approval: ArtifactColumns): SQL | undefined =>
  and(
    eq(approval.kind, 'approval'),
    eq(approval.postId, contentPost.id),
    eq(approval.id, contentPost.publishedApprovalId),
  )

/**
 * The newest recorded Instagram link of each feed post's exported Instagram versions (criterion
 * 90), with the page it went out under: the frozen brand of the version's revision, or the brand
 * file's for a version adapted before brands carried a handle. One query over the children.
 */
async function instagramLinks(
  parentIds: string[],
): Promise<Map<string, NonNullable<FeedPost['instagram']>>> {
  const found = new Map<string, NonNullable<FeedPost['instagram']>>()
  if (parentIds.length === 0) return found
  const link = alias(contentArtifact, 'social_link')
  const revision = alias(contentArtifact, 'social_revision')
  const links = await db
    .select({
      parentId: contentPost.parentId,
      brandId: sql<string | null>`${contentPost.pointers}->'social'->>'brandId'`,
      url: sql<string>`${link.body}->>'url'`,
      page: sql<unknown>`${revision.body}->'brand'->'instagram'`,
    })
    .from(contentPost)
    .innerJoin(
      link,
      and(
        eq(link.kind, 'social_link'),
        eq(link.postId, contentPost.id),
        eq(link.id, sql`${contentPost.pointers}->>'socialLinkId'`),
      ),
    )
    .leftJoin(
      revision,
      and(
        eq(revision.kind, 'revision'),
        eq(revision.postId, contentPost.id),
        eq(revision.id, sql`${contentPost.pointers}->>'revisionId'`),
      ),
    )
    .where(
      and(
        inArray(contentPost.parentId, parentIds),
        eq(contentPost.kind, 'social'),
        eq(contentPost.stage, 'exported'),
        sql`${contentPost.pointers}->'social'->>'platform' = 'instagram'`,
      ),
    )
    .orderBy(desc(contentPost.updatedAt))
    .limit(FEED_LIMIT)
  for (const l of links) {
    if (!l.parentId || found.has(l.parentId)) continue
    // A brand frozen before ADR-124 has no page: the brand file's handle stands in.
    const frozen = BrandSchema.shape.instagram.safeParse(l.page)
    const page =
      (frozen.success ? frozen.data : null) ??
      (l.brandId ? (brandById(l.brandId)?.instagram ?? null) : null)
    if (page) found.set(l.parentId, { url: l.url, handle: page.handle, pageUrl: page.url })
  }
  return found
}

/**
 * True when a live, unexpired feed post's approved render or market version names this PNG
 * (criteria 77, 107; an expired post's slides leave with its page). One query over the live posts'
 * approvals and their settings, by jsonb containment on the slides; no bytes are read. Two posts
 * may name the same bytes, so every post naming it is read (at most FEED_LIMIT) and one still
 * live is enough. The containment has no index behind it, and needs none at the expected size:
 * it is tested only on the renders and market versions the live posts' approvals pin, reached by
 * id from those posts (tens in this slice, at most FEED_LIMIT), never on every render stored; and
 * the browser keeps each slide (a year signed in, an hour in public), so a reader asks once. A GIN
 * index on the slides would be paid by every render written; it earns its place only if live
 * posts reach the thousands.
 */
export async function isLiveAsset(id: string, now: Date = new Date()): Promise<boolean> {
  const approval = alias(contentArtifact, 'approval')
  const settings = alias(contentArtifact, 'approved_settings')
  const render = alias(contentArtifact, 'approved_render')
  const market = alias(contentArtifact, 'approved_market')
  const names = JSON.stringify([{ pngAssetId: id }])
  const rows = await db
    .select({
      approvedAt: sql<string>`${approval.body}->'by'->>'at'`,
      settingsId: settings.id,
      settings: settings.body,
    })
    .from(contentPost)
    .innerJoin(approval, approvalOf(approval))
    .innerJoin(settings, pinnedBy(approval, settings, 'settings', 'settingsId'))
    .innerJoin(render, pinnedBy(approval, render, 'render', 'renderId'))
    .leftJoin(market, pinnedBy(approval, market, 'market', 'marketId'))
    .where(
      and(
        liveFeedPosts(),
        or(
          sql`${render.body}->'slides' @> ${names}::jsonb`,
          sql`${market.body}->'slides' @> ${names}::jsonb`,
        ),
      ),
    )
    .limit(FEED_LIMIT)
  // Settings that no longer parse leave the post out, as the feed does.
  return rows.some((r) => {
    const settings = bodyOf('settings', r.settings, r.settingsId)
    return settings !== null && isLive({ approvedAt: r.approvedAt, settings }, now)
  })
}

/** The most live blogs the readers read, newest publish first. */
const BLOGS_LIMIT = 500

/** A live blog as its public page and the feed read it (BR9–BR11): what its published approval pins. */
export type LiveBlog = {
  id: string
  title: string
  slug: string
  /** When it was first published: its first approval's time, ISO. */
  publishedAt: string
  /** When it was last published: the approval students see, ISO. Its expiry counts from here. */
  updatedAt: string
  settings: FeedSettings
  /** Tag ids from the pinned settings, as a post's (ADR-122). */
  tags: string[]
  sections: { heading: string; body: string }[]
  takeaways: string[]
  faq: { q: string; a: string }[]
  /** Its drawn pictures in order, each its tinted copy (GD16) in its place, its scene as alt text. */
  pictures: { target: BlogTarget; assetId: string; alt: string }[]
  /** Linked posts' slides after a section (BR4, BR7), each only while that post is live. */
  embeds: { after: number; postId: string; title: string; slides: FeedVersion['slides'] }[]
  /** The sources its published facts were made from, with their links. */
  sources: PostSource[]
  /** "From this guide" (BR7): the live posts linked to it, newest approval first, by id and slug. */
  posts: { id: string; slug: string | null; title: string }[]
  /** The language it is written in (GD40), its source's; absent is English. */
  language?: LanguageId
}

/**
 * The blogs students and the public read: published (the approval students see, not the stage, so
 * a live blog taken back for editing stays, criteria 116, 117) and a blog. No index behind the
 * predicate, as for the feed posts: a scan of content_post is acceptable at the expected size.
 */
const liveBlogPosts = (): SQL | undefined =>
  and(isNotNull(contentPost.publishedApprovalId), eq(contentPost.kind, 'blog'))

/**
 * The blogs among `blogIds` live at `now` (published, with a slug, not expired), as the posts
 * linked to them link to them (BR7): a blog unpublished or expired gives none, so its posts'
 * "Read the full guide" is hidden. One query, by primary key, bounded by the ids given.
 */
async function liveGuides(blogIds: string[], now: Date): Promise<Map<string, BlogGuide>> {
  const found = new Map<string, BlogGuide>()
  if (blogIds.length === 0) return found
  const settings = alias(contentArtifact, 'approved_settings')
  const rows = await db
    .select({
      id: contentPost.id,
      slug: contentPost.slug,
      approvedAt: sql<string>`${approval.body}->'by'->>'at'`,
      settingsId: settings.id,
      settings: settings.body,
    })
    .from(contentPost)
    .innerJoin(approval, approvalOf(approval))
    .innerJoin(settings, pinnedBy(approval, settings, 'settings', 'settingsId'))
    .where(and(liveBlogPosts(), isNotNull(contentPost.slug), inArray(contentPost.id, blogIds)))
    .limit(blogIds.length)
  for (const r of rows) {
    const settings = bodyOf('settings', r.settings, r.settingsId)
    if (r.slug && settings && isLive({ approvedAt: r.approvedAt, settings }, now)) {
      found.set(r.id, { id: r.id, slug: r.slug })
    }
  }
  return found
}

/**
 * The blog this post is linked to while that blog is live at `now` (BR7), for its caption's
 * "Read the full guide"; null for none, or one not live.
 */
export async function liveGuideOf(
  postId: string,
  now: Date = new Date(),
): Promise<BlogGuide | null> {
  const blogId = await linkedBlogOf(postId)
  if (!blogId) return null
  return (await liveGuides([blogId], now)).get(blogId) ?? null
}

/** The text, pictures and source chain the approval students see pins, as readBlogs joins them. */
const publishedText = alias(contentArtifact, 'published_text')
const publishedImages = alias(contentArtifact, 'published_images')
const publishedOutline = alias(contentArtifact, 'published_outline')
const publishedBlogFacts = alias(contentArtifact, 'published_blog_facts')
const publishedBlogSource = alias(contentArtifact, 'published_blog_source')
const firstApproval = alias(contentArtifact, 'first_approval')

/** What readBlogs reads of the records a blog's approval pins, each by its own record's schema. */
const PinnedBlogSchema = z.object({
  settings: BODIES.settings,
  text: BODIES.blog_text.pick({ sections: true, takeaways: true, faq: true }),
})

/** The record another record names by `key` in its body, of this kind, on the same post. */
const namedBy = (
  from: ArtifactColumns,
  record: ArtifactColumns,
  kind: ArtifactKind,
  key: string,
): SQL | undefined =>
  and(
    eq(record.kind, kind),
    eq(record.postId, contentPost.id),
    eq(record.id, sql`${from.body}->>${key}`),
  )

/**
 * The live, unexpired blogs matching `where`, newest publish first, at most `limit`, with what each
 * approval pinned. Two queries: the blogs, each with its approval's settings, text and pictures,
 * the source its text's outline's facts name, and its first approval's time (a correlated min over
 * its own records, by content_artifact_post_id_idx); then in one read the live posts their pictures
 * embed, by id, and those linked to them, by content_post_blog_id_idx (readLive, at most
 * FEED_LIMIT). A blog whose pinned settings or text no longer parse is not shown.
 */
async function readBlogs(where: SQL | undefined, limit: number, now: Date): Promise<LiveBlog[]> {
  const settings = alias(contentArtifact, 'approved_settings')
  const updatedAt = sql<string>`${approval.body}->'by'->>'at'`
  const firstAt = db
    .select({ at: sql<string>`min(${firstApproval.body}->'by'->>'at')` })
    .from(firstApproval)
    .where(and(eq(firstApproval.postId, contentPost.id), eq(firstApproval.kind, 'approval')))
  const rows = await db
    .select({
      id: contentPost.id,
      title: contentPost.title,
      slug: contentPost.slug,
      updatedAt,
      publishedAt: sql<string>`(${firstAt})`,
      settings: settings.body,
      text: publishedText.body,
      images: publishedImages.body,
      source: sourceLinks(publishedBlogSource),
    })
    .from(contentPost)
    .innerJoin(approval, approvalOf(approval))
    .innerJoin(settings, pinnedBy(approval, settings, 'settings', 'settingsId'))
    .innerJoin(publishedText, pinnedBy(approval, publishedText, 'blog_text', 'blogTextId'))
    .leftJoin(publishedImages, pinnedBy(approval, publishedImages, 'blog_images', 'blogImagesId'))
    .leftJoin(
      publishedOutline,
      namedBy(publishedText, publishedOutline, 'blog_outline', 'outlineId'),
    )
    .leftJoin(publishedBlogFacts, namedBy(publishedOutline, publishedBlogFacts, 'facts', 'factsId'))
    .leftJoin(
      publishedBlogSource,
      namedBy(publishedBlogFacts, publishedBlogSource, 'source', 'sourceId'),
    )
    .where(and(liveBlogPosts(), where))
    .orderBy(desc(updatedAt), desc(contentPost.id))
    .limit(limit)

  const read = rows.flatMap((r) => {
    const pinned = readBack(PinnedBlogSchema, r, `records pinned by blog ${r.id}`)
    const live = pinned && isLive({ approvedAt: r.updatedAt, settings: pinned.settings }, now)
    if (!pinned || !live || !r.slug) return []
    // Pictures or a source that no longer parse are shown as none.
    const images = r.images === null ? null : bodyOf('blog_images', r.images, `of blog ${r.id}`)
    const source =
      r.source === null ? null : readBack(PublishedSourceSchema, r.source, `source of ${r.id}`)
    return [{ row: r, slug: r.slug, pinned, images, source }]
  })

  // The embedded posts and the posts linked to these blogs that students can see now, in one read.
  const embedIds = [...new Set(read.flatMap((b) => b.images?.embeds.map((e) => e.postId) ?? []))]
  const blogIds = read.map((b) => b.row.id)
  const shown =
    blogIds.length === 0
      ? undefined
      : or(
          inArray(contentPost.blogId, blogIds),
          embedIds.length === 0 ? undefined : inArray(contentPost.id, embedIds),
        )
  const live = shown
    ? (await readLive(and(liveFeedPosts(), shown), FEED_LIMIT, now)).filter((l) =>
        isLive(l.post, now),
      )
    : []
  const embedded = new Map(live.map((l) => [l.post.id, l.post] as const))

  return read.map(({ row, slug, pinned, images, source }) => ({
    id: row.id,
    title: row.title,
    slug,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    settings: pinned.settings,
    tags: pinned.settings.tags,
    sections: pinned.text.sections.map(({ heading, body }) => ({ heading, body })),
    takeaways: pinned.text.takeaways,
    faq: pinned.text.faq.map(({ q, a }) => ({ q, a })),
    pictures: (images?.images ?? []).flatMap((p) =>
      p.tintedAssetId ? [{ target: p.target, assetId: p.tintedAssetId, alt: p.scene }] : [],
    ),
    embeds: (images?.embeds ?? []).flatMap((e) => {
      const post = embedded.get(e.postId)
      return post
        ? [{ after: e.after, postId: e.postId, title: post.title, slides: post.main.slides }]
        : []
    }),
    sources: source ? postSources(source) : [],
    posts: live
      .filter((l) => l.blogId === row.id)
      .map((l) => ({ id: l.post.id, slug: l.slug, title: l.post.title })),
    // Its page and card read it (GD40); a blog whose source is gone reads as English.
    language: source?.language ?? 'en',
  }))
}

/** The live, unexpired blogs, newest publish first (BR11). */
export async function liveBlogs(now: Date = new Date()): Promise<LiveBlog[]> {
  return readBlogs(undefined, BLOGS_LIMIT, now)
}

/**
 * The live blog at /blog/<slug> (BR9), or null: no blog has the slug (a feed post's is not a
 * blog's), it is not published, or it has expired at `now`.
 */
export async function liveBlogBySlug(
  slug: string,
  now: Date = new Date(),
): Promise<LiveBlog | null> {
  const [found] = await readBlogs(eq(contentPost.slug, slug), 1, now)
  return found ?? null
}

/**
 * The live blog with this id, as readers read it (BR6: the sections a post is made from), or
 * null: no such post, not a blog, not published, or expired at `now`.
 */
export async function liveBlogById(id: string, now: Date = new Date()): Promise<LiveBlog | null> {
  const [found] = await readBlogs(eq(contentPost.id, id), 1, now)
  return found ?? null
}

/**
 * Every live blog's slug with its last publish time and settings, newest first, for the sitemap
 * (BR10; lib/public-post.ts leaves out the expired ones). At most SITEMAP_LIMIT.
 */
export async function listLiveBlogSlugs(): Promise<SitemapRow[]> {
  const settings = alias(contentArtifact, 'approved_settings')
  const approvedAt = sql<string>`${approval.body}->'by'->>'at'`
  const rows = await db
    .select({ slug: contentPost.slug, approvedAt, settings: settings.body })
    .from(contentPost)
    .innerJoin(approval, approvalOf(approval))
    .innerJoin(settings, pinnedBy(approval, settings, 'settings', 'settingsId'))
    .where(and(liveBlogPosts(), isNotNull(contentPost.slug)))
    .orderBy(desc(approvedAt))
    .limit(SITEMAP_LIMIT)
  return rows.flatMap((r) => {
    const settings = r.slug ? bodyOf('settings', r.settings, `of /blog/${r.slug}`) : null
    return r.slug && settings ? [{ slug: r.slug, approvedAt: r.approvedAt, settings }] : []
  })
}

/**
 * True when a live, unexpired blog's published pictures name this PNG as a tinted copy, the one
 * its page shows (BR9): never an original, and never a post's slide (isLiveAsset serves those).
 * One query over the live blogs' approvals, by jsonb containment on the pictures each pins; no
 * bytes are read. No index behind the containment, as for isLiveAsset: it is tested only on the
 * pictures the live blogs' approvals pin (at most BLOGS_LIMIT), never on every record stored.
 */
export async function isLiveBlogAsset(id: string, now: Date = new Date()): Promise<boolean> {
  const settings = alias(contentArtifact, 'approved_settings')
  const names = JSON.stringify([{ tintedAssetId: id }])
  const rows = await db
    .select({
      approvedAt: sql<string>`${approval.body}->'by'->>'at'`,
      settingsId: settings.id,
      settings: settings.body,
    })
    .from(contentPost)
    .innerJoin(approval, approvalOf(approval))
    .innerJoin(settings, pinnedBy(approval, settings, 'settings', 'settingsId'))
    .innerJoin(publishedImages, pinnedBy(approval, publishedImages, 'blog_images', 'blogImagesId'))
    .where(and(liveBlogPosts(), sql`${publishedImages.body}->'images' @> ${names}::jsonb`))
    .limit(BLOGS_LIMIT)
  return rows.some((r) => {
    const settings = bodyOf('settings', r.settings, r.settingsId)
    return settings !== null && isLive({ approvedAt: r.approvedAt, settings }, now)
  })
}
