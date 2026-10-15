// Draft and layout previews against the development database (Docker, port 5433); off by default:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/preview.test.ts
// The model layer is the fake provider. Every account here has an id starting `pv-` and is deleted
// after, with the posts it made.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '100000'
process.env.AI_DAILY_CAP_IMAGE = '100000'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'pv-'
const SLOW = 60_000
const ED = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'PV ed' }
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe.skipIf(!enabled)('the previews against the database', () => {
  let commands: typeof import('./commands')
  let store: typeof import('./store')
  let preview: typeof import('./preview')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  const posts: string[] = []

  function ok<T extends { ok: boolean }>(res: T): Extract<T, { ok: true }> {
    if (!res.ok) throw new Error((res as unknown as { error: string }).error)
    return res as Extract<T, { ok: true }>
  }

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.createdByUserId, `${P}%`))
    if (posts.length > 0) {
      await db.delete(schema.aiCall).where(orm.inArray(schema.aiCall.postId, posts))
    }
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  /** A post with the-line drafted, picked and themed. */
  async function drafted() {
    const { DEMO_SOURCES } = await import('../demo-sources')
    const demo = DEMO_SOURCES.find((s) => s.key === 'paid-work')
    if (!demo) throw new Error('demo source missing')
    const requestId = randomUUID()
    posts.push(requestId)
    let { version } = ok(
      await commands.startFeedPost(ED, {
        requestId,
        title: demo.title,
        kind: demo.kind,
        text: demo.text,
      }),
    )
    ;({ version } = ok(await commands.tickTemplates(ED, requestId, version, ['the-line'])))
    ;({ version } = ok(await commands.draftPost(ED, requestId, version, false)))
    ;({ version } = ok(await commands.pickStructure(ED, requestId, version, 0)))
    ;({ version } = ok(await commands.chooseTheme(ED, requestId, version, 'paper')))
    return { id: requestId, version }
  }

  beforeAll(async () => {
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    commands = await import('./commands')
    store = await import('./store')
    preview = await import('./preview')
    // after() throws outside a request: run the commands' background work at once.
    ;(await import('./after')).scheduleWith((task) => {
      void task()
    })
    await cleanUp()
    await db.insert(schema.user).values({
      id: ED.id,
      name: ED.name,
      email: `${ED.id}@pv.e2e.test`,
      role: 'user',
      editor: true,
      reviewer: false,
    })
  })

  afterAll(cleanUp)

  test(
    'a draft slide is a PNG, and after approval the layout preview is the same bytes',
    async () => {
      const { id, version } = await drafted()
      const draftsId = (await store.loadPost(id))?.pointers.draftsId
      if (!draftsId) throw new Error('no drafts')

      const draft = await preview.draftPreviewPng({
        postId: id,
        draftsId,
        index: 0,
        slide: 1,
        themeId: 'paper',
      })
      expect(Array.from(draft?.slice(0, 8) ?? [])).toEqual(PNG)

      ok(await commands.approveStructure(ED, id, version))
      const layoutId = (await store.loadPost(id))?.pointers.layoutId
      if (!layoutId) throw new Error('no layout')
      const approved = await preview.layoutPreviewPng({ postId: id, layoutId, slide: 1 })
      expect(approved).not.toBeNull()
      expect(Buffer.from(approved ?? []).equals(Buffer.from(draft ?? []))).toBe(true)
    },
    SLOW,
  )

  test(
    'a planned scene is drawn in the slide’s empty art box, in the draft and the layout preview',
    async () => {
      const { id, version } = await drafted()
      const draftsId = (await store.loadPost(id))?.pointers.draftsId
      if (!draftsId) throw new Error('no drafts')
      const scene = 'Two students share a bench outside the library at dusk.'
      const input = { postId: id, draftsId, index: 0, themeId: 'paper' }
      const same = (a: Uint8Array | null, b: Uint8Array | null) =>
        Buffer.from(a ?? []).equals(Buffer.from(b ?? []))

      const plain = await preview.draftPreviewPng({ ...input, slide: 1 })
      const planned = await preview.draftPreviewPng({ ...input, slide: 1, planned: [scene, null] })
      expect(planned).not.toBeNull()
      expect(same(planned, plain)).toBe(false)
      // The body slide has no art box: a scene for another slide leaves it as it was.
      const body = await preview.draftPreviewPng({ ...input, slide: 2, planned: [scene, null] })
      expect(same(body, await preview.draftPreviewPng({ ...input, slide: 2 }))).toBe(true)

      ok(await commands.approveStructure(ED, id, version))
      const layoutId = (await store.loadPost(id))?.pointers.layoutId
      if (!layoutId) throw new Error('no layout')
      const approved = await preview.layoutPreviewPng({
        postId: id,
        layoutId,
        slide: 1,
        planned: [scene],
      })
      expect(same(approved, planned)).toBe(true)
    },
    SLOW,
  )

  test(
    'ids of another post, or out of range, give null',
    async () => {
      const a = await drafted()
      const b = await drafted()
      const draftsA = (await store.loadPost(a.id))?.pointers.draftsId
      if (!draftsA) throw new Error('no drafts')
      const input = { postId: b.id, draftsId: draftsA, index: 0, slide: 1, themeId: 'paper' }
      expect(await preview.draftPreviewPng(input)).toBeNull()
      expect(await preview.draftPreviewPng({ ...input, postId: a.id, index: 9 })).toBeNull()
      expect(await preview.draftPreviewPng({ ...input, postId: a.id, slide: 99 })).toBeNull()
      expect(await preview.draftPreviewPng({ ...input, postId: a.id, themeId: 'nope' })).toBeNull()
      const layoutA = { postId: b.id, layoutId: 'missing', slide: 1 }
      expect(await preview.layoutPreviewPng(layoutA)).toBeNull()
    },
    SLOW,
  )

  test(
    'draftFitChecks gives one list of checks per draft',
    async () => {
      const { id } = await drafted()
      const { drafts, facts, source } = (await store.loadPost(id))?.current ?? {}
      if (!drafts || !facts || !source) throw new Error('post incomplete')
      const checks = preview.draftFitChecks(
        drafts.body,
        'paper',
        facts.body.facts,
        source.body.title,
      )
      expect(checks).toHaveLength(drafts.body.items.length)
      expect(checks[0]?.length).toBeGreaterThan(0)
    },
    SLOW,
  )
})
