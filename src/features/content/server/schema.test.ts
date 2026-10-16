// The content tables and the database's own guard on them: records are written once and never
// changed, whatever code tries (migration 0003_content_artifact_immutable).
// Against the development database (Docker, port 5433);
// off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/schema.test.ts
// Every row here has an id starting `sc-` and is deleted after (records go with their post).

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { emptyPointers } from '@/features/content/model/artifacts'

const enabled = process.env.DB_TESTS === '1'
const P = 'sc-'
const POST = `${P}post`
const ARTIFACT = `${P}artifact`
const ASSET = `${P}asset`

const IMMUTABLE = { cause: { message: 'content_artifact rows are immutable' } }

// What a query failed with, or null. Drizzle's builders are thenables, not promises, and Bun's
// `.rejects` waits on a pending query without letting it settle, so the query is awaited first.
async function failureOf(query: PromiseLike<unknown>): Promise<unknown> {
  try {
    await query
    return null
  } catch (error) {
    return error
  }
}

describe.skipIf(!enabled)('the content tables against the database', () => {
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.id, `${P}%`))
    await db.delete(schema.contentAsset).where(orm.like(schema.contentAsset.id, `${P}%`))
    await db.delete(schema.comicCharacter).where(orm.like(schema.comicCharacter.brandId, `${P}%`))
  }

  const artifact = () => ({
    id: ARTIFACT,
    postId: POST,
    kind: 'source',
    body: { title: 'Schema test', kind: 'article', text: 'One.', paragraphs: [], demoKey: null },
  })

  beforeAll(async () => {
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
  })

  afterAll(async () => {
    await cleanUp()
  })

  test('a post and one record are stored', async () => {
    await db.insert(schema.contentPost).values({
      id: POST,
      kind: 'feed',
      title: 'Schema test',
      stage: 'source',
      pointers: emptyPointers(),
    })
    await db.insert(schema.contentArtifact).values(artifact())
    const rows = await db
      .select({ id: schema.contentArtifact.id, kind: schema.contentArtifact.kind })
      .from(schema.contentArtifact)
      .where(orm.eq(schema.contentArtifact.postId, POST))
    expect(rows).toEqual([{ id: ARTIFACT, kind: 'source' }])
  })

  test('the database refuses to change a record', async () => {
    expect(
      await failureOf(
        db.execute(orm.sql`update content_artifact set body = '{}' where id = ${ARTIFACT}`),
      ),
    ).toMatchObject(IMMUTABLE)
  })

  test('writing the same record again leaves one row', async () => {
    await db.insert(schema.contentArtifact).values(artifact()).onConflictDoNothing()
    const rows = await db
      .select({ id: schema.contentArtifact.id })
      .from(schema.contentArtifact)
      .where(orm.eq(schema.contentArtifact.id, ARTIFACT))
    expect(rows).toHaveLength(1)
  })

  test('a blog is stored, and a post that belongs to it loses the link when the blog is deleted', async () => {
    const BLOG = `${P}blog`
    const LINKED = `${P}linked`
    await db.insert(schema.contentPost).values([
      { id: BLOG, kind: 'blog', title: 'A guide', stage: 'source', pointers: emptyPointers() },
      {
        id: LINKED,
        kind: 'feed',
        title: 'From the guide',
        stage: 'source',
        pointers: emptyPointers(),
        blogId: BLOG,
      },
    ])
    const blogOf = async () =>
      (
        await db
          .select({ blogId: schema.contentPost.blogId })
          .from(schema.contentPost)
          .where(orm.eq(schema.contentPost.id, LINKED))
      )[0]?.blogId
    expect(await blogOf()).toBe(BLOG)
    await db.delete(schema.contentPost).where(orm.eq(schema.contentPost.id, BLOG))
    expect(await blogOf()).toBeNull()
  })

  test('a comic keeps the path it tells, and every other post has none (RC2)', async () => {
    const COMIC = `${P}comic`
    await db.insert(schema.contentPost).values({
      id: COMIC,
      kind: 'feed',
      title: 'A year in Hobart',
      stage: 'source',
      pointers: emptyPointers(),
      courseId: 'utas-bachelor-of-nursing',
    })
    const rows = await db
      .select({ id: schema.contentPost.id, courseId: schema.contentPost.courseId })
      .from(schema.contentPost)
      .where(orm.inArray(schema.contentPost.id, [COMIC, POST]))
      .orderBy(schema.contentPost.id)
    expect(rows).toEqual([
      { id: COMIC, courseId: 'utas-bachelor-of-nursing' },
      { id: POST, courseId: null },
    ])
  })

  test('the comic character is stored per page brand, and its approver must be a user (RC9)', async () => {
    const BRAND = `${P}comics`
    const views = [
      { label: 'Front', scene: 'Standing, facing us, a backpack on one shoulder.' },
      { label: 'Smiling', scene: 'A wide smile, head tilted.' },
    ]
    await db.insert(schema.comicCharacter).values({
      brandId: BRAND,
      description: 'A student of about 22, gender-neutral, short dark hair.',
      views,
      updatedBy: `${P}editor`,
      updatedAt: new Date(),
    })
    const [row] = await db
      .select()
      .from(schema.comicCharacter)
      .where(orm.eq(schema.comicCharacter.brandId, BRAND))
    expect(row).toMatchObject({
      views,
      sheetAssetId: null,
      approvedAssetId: null,
      approvedBy: null,
    })
    expect(
      await failureOf(
        db
          .update(schema.comicCharacter)
          .set({ approvedBy: `${P}nobody`, approvedAt: new Date() })
          .where(orm.eq(schema.comicCharacter.brandId, BRAND)),
      ),
    ).toMatchObject({ cause: { constraint_name: 'comic_character_approved_by_user_id_fk' } })
  })

  test('an image is stored as bytes and cannot be changed either', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])
    await db.insert(schema.contentAsset).values({ id: ASSET, mime: 'image/png', bytes })
    const [row] = await db
      .select({ bytes: schema.contentAsset.bytes })
      .from(schema.contentAsset)
      .where(orm.eq(schema.contentAsset.id, ASSET))
    expect(row?.bytes).toEqual(bytes)
    expect(
      await failureOf(
        db
          .update(schema.contentAsset)
          .set({ mime: 'image/jpeg' })
          .where(orm.eq(schema.contentAsset.id, ASSET)),
      ),
    ).toMatchObject(IMMUTABLE)
  })
})
