// The post store and the step lock against the development database (Docker, port 5433);
// off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/store.test.ts
// Every post and user here has an id starting `st-` and is deleted after (records and steps go
// with their post); the test's one asset is deleted by its id.

import { afterAll, beforeAll, describe, expect, mock, spyOn, test } from 'bun:test'
import { FEED_BRAND, PAGE_BRANDS } from '../brands'
import { type ArtifactKind, type Body, emptyPointers, type Pointers } from '../model/artifacts'
import type { Stage } from '../model/stages'
import type { FeedSettings, LaidSlide } from '../model/types'
import { TEMPLATES } from '../templates'
import { artifactId, assetId } from './hash'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'st-'
const ED = `${P}ed`
const ASSET_BYTES = new Uint8Array([137, 80, 78, 71, 115, 116, 45, 116, 101, 115, 116])

// What a promise failed with, or null. Drizzle's builders are thenables, and Bun's `.rejects`
// can wait on a pending query without letting it settle, so the call is awaited first.
async function failureOf(work: PromiseLike<unknown>): Promise<unknown> {
  try {
    await work
    return null
  } catch (error) {
    return error
  }
}

const stamp = { userId: ED, name: 'ST ed', at: '2026-10-05T10:00:00.000Z' }

const sourceBody = (title = 'Store test'): Body<'source'> => ({
  title,
  kind: 'article',
  text: 'One.',
  paragraphs: [{ ref: '¶1', text: 'One.' }],
  demoKey: null,
  language: 'en',
})

const revisionBody = (factsId: string, note: string): Body<'revision'> => ({
  factsId,
  emotion: null,
  structure: { templateId: TEMPLATES[0]?.id ?? '', slides: [], artPrompt: 'A quiet desk.' },
  template: TEMPLATES[0] as Body<'revision'>['template'],
  brand: FEED_BRAND,
  themeId: 'paper',
  by: stamp,
  note,
})

const GENERAL: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
}

/** One laid slide with one line and a source line, as the layout engine writes them. */
const laidSlide = (text: string, searchLine: string | null = null): LaidSlide => ({
  kind: 'cover',
  lines: [
    { slot: 'headline', text, x: 0, y: 0, fontPx: 48, font: 'heading', mark: 'none', width: 1 },
  ],
  artBox: null,
  sourceLine: 'Source: Store test',
  searchLine,
})

const slot = (text: string) => ({ text, factIds: [], factual: false })

