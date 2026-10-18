// Copies chosen live feed posts and live targeted updates, as they are, from one database to
// another (the local dev database to production through the Cloud SQL proxy): nothing is made
// again and no model is called. The target's account --as becomes the owner and approver of all
// of it: every user id, in a column or inside a record's JSON, is mapped to it.
//   bun --conditions react-server scripts/copy-content.ts [--from <url>] --to <url> --as <email>
//     [--posts <id,…>] [--updates <all-live|title-or-id,…>] [--dry-run] [--yes-remote]
// --from left out: the DATABASE_URL Bun loads from .env.local, the dev database. A title holding
// a comma is given by its id.
//
// What a post takes with it, read from the schema (src/shared/lib/db/schema.ts):
// - content_post: the post, and its exported Instagram versions (kind social, parent_id the post,
//   with a link), whose link the feed shows beside the post (store.ts instagramLinks).
// - content_artifact: every record of those posts; the approval, its settings, render, revision,
//   layout, market version, source and share records are what the feed and /posts/<slug> read.
// - content_asset: every image a record names (any string of its JSON that is an asset id).
// Left behind: content_step (the workbench's step locks), ai_call (the model call log, no
// foreign key), ai_cache (model answers, by input, not by post), content_idea_decision (the
// editors' Ideas queue, keyed by idea), and a linked blog the copy does not hold (unlinked,
// reported). An update takes only its row: its only references are users.
//
// Safety: the source is read in one read-only transaction; the target is written in one
// transaction, all or nothing. A post or update whose id the target has is skipped. Slugs are
// checked before writing. --dry-run writes everything, reports, then rolls back. A target that is
// not this machine is refused without --yes-remote. URLs are printed as host:port/name only.

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { BODIES } from '../src/features/content/model/artifacts'
import { canReview } from '../src/shared/lib/auth/access'
import * as schema from '../src/shared/lib/db/schema'
import {
  assetCandidates,
  type CopyArgs,
  mappedUserColumns,
  maskUrl,
  parseArgs,
  remapJson,
  scrub,
  slugConflicts,
  stampUserIds,
  targetRefusal,
  type UserMap,
  withPresentBlogs,
} from './copy-content-plan'

const { adminUpdate, contentArtifact, contentAsset, contentPost, user } = schema

/** The most posts one run copies, and the bounds on what they bring. */
const POSTS_MAX = 100
const CHILDREN_MAX = 200
const ARTIFACTS_MAX = 20_000
const UPDATES_MAX = 1_000
/** Rows per insert: images are large, so a statement carries a few at a time. */
const ASSET_BATCH = 20
const ROW_BATCH = 200
/** The longest error message printed. */
const MESSAGE_MAX = 500

type Db = ReturnType<typeof drizzle<typeof schema>>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type PostRow = typeof contentPost.$inferSelect
type ArtifactRow = typeof contentArtifact.$inferSelect
type AssetRow = typeof contentAsset.$inferSelect
type UpdateRow = typeof adminUpdate.$inferSelect

const POST_USERS = [
  'createdByUserId',
  'updatedByUserId',
  'assigneeUserId',
  'assignedByUserId',
] as const satisfies readonly (keyof PostRow)[]
const UPDATE_USERS = [
  'createdByUserId',
  'approvedByUserId',
] as const satisfies readonly (keyof UpdateRow)[]

/** A refusal with a message fit to print. */
class Refused extends Error {}
/** Thrown at the end of a dry run, to roll the target back. */
class DryRun extends Error {}

const chunks = <T>(rows: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) =>
    rows.slice(i * size, (i + 1) * size),
  )

