// "New comic" (RC1, RC2) and its panels (RC6, RC10), called with its actor directly, against a
// database (Docker, port 5433); off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/comics.test.ts
// The model layer is the fake provider (AI_PROVIDER=fake) on the real call log and cache, painting
// each image in a colour of its own prompt and place, so each panel is its own asset. Every
// account here has an id starting `cm-` and is deleted after, with the posts it made (records and
// steps go with their post), their call log rows and this run's cached answers. The Comics page's
// character and design language are set aside for the run and put back after.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'
import type { Provider } from '../ai/client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_IMAGE = '100000'
// The models are this run's own, so no answer or image they cache answers another run.
process.env.GEMINI_FLASH_MODEL = `cm-flash-${randomUUID()}`
process.env.GEMINI_IMAGE_MODEL = `cm-imagen-${randomUUID()}`
// A social version's caption may ask the pro model: this run's own too.
process.env.GEMINI_PRO_MODEL = `cm-pro-${randomUUID()}`
process.env.AI_DAILY_CAP_PRO = '100000'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'cm-'
const SLOW = 60_000

const ED = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'CM ed' }
const REV = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'CM rev' }

describe.skipIf(!enabled)('"New comic" against the database', () => {
  let comic: typeof import('./commands/comic')
  let makeComic: typeof import('./commands/comic').makeComic
  let commands: typeof import('./commands')
  let social: typeof import('./social')
  let preview: typeof import('./preview')
  let store: typeof import('./store')
  let stepLock: typeof import('./steps')
  let paths: typeof import('../lib/path-facts')
  let errors: typeof import('../lib/workflow').WORKFLOW_ERRORS
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  const posts: string[] = []
  /** While true, the comic's story fails (STORY_FAILED) without a model call. */
  let storyFails = false
  const STORY_FAILED = 'The story could not be written.'
  /** The work the command left to run after its response (./after.ts), not yet awaited. */
  const background: Promise<unknown>[] = []
  /** Waits for every run the command left going, as the page waits by polling. */
  async function settled() {
    while (background.length > 0) await background.shift()
  }
  /** Every image request that reached the model, in order. */
  const images: { prompt: string; aspectRatio: string; references: string[] }[] = []
  /** The use cases of every JSON request that reached the model, in order. */
  const asked: string[] = []
  /** The ai the commands call: the run's own, or one with a lower image cap for a test. */
  let active: ReturnType<typeof import('../ai/client').makeAi>
  let makeActive: (imageCap: string) => typeof active
  /** Paints an 8×8 PNG in a colour of its own key. */
  let painted: (key: string) => Uint8Array
  /** The Comics page's character and design language before the run, put back after. */
  let savedCharacter: typeof import('@/shared/lib/db/schema').comicCharacter.$inferSelect[] = []
  let savedStyle: typeof import('@/shared/lib/db/schema').pageStyle.$inferSelect[] = []

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.createdByUserId, `${P}%`))
    if (posts.length > 0) {
      await db.delete(schema.aiCall).where(orm.inArray(schema.aiCall.postId, posts))
    }
    await db.delete(schema.aiCache).where(orm.like(schema.aiCache.model, `${P}%`))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  const comics = () => orm.eq(schema.comicCharacter.brandId, 'comics')
  const comicsStyle = () => orm.eq(schema.pageStyle.brandId, 'comics')

  async function load(id: string) {
    const post = await store.loadPost(id)
    if (!post) throw new Error(`post ${id} missing`)
    return post
  }

  /** "Make storyboard" for the first path, once its story has run. */
  async function made(
    actor: typeof ED,
    more: { premise?: string | null; emotion?: string | null; courseId?: string } = {},
  ) {
    const requestId = randomUUID()
    posts.push(requestId)
    const res = await makeComic(actor, {
      courseId: more.courseId ?? paths.PATHS[0].id,
      premise: more.premise ?? null,
      emotion: more.emotion ?? null,
      requestId,
    })
    await settled()
    return { requestId, res }
  }

  beforeAll(async () => {
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')

    const client = await import('../ai/client')
    const { aiConfig } = await import('../ai/config')
    const { makeFake } = await import('../ai/fake')
    const { dbCallLog } = await import('../ai/calls')
    const { dbCache } = await import('../ai/cache')
    const { Resvg } = await import('@resvg/resvg-js')
    const fake = makeFake()
    painted = (key) => {
      const hex = createHash('sha256').update(key).digest('hex').slice(0, 6)
      return new Uint8Array(
        new Resvg(
          `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#${hex}"/></svg>`,
        )
          .render()
          .asPng(),
      )
    }
    const provider: Provider = {
      json: async (req) => {
        asked.push(req.useCase)
        return fake.json(req)
      },
      image: async (req) => {
        images.push({
          prompt: req.prompt,
          aspectRatio: req.aspectRatio,
          references: (req.references ?? []).map((r) => r.base64),
        })
        return painted(`${req.prompt}#${images.length}`)
      },
    }
    makeActive = (imageCap) =>
      client.makeAi({
        provider,
        config: aiConfig({ ...process.env, AI_DAILY_CAP_IMAGE: imageCap }),
        calls: dbCallLog,
        cache: dbCache,
      })
    active = makeActive(process.env.AI_DAILY_CAP_IMAGE as string)
    const ai = new Proxy({} as typeof active, {
      get: (_, key) => active[key as keyof typeof active],
    })
    mock.module('../ai/client', () => ({ ...client, ai }))
    // The story fails on demand, so "Try again" can be seen to draft it.
    const story = await import('../ai/comic')
    const draftStory = story.draftStory
    mock.module('../ai/comic', () => ({
      ...story,
      draftStory: (...args: Parameters<typeof draftStory>) =>
        storyFails
          ? Promise.resolve({ ok: false as const, error: STORY_FAILED })
          : draftStory(...args),
    }))

    comic = await import('./commands/comic')
    ;({ makeComic } = comic)
    commands = await import('./commands')
    social = await import('./social')
    preview = await import('./preview')
    store = await import('./store')
    stepLock = await import('./steps')
    paths = await import('../lib/path-facts')
    ;({ WORKFLOW_ERRORS: errors } = await import('../lib/workflow'))
    // No request here for after(): run each task at once, and keep it to await.
    ;(await import('./after')).scheduleWith((task) => {
      background.push(task())
    })

    savedCharacter = await db.select().from(schema.comicCharacter).where(comics())
    savedStyle = await db.select().from(schema.pageStyle).where(comicsStyle())
    await cleanUp()
    await db.insert(schema.user).values(
      [ED, REV].map((a) => ({
        id: a.id,
        name: a.name,
        email: `${a.id}@cm.e2e.test`,
        role: a.role as 'user' | 'admin',
        editor: a.editor,
        reviewer: a.reviewer,
      })),
    )
  })

  afterAll(async () => {
    await cleanUp()
    await db.delete(schema.comicCharacter).where(comics())
    if (savedCharacter.length > 0) await db.insert(schema.comicCharacter).values(savedCharacter)
    if (savedStyle.length > 0) await db.insert(schema.pageStyle).values(savedStyle)
  })

  beforeEach(async () => {
    images.length = 0
    asked.length = 0
    active = makeActive(process.env.AI_DAILY_CAP_IMAGE as string)
    // Every comic draws the same scenes: forget the panels an earlier test drew, so each test's
    // panels reach the model. No character, and no design language, until a test sets them.
    await db
      .delete(schema.aiCache)
      .where(orm.eq(schema.aiCache.model, process.env.GEMINI_IMAGE_MODEL as string))
    await db.delete(schema.comicCharacter).where(comics())
    await db.delete(schema.pageStyle).where(comicsStyle())
  })

  test(
    'a comic post for the path, its frozen facts and its storyboard in the comic template',
    async () => {
      const { requestId, res } = await made(ED, { emotion: 'hopeful' })
      expect(res).toEqual({ ok: true, id: requestId })
      const post = await load(requestId)
      const path = paths.PATHS[0]
      const facts = paths.pathFacts(path.id)
      expect(post.kind).toBe('feed')
      expect(post.stage).toBe('structures')
      expect(post.courseId).toBe(path.id)
      expect(post.pointers.pageBrandId).toBe('comics')
      expect(post.current.source?.body).toMatchObject({
        kind: 'path',
        title: path.label,
        paragraphs: facts?.paragraphs,
        demoKey: null,
      })
      expect(post.current.facts?.body.facts).toEqual(facts?.facts ?? [])
      expect(post.current.facts?.body.keyIdeas).toEqual([])
      const items = post.current.drafts?.body.items ?? []
      expect(items).toHaveLength(1)
      expect(items[0].template.id).toBe('comic')
      expect(items[0].angle).toBe('Story')
      const slides = items[0].structure.slides
      expect(slides.length).toBeGreaterThanOrEqual(3)
      expect(slides.every((s) => (s.scene ?? '') !== '')).toBe(true)
      expect(post.current.drafts?.body.emotion).toBe('hopeful')
      expect(post.current.drafts?.body.note).toBe('Storyboard drafted')
      expect(post.pointers.ticked).toEqual(['comic'])
      expect(post.pointers.picked).toBe(0)
      expect(post.pointers.themeId).toBe('pop')
      // The story's title, not the placeholder the post was made with.
      expect(post.title).toBe('Life on this path')
    },
    SLOW,
  )

  test('its settings tag it for Australia', async () => {
    const { requestId } = await made(ED)
    expect((await load(requestId)).current.settings?.body.tags).toEqual(['destination:AU'])
  })

  test('a non-editor is refused, and no post is made', async () => {
    const { requestId, res } = await made(REV)
    expect(res).toEqual({ ok: false, error: errors.notAuthorised })
    expect(await store.loadPost(requestId)).toBeNull()
  })

  test('an unknown path, a long premise, a bad emotion and a premise the art guard refuses make nothing', async () => {
    const refusals = [
      [{ courseId: 'no-such-course' }, 'Choose a path.'],
      [{ premise: 'a'.repeat(121) }, 'Keep the premise to 120 characters.'],
      [{ emotion: 'not 1 word' }, (await import('../emotions')).EMOTION_ERROR],
      [{ premise: 'Moving to Perth in 2027' }, (await import('../ai/draft')).ART_PROMPT_ERROR],
    ] as const
    for (const [input, error] of refusals) {
      const { requestId, res } = await made(ED, input)
      expect(res).toEqual({ ok: false, error })
      expect(await store.loadPost(requestId)).toBeNull()
    }
  })

  test(
    'a failed story keeps the post with its source and facts, with no storyboard, and the step failed',
    async () => {
      const { requestId, res } = await made(ED, { premise: '[fake:fail-comic_story]' })
      expect(res).toEqual({ ok: true, id: requestId })
      const post = await load(requestId)
      expect(post.current.source?.body.kind).toBe('path')
      expect(post.current.facts?.body.facts.length).toBeGreaterThan(0)
      expect(post.current.drafts).toBeNull()
      expect(await stepLock.failedSteps(requestId)).toContain('draft')
    },
    SLOW,
  )

  /** A comic made and storyboarded, with its version and its picked version's slides. */
  async function storyboard() {
    const { requestId } = await made(ED)
    return { id: requestId, ...(await slidesOf(requestId)) }
  }
  async function slidesOf(id: string) {
    const post = await load(id)
    const slides = post.current.drafts?.body.items[0].structure.slides ?? []
    return { post, version: post.version, slides }
  }
  const captions = (slides: { slots: Record<string, { text: string }> }[]) =>
    slides.map((s) => s.slots.caption?.text ?? '')

  test(
    '"Try again" after a failed story drafts the storyboard for that comic',
    async () => {
      storyFails = true
      const { requestId } = await made(ED)
      storyFails = false
      const failed = await load(requestId)
      expect(failed.current.drafts).toBeNull()
      expect(await stepLock.failedSteps(requestId)).toContain('draft')

      const res = await comic.retryStory(ED, requestId, failed.version)
      expect(res.ok).toBe(true)
      await settled()
      const post = await load(requestId)
      expect(post.current.drafts?.body.note).toBe('Storyboard drafted')
      expect(post.current.drafts?.body.items[0].template.id).toBe('comic')
      expect(post.pointers.picked).toBe(0)
      expect(await stepLock.failedSteps(requestId)).not.toContain('draft')
    },
    SLOW,
  )

  test(
    'a caption that promises an outcome is refused and saves nothing',
    async () => {
      const { id, version, post } = await storyboard()
      const res = await commands.editSlot(ED, id, version, {
        slide: 2,
        slot: 'caption',
        text: 'A job after graduation is guaranteed.',
      })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toContain('"guaranteed"')
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.pointers.draftsId).toBe(post.pointers.draftsId)
    },
    SLOW,
  )

  test(
    'a caption whose figure is the path’s fee saves; one no fact holds is refused, naming it',
    async () => {
      const { id, version } = await storyboard()
      // The first path's tuition is about AUD 33k a year (engine/catalogue.ts).
      const saved = await commands.editSlot(ED, id, version, {
        slide: 2,
        slot: 'caption',
        text: 'Tuition is about AUD 33k a year.',
      })
      expect(saved.ok).toBe(true)
      await settled()
      const { slides, version: v2 } = await slidesOf(id)
      expect(slides[1].slots.caption.text).toBe('Tuition is about AUD 33k a year.')

      const refused = await commands.editSlot(ED, id, v2, {
        slide: 2,
        slot: 'caption',
        text: 'Tuition is about AUD 30k a year.',
      })
      expect(refused).toEqual({ ok: false, error: '30k is not a fact of this path.' })
    },
    SLOW,
  )

  test(
    'a scene edit saves a new storyboard with the scene and its note; a long or worded scene is refused',
    async () => {
      const { id, version, post } = await storyboard()
      const scene =
        'The student cooks noodles in a small shared kitchen, steam rising, evening light.'
      const res = await comic.editScene(ED, id, version, { slide: 3, text: scene })
      expect(res.ok).toBe(true)
      await settled()
      const after = await slidesOf(id)
      expect(after.post.pointers.draftsId).not.toBe(post.pointers.draftsId)
      expect(after.slides[2].scene).toBe(scene)
      expect(after.post.current.drafts?.body.note).toBe('Panel 3 scene edited')

      expect(
        await comic.editScene(ED, id, after.version, { slide: 3, text: 'a'.repeat(301) }),
      ).toEqual({ ok: false, error: 'Keep the scene to 300 characters.' })
      const { ART_PROMPT_ERROR } = await import('../ai/draft')
      expect(
        await comic.editScene(ED, id, after.version, { slide: 3, text: 'Moving to Perth in 2027' }),
      ).toEqual({ ok: false, error: ART_PROMPT_ERROR })
      expect((await load(id)).version).toBe(after.version)
    },
    SLOW,
  )

  test(
    'a premise, an emotion, a scene and a caption typed in Nepali, Hindi or Thai at their limits in characters as a reader sees them are taken (GD37)',
    async () => {
      const { nativeOf } = await import('../text/native-fixtures')
      const premise = nativeOf('ne', 120)
      const { requestId: id, res } = await made(ED, { premise, emotion: 'ตื่นเต้น' })
      expect(res).toEqual({ ok: true, id })
      const { version } = await slidesOf(id)
      const scene = nativeOf('hi', 300)
      expect((await comic.editScene(ED, id, version, { slide: 3, text: scene })).ok).toBe(true)
      await settled()
      const after = await slidesOf(id)
      const caption = nativeOf('th', 100)
      const edited = await commands.editSlot(ED, id, after.version, {
        slide: 2,
        slot: 'caption',
        text: caption,
      })
      expect(edited.ok).toBe(true)
      await settled()
      const { post, slides } = await slidesOf(id)
      expect(post.current.drafts?.body.emotion).toBe('ตื่นเต้น')
      expect(slides[2].scene).toBe(scene)
      expect(slides[1].slots.caption.text).toBe(caption)
      expect(
        await comic.editScene(ED, id, post.version, { slide: 3, text: nativeOf('hi', 301) }),
      ).toEqual({ ok: false, error: 'Keep the scene to 300 characters.' })
      // The most a slot takes in an edit, counted the same way; the fit checks hold it to less.
      const longest = nativeOf('ne', 2000)
      const kept = await commands.editSlot(ED, id, post.version, {
        slide: 2,
        slot: 'caption',
        text: longest,
      })
      expect(kept.ok).toBe(true)
      await settled()
      expect((await slidesOf(id)).slides[1].slots.caption.text).toBe(longest)
    },
    SLOW,
  )

  test(
    'a panel removed down to three, then a fourth removal refused',
    async () => {
      const { id, version, slides } = await storyboard()
      expect(slides).toHaveLength(4)
      const res = await comic.editPanels(ED, id, version, { kind: 'remove', at: 0 })
      expect(res.ok).toBe(true)
      await settled()
      const after = await slidesOf(id)
      expect(captions(after.slides)).toEqual(captions(slides.slice(1)))
      expect(after.slides.map((s) => s.kind)).toEqual(['cover', 'body', 'body'])
      expect(after.post.current.drafts?.body.note).toBe('Panel 1 removed')

      expect(await comic.editPanels(ED, id, after.version, { kind: 'remove', at: 1 })).toEqual({
        ok: false,
        error: 'A comic has at least 3 panels.',
      })
    },
    SLOW,
  )

  test(
    'a panel added, then moved first, gives that order with the kinds recomputed',
    async () => {
      const { id, version, slides } = await storyboard()
      const [a, b, c, d] = captions(slides)
      const added = await comic.editPanels(ED, id, version, { kind: 'add', after: 1 })
      expect(added.ok).toBe(true)
      await settled()
      const mid = await slidesOf(id)
      expect(captions(mid.slides)).toEqual([a, b, '', c, d])
      expect(mid.slides[2].scene).toBe('')
      expect(mid.post.current.drafts?.body.note).toBe('Panel 3 added')

      const moved = await comic.editPanels(ED, id, mid.version, { kind: 'move', at: 2, to: 0 })
      expect(moved.ok).toBe(true)
      await settled()
      const after = await slidesOf(id)
      expect(captions(after.slides)).toEqual(['', a, b, c, d])
      expect(after.slides.map((s) => s.kind)).toEqual(['cover', 'body', 'body', 'body', 'body'])
      expect(after.post.current.drafts?.body.note).toBe('Panel 3 moved to 1')
    },
    SLOW,
  )

  test(
    'approving a storyboard with an empty scene is refused, naming the panel',
    async () => {
      const { id, version } = await storyboard()
      const added = await comic.editPanels(ED, id, version, { kind: 'add', after: 2 })
      if (!added.ok) throw new Error(added.error)
      await settled()
      const res = await commands.approveStructure(ED, id, added.version)
      expect(res).toEqual({ ok: false, error: 'Plan the scene for panel 4.' })
      expect((await load(id)).stage).toBe('structures')
    },
    SLOW,
  )

  test(
    'a non-editor may neither edit a scene nor change the panels, and nothing is saved',
    async () => {
      const { id, version } = await storyboard()
      expect(await comic.editScene(REV, id, version, { slide: 1, text: 'A quiet desk.' })).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      expect(await comic.editPanels(REV, id, version, { kind: 'add', after: 0 })).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      expect(await comic.retryStory(REV, id, version)).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      expect((await load(id)).version).toBe(version)
    },
    SLOW,
  )

  test(
    "a comic draft's preview writes each panel's planned scene in its art area",
    async () => {
      const { id, post, slides } = await storyboard()
      const draftsId = post.pointers.draftsId
      if (!draftsId) throw new Error('no drafts')
      const input = { postId: id, draftsId, index: 0, slide: 2, themeId: 'pop' }
      const own = await preview.draftPreviewPng(input)
      const planned = await preview.draftPreviewPng({
        ...input,
        planned: slides.map((s) => s.scene ?? null),
      })
      const blank = await preview.draftPreviewPng({ ...input, planned: [] })
      expect(own).not.toBeNull()
      expect(Buffer.from(own ?? []).equals(Buffer.from(planned ?? []))).toBe(true)
      expect(Buffer.from(own ?? []).equals(Buffer.from(blank ?? []))).toBe(false)
    },
    SLOW,
  )

  // The panels (RC6, RC10): drawn as a look post's images are (./commands/images.ts), each with
  // the approved character sheet as its first reference image.

  function ok<T extends { ok: boolean }>(res: T): Extract<T, { ok: true }> {
    if (!res.ok) throw new Error((res as unknown as { error: string }).error)
    return res as Extract<T, { ok: true }>
  }

  /** A comic storyboarded and approved, its panels planned after the approval. */
  async function approvedComic() {
    const { id, version, slides } = await storyboard()
    ok(await commands.approveStructure(ED, id, version))
    await settled()
    const post = await load(id)
    return { id, version: post.version, post, slides }
  }

  /** The Comics page's character approved with a sheet of its own; the sheet's bytes. */
  async function approvedCharacter(): Promise<Uint8Array> {
    const sheet = painted('cm-character-sheet')
    const assetId = await store.putAsset(null, sheet, 'image/png')
    const now = new Date()
    await db.insert(schema.comicCharacter).values({
      brandId: 'comics',
      description: 'A first-year student in a yellow raincoat.',
      views: [{ label: 'Front', scene: 'Standing, facing forward.' }],
      sheetAssetId: assetId,
      approvedAssetId: assetId,
      approvedBy: ED.id,
      approvedAt: now,
      updatedBy: ED.id,
      updatedAt: now,
    })
    return sheet
  }

  const SAME_CHARACTER = 'The same character as in the first reference image, drawn consistently.'
  const panelsOf = (post: Awaited<ReturnType<typeof load>>) =>
    post.current.render?.body.slideArt ?? []

  test(
    'approving the storyboard plans each panel from its own scene, with no scene plan call (RC6)',
    async () => {
      const { post, slides } = await approvedComic()
      expect(post.stage).toBe('approved')
      expect(post.current.artPlan?.body.scenes).toEqual(
        slides.map((s, i) => ({ slide: i + 1, scene: s.scene ?? '' })),
      )
      expect(asked).not.toContain('scene_plan')
    },
    SLOW,
  )

  test(
    'with no approved character, Draw images is refused with the RC10 message and no image call',
    async () => {
      const { id, version } = await approvedComic()
      expect(await commands.drawImages(ED, id, version)).toEqual({
        ok: false,
        error: 'Approve the comic character first.',
      })
      await settled()
      expect(images).toHaveLength(0)
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.stage).toBe('approved')
    },
    SLOW,
  )

  test(
    'a comic’s panels are its pictures: Skip pictures is refused, and nothing is saved',
    async () => {
      const { id, version } = await approvedComic()
      expect(await commands.skipPictures(ED, id, version)).toEqual({
        ok: false,
        error: errors.panels,
      })
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.stage).toBe('approved')
    },
    SLOW,
  )

  test(
    'with the character approved, every panel is drawn square in the Comics style with the sheet as its first reference, each its own picture',
    async () => {
      const sheet = await approvedCharacter()
      const { id, version, slides } = await approvedComic()
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const post = await load(id)
      expect(post.stage).toBe('rendered')
      const panels = panelsOf(post)
      expect(panels.map((p) => p.slide)).toEqual(slides.map((_, i) => i + 1))
      expect(panels.map((p) => p.scene)).toEqual(slides.map((s) => s.scene ?? ''))
      const assets = panels.map((p) => p.assetId)
      expect(assets.every((a) => a !== null)).toBe(true)
      expect(new Set(assets).size).toBe(slides.length)

      const { DEFAULT_COMIC_STYLE } = await import('../brands')
      expect(images).toHaveLength(slides.length)
      for (const req of images) {
        expect(req.aspectRatio).toBe('1:1')
        expect(req.references[0]).toBe(Buffer.from(sheet).toString('base64'))
        expect(req.prompt).toStartWith(SAME_CHARACTER)
        expect(req.prompt).toContain(`Style: ${DEFAULT_COMIC_STYLE}`)
      }
    },
    SLOW,
  )

  test(
    'a chip on panel 2 redraws only panel 2, as its next take with the sheet first, keeping every other panel',
    async () => {
      const sheet = await approvedCharacter()
      const { id, version } = await approvedComic()
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const before = await load(id)
      images.length = 0

      ok(await commands.nudgeImage(ED, id, before.version, { slide: 2, nudge: 'warmer-light' }))
      const after = await load(id)
      const was = panelsOf(before)
      const now = panelsOf(after)
      expect(images).toHaveLength(1)
      expect(images[0].references[0]).toBe(Buffer.from(sheet).toString('base64'))
      expect(images[0].prompt).toStartWith(SAME_CHARACTER)
      expect(now[1]).toMatchObject({ slide: 2, take: 2, nudge: 'warmer-light', fallback: null })
      expect(now[1].assetId).not.toBe(was[1].assetId)
      expect(now.filter((_, i) => i !== 1)).toEqual(was.filter((_, i) => i !== 1))
    },
    SLOW,
  )

  test(
    'at a daily image limit of two, panels 1–2 are drawn and 3–4 read daily_limit; review waits; Draw remaining draws only 3–4',
    async () => {
      await approvedCharacter()
      const { id, version, slides } = await approvedComic()
      expect(slides).toHaveLength(4)
      const { dbCallLog } = await import('../ai/calls')
      const used = await dbCallLog.countToday('image', new Date().toISOString().slice(0, 10))
      active = makeActive(String(used + 2))

      ok(await commands.drawImages(ED, id, version))
      await settled()
      const first = await load(id)
      const held = panelsOf(first)
      expect(held.map((p) => p.fallback)).toEqual([null, null, 'daily_limit', 'daily_limit'])
      expect(held.map((p) => p.assetId !== null)).toEqual([true, true, false, false])
      const set = ok(
        await commands.saveSettings(ED, id, first.version, {
          layer: 'general',
          audience: { mode: 'everyone', rules: [] },
          whyLine: null,
          expiry: { kind: 'days', days: 90 },
          studioLink: null,
          tags: ['destination:AU'],
          sourcesAt: 'caption',
        }),
      )
      expect(await commands.sendToReview(ED, id, set.version)).toEqual({
        ok: false,
        error: 'Draw every panel first.',
      })

      active = makeActive(process.env.AI_DAILY_CAP_IMAGE as string)
      images.length = 0
      ok(await commands.drawImages(ED, id, set.version))
      await settled()
      const all = await load(id)
      const drawn = panelsOf(all)
      expect(images).toHaveLength(2)
      expect(images[0].prompt).toContain(slides[2].scene ?? '')
      expect(images[1].prompt).toContain(slides[3].scene ?? '')
      expect(drawn.slice(0, 2)).toEqual(held.slice(0, 2))
      expect(drawn.every((p) => p.assetId !== null)).toBe(true)
      // Every panel drawn, the comic goes to review with no source check to wait on (RC4).
      ok(await commands.sendToReview(ED, id, all.version))
      expect((await load(id)).stage).toBe('in_review')
    },
    SLOW,
  )

  test(
    'a non-editor may neither draw the panels nor redraw one, and nothing is drawn',
    async () => {
      await approvedCharacter()
      const { id, version } = await approvedComic()
      expect(await commands.drawImages(REV, id, version)).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      expect(await commands.nudgeImage(REV, id, version, { slide: 1, nudge: null })).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      await settled()
      expect(images).toHaveLength(0)
      expect((await load(id)).version).toBe(version)
    },
    SLOW,
  )

  // Published (RC7, RC15): a live comic is a live feed post, carried by the feed, its slug and its
  // public page as they are, and it goes to Instagram on the Comics page only.

  /**
   * A comic with its panels drawn, its settings as the Settings step starts them (with `more` over
   * them), sent to review and published; the character approved first unless it already is.
   */
  async function liveComic(more: { expiry?: { kind: 'days'; days: 30 | 90 } } = {}) {
    const character = await db.select().from(schema.comicCharacter).where(comics())
    if (character.length === 0) await approvedCharacter()
    const { id, version } = await approvedComic()
    ok(await commands.drawImages(ED, id, version))
    await settled()
    const drawn = await load(id)
    const { defaultSettings } = await import('../lib/settings-defaults')
    const settings = { ...defaultSettings(drawn.current.facts?.body.facts ?? []), ...more }
    let at = ok(await commands.saveSettings(ED, id, drawn.version, settings)).version
    at = ok(await commands.sendToReview(ED, id, at)).version
    at = ok(await commands.approveAndPublish(REV, id, at)).version
    return { id, version: at }
  }

  test(
    'a published comic is in the feed for Australia only, at its slug, its last panel searchable by its title, every panel public',
    async () => {
      const { id } = await liveComic()
      const post = await load(id)
      expect(post.stage).toBe('live')

      const { applyFilters, parseFilters } = await import('../lib/feed')
      const live = (await store.listLive()).find((p) => p.id === id)
      if (!live) throw new Error('the comic is not in the feed')
      expect(live.tags).toContain('destination:AU')
      expect(live.courseId).toBe(post.courseId)
      const shown = (destination: string) =>
        applyFilters([live], parseFilters({ destination })).map((p) => p.id)
      expect(shown('AU')).toEqual([id])
      expect(shown('UK')).toEqual([])

      // The comic's own title, from its story, not its source's (the path's label).
      const search = `To find this again, search “OfCourse ${post.title}”`
      expect(post.title).not.toBe(post.current.source?.body.title)
      const laid = post.current.layout?.body.slides ?? []
      expect(laid.at(-1)?.searchLine).toBe(search)

      const [row] = await db
        .select({ slug: schema.contentPost.slug })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, id))
      expect(row.slug).toEqual(expect.any(String))
      const page = await store.liveBySlug(row.slug as string)
      expect(page?.id).toBe(id)
      expect(page?.searchLine).toBe(search)

      const slides = post.current.render?.body.slides ?? []
      expect(slides).toHaveLength(laid.length)
      for (const slide of slides) expect(await store.isLiveAsset(slide.pngAssetId)).toBe(true)
    },
    SLOW,
  )

  test(
    'a live comic adapts for the Comics page only, each slide with the comic’s own panel and no cover of its own',
    async () => {
      const { id, version } = await liveComic()
      const parent = await load(id)
      const input = { platform: 'instagram' as const, requestId: randomUUID() }
      expect(await social.adaptPost(ED, id, version, { ...input, brandId: 'main' })).toEqual({
        ok: false,
        error: 'A comic goes to the Comics page.',
      })
      expect(await store.loadPost(input.requestId)).toBeNull()

      posts.push(input.requestId)
      let at = ok(await social.adaptPost(ED, id, version, { ...input, brandId: 'comics' })).version
      at = ok(await social.approveLayout(ED, input.requestId, at)).version
      images.length = 0
      ok(await social.renderSocial(ED, input.requestId, at))
      await settled()
      const made = await load(input.requestId)
      expect(made.stage).toBe('ready')
      expect(made.pointers.social).toEqual({ brandId: 'comics', platform: 'instagram' })
      expect(images).toHaveLength(0)
      const parentRender = parent.current.render?.body
      if (!parentRender?.slideArt) throw new Error('the comic has no panels')
      expect(made.current.render?.body.art).toEqual(parentRender.art)
      expect(made.current.render?.body.slideArt).toEqual(parentRender.slideArt)
      expect(made.current.layout?.body.slides.at(-1)?.searchLine).toBe(
        `To find this again, search “OfCourse ${parent.title}”`,
      )

      const panels = parentRender.slideArt
      const svgIds = made.current.render?.body.slides.map((s) => s.svgAssetId) ?? []
      const assets = await store.getAssets([...svgIds, ...panels.map((p) => p.assetId as string)])
      expect(svgIds).toHaveLength(panels.length)
      for (const [i, svgId] of svgIds.entries()) {
        const svg = new TextDecoder().decode(assets.get(svgId)?.bytes)
        const panel = assets.get(panels[i].assetId as string)?.bytes
        if (!panel) throw new Error(`panel ${i + 1} missing`)
        expect(svg).toContain(Buffer.from(panel).toString('base64'))
      }
    },
    SLOW,
  )

  test(
    '"Make the set" on a live comic makes only its Comics version, with no quote card',
    async () => {
      const { id, version } = await liveComic()
      const requestIds = { comics: randomUUID() }
      posts.push(requestIds.comics)
      const made = ok(await social.makeSet(ED, id, version, { requestIds }))
      await settled()
      expect(
        made.versions.map((v) => [v.id, v.brandId, v.kind, v.stage, v.error, v.ownCover]),
      ).toEqual([[requestIds.comics, 'comics', 'page', 'ready', null, false]])
      const children = (await store.listCards()).filter((c) => c.parentId === id)
      expect(children.map((c) => c.id)).toEqual([requestIds.comics])
    },
    SLOW,
  )

  // On a futures card (RC16): the newest-approved live, unexpired comic of each path, by its public
  // page and its first panel's public picture, so a student's browser can load both.

  /** What a futures card shows of a live comic: its title, its public page and its first panel. */
  async function coverOf(id: string) {
    const { postPath, postAssetPath } = await import('../lib/public-post')
    const post = await load(id)
    const [row] = await db
      .select({ slug: schema.contentPost.slug })
      .from(schema.contentPost)
      .where(orm.eq(schema.contentPost.id, id))
    const first = post.current.render?.body.slides[0]
    if (!row.slug || !first) throw new Error(`comic ${id} has no slug or no first panel`)
    return {
      title: post.title,
      href: postPath(row.slug),
      coverSrc: postAssetPath(first.pngAssetId),
    }
  }

  test(
    'a live comic gives its path its slug and its first panel; a path with none is absent',
    async () => {
      const { id } = await liveComic()
      const path = paths.PATHS[0].id
      expect(path).toBe('ecu-cyber')
      const covers = await store.liveComicCovers([path, 'no-such-course'])
      expect(covers).toEqual({ [path]: await coverOf(id) })
      expect(covers[path].href).toMatch(/^\/posts\/[a-z0-9-]+$/)
      expect(covers[path].coverSrc).toMatch(/^\/posts\/assets\//)
    },
    SLOW,
  )

  test(
    'a comic in progress gives its path nothing, and no paths ask nothing',
    async () => {
      const course = paths.PATHS[2].id
      await made(ED, { courseId: course })
      expect(await store.liveComicCovers([course])).toEqual({})
      expect(await store.liveComicCovers([])).toEqual({})
    },
    SLOW,
  )

  test(
    'of two live comics of a path, the newer approval wins',
    async () => {
      const older = await liveComic()
      const newer = await liveComic()
      const path = paths.PATHS[0].id
      const covers = await store.liveComicCovers([path])
      expect(covers[path]).toEqual(await coverOf(newer.id))
      expect(covers[path]).not.toEqual(await coverOf(older.id))
    },
    SLOW,
  )

  test(
    'an expired comic gives nothing: an older one still live shows, and none once all have expired',
    async () => {
      const lasting = await liveComic()
      await liveComic({ expiry: { kind: 'days', days: 30 } })
      const path = paths.PATHS[0].id
      const day = 24 * 60 * 60 * 1000
      const inAMonth = new Date(Date.now() + 31 * day)
      expect(await store.liveComicCovers([path], inAMonth)).toEqual({
        [path]: await coverOf(lasting.id),
      })
      expect(await store.liveComicCovers([path], new Date(Date.now() + 91 * day))).toEqual({})
    },
    SLOW,
  )

  // On the Comic gaps tab (RC13): each path's comic, live when one is published and unexpired, in
  // progress when one exists at any other stage, by course id.

  test(
    'a comic at its storyboard puts its path in progress',
    async () => {
      const course = paths.PATHS[3].id
      await made(ED, { courseId: course })
      expect((await store.comicStatuses()).get(course)).toBe('in_progress')
    },
    SLOW,
  )

  test(
    'a live comic makes its path live, over the comics of the path still in progress, until it expires',
    async () => {
      await made(ED)
      await liveComic()
      const path = paths.PATHS[0].id
      expect((await store.comicStatuses()).get(path)).toBe('live')
      const expired = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000)
      expect((await store.comicStatuses(expired)).get(path)).toBe('in_progress')
    },
    SLOW,
  )

  test('a feed post without a path is not counted', async () => {
    await db.insert(schema.contentPost).values({
      id: `${P}${randomUUID()}`,
      kind: 'feed',
      parentId: null,
      title: 'Not a comic',
      stage: 'structures',
      pointers: {} as never,
      createdByUserId: ED.id,
      updatedByUserId: ED.id,
    })
    expect([...(await store.comicStatuses()).keys()]).not.toContain(null)
  })
})