describe.skipIf(!enabled)('the post store and step lock against the database', () => {
  let store: typeof import('./store')
  let steps: typeof import('./steps')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.id, `${P}%`))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
    await db.delete(schema.contentAsset).where(orm.eq(schema.contentAsset.id, assetId(ASSET_BYTES)))
  }

  async function newPost(id: string, pointers: Pointers = emptyPointers(), title = 'Store test') {
    await db.transaction((tx) =>
      store.insertPost(tx, {
        id,
        kind: 'feed',
        parentId: null,
        title,
        stage: 'source',
        pointers,
        actorId: ED,
      }),
    )
  }

  beforeAll(async () => {
    store = await import('./store')
    steps = await import('./steps')
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
    await db.insert(schema.user).values([
      { id: ED, name: 'ST ed', email: 'st-ed@example.test' },
      { id: `${P}rev`, name: 'ST rev', email: 'st-rev@example.test' },
    ])
  })

  afterAll(cleanUp)

  test('the same record written twice, keys in another order, is one id and one row', async () => {
    const post = `${P}twice`
    await newPost(post)
    const body = sourceBody()
    const reordered = {
      demoKey: null,
      language: 'en' as const,
      paragraphs: [{ text: 'One.', ref: '¶1' }],
      text: 'One.',
      kind: 'article',
      title: 'Store test',
    }
    const [a, b] = await db.transaction(async (tx) => [
      await store.putArtifact(tx, { kind: 'source', postId: post, body, actorId: ED }),
      await store.putArtifact(tx, { kind: 'source', postId: post, body: reordered, actorId: ED }),
    ])
    expect(a).toBe(b as string)
    const rows = await db
      .select({ id: schema.contentArtifact.id })
      .from(schema.contentArtifact)
      .where(orm.eq(schema.contentArtifact.postId, post))
    expect(rows).toEqual([{ id: a as string }])
  })

  test('a body that fails its schema throws before anything is written', async () => {
    const post = `${P}invalid`
    await newPost(post)
    const bad = { ...sourceBody(), title: '' }
    const error = await failureOf(
      db.transaction((tx) =>
        store.putArtifact(tx, { kind: 'source', postId: post, body: bad, actorId: ED }),
      ),
    )
    expect(error).not.toBeNull()
    const rows = await db
      .select({ id: schema.contentArtifact.id })
      .from(schema.contentArtifact)
      .where(orm.eq(schema.contentArtifact.postId, post))
    expect(rows).toEqual([])
  })

  test('an image is stored once by its bytes and read back; an unknown one is null', async () => {
    const first = await store.putAsset(null, ASSET_BYTES, 'image/png')
    const second = await db.transaction((tx) => store.putAsset(tx, ASSET_BYTES, 'image/png'))
    expect(first).toBe(assetId(ASSET_BYTES))
    expect(second).toBe(first)
    expect(await store.getAsset(first)).toEqual({ mime: 'image/png', bytes: ASSET_BYTES })
    expect(await store.getAsset(`${P}missing`)).toBeNull()
  })

  test('a save from a stale version is refused with who changed it (21)', async () => {
    const post = `${P}versions`
    await newPost(post)
    const moved = { ...emptyPointers(), ticked: ['the-line'] }
    const first = await db.transaction((tx) =>
      store.savePointers(tx, post, 1, { stage: 'structures', pointers: moved }, ED),
    )
    expect(first).toEqual({ ok: true, version: 2 })

    const second = await db.transaction((tx) =>
      store.savePointers(tx, post, 1, { stage: 'source', pointers: emptyPointers() }, `${P}rev`),
    )
    expect(second).toEqual({ ok: false, error: 'Changed by ST ed just now' })

    const loaded = await store.loadPost(post)
    expect(loaded?.version).toBe(2)
    expect(loaded?.stage).toBe('structures')
    expect(loaded?.pointers.ticked).toEqual(['the-line'])
    expect(loaded?.updatedByName).toBe('ST ed')
  })

  test('an automatic source check lands only while the text it read is current, keeping the version (98)', async () => {
    const id = `${P}source-check-pointer`
    await newPost(id, { ...emptyPointers(), draftsId: 'drafts-a', picked: 1 })
    const draft = (draftsId: string, index: number) => ({
      revisionId: null,
      draft: { draftsId, index },
    })
    expect(await store.setSourceCheckPointer(id, 'check-a', draft('drafts-b', 1))).toBeNull()
    expect(await store.setSourceCheckPointer(id, 'check-a', draft('drafts-a', 0))).toBeNull()
    expect(
      await store.setSourceCheckPointer(id, 'check-a', { revisionId: 'revision-a' }),
    ).toBeNull()
    expect(await store.setSourceCheckPointer(id, 'check-a', draft('drafts-a', 1))).toBe(1)
    expect((await store.loadPost(id))?.pointers.sourceCheckId).toBe('check-a')

    // Once approved, a check of the draft no longer lands; one of the revision does.
    await db
      .update(schema.contentPost)
      .set({
        pointers: { ...emptyPointers(), draftsId: 'drafts-a', picked: 1, revisionId: 'revision-a' },
      })
      .where(orm.eq(schema.contentPost.id, id))
    expect(await store.setSourceCheckPointer(id, 'check-b', draft('drafts-a', 1))).toBeNull()
    expect(await store.setSourceCheckPointer(id, 'check-c', { revisionId: 'revision-a' })).toBe(1)
    expect((await store.loadPost(id))?.pointers.sourceCheckId).toBe('check-c')
  })

  test('a save that leaves the source check as it read it keeps one that landed meanwhile (98)', async () => {
    const id = `${P}keep-source-check`
    const read: Pointers = { ...emptyPointers(), draftsId: 'drafts-a', picked: 0 }
    await newPost(id, read)
    // The check lands after the command read the post, and before it saves.
    await store.setSourceCheckPointer(id, 'check-a', {
      revisionId: null,
      draft: { draftsId: 'drafts-a', index: 0 },
    })
    await db.transaction((tx) =>
      store.savePointers(
        tx,
        id,
        1,
        { stage: 'structures', pointers: { ...read, themeId: 'paper' } },
        ED,
        {
          keepSourceCheck: true,
        },
      ),
    )
    expect((await store.loadPost(id))?.pointers).toMatchObject({
      sourceCheckId: 'check-a',
      themeId: 'paper',
    })
    // A save that sets the pointer itself takes its own.
    await db.transaction((tx) =>
      store.savePointers(
        tx,
        id,
        2,
        { stage: 'structures', pointers: { ...read, sourceCheckId: 'check-b' } },
        ED,
      ),
    )
    expect((await store.loadPost(id))?.pointers.sourceCheckId).toBe('check-b')
  })

  test('loadPost drops a source check that names another revision', async () => {
    const post = `${P}load`
    await newPost(post)
    const ids = await db.transaction(async (tx) => {
      const put = <K extends Parameters<typeof store.putArtifact>[1]['kind']>(
        kind: K,
        body: Body<K>,
      ) => store.putArtifact(tx, { kind, postId: post, body, actorId: ED })
      const sourceId = await put('source', sourceBody())
      const factsId = await put('facts', { sourceId, keyIdeas: [], facts: [], replays: [] })
      const oldRevisionId = await put('revision', revisionBody(factsId, 'approved'))
      const revisionId = await put('revision', revisionBody(factsId, 'light edit: phrase'))
      const staleCheckId = await put('source_check', {
        revisionId: oldRevisionId,
        claims: [],
        replays: [],
      })
      return { sourceId, factsId, revisionId, staleCheckId }
    })
    const pointers: Pointers = {
      ...emptyPointers(),
      sourceId: ids.sourceId,
      factsId: ids.factsId,
      revisionId: ids.revisionId,
      sourceCheckId: ids.staleCheckId,
    }
    await db.transaction((tx) =>
      store.savePointers(tx, post, 1, { stage: 'approved', pointers }, ED),
    )

    const loaded = await store.loadPost(post)
    expect(loaded?.current.revision?.id).toBe(ids.revisionId)
    expect(loaded?.records.has(ids.staleCheckId)).toBe(true)
    expect(loaded?.current.sourceCheck).toBeNull()
    expect(await store.loadPost(`${P}missing`)).toBeNull()
  })

  test("a blog's outline and its text load through loadPost (BR2, BR3)", async () => {
    const post = `${P}blog-records`
    await db.transaction((tx) =>
      store.insertPost(tx, {
        id: post,
        kind: 'blog',
        parentId: null,
        title: 'A guide',
        stage: 'source',
        pointers: emptyPointers(),
        actorId: ED,
      }),
    )
    const ids = await db.transaction(async (tx) => {
      const put = <K extends Parameters<typeof store.putArtifact>[1]['kind']>(
        kind: K,
        body: Body<K>,
      ) => store.putArtifact(tx, { kind, postId: post, body, actorId: ED })
      const sourceId = await put('source', sourceBody())
      const factsId = await put('facts', { sourceId, keyIdeas: [], facts: [], replays: [] })
      const blogOutlineId = await put('blog_outline', {
        factsId,
        idea: null,
        sections: [{ heading: 'Who can work?', point: 'Students on a visa can.' }],
        takeaways: ['One.', 'Two.', 'Three.'],
        faq: ['A?', 'B?', 'C?'].map((q) => ({ q, point: 'Because.' })),
        note: 'Outlined',
      })
      const blogTextId = await put('blog_text', {
        outlineId: blogOutlineId,
        sections: [{ heading: 'Who can work?', body: 'Students can.', factIds: [] }],
        takeaways: ['One.', 'Two.', 'Three.'],
        faq: ['A?', 'B?', 'C?'].map((q) => ({ q, a: 'Because.', factIds: [] })),
        emotion: null,
        note: null,
      })
      return { sourceId, factsId, blogOutlineId, blogTextId }
    })
    await db.transaction((tx) =>
      store.savePointers(
        tx,
        post,
        1,
        { stage: 'structures', pointers: { ...emptyPointers(), ...ids } },
        ED,
      ),
    )

    const loaded = await store.loadPost(post)
    expect(loaded?.kind).toBe('blog')
    expect(loaded?.current.blogOutline?.id).toBe(ids.blogOutlineId)
    expect(loaded?.current.blogText?.id).toBe(ids.blogTextId)
  })

  test('a second run of a step in flight is refused; a stale lock is taken', async () => {
    const post = `${P}lock`
    await newPost(post)
    let started: () => void = () => {}
    let finish: () => void = () => {}
    const isRunning = new Promise<void>((resolve) => {
      started = resolve
    })
    const release = new Promise<void>((resolve) => {
      finish = resolve
    })

    const first = steps.runStep(post, 'extract', 1, async () => {
      started()
      await release
      return { ok: true, n: 1 }
    })
    await isRunning
    expect(await steps.runningSteps(post)).toEqual(['extract'])
    const second = await steps.runStep(post, 'extract', 1, async () => ({ ok: true, n: 2 }))
    expect(second).toEqual({ ok: false, error: 'Already running. Wait for it to finish.' })
    finish()
    expect(await first).toEqual({ ok: true, n: 1 })
    expect(await steps.runningSteps(post)).toEqual([])

    // A lock left running by a crash, older than the timeout, is taken.
    await db
      .update(schema.contentStep)
      .set({
        status: 'running',
        startedAt: new Date(Date.now() - steps.STEP_TIMEOUT_MS - 60_000),
      })
      .where(orm.eq(schema.contentStep.postId, post))
    const third = await steps.runStep(post, 'extract', 1, async () => ({ ok: true, n: 3 }))
    expect(third).toEqual({ ok: true, n: 3 })
  })

  test('a run records how far it is; a run that beats keeps its lock past the timeout; a run whose lock was taken is told so', async () => {
    const post = `${P}progress`
    await newPost(post)
    let progress: (done: number, total: number) => Promise<boolean> = async () => false
    let started: () => void = () => {}
    let finish: () => void = () => {}
    const isRunning = new Promise<void>((resolve) => {
      started = resolve
    })
    const release = new Promise<void>((resolve) => {
      finish = resolve
    })
    const first = steps.runStep(post, 'images', 1, async (run) => {
      progress = (done, total) => run.progress(done, total)
      started()
      await release
      return { ok: true, n: 1 }
    })
    await isRunning
    expect(await steps.runningNow(post)).toEqual({ running: ['images'], progress: {} })
    expect(await progress(1, 4)).toBe(true)
    expect(await steps.runningNow(post)).toEqual({
      running: ['images'],
      progress: { images: { done: 1, total: 4 } },
    })

    // Started longer ago than the timeout, but beating since: still running, and its lock holds.
    const long = new Date(Date.now() - steps.STEP_TIMEOUT_MS - 60_000)
    await db
      .update(schema.contentStep)
      .set({ startedAt: long })
      .where(orm.eq(schema.contentStep.postId, post))
    expect((await steps.runningNow(post)).running).toEqual(['images'])
    expect(await steps.runStep(post, 'images', 1, async () => ({ ok: true, n: 2 }))).toEqual({
      ok: false,
      error: 'Already running. Wait for it to finish.',
    })

    // No beat for longer than the timeout, as after a crash: the lock is free, and a new run that
    // takes it starts with no progress. The first run is told it no longer holds the lock.
    await db
      .update(schema.contentStep)
      .set({ beatAt: long })
      .where(orm.eq(schema.contentStep.postId, post))
    expect(await steps.runningNow(post)).toEqual({ running: [], progress: {} })
    let third: Promise<unknown> = Promise.resolve()
    let taken: () => void = () => {}
    const tookOver = new Promise<void>((resolve) => {
      taken = resolve
    })
    third = steps.runStep(post, 'images', 1, async () => {
      taken()
      await release
      return { ok: true, n: 3 }
    })
    await tookOver
    expect(await steps.runningNow(post)).toEqual({ running: ['images'], progress: {} })
    expect(await progress(2, 4)).toBe(false)
    finish()
    await Promise.all([first, third])
  })

  test('a busy model said inside a run reaches its progress; a run finished on Flash-Lite says so after it ends', async () => {
    const { callNotes, noteLite } = await import('../ai/wait-notes')
    const post = `${P}notes`
    await newPost(post)
    const busy = { kind: 'busy', model: 'flash-model', attempt: 2, waitS: 8 } as const
    // Outside a run a note goes nowhere.
    callNotes()(busy)
    const seen: Awaited<ReturnType<typeof steps.runningNow>>[] = []
    const result = await steps.runStep(post, 'blog_text', 1, async (run) => {
      await run.progress(0, 5)
      const noteWait = callNotes()
      noteWait(busy)
      await run.progress(0, 5)
      seen.push(await steps.runningNow(post))
      noteWait({ kind: 'fallback', model: 'lite-model' })
      noteWait(null)
      noteLite('lite-model')
      await run.progress(5, 5)
      seen.push(await steps.runningNow(post))
      return { ok: true, n: 1 }
    })
    expect(result).toEqual({ ok: true, n: 1 })
    expect(seen).toEqual([
      { running: ['blog_text'], progress: { blog_text: { done: 0, total: 5, note: busy } } },
      { running: ['blog_text'], progress: { blog_text: { done: 5, total: 5 } } },
    ])
    expect((await steps.failedNow(post)).lite).toEqual(['blog_text'])

    // Run again on Flash, the fact is gone; a run that never fell back says nothing.
    await steps.runStep(post, 'blog_text', 1, async () => ({ ok: true, n: 2 }))
    expect(await steps.failedNow(post)).toEqual({ failed: [], reasons: {}, lite: [] })
  })

  test('a step whose work throws is marked failed and returns the save error', async () => {
    const post = `${P}throws`
    await newPost(post)
    const result = await steps.runStep(post, 'draft', 1, async () => {
      throw new Error('boom')
    })
    expect(result).toEqual({ ok: false, error: 'Could not save. Please try again.' })
    const [row] = await db
      .select({ status: schema.contentStep.status })
      .from(schema.contentStep)
      .where(orm.eq(schema.contentStep.postId, post))
    expect(row?.status).toBe('failed')
  })

  /** The stages a published post can be at. */
  const LIVE: readonly Stage[] = ['live', 'exported']

  /**
   * A feed post whose records are written by hand and whose pointers are moved to `stage`, with
   * an approval that pins its render, settings and (when given) its Nepal version, as
   * approveAndPublish does; at a live stage that approval is the one students see. The
   * structure's body slot is the excerpt; the render's one slide is the PNG named.
   */
  async function published(
    id: string,
    stage: Stage,
    png: string,
    nepalPng: string | null = null,
    settings: Body<'settings'> = GENERAL,
    {
      title = 'Store test',
      searchLine = null,
      approvedAt = stamp.at,
      builtOn = null,
      source = sourceBody(),
    }: {
      title?: string
      searchLine?: string | null
      approvedAt?: string
      /** The source the published facts name: the post's own, unless another's is given. */
      builtOn?: string | null
      /** The post's own source record. */
      source?: Body<'source'>
    } = {},
  ): Promise<{ pointers: Pointers; version: number; renderId: string; revisionId: string }> {
    await newPost(id, emptyPointers(), title)
    const pointers = await db.transaction(async (tx) => {
      const put = <K extends Parameters<typeof store.putArtifact>[1]['kind']>(
        kind: K,
        body: Body<K>,
      ) => store.putArtifact(tx, { kind, postId: id, body, actorId: ED })
      const sourceId = await put('source', source)
      const factsId = await put('facts', {
        sourceId: builtOn ?? sourceId,
        keyIdeas: [],
        facts: [],
        replays: [],
      })
      const revision = revisionBody(factsId, 'approved')
      const revisionId = await put('revision', {
        ...revision,
        structure: {
          ...revision.structure,
          slides: [
            { kind: 'cover', slots: { headline: slot('Headline') } },
            { kind: 'body', slots: { body: slot('The excerpt.') } },
          ],
        },
      })
      const layoutId = await put('layout', {
        revisionId,
        slides: [laidSlide('Headline', searchLine)],
        fits: [],
        fitChecks: [],
      })
      const renderId = await put('render', {
        revisionId,
        layoutId,
        art: { assetId: null, prompt: 'A quiet desk.', version: 1, fallback: 'no_art' },
        slides: [{ svgAssetId: `${png}-svg`, pngAssetId: png }],
      })
      const sourceCheckId = await put('source_check', { revisionId, claims: [], replays: [] })
      const settingsId = await put('settings', settings)
      const marketId = nepalPng
        ? await put('market', {
            revisionId,
            renderId,
            market: 'NP',
            slots: [],
            feedExcerpt: 'The Nepal excerpt.',
            conversions: [],
            layout: [laidSlide('NPR headline')],
            fitChecks: [],
            slides: [{ svgAssetId: `${nepalPng}-svg`, pngAssetId: nepalPng }],
            replays: [],
          })
        : null
      const approvalId = await put('approval', {
        revisionId,
        renderId,
        sourceCheckId,
        settingsId,
        visionId: null,
        overrideId: null,
        marketId,
        by: { ...stamp, at: approvedAt },
        selfReviewed: false,
      })
      return {
        ...emptyPointers(),
        sourceId,
        factsId,
        revisionId,
        layoutId,
        renderId,
        sourceCheckId,
        settingsId,
        marketId,
        approvalId,
      }
    })
    const saved = await db.transaction(async (tx) => {
      if (LIVE.includes(stage)) await store.publishApproval(tx, id, pointers.approvalId as string)
      return store.savePointers(tx, id, 1, { stage, pointers }, ED)
    })
    if (!saved.ok) throw new Error(saved.error)
    return {
      pointers,
      version: saved.version,
      renderId: pointers.renderId as string,
      revisionId: pointers.revisionId as string,
    }
  }

  test('listLive reads a live feed post as its approval pinned it, with its tags and source; a post in review and a social version stay out (71, 81)', async () => {
    const live = `${P}live`
    const tagged: Body<'settings'> = { ...GENERAL, tags: ['destination:AU', 'theme:books-movies'] }
    const { pointers } = await published(live, 'live', `${P}png-live`, null, tagged)
    await published(`${P}in-review`, 'in_review', `${P}png-review`)
    await db.transaction((tx) =>
      store.insertPost(tx, {
        id: `${P}social`,
        kind: 'social',
        parentId: live,
        title: 'Store test · Instagram',
        stage: 'exported',
        pointers,
        actorId: ED,
      }),
    )

    const posts = await store.listLive()
    const ids = posts.map((p) => p.id)
    expect(ids).toContain(live)
    expect(ids).not.toContain(`${P}in-review`)
    expect(ids).not.toContain(`${P}social`)
    expect(posts.find((p) => p.id === live)).toEqual({
      id: live,
      title: 'Store test',
      approvedAt: stamp.at,
      settings: tagged,
      sourceLine: 'Source: Store test',
      sourceId: pointers.sourceId,
      courseId: null,
      tags: ['destination:AU', 'theme:books-movies'],
      main: {
        excerpt: 'The excerpt.',
        slides: [{ pngAssetId: `${P}png-live`, alt: 'Slide 1: Headline Source: Store test' }],
      },
      market: null,
      instagram: null,
      sharedTo: [],
      sources: [{ site: null, title: 'Store test', url: null }],
      // Linked to no blog: no "Read the full guide" (BR7).
      guide: null,
      language: 'en',
    })
    expect(pointers.sourceId).not.toBeNull()
  })

  test("a live post carries its source's language, so its page writes its lines in it (GD39)", async () => {
    const id = `${P}thai`
    await published(id, 'live', `${P}png-thai`, null, GENERAL, {
      source: { ...sourceBody(), language: 'th' },
    })
    expect((await store.liveById(id))?.language).toBe('th')
  })

  test('listLive carries the market version a fresh approval pins, keyed by its market (76, 82)', async () => {
    const id = `${P}nepal`
    const { pointers, version, renderId, revisionId } = await published(
      id,
      'live',
      `${P}png-np-main`,
    )
    const marketId = await db.transaction(async (tx) => {
      const marketId = await store.putArtifact(tx, {
        kind: 'market',
        postId: id,
        actorId: ED,
        body: {
          revisionId,
          renderId,
          market: 'NP',
          slots: [],
          feedExcerpt: 'The Nepal excerpt.',
          conversions: [],
          layout: [laidSlide('NPR headline')],
          fitChecks: [],
          slides: [{ svgAssetId: `${P}png-np-svg`, pngAssetId: `${P}png-np` }],
          replays: [],
        },
      })
      const approvalId = await store.putArtifact(tx, {
        kind: 'approval',
        postId: id,
        actorId: ED,
        body: {
          revisionId,
          renderId,
          sourceCheckId: pointers.sourceCheckId as string,
          settingsId: pointers.settingsId as string,
          visionId: null,
          overrideId: null,
          marketId,
          by: { ...stamp, at: '2026-10-06T10:00:00.000Z' },
          selfReviewed: false,
        },
      })
      await store.publishApproval(tx, id, approvalId)
      const saved = await store.savePointers(
        tx,
        id,
        version,
        { stage: 'live', pointers: { ...pointers, marketId, approvalId } },
        ED,
      )
      if (!saved.ok) throw new Error(saved.error)
      return marketId
    })
    expect(marketId).not.toBe('')

    const post = (await store.listLive()).find((p) => p.id === id)
    expect(post?.approvedAt).toBe('2026-10-06T10:00:00.000Z')
    expect(post?.main.slides.map((s) => s.pngAssetId)).toEqual([`${P}png-np-main`])
    expect(post?.market).toEqual({
      id: 'NP',
      version: {
        excerpt: 'The Nepal excerpt.',
        slides: [{ pngAssetId: `${P}png-np`, alt: 'Slide 1: NPR headline Source: Store test' }],
      },
    })
  })

  test('listLive carries the newest recorded Instagram link of a post’s exported Instagram version, with its page’s handle, and null without one (90)', async () => {
    const parent = `${P}insta`
    const { pointers } = await published(parent, 'live', `${P}png-insta`)
    const found = PAGE_BRANDS.find((b) => b.id === 'cerebral')
    if (!found) throw new Error('no cerebral brand')
    const cerebral = found

    /** An exported social child of the live post, with a recorded link when `url` is given. */
    async function child(id: string, platform: 'instagram' | 'linkedin', url: string | null) {
      await db.transaction(async (tx) => {
        // The post first: its records name it.
        await store.insertPost(tx, {
          id,
          kind: 'social',
          parentId: parent,
          title: `Store test · ${platform}`,
          stage: 'structures',
          pointers: { ...emptyPointers(), social: { brandId: 'cerebral', platform } },
          actorId: ED,
        })
        const revisionId = await store.putArtifact(tx, {
          kind: 'revision',
          postId: id,
          actorId: ED,
          body: { ...revisionBody(pointers.factsId as string, `social: ${id}`), brand: cerebral },
        })
        const socialLinkId = url
          ? await store.putArtifact(tx, {
              kind: 'social_link',
              postId: id,
              actorId: ED,
              body: { exportId: `export_${id}`, platform: 'instagram', url, by: stamp },
            })
          : null
        const saved = await store.savePointers(
          tx,
          id,
          1,
          {
            stage: 'exported',
            pointers: {
              ...pointers,
              revisionId,
              socialLinkId,
              social: { brandId: 'cerebral', platform },
            },
          },
          ED,
        )
        if (!saved.ok) throw new Error(saved.error)
      })
    }

    expect((await store.listLive()).find((p) => p.id === parent)?.instagram).toBeNull()
    await child(`${P}insta-unlinked`, 'instagram', null)
    expect((await store.listLive()).find((p) => p.id === parent)?.instagram).toBeNull()

    await child(`${P}insta-first`, 'instagram', 'https://www.instagram.com/p/st-first/')
    await child(`${P}insta-linkedin`, 'linkedin', 'https://www.instagram.com/p/st-wrong/')
    expect((await store.listLive()).find((p) => p.id === parent)?.instagram).toEqual({
      url: 'https://www.instagram.com/p/st-first/',
      handle: 'ofcourse_philosophy',
      pageUrl: 'https://www.instagram.com/ofcourse_philosophy/',
    })

    await child(`${P}insta-second`, 'instagram', 'https://www.instagram.com/p/st-second/')
    expect((await store.listLive()).find((p) => p.id === parent)?.instagram?.url).toBe(
      'https://www.instagram.com/p/st-second/',
    )
    // The children themselves stay out of the feed.
    const ids = (await store.listLive()).map((p) => p.id)
    expect(ids.filter((id) => id.startsWith(`${P}insta-`))).toEqual([])
  })

  test('listLive reads the newest approvals first, so its limit keeps the newest posts (71)', async () => {
    const at = (day: number) => `2026-10-0${day}T10:00:00.000Z`
    const png = (name: string) => `${P}png-order-${name}`
    await published(`${P}order-old`, 'live', png('old'), null, GENERAL, { approvedAt: at(2) })
    await published(`${P}order-new`, 'live', png('new'), null, GENERAL, { approvedAt: at(4) })
    await published(`${P}order-mid`, 'live', png('mid'), null, GENERAL, { approvedAt: at(3) })
    const ids = (await store.listLive()).map((p) => p.id).filter((id) => id.includes('order-'))
    expect(ids).toEqual([`${P}order-new`, `${P}order-mid`, `${P}order-old`])
  })

  test('liveById reads one live feed post as the feed does; one in review, an expired one, a social version and an unknown id are null (73, 75)', async () => {
    const id = `${P}by-id`
    const { pointers } = await published(id, 'live', `${P}png-by-id`)
    await published(`${P}by-id-review`, 'in_review', `${P}png-by-id-review`)
    await published(`${P}by-id-expired`, 'live', `${P}png-by-id-expired`, null, EXPIRED)
    await db.transaction((tx) =>
      store.insertPost(tx, {
        id: `${P}by-id-social`,
        kind: 'social',
        parentId: id,
        title: 'Store test · Instagram',
        stage: 'exported',
        pointers,
        actorId: ED,
      }),
    )

    const post = await store.liveById(id)
    expect(post?.id).toBe(id)
    expect(post).toEqual((await store.listLive()).find((p) => p.id === id) ?? null)
    for (const missing of ['by-id-review', 'by-id-expired', 'by-id-social', 'by-id-nope']) {
      expect(await store.liveById(`${P}${missing}`)).toBeNull()
    }
  })

  test('isLiveAsset knows the PNGs of live renders and market versions, and nothing else (77)', async () => {
    await published(`${P}asset-live`, 'live', `${P}png-asset-live`, `${P}png-asset-np`)
    await published(`${P}asset-draft`, 'rendered', `${P}png-asset-draft`)
    expect(await store.isLiveAsset(`${P}png-asset-live`)).toBe(true)
    expect(await store.isLiveAsset(`${P}png-asset-np`)).toBe(true)
    expect(await store.isLiveAsset(`${P}png-asset-draft`)).toBe(false)
    expect(await store.isLiveAsset(`${P}png-asset-live-svg`)).toBe(false)
    expect(await store.isLiveAsset(`${P}nope`)).toBe(false)
  })

  /** Approved 5 Oct 2026, gone from the feed on 6 Oct 2026. */
  const EXPIRED: Body<'settings'> = { ...GENERAL, expiry: { kind: 'date', date: '2026-10-06' } }

  test("isLiveAsset refuses an expired post's PNGs: it left the feed and its page (73, 107)", async () => {
    await published(`${P}asset-expired`, 'live', `${P}png-asset-expired`, null, EXPIRED)
    await published(`${P}asset-kept`, 'live', `${P}png-asset-kept`)
    expect(await store.isLiveAsset(`${P}png-asset-expired`)).toBe(false)
    expect(await store.isLiveAsset(`${P}png-asset-kept`)).toBe(true)
  })

  /** GENERAL settings with these tags. */
  const tagged = (...tags: string[]): Body<'settings'> => ({ ...GENERAL, tags })

  test('relatedCandidates reads the live posts sharing a tag or the source; never the post itself, one sharing nothing, an expired one or one in review (SR10)', async () => {
    const base = `${P}rel-base`
    const png = (name: string) => `${P}png-rel-${name}`
    const { pointers } = await published(
      base,
      'live',
      png('base'),
      null,
      tagged('theme:rel-shared', 'destination:rel-dest'),
    )
    await published(`${P}rel-theme`, 'live', png('theme'), null, tagged('theme:rel-shared'))
    await published(
      `${P}rel-dest`,
      'live',
      png('dest'),
      null,
      tagged('theme:rel-other', 'destination:rel-dest'),
    )
    await published(`${P}rel-none`, 'live', png('none'), null, tagged('theme:rel-other'))
    await published(`${P}rel-expired`, 'live', png('expired'), null, {
      ...EXPIRED,
      tags: ['theme:rel-shared'],
    })
    await published(`${P}rel-review`, 'in_review', png('review'), null, tagged('theme:rel-shared'))
    // A post published on the base post's source, with no tags of its own; and one whose working
    // pointer names that source while its published version does not (criteria 113, 116).
    await published(`${P}rel-source`, 'live', png('source'), null, GENERAL, {
      builtOn: pointers.sourceId,
    })
    const working = await published(`${P}rel-working`, 'live', png('working'))
    const moved = await db.transaction((tx) =>
      store.savePointers(
        tx,
        `${P}rel-working`,
        working.version,
        { stage: 'structures', pointers: { ...working.pointers, sourceId: pointers.sourceId } },
        ED,
      ),
    )
    if (!moved.ok) throw new Error(moved.error)

    const found = await store.relatedCandidates({
      id: base,
      sourceId: pointers.sourceId,
      tags: ['theme:rel-shared', 'destination:rel-dest'],
    })
    expect(found.map((p) => p.id).sort()).toEqual([
      `${P}rel-dest`,
      `${P}rel-source`,
      `${P}rel-theme`,
    ])
    expect(found.find((p) => p.id === `${P}rel-theme`)).toEqual(
      (await store.listLive()).find((p) => p.id === `${P}rel-theme`),
    )
  })

  test('relatedCandidates with nothing to share reads nothing; it keeps the 20 newest approvals (SR10)', async () => {
    expect(await store.relatedCandidates({ id: `${P}rel-bare`, sourceId: null, tags: [] })).toEqual(
      [],
    )

    const at = (day: number) => `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`
    for (let day = 1; day <= 21; day++) {
      await published(
        `${P}rel-many-${day}`,
        'live',
        `${P}png-rel-many-${day}`,
        null,
        tagged('theme:rel-many'),
        { approvedAt: at(day) },
      )
    }
    const ids = (
      await store.relatedCandidates({
        id: `${P}rel-many-base`,
        sourceId: null,
        tags: ['theme:rel-many'],
      })
    ).map((p) => p.id)
    expect(ids).toHaveLength(20)
    expect(ids[0]).toBe(`${P}rel-many-21`)
    expect(ids[19]).toBe(`${P}rel-many-2`)
    expect(ids).not.toContain(`${P}rel-many-1`)
  })

  /** The slug stored on a post, or null. */
  async function slugOf(id: string): Promise<string | null> {
    const [row] = await db
      .select({ slug: schema.contentPost.slug })
      .from(schema.contentPost)
      .where(orm.eq(schema.contentPost.id, id))
    return row?.slug ?? null
  }

  test('going live gives a feed post a slug from its title, the next free number to a second post with it, kept as it moves on; a post in review and a social version get none (107)', async () => {
    const title = 'ST slug: Café rules!'
    const { pointers, version } = await published(
      `${P}slug-a`,
      'live',
      `${P}png-slug-a`,
      null,
      GENERAL,
      { title },
    )
    await published(`${P}slug-b`, 'live', `${P}png-slug-b`, null, GENERAL, { title })
    await published(`${P}slug-review`, 'in_review', `${P}png-slug-review`, null, GENERAL, {
      title: 'ST slug in review',
    })
    expect(await slugOf(`${P}slug-a`)).toBe('st-slug-cafe-rules')
    expect(await slugOf(`${P}slug-b`)).toBe('st-slug-cafe-rules-2')
    expect(await slugOf(`${P}slug-review`)).toBeNull()

    const moved = await db.transaction((tx) =>
      store.savePointers(
        tx,
        `${P}slug-a`,
        version,
        { stage: 'exported', pointers, title: 'ST renamed' },
        ED,
      ),
    )
    expect(moved.ok).toBe(true)
    expect(await slugOf(`${P}slug-a`)).toBe('st-slug-cafe-rules')

    await db.transaction(async (tx) => {
      await store.insertPost(tx, {
        id: `${P}slug-social`,
        kind: 'social',
        parentId: `${P}slug-a`,
        title,
        stage: 'structures',
        pointers,
        actorId: ED,
      })
      const saved = await store.savePointers(
        tx,
        `${P}slug-social`,
        1,
        { stage: 'exported', pointers },
        ED,
      )
      if (!saved.ok) throw new Error(saved.error)
    })
    expect(await slugOf(`${P}slug-social`)).toBeNull()
  })

  test('the slug is unique: a second post given the same one is refused by the database', async () => {
    await published(`${P}slug-one`, 'live', `${P}png-slug-one`, null, GENERAL, {
      title: 'ST unique',
    })
    await newPost(`${P}slug-two`)
    const error = await failureOf(
      db
        .update(schema.contentPost)
        .set({ slug: 'st-unique' })
        .where(orm.eq(schema.contentPost.id, `${P}slug-two`)),
    )
    expect(error).toMatchObject({
      cause: { code: '23505', constraint_name: 'content_post_slug_idx' },
    })
  })

  test('a live post lists the sources its published facts were made from, with their links (GD31)', async () => {
    const parts = [
      { url: 'https://abc.net.au/a', site: 'abc.net.au', title: 'Long hours', from: 1, to: 1 },
      { url: 'https://study.gov.au/w', site: 'study.gov.au', title: 'Work rights', from: 2, to: 2 },
    ]
    const id = `${P}sourced`
    await published(id, 'live', `${P}png-sourced`, null, GENERAL, {
      title: 'ST sourced',
      source: { ...sourceBody('ST sourced'), url: parts[0].url, site: parts[0].site, parts },
    })
    const sources = [
      { site: 'abc.net.au', title: 'Long hours', url: 'https://abc.net.au/a' },
      { site: 'study.gov.au', title: 'Work rights', url: 'https://study.gov.au/w' },
    ]
    expect((await store.liveBySlug('st-sourced'))?.sources).toEqual(sources)
    expect((await store.liveById(id))?.sources).toEqual(sources)
    // A pasted source is named by its title, with no link.
    await published(`${P}pasted`, 'live', `${P}png-pasted`, null, GENERAL, { title: 'ST pasted' })
    expect((await store.liveBySlug('st-pasted'))?.sources).toEqual([
      { site: null, title: 'Store test', url: null },
    ])
  })

  test('liveBySlug reads a live post by its slug with its search line; an unpublished or expired post and an unknown slug are null (107)', async () => {
    const searchLine = 'To find this again, search “OfCourse ST public”'
    const live = `${P}public`
    const { pointers } = await published(live, 'live', `${P}png-public`, null, GENERAL, {
      title: 'ST public',
      searchLine,
    })
    const post = await store.liveBySlug('st-public')
    expect(post).toMatchObject({
      id: live,
      slug: 'st-public',
      title: 'ST public',
      sourceLine: 'Source: Store test',
      searchLine,
      sourceId: pointers.sourceId,
      main: {
        excerpt: 'The excerpt.',
        slides: [
          {
            pngAssetId: `${P}png-public`,
            alt: `Slide 1: Headline Source: Store test ${searchLine}`,
          },
        ],
      },
    })

    await published(`${P}public-expired`, 'live', `${P}png-public-expired`, null, EXPIRED, {
      title: 'ST public expired',
    })
    expect(await slugOf(`${P}public-expired`)).toBe('st-public-expired')
    expect(await store.liveBySlug('st-public-expired')).toBeNull()

    // A slug alone does not publish: a post never published is null even when it has one.
    await published(`${P}public-unpublished`, 'in_review', `${P}png-public-unpublished`)
    await db
      .update(schema.contentPost)
      .set({ slug: 'st-public-unpublished' })
      .where(orm.eq(schema.contentPost.id, `${P}public-unpublished`))
    expect(await store.liveBySlug('st-public-unpublished')).toBeNull()
    expect(await store.liveBySlug('st-nope')).toBeNull()
  })

  /**
   * The post's pointers moved back to its text versions with the approval and what follows the
   * revision cleared, written directly as "Edit" on a live post will (Task 61); the new version.
   */
  async function movedBack(id: string, version: number, pointers: Pointers): Promise<number> {
    const back = { ...pointers, layoutId: null, renderId: null, marketId: null, approvalId: null }
    const saved = await db.transaction((tx) =>
      store.savePointers(tx, id, version, { stage: 'structures', pointers: back }, ED),
    )
    if (!saved.ok) throw new Error(saved.error)
    return saved.version
  }

  test('a published post moved back to its text versions stays live for students, with the same slides and slug (116)', async () => {
    const id = `${P}edit-live`
    const png = `${P}png-edit-live`
    const nepalPng = `${P}png-edit-live-np`
    const { pointers, version } = await published(id, 'live', png, nepalPng, GENERAL, {
      title: 'ST edit live',
    })
    const page = await store.liveBySlug('st-edit-live')
    const listed = (await store.listLive()).find((p) => p.id === id)
    expect(page?.id).toBe(id)
    expect(listed?.id).toBe(id)

    await movedBack(id, version, pointers)
    expect(await slugOf(id)).toBe('st-edit-live')
    expect(await store.liveBySlug('st-edit-live')).toEqual(page)
    expect((await store.listLive()).find((p) => p.id === id)).toEqual(listed)
    expect(await store.liveById(id)).toEqual(listed ?? null)
    expect((await store.listLiveSlugs()).map((r) => r.slug)).toContain('st-edit-live')
    expect(await store.isLiveAsset(png)).toBe(true)
    expect(await store.isLiveAsset(nepalPng)).toBe(true)
  })

  test('publishing a second approval replaces what the public page shows, at the same slug (117)', async () => {
    const id = `${P}republish`
    const first = `${P}png-republish-1`
    const second = `${P}png-republish-2`
    const { pointers, version } = await published(id, 'live', first, null, GENERAL, {
      title: 'ST republish',
    })
    const back = await movedBack(id, version, pointers)
    await db.transaction(async (tx) => {
      const put = <K extends Parameters<typeof store.putArtifact>[1]['kind']>(
        kind: K,
        body: Body<K>,
      ) => store.putArtifact(tx, { kind, postId: id, body, actorId: ED })
      const renderId = await put('render', {
        revisionId: pointers.revisionId as string,
        layoutId: pointers.layoutId as string,
        art: { assetId: null, prompt: 'A quiet desk.', version: 1, fallback: 'no_art' },
        slides: [{ svgAssetId: `${second}-svg`, pngAssetId: second }],
      })
      const approvalId = await put('approval', {
        revisionId: pointers.revisionId as string,
        renderId,
        sourceCheckId: pointers.sourceCheckId as string,
        settingsId: pointers.settingsId as string,
        visionId: null,
        overrideId: null,
        marketId: null,
        by: { ...stamp, at: '2026-10-06T10:00:00.000Z' },
        selfReviewed: false,
      })
      await store.publishApproval(tx, id, approvalId)
      const saved = await store.savePointers(
        tx,
        id,
        back,
        { stage: 'live', pointers: { ...pointers, renderId, approvalId } },
        ED,
      )
      if (!saved.ok) throw new Error(saved.error)
    })

    const page = await store.liveBySlug('st-republish')
    expect(page?.id).toBe(id)
    expect(page?.approvedAt).toBe('2026-10-06T10:00:00.000Z')
    expect(page?.main.slides.map((s) => s.pngAssetId)).toEqual([second])
    expect(await slugOf(id)).toBe('st-republish')
    expect(await store.isLiveAsset(second)).toBe(true)
    expect(await store.isLiveAsset(first)).toBe(false)
  })

  test('the migration names the published approval of every post already live, and of none other (0008)', async () => {
    const live = await published(`${P}backfill-live`, 'live', `${P}png-backfill-live`)
    const review = await published(`${P}backfill-review`, 'in_review', `${P}png-backfill-review`)
    // As a row was before the migration: live, its approval in the pointers, no published id.
    await db
      .update(schema.contentPost)
      .set({ publishedApprovalId: null })
      .where(orm.like(schema.contentPost.id, `${P}backfill-%`))

    // The migration's own statement (after its breakpoint, comments dropped), kept to this test's rows.
    const migration = await Bun.file(
      new URL(
        '../../../shared/lib/db/migrations/0008_content_post_published_approval.sql',
        import.meta.url,
      ),
    ).text()
    const statement = (migration.split('--> statement-breakpoint')[1] ?? '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join(' ')
      .trim()
      .replace(/;$/, '')
    expect(statement).toStartWith('update content_post set published_approval_id')
    await db.execute(orm.sql`${orm.sql.raw(statement)} and id like ${`${P}backfill-%`}`)
    const publishedIdOf = async (id: string) =>
      (
        await db
          .select({ id: schema.contentPost.publishedApprovalId })
          .from(schema.contentPost)
          .where(orm.eq(schema.contentPost.id, id))
      )[0]?.id
    expect(await publishedIdOf(`${P}backfill-live`)).toBe(live.pointers.approvalId as string)
    expect(await publishedIdOf(`${P}backfill-review`)).toBeNull()
    expect(review.pointers.approvalId).not.toBeNull()
  })

  test('listLiveSlugs lists the live feed posts with their slug, approval time and settings, never one in review (107)', async () => {
    await published(`${P}map-live`, 'live', `${P}png-map-live`, null, EXPIRED, {
      title: 'ST map live',
    })
    await published(`${P}map-review`, 'in_review', `${P}png-map-review`, null, GENERAL, {
      title: 'ST map review',
    })
    const rows = await store.listLiveSlugs()
    expect(rows.find((r) => r.slug === 'st-map-live')).toEqual({
      slug: 'st-map-live',
      approvedAt: stamp.at,
      settings: EXPIRED,
    })
    expect(rows.map((r) => r.slug)).not.toContain('st-map-review')
  })

  test('listHistory reads a post’s structure and revision records newest first, with who, when and what changed (101)', async () => {
    const post = `${P}history`
    const other = `${P}history-other`
    await newPost(post)
    await newPost(other)
    const put = <K extends Parameters<typeof store.putArtifact>[1]['kind']>(
      postId: string,
      kind: K,
      body: Body<K>,
      actorId = ED,
    ) => db.transaction((tx) => store.putArtifact(tx, { kind, postId, body, actorId }))
    const sourceId = await put(post, 'source', sourceBody())
    const factsId = await put(post, 'facts', { sourceId, keyIdeas: [], facts: [], replays: [] })
    const drafts = { factsId, attempt: 1, items: [], replays: [], emotion: null }
    // A row written before notes existed: no `note` key at all.
    const oldId = `drafts_${'0'.repeat(32)}`
    await db.insert(schema.contentArtifact).values({
      id: oldId,
      postId: post,
      kind: 'drafts',
      body: drafts,
      createdByUserId: ED,
      createdAt: new Date('2026-10-01T09:00:00.000Z'),
    })
    const editedId = await put(post, 'drafts', { ...drafts, note: 'Slide 2 edited' })
    const revisionId = await put(post, 'revision', revisionBody(factsId, 'approved'), `${P}rev`)
    // Records of other kinds, and another post's, stay out.
    await put(post, 'layout', { revisionId, slides: [], fits: [], fitChecks: [] })
    await put(other, 'drafts', { ...drafts, note: 'Drafted' })

    const history = await store.listHistory(post)
    expect(history.map((h) => [h.id, h.kind, h.note, h.by, h.factsId])).toEqual([
      [revisionId, 'revision', 'approved', 'ST rev', factsId],
      [editedId, 'drafts', 'Slide 2 edited', 'ST ed', factsId],
      [oldId, 'drafts', null, 'ST ed', factsId],
    ])
    expect(history[2].at).toBe('2026-10-01T09:00:00.000Z')
    expect(Date.parse(history[0].at)).toBeGreaterThan(Date.parse(history[1].at))

    // A record is read by its post: another post's id is not this post's history.
    expect((await store.loadRecord(post, editedId))?.body).toEqual({
      ...drafts,
      note: 'Slide 2 edited',
    })
    expect(await store.loadRecord(other, editedId)).toBeNull()
    expect(await store.loadRecord(post, `${P}missing`)).toBeNull()
  })

  test('a board card says who changed the post last (19)', async () => {
    const post = `${P}card`
    await newPost(post)
    const cards = await store.listCards()
    const card = cards.find((c) => c.id === post)
    expect(card).toMatchObject({
      id: post,
      kind: 'feed',
      parentId: null,
      title: 'Store test',
      stage: 'source',
      updatedByName: 'ST ed',
      market: null,
      platform: null,
      brandName: null,
    })
    expect(card?.updatedAt).toBeInstanceOf(Date)
  })

  /** A record as an older build wrote it, by SQL: putArtifact would add the fields added since. */
  async function oldRecord(postId: string, kind: ArtifactKind, body: object): Promise<string> {
    const id = artifactId(kind, postId, body)
    await db.insert(schema.contentArtifact).values({ id, postId, kind, body, createdByUserId: ED })
    return id
  }

  /** GENERAL as it was saved before the tag file (criterion 80): no `tags` key at all. */
  const { tags: _tags, ...OLD_GENERAL } = GENERAL

  /**
   * A live post every record of which is written by SQL in an older build's shape: drafts before
   * emotions and notes, a revision and brand before emotions and Instagram pages, a layout before
   * the search line, a market version before currency pairs and rewording. Its settings as given.
   */
  async function oldLivePost(id: string, title: string, settings: object, png: string) {
    await newPost(id, emptyPointers(), title)
    const sourceId = await oldRecord(id, 'source', sourceBody(title))
    const fact = { id: 'f1', text: 'One.', value: null, ref: '¶1', quote: 'One.' }
    const factsId = await oldRecord(id, 'facts', {
      sourceId,
      keyIdeas: [],
      facts: [{ ...fact, supported: true, why: null, span: null }],
      replays: [],
    })
    const structure = {
      templateId: TEMPLATES[0]?.id ?? '',
      artPrompt: 'A quiet desk.',
      slides: [
        { kind: 'cover', slots: { headline: slot('Old headline') } },
        { kind: 'body', slots: { body: slot('The old excerpt.') } },
      ],
    }
    const draftsId = await oldRecord(id, 'drafts', {
      factsId,
      attempt: 1,
      items: [{ structure, template: TEMPLATES[0] }],
      replays: [],
    })
    const { emotion: _emotion, ...revision } = revisionBody(factsId, 'approved')
    const { instagram: _instagram, ...brand } = FEED_BRAND
    const revisionId = await oldRecord(id, 'revision', { ...revision, brand, structure })
    const { searchLine: _searchLine, ...laid } = laidSlide('Old headline')
    const layoutId = await oldRecord(id, 'layout', {
      revisionId,
      slides: [laid],
      fits: [],
      fitChecks: [],
    })
    const renderId = await oldRecord(id, 'render', {
      revisionId,
      layoutId,
      art: { assetId: null, prompt: 'A quiet desk.', version: 1, fallback: 'no_art' },
      slides: [{ svgAssetId: `${png}-svg`, pngAssetId: png }],
    })
    const sourceCheckId = await oldRecord(id, 'source_check', {
      revisionId,
      claims: [],
      replays: [],
    })
    const settingsId = await oldRecord(id, 'settings', settings)
    const conversion = { factId: 'f1', from: 'AUD 499', to: 'NPR 43,900', rate: 88 }
    const marketId = await oldRecord(id, 'market', {
      revisionId,
      renderId,
      market: 'NP',
      slots: [],
      feedExcerpt: 'The old Nepal excerpt.',
      conversions: [{ ...conversion, rateSource: 'mock', rateDate: '2026-10-01' }],
      layout: [laid],
      fitChecks: [],
      slides: [{ svgAssetId: `${png}-np-svg`, pngAssetId: `${png}-np` }],
      replays: [],
    })
    const approvalId = await oldRecord(id, 'approval', {
      revisionId,
      renderId,
      sourceCheckId,
      settingsId,
      visionId: null,
      overrideId: null,
      marketId,
      by: stamp,
      selfReviewed: false,
    })
    const pointers: Pointers = {
      ...emptyPointers(),
      ...{ sourceId, factsId, draftsId, picked: 0, revisionId, layoutId, renderId },
      ...{ sourceCheckId, settingsId, marketId, approvalId },
    }
    const saved = await db.transaction((tx) =>
      store.savePointers(tx, id, 1, { stage: 'live', pointers }, ED),
    )
    if (!saved.ok) throw new Error(saved.error)
    // Published before the published approval had its column: the migration names it (0008).
    await db.execute(
      orm.sql`update content_post set published_approval_id = ${approvalId} where id = ${id}`,
    )
    // Pointers saved before covers and pages (criteria 102, 105).
    await db.execute(
      orm.sql`update content_post set pointers = pointers - 'coversId' - 'pageBrandId' where id = ${id}`,
    )
  }

  test('records written before a schema change read with its defaults: the workbench, the board, the feed and the public page (45, 54, 71, 107)', async () => {
    const id = `${P}old-shape`
    await oldLivePost(id, 'ST old shape', OLD_GENERAL, `${P}png-old`)

    const post = await store.loadPost(id)
    expect(post?.pointers).toMatchObject({ coversId: null, pageBrandId: null })
    const now = post?.current
    expect(now?.settings?.body).toEqual(GENERAL)
    expect(now?.drafts?.body).toMatchObject({ emotion: null, note: null })
    expect(now?.revision?.body).toMatchObject({ emotion: null, brand: { instagram: null } })
    expect(now?.layout?.body.slides[0]?.searchLine).toBeNull()
    expect(now?.market?.body.conversions[0]).toMatchObject({
      fromCurrency: 'AUD',
      toCurrency: 'NPR',
    })
    expect(now?.approval).not.toBeNull()
    expect((await store.loadRecord(id, post?.pointers.settingsId ?? ''))?.body).toEqual(GENERAL)

    const card = (await store.listCards()).find((c) => c.id === id)
    expect(card?.liveLine).toStartWith('General · Everyone')

    const live = (await store.listLive()).find((p) => p.id === id)
    expect(live?.settings).toEqual(GENERAL)
    expect(live?.tags).toEqual([])
    expect(live?.main.excerpt).toBe('The old excerpt.')
    expect(live?.market?.version.excerpt).toBe('The old Nepal excerpt.')

    const [row] = await db
      .select({ slug: schema.contentPost.slug })
      .from(schema.contentPost)
      .where(orm.eq(schema.contentPost.id, id))
    const page = await store.liveBySlug(row?.slug ?? '')
    expect(page?.settings).toEqual(GENERAL)
    expect(page?.searchLine).toBeNull()
    const listed = (await store.listLiveSlugs()).find((r) => r.slug === row?.slug)
    expect(listed?.settings).toEqual(GENERAL)
  })

  test('a stored body that fails its schema is logged and read as missing: the post, the board and the feed still load (security §6)', async () => {
    const id = `${P}bad-shape`
    await oldLivePost(id, 'ST bad shape', { ...OLD_GENERAL, layer: 'everything' }, `${P}png-bad`)
    const logged = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const post = await store.loadPost(id)
      expect(post?.current.settings).toBeNull()
      expect(post?.current.revision).not.toBeNull()
      expect(post?.current.approval).toBeNull()
      expect(await store.loadRecord(id, post?.pointers.settingsId ?? '')).toBeNull()
      expect((await store.listCards()).find((c) => c.id === id)?.liveLine).toBeNull()
      expect((await store.listLive()).map((p) => p.id)).not.toContain(id)
      expect(await store.isLiveAsset(`${P}png-bad`)).toBe(false)
      expect(logged).toHaveBeenCalled()
    } finally {
      logged.mockRestore()
    }
  })
})