const parsed = parseArgs(process.argv.slice(2))
if (!parsed.ok) {
  for (const e of parsed.errors) console.error(e)
  console.error(
    'Usage: bun --conditions react-server scripts/copy-content.ts [--from <url>] --to <url> --as <email> [--posts <id,…>] [--updates <all-live|title-or-id,…>] [--dry-run] [--yes-remote]',
  )
  process.exit(1)
}
const args: CopyArgs = parsed.value
const fromUrl = args.from ?? process.env.DATABASE_URL
if (!fromUrl) {
  console.error('No source: pass --from, or run from the repo so Bun loads DATABASE_URL.')
  process.exit(1)
}
const urls = [fromUrl, args.to]
if (maskUrl(fromUrl) === maskUrl(args.to)) {
  console.error('The source and the target are the same database.')
  process.exit(1)
}
const refusal = targetRefusal(args.to, args.yesRemote)
if (refusal) {
  console.error(refusal)
  process.exit(1)
}
if (args.posts.length > POSTS_MAX) {
  console.error(`At most ${POSTS_MAX} posts per run.`)
  process.exit(1)
}

const sourceClient = postgres(fromUrl, { max: 1, prepare: false, onnotice: () => {} })
const targetClient = postgres(args.to, { max: 1, prepare: false, onnotice: () => {} })
const source = drizzle(sourceClient, { schema })
const target = drizzle(targetClient, { schema })

/** Everything the copy writes, read from the source. */
type Read = {
  posts: PostRow[]
  children: PostRow[]
  artifacts: ArtifactRow[]
  assets: AssetRow[]
  updates: UpdateRow[]
  sourceUsers: Set<string>
  migration: string | null
}

/** The newest migration a database ran, by hash, or null. */
async function lastMigration(tx: Tx): Promise<string | null> {
  const rows = await tx.execute<{ hash: string }>(
    sql`select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`,
  )
  return rows[0]?.hash ?? null
}

/** The chosen posts, checked live feed posts, and their exported Instagram versions. */
async function readPosts(tx: Tx): Promise<{ posts: PostRow[]; children: PostRow[] }> {
  if (args.posts.length === 0) return { posts: [], children: [] }
  const posts = await tx
    .select()
    .from(contentPost)
    .where(inArray(contentPost.id, args.posts))
    .limit(args.posts.length)
  const byId = new Map(posts.map((p) => [p.id, p]))
  const problems = args.posts.flatMap((id) => {
    const p = byId.get(id)
    if (!p) return [`Post ${id} is not in the source.`]
    if (p.kind !== 'feed' || p.parentId !== null) return [`Post ${id} is not a feed post.`]
    if (p.publishedApprovalId === null) return [`Post ${id} is not live.`]
    return []
  })
  if (problems.length > 0) throw new Refused(problems.join('\n'))
  const children = await tx
    .select()
    .from(contentPost)
    .where(
      and(
        inArray(contentPost.parentId, args.posts),
        eq(contentPost.kind, 'social'),
        eq(contentPost.stage, 'exported'),
        sql`${contentPost.pointers}->'social'->>'platform' = 'instagram'`,
        sql`${contentPost.pointers}->>'socialLinkId' is not null`,
      ),
    )
    .limit(CHILDREN_MAX + 1)
  if (children.length > CHILDREN_MAX) throw new Refused('Too many Instagram versions to copy.')
  // In the order asked, so the report lists them so.
  return { posts: args.posts.map((id) => byId.get(id)!), children }
}

/** The chosen live updates: all, or each named by title or id, each name matching one. */
async function readUpdates(tx: Tx): Promise<UpdateRow[]> {
  const chosen = args.updates
  if (chosen === null) return []
  const live = eq(adminUpdate.status, 'live')
  if (chosen.all) {
    const rows = await tx
      .select()
      .from(adminUpdate)
      .where(live)
      .orderBy(desc(adminUpdate.updatedAt))
      .limit(UPDATES_MAX + 1)
    if (rows.length > UPDATES_MAX) throw new Refused('Too many live updates to copy at once.')
    return rows
  }
  const rows = await tx
    .select()
    .from(adminUpdate)
    .where(
      and(
        live,
        sql`(${inArray(adminUpdate.id, chosen.names)} or ${inArray(adminUpdate.title, chosen.names)})`,
      ),
    )
    .limit(UPDATES_MAX)
  const problems = chosen.names.flatMap((name) => {
    const n = rows.filter((r) => r.id === name || r.title === name).length
    return n === 1 ? [] : [`Update "${name}" matches ${n} live updates in the source.`]
  })
  if (problems.length > 0) throw new Refused(problems.join('\n'))
  return rows
}

/** Every read, in one read-only transaction on the source. */
async function readSource(): Promise<Read> {
  return source.transaction(
    async (tx) => {
      const migration = await lastMigration(tx)
      const { posts, children } = await readPosts(tx)
      const postIds = [...posts, ...children].map((p) => p.id)
      const artifacts = postIds.length
        ? await tx
            .select()
            .from(contentArtifact)
            .where(inArray(contentArtifact.postId, postIds))
            .orderBy(contentArtifact.createdAt, contentArtifact.id)
            .limit(ARTIFACTS_MAX + 1)
        : []
      if (artifacts.length > ARTIFACTS_MAX) throw new Refused('Too many records to copy at once.')
      const updates = await readUpdates(tx)

      const candidates = new Set<string>()
      for (const a of artifacts) for (const s of assetCandidates(a.body)) candidates.add(s)
      for (const p of [...posts, ...children])
        for (const s of assetCandidates(p.pointers)) candidates.add(s)
      for (const u of updates) for (const s of assetCandidates(u.audience)) candidates.add(s)
      for (const p of [...posts, ...children])
        for (const c of POST_USERS) if (p[c]) candidates.add(p[c])
      for (const a of artifacts) if (a.createdByUserId) candidates.add(a.createdByUserId)
      for (const u of updates) for (const c of UPDATE_USERS) if (u[c]) candidates.add(u[c])
      const ids = [...candidates]

      const assets = ids.length
        ? await tx
            .select()
            .from(contentAsset)
            .where(inArray(contentAsset.id, ids))
            .limit(ids.length)
        : []
      const users = ids.length
        ? await tx.select({ id: user.id }).from(user).where(inArray(user.id, ids)).limit(ids.length)
        : []
      return {
        posts,
        children,
        artifacts,
        assets,
        updates,
        sourceUsers: new Set(users.map((u) => u.id)),
        migration,
      }
    },
    { accessMode: 'read only' },
  )
}

/** Every record's body checked against its kind's schema: a bad one stops the copy. */
function checkBodies(artifacts: readonly ArtifactRow[]): void {
  const bad = artifacts.flatMap((a) => {
    const schemaOf = BODIES[a.kind as keyof typeof BODIES]
    if (!schemaOf) return [`Record ${a.id} has an unknown kind.`]
    return schemaOf.safeParse(a.body).success ? [] : [`Record ${a.id} (${a.kind}) does not parse.`]
  })
  if (bad.length > 0) throw new Refused(bad.join('\n'))
}

/** Rows of a map, refusing any user column the copy cannot map. */
function mapRows<R extends Record<string, unknown>>(
  rows: readonly R[],
  columns: readonly (keyof R & string)[],
  map: UserMap,
  what: (row: R) => string,
): R[] {
  return rows.map((row) => {
    const mapped = mappedUserColumns(row, columns, map)
    if (!mapped.ok) throw new Refused(`${what(row)}: ${mapped.error}`)
    return mapped.row
  })
}

type Report = {
  written: Record<string, number>
  assetBytes: number
  assetsPresent: number
  skipped: string[]
  notes: string[]
}

async function writeTarget(read: Read): Promise<Report> {
  return target.transaction(async (tx) => {
    const email = args.as.toLowerCase()
    const [account] = await tx
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
        editor: user.editor,
        reviewer: user.reviewer,
        suspendedAt: user.suspendedAt,
      })
      .from(user)
      .where(eq(sql`lower(${user.email})`, email))
      .limit(1)
    if (!account) throw new Refused(`No account ${args.as} in the target.`)
    if (account.suspendedAt) throw new Refused(`${args.as} is suspended in the target.`)
    if (!canReview(account)) throw new Refused(`${args.as} may not approve posts in the target.`)

    const migration = await lastMigration(tx)
    if (migration !== read.migration)
      throw new Refused('The source and the target are not migrated to the same version.')

    // Every source user maps to the target's account; any other user id is refused.
    const map: UserMap = new Map(
      [...read.sourceUsers].map((id) => [id, { id: account.id, name: account.name }]),
    )
    const unknownStamps = [
      ...new Set(read.artifacts.flatMap((a) => stampUserIds(a.body)).filter((id) => !map.has(id))),
    ]
    if (unknownStamps.length > 0)
      throw new Refused(`${unknownStamps.length} stamped user id(s) the copy cannot map.`)

    const report: Report = { written: {}, assetBytes: 0, assetsPresent: 0, skipped: [], notes: [] }

    // Already there: skipped, with what hangs off them.
    const allPosts = [...read.posts, ...read.children]
    const blogIds = [...new Set(read.posts.flatMap((p) => (p.blogId ? [p.blogId] : [])))]
    const lookFor = [...new Set([...allPosts.map((p) => p.id), ...blogIds])]
    const there = lookFor.length
      ? await tx
          .select({ id: contentPost.id })
          .from(contentPost)
          .where(inArray(contentPost.id, lookFor))
          .limit(lookFor.length)
      : []
    const present = new Set(there.map((r) => r.id))
    const posts = read.posts.filter((p) => !present.has(p.id))
    for (const p of read.posts)
      if (present.has(p.id)) report.skipped.push(`post ${p.id} "${p.title}" (already there)`)
    const kept = new Set(posts.map((p) => p.id))
    const children = read.children.filter((c) => kept.has(c.parentId!) && !present.has(c.id))
    const writing = new Set([...posts, ...children].map((p) => p.id))
    const artifacts = read.artifacts.filter((a) => writing.has(a.postId))
    checkBodies(artifacts)

    const updateIds = read.updates.map((u) => u.id)
    const updatesThere = updateIds.length
      ? await tx
          .select({ id: adminUpdate.id })
          .from(adminUpdate)
          .where(inArray(adminUpdate.id, updateIds))
          .limit(updateIds.length)
      : []
    const updatePresent = new Set(updatesThere.map((u) => u.id))
    const updates = read.updates.filter((u) => !updatePresent.has(u.id))
    for (const u of read.updates)
      if (updatePresent.has(u.id))
        report.skipped.push(`update ${u.id} "${u.title}" (already there)`)

    // Slugs: one unique index holds them all.
    const slugs = posts.flatMap((p) => (p.slug ? [p.slug] : []))
    const taken = slugs.length
      ? await tx
          .select({ id: contentPost.id, slug: contentPost.slug })
          .from(contentPost)
          .where(inArray(contentPost.slug, slugs))
          .limit(slugs.length)
      : []
    const conflicts = slugConflicts(posts, taken)
    if (conflicts.length > 0) throw new Refused(conflicts.join('\n'))

    // A blog link the target will not have is unlinked, so the foreign key holds.
    const blogs = withPresentBlogs(posts, new Set([...present, ...writing]))
    const childBlogs = withPresentBlogs(children, new Set([...present, ...writing]))
    report.notes.push(...blogs.unlinked, ...childBlogs.unlinked)

    const postRows = mapRows(blogs.rows, POST_USERS, map, (p) => `Post ${p.id}`).map((p) => ({
      ...p,
      pointers: remapJson(p.pointers, map) as PostRow['pointers'],
    }))
    const childRows = mapRows(childBlogs.rows, POST_USERS, map, (p) => `Post ${p.id}`).map((p) => ({
      ...p,
      pointers: remapJson(p.pointers, map) as PostRow['pointers'],
    }))
    const artifactRows = mapRows(artifacts, ['createdByUserId'], map, (a) => `Record ${a.id}`).map(
      (a) => ({ ...a, body: remapJson(a.body, map) }),
    )
    const updateRows = mapRows(updates, UPDATE_USERS, map, (u) => `Update ${u.id}`).map((u) => ({
      ...u,
      audience: remapJson(u.audience, map) as UpdateRow['audience'],
    }))

    // Images the written records name; one the target has (same id, same bytes) stays as it is.
    const named = new Set(artifacts.flatMap((a) => assetCandidates(a.body)))
    for (const p of [...posts, ...children])
      for (const s of assetCandidates(p.pointers)) named.add(s)
    const wanted = read.assets.filter((a) => named.has(a.id))
    const wantedIds = wanted.map((a) => a.id)
    const assetsThere = wantedIds.length
      ? await tx
          .select({ id: contentAsset.id })
          .from(contentAsset)
          .where(inArray(contentAsset.id, wantedIds))
          .limit(wantedIds.length)
      : []
    const assetPresent = new Set(assetsThere.map((a) => a.id))
    const assetRows = wanted.filter((a) => !assetPresent.has(a.id))
    report.assetsPresent = assetPresent.size

    // Parents before their versions; records after their posts.
    for (const batch of chunks(postRows, ROW_BATCH)) await tx.insert(contentPost).values(batch)
    for (const batch of chunks(childRows, ROW_BATCH)) await tx.insert(contentPost).values(batch)
    for (const batch of chunks(artifactRows, ROW_BATCH))
      await tx.insert(contentArtifact).values(batch)
    for (const batch of chunks(assetRows, ASSET_BATCH)) await tx.insert(contentAsset).values(batch)
    for (const batch of chunks(updateRows, ROW_BATCH)) await tx.insert(adminUpdate).values(batch)

    report.written = {
      'content_post (feed)': postRows.length,
      'content_post (instagram versions)': childRows.length,
      content_artifact: artifactRows.length,
      content_asset: assetRows.length,
      admin_update: updateRows.length,
    }
    report.assetBytes = assetRows.reduce((n, a) => n + a.bytes.byteLength, 0)
    if (args.dryRun) throw Object.assign(new DryRun(), { report })
    return report
  })
}

function print(read: Read, report: Report, dry: boolean): void {
  console.log(
    `${dry ? 'DRY RUN (rolled back)' : 'Copied'}: ${maskUrl(fromUrl!)} → ${maskUrl(args.to)}`,
  )
  for (const p of read.posts) console.log(`  post ${p.id}  ${p.title}`)
  console.log(`${dry ? 'Would write' : 'Wrote'}:`)
  for (const [table, n] of Object.entries(report.written)) console.log(`  ${table}: ${n}`)
  console.log(`  asset bytes: ${report.assetBytes}`)
  console.log(`  assets already in the target: ${report.assetsPresent}`)
  for (const s of report.skipped) console.log(`Skipped ${s}`)
  for (const n of report.notes) console.log(`Note: ${n}`)
  console.log(
    'Not copied: content_step (step locks), ai_call (call log), ai_cache (model answers), content_idea_decision (Ideas queue).',
  )
}

try {
  const read = await readSource()
  try {
    print(read, await writeTarget(read), false)
  } catch (err) {
    if (!(err instanceof DryRun)) throw err
    print(read, (err as DryRun & { report: Report }).report, true)
  }
} catch (err) {
  // A failed query's own message lists its parameters (records, image bytes): the database's
  // reason, its cause, is what is shown, cut short and with every credential taken out.
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause : err
  const message = cause instanceof Error ? cause.message : String(cause)
  console.error(
    err instanceof Refused ? message : `Copy failed: ${scrub(message, urls).slice(0, MESSAGE_MAX)}`,
  )
  process.exitCode = 1
} finally {
  await Promise.all([sourceClient.end(), targetClient.end()])
}
