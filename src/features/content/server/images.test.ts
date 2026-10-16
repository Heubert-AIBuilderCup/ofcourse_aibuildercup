// A look post's images (GD12–GD14): planned in words, edited, drawn one per art box or one
// panorama, nudged one at a time, and kept at the daily image limit. Against the development
// database (Docker, port 5433); off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/images.test.ts
// The model layer is the fake provider on the real call log and cache, painting each image in a
// colour of its own prompt, so a nudged image can be told from the one before. Every account here
// has an id starting `im-` and is deleted after, with its posts, their call log rows and the
// cache rows of this run's own image and text models.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'
import type { Provider } from '../ai/client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '100000'
process.env.AI_DAILY_CAP_IMAGE = '100000'
process.env.GEMINI_IMAGE_MODEL = `im-imagen-${randomUUID()}`
process.env.GEMINI_LITE_MODEL = `im-lite-${randomUUID()}`
process.env.GEMINI_FLASH_MODEL = `im-flash-${randomUUID()}`
process.env.GEMINI_PRO_MODEL = `im-pro-${randomUUID()}`

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'im-'
const SLOW = 60_000

const ED = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'IM ed' }
const REV = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'IM rev' }
const ADMIN = { id: `${P}admin`, role: 'admin', editor: false, reviewer: false, name: 'IM admin' }

const HEADING = '\n\nBrand guideline for the image:\n'
/** What the art prompt guard reads: the prompt before the guideline. */
const head = (prompt: string) => prompt.split(HEADING)[0]

describe.skipIf(!enabled)('a look post’s images against the database', () => {
  let commands: typeof import('./commands')
  let store: typeof import('./store')
  let preview: typeof import('./preview')
  let after: typeof import('./after')
  let steps: typeof import('./steps')
  let errors: typeof import('../lib/workflow').WORKFLOW_ERRORS
  let stepRunningError: typeof import('../lib/workflow').stepRunningError
  let artPromptError: string
  let dailyLimit: string
  let guideline: string
  let closer: string
  let paidWork: { title: string; kind: string; text: string }
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  /** Every image request that reached the model, in order. */
  const images: { prompt: string; aspectRatio: string }[] = []
  /** The slides of every scene plan request that reached the model, in order. */
  const plans: number[][] = []
  /** The ai the commands call: the run's own, or one with a lower image cap for a test. */
  let active: ReturnType<typeof import('../ai/client').makeAi>
  let makeActive: (imageCap: string) => typeof active
  const background: Promise<unknown>[] = []
  /** While true, the scene plan model fails, as the automatic plan after approval may. */
  let planFails = false
  /** While set, each image request waits here, one at a time, until the test lets it through. */
  let hold: (() => void)[] | null = null
  /** The image requests, counted from 1 in each test, that fail, as a busy or slow model may. */
  let failAt = new Set<number>()
  let imageCalls = 0
  const posts: string[] = []

  async function settled() {
    while (background.length > 0) await background.shift()
  }

  /** Waits, a few milliseconds at a time, until `check` holds; fails after five seconds. */
  async function until(check: () => boolean) {
    for (let i = 0; i < 500; i++) {
      if (check()) return
      await Bun.sleep(10)
    }
    throw new Error('timed out waiting')
  }

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.createdByUserId, `${P}%`))
    if (posts.length > 0) {
      await db.delete(schema.aiCall).where(orm.inArray(schema.aiCall.postId, posts))
    }
    await db.delete(schema.aiCache).where(orm.like(schema.aiCache.model, `${P}%`))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  function ok<T extends { ok: boolean }>(res: T): Extract<T, { ok: true }> {
    if (!res.ok) throw new Error((res as unknown as { error: string }).error)
    return res as Extract<T, { ok: true }>
  }

  async function load(id: string) {
    const post = await store.loadPost(id)
    if (!post) throw new Error(`post ${id} missing`)
    return post
  }

  /** A post in the look, drafted, picked and approved, its source check landed. */
  async function approvedLook(look: string) {
    const requestId = randomUUID()
    posts.push(requestId)
    let { id, version } = ok(await commands.startFeedPost(ED, { requestId, ...paidWork }))
    ;({ version } = ok(await commands.tickTemplates(ED, id, version, [look])))
    ;({ version } = ok(await commands.draftPost(ED, id, version, false)))
    ;({ version } = ok(await commands.pickStructure(ED, id, version, 0)))
    ;({ version } = ok(await commands.chooseTheme(ED, id, version, 'paper')))
    ok(await commands.approveStructure(ED, id, version))
    await settled()
    return { id, version: (await load(id)).version }
  }

  /** An approved look post with its images planned. */
  async function planned(look = 'field-notes') {
    const { id, version } = await approvedLook(look)
    return ok(await commands.planImages(ED, id, version))
  }

  /** An approved look post with its images planned and drawn, its source check landed. */
  async function drawnLook(look = 'field-notes') {
    const { id, version } = await planned(look)
    ok(await commands.drawImages(ED, id, version))
    await settled()
    return load(id)
  }

  /**
   * A claim whose removal leaves its slot within a look body's 15 to 25 words, so the post stays
   * rendered and is drawn again rather than sent back to approved.
   */
  function removableClaim(post: Awaited<ReturnType<typeof load>>): number {
    const words = (t: string) => t.split(/\s+/).filter(Boolean).length
    const slides = post.current.revision?.body.structure.slides ?? []
    const claims = post.current.sourceCheck?.body.claims ?? []
    const at = claims.findIndex((c) => {
      const left = words(slides[c.slide - 1]?.slots[c.slot]?.text ?? '') - words(c.text)
      return c.slot === 'body' && left >= 15 && left <= 25
    })
    if (at < 0) throw new Error('no claim to remove')
    return at
  }

  /** The asset of each slide's image, by slide. */
  const assetsOf = (render: { body: { slideArt?: { slide: number; assetId: string | null }[] } }) =>
    (render.body.slideArt ?? []).map((a): [number, string | null] => [a.slide, a.assetId])

  function renderOf(post: Awaited<ReturnType<typeof load>>) {
    const render = post.current.render
    if (!render) throw new Error('no render')
    return render
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
    // Each call its own colour, from its prompt and its place in the test, so each image, a nudged
    // one and a new picture of the same scene, is its own asset.
    const painted = (prompt: string) => {
      const hex = createHash('sha256').update(prompt).digest('hex').slice(0, 6)
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
        if (planFails && req.useCase === 'scene_plan') throw new Error('im: the plan model fails')
        if (req.useCase === 'scene_plan') {
          const { slides } = req.data as { slides: { slide: number }[] }
          plans.push(slides.map((s) => s.slide))
        }
        return fake.json(req)
      },
      image: async (req) => {
        const waiting = hold
        if (waiting) await new Promise<void>((go) => waiting.push(go))
        imageCalls += 1
        if (failAt.has(imageCalls)) throw new Error('im: the image model is busy')
        images.push({ prompt: req.prompt, aspectRatio: req.aspectRatio })
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

    commands = await import('./commands')
    store = await import('./store')
    preview = await import('./preview')
    after = await import('./after')
    steps = await import('./steps')
    after.scheduleWith((task) => {
      background.push(task())
    })
    ;({ WORKFLOW_ERRORS: errors, stepRunningError } = await import('../lib/workflow'))
    ;({ ART_PROMPT_ERROR: artPromptError } = await import('../ai/draft'))
    dailyLimit = client.AI_ERRORS.dailyLimit
    guideline = (await import('../brands/guideline')).guidelineFor('image')
    closer = (await import('../nudges')).imageNudge('closer')?.instruction as string
    const { DEMO_SOURCES } = await import('../demo-sources')
    const demo = DEMO_SOURCES.find((s) => s.key === 'paid-work')
    if (!demo) throw new Error('demo source missing')
    paidWork = { title: demo.title, kind: demo.kind, text: demo.text }

    await cleanUp()
    await db.insert(schema.user).values(
      [ED, REV, ADMIN].map((a) => ({
        id: a.id,
        name: a.name,
        email: `${a.id}@im.e2e.test`,
        role: a.role as 'user' | 'admin',
        editor: a.editor,
        reviewer: a.reviewer,
      })),
    )
  })

  afterAll(cleanUp)

  beforeEach(async () => {
    images.length = 0
    plans.length = 0
    failAt = new Set()
    imageCalls = 0
    active = makeActive(process.env.AI_DAILY_CAP_IMAGE as string)
    // Every post draws the same scenes: forget the images an earlier test drew, so each test's
    // images reach the model.
    await db
      .delete(schema.aiCache)
      .where(orm.eq(schema.aiCache.model, process.env.GEMINI_IMAGE_MODEL as string))
  })

  test(
    'plan, then edit, then draw: a scene per art box, each image drawn from its own scene and the guideline, and the post rendered (GD12)',
    async () => {
      let { id, version } = await planned()
      const post = await load(id)
      const plan = post.current.artPlan
      if (!plan) throw new Error('no plan')
      expect(plan.body.revisionId).toBe(post.current.revision?.id as string)
      expect(plan.body.panorama).toBe(false)
      expect(plan.body.scenes.map((s) => s.slide)).toEqual([1, 2, 3, 4])
      expect(images).toEqual([])
      // The approved layout's preview writes each planned scene in its art box.
      const layoutId = post.current.layout?.id as string
      const scenes = await preview.plannedScenes(id, plan.id, layoutId)
      expect(scenes?.slice(0, 4)).toEqual(plan.body.scenes.map((s) => s.scene))
      expect(scenes?.[4]).toBeNull()

      // The editor's words: refused with a digit or over 200 characters, kept when clean.
      for (const [text, error] of [
        ['Two students and 3 laptops.', artPromptError],
        ['x'.repeat(201), errors.scene],
        ['   ', errors.scene],
      ] as const) {
        expect(await commands.editImageScene(ED, id, version, { slide: 2, text })).toEqual({
          ok: false,
          error,
        })
      }
      const mine = 'A student in a green scarf laughs with a friend on a park bench.'
      ;({ version } = ok(
        await commands.editImageScene(ED, id, version, { slide: 2, text: ` ${mine} ` }),
      ))
      const edited = (await load(id)).current.artPlan
      expect(edited?.id).not.toBe(plan.id)
      expect(edited?.body.scenes[1]).toEqual({ slide: 2, scene: mine })
      expect(edited?.body.scenes.filter((_, i) => i !== 1)).toEqual(
        plan.body.scenes.filter((_, i) => i !== 1),
      )
      // The old plan's preview URL still draws the old scenes; another layout's plan draws none.
      expect((await preview.plannedScenes(id, plan.id, layoutId))?.[1]).toBe(
        plan.body.scenes[1].scene,
      )

      ok(await commands.drawImages(ED, id, version))
      await settled()
      const drawn = await load(id)
      expect(drawn.stage).toBe('rendered')
      const render = renderOf(drawn)
      const wanted = edited?.body.scenes ?? []
      expect(images).toHaveLength(4)
      images.forEach((req, i) => {
        expect(head(req.prompt)).toStartWith(wanted[i].scene)
        expect(req.prompt).toEndWith(`${HEADING}${guideline}`)
        expect(req.aspectRatio).toBe('1:1')
      })
      expect(
        render.body.slideArt?.map((a) => [a.slide, a.scene, a.take, a.nudge, a.fallback]),
      ).toEqual(wanted.map((s) => [s.slide, s.scene, 1, null, null]))
      const ids = render.body.slideArt?.map((a) => a.assetId) ?? []
      expect(ids.every((a) => a !== null)).toBe(true)
      expect(new Set(ids).size).toBe(4)
      expect(render.body.slides).toHaveLength(drawn.current.layout?.body.slides.length as number)
    },
    SLOW,
  )

  test(
    'Draw images returns at once and draws in the background: each slide fills in as its picture lands, and a second press while it runs is refused (GD12, GD14)',
    async () => {
      const { id, version } = await planned()
      const waiting: (() => void)[] = []
      hold = waiting
      try {
        expect(await commands.drawImages(ED, id, version)).toEqual({ ok: true, id, version })
        // Nothing is drawn yet: the step runs and the post waits at approved.
        expect(images).toEqual([])
        expect(await steps.runningSteps(id)).toContain('images')
        expect((await load(id)).stage).toBe('approved')
        expect(await commands.drawImages(ED, id, version)).toEqual({
          ok: false,
          error: stepRunningError('images'),
        })

        // The first picture lands: the post is rendered with it while the second is drawn.
        await until(() => waiting.length === 1)
        waiting.shift()?.()
        await until(() => waiting.length === 1)
        const first = await load(id)
        expect(first.stage).toBe('rendered')
        expect(assetsOf(renderOf(first)).filter(([, a]) => a !== null)).toHaveLength(1)
        expect(assetsOf(renderOf(first))[0]).toEqual([1, expect.any(String)])
      } finally {
        hold = null
        for (const go of waiting.splice(0)) go()
      }

      await settled()
      const post = await load(id)
      expect(await steps.runningSteps(id)).not.toContain('images')
      expect(images).toHaveLength(4)
      const art = renderOf(post).body.slideArt ?? []
      expect(art.map((a) => a.slide)).toEqual([1, 2, 3, 4])
      expect(art.every((a) => a.assetId !== null && a.fallback === null)).toBe(true)
    },
    SLOW,
  )

  test(
    'a nudge on slide 2 draws only slide 2 again, with the chip in the request, as take 2; the earlier render keeps take 1 (GD13)',
    async () => {
      let { id, version } = await planned()
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const loaded = await load(id)
      version = loaded.version
      const before = renderOf(loaded)
      images.length = 0

      expect(await commands.nudgeImage(ED, id, version, { slide: 2, nudge: 'shorter' })).toEqual({
        ok: false,
        error: errors.imageNudge,
      })
      ok(await commands.nudgeImage(ED, id, version, { slide: 2, nudge: 'closer' }))
      const post = await load(id)
      expect(post.stage).toBe('rendered')
      const after = renderOf(post)
      expect(after.id).not.toBe(before.id)
      expect(images).toHaveLength(1)
      expect(head(images[0].prompt)).toContain(closer)
      expect(head(images[0].prompt)).toStartWith(before.body.slideArt?.[1].scene as string)

      const was = before.body.slideArt ?? []
      const now = after.body.slideArt ?? []
      expect(now[1]).toMatchObject({ slide: 2, take: 2, nudge: 'closer', fallback: null })
      expect(now[1].assetId).not.toBe(was[1].assetId)
      expect(now.filter((_, i) => i !== 1)).toEqual(was.filter((_, i) => i !== 1))
      // "Swap image" can go back: the earlier render still holds take 1.
      const earlier = await store.loadRecord(id, before.id)
      if (earlier?.kind !== 'render') throw new Error('the earlier render is gone')
      const kept = earlier.body as import('../model/artifacts').Body<'render'>
      expect(kept.slideArt?.[1].assetId).toBe(was[1].assetId)
    },
    SLOW,
  )

  /** The images step's row: how its last run ended and how far it recorded it was. */
  async function imagesStep(id: string) {
    const [row] = await db
      .select({ status: schema.contentStep.status, progress: schema.contentStep.progress })
      .from(schema.contentStep)
      .where(
        orm.and(orm.eq(schema.contentStep.postId, id), orm.eq(schema.contentStep.step, 'images')),
      )
    return row
  }

  test(
    'one press draws all four planned images though the second call fails once: that image is asked again, and the step records 4 of 4',
    async () => {
      const { id, version } = await planned()
      failAt = new Set([2])
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const art = renderOf(await load(id)).body.slideArt ?? []
      expect(art.map((a) => a.slide)).toEqual([1, 2, 3, 4])
      expect(art.every((a) => a.assetId !== null && a.fallback === null)).toBe(true)
      expect(imageCalls).toBe(5)
      expect(await imagesStep(id)).toEqual({ status: 'done', progress: { done: 4, total: 4 } })
    },
    SLOW,
  )

  test(
    'an image whose call fails twice is drawn on its third attempt: every slide has its picture, none could not be drawn',
    async () => {
      const { id, version } = await planned()
      failAt = new Set([2, 3])
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const art = renderOf(await load(id)).body.slideArt ?? []
      expect(art.map((a) => a.fallback)).toEqual([null, null, null, null])
      expect(art.every((a) => a.assetId !== null)).toBe(true)
      expect(imageCalls).toBe(6)
      expect(await imagesStep(id)).toEqual({ status: 'done', progress: { done: 4, total: 4 } })
    },
    SLOW,
  )

  test(
    'an image whose call fails three times could not be drawn while the others are; "Try this one again" draws it as its first take',
    async () => {
      const { id, version } = await planned()
      failAt = new Set([2, 3, 4])
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const post = await load(id)
      const art = renderOf(post).body.slideArt ?? []
      expect(art.map((a) => a.fallback)).toEqual([null, 'no_art', null, null])
      expect(art.map((a) => a.assetId !== null)).toEqual([true, false, true, true])
      expect((await imagesStep(id))?.status).toBe('done')

      ok(await commands.nudgeImage(ED, id, post.version, { slide: 2, nudge: null }))
      const again = renderOf(await load(id)).body.slideArt ?? []
      expect(again[1]).toMatchObject({ slide: 2, take: 1, nudge: null, fallback: null })
      expect(again[1].assetId).toEqual(expect.any(String))
      expect(again.filter((_, i) => i !== 1)).toEqual(art.filter((_, i) => i !== 1))
    },
    SLOW,
  )

  test(
    'a drawing stopped after two pictures, its lock lost as after a crash, leaves the rest undrawn; drawing again draws only the last two',
    async () => {
      const { id, version } = await planned()
      const waiting: (() => void)[] = []
      hold = waiting
      try {
        ok(await commands.drawImages(ED, id, version))
        for (const _ of [1, 2]) {
          await until(() => waiting.length === 1)
          waiting.shift()?.()
        }
        // The third image is being drawn when the run is lost: not heard from since long ago.
        await until(() => waiting.length === 1)
        await db
          .update(schema.contentStep)
          .set({ startedAt: new Date(Date.now() - steps.STEP_TIMEOUT_MS - 60_000), beatAt: null })
          .where(
            orm.and(
              orm.eq(schema.contentStep.postId, id),
              orm.eq(schema.contentStep.step, 'images'),
            ),
          )
      } finally {
        hold = null
        for (const go of waiting.splice(0)) go()
      }
      await settled()
      const stopped = await load(id)
      expect(assetsOf(renderOf(stopped))).toEqual([
        [1, expect.any(String)],
        [2, expect.any(String)],
      ])
      expect(await steps.runningSteps(id)).toEqual([])

      // Opening Images again draws what is left; the images drawn before are not asked again.
      await db
        .delete(schema.aiCache)
        .where(orm.eq(schema.aiCache.model, process.env.GEMINI_IMAGE_MODEL as string))
      images.length = 0
      ok(await commands.drawImages(ED, id, stopped.version))
      await settled()
      const scenes = (await load(id)).current.artPlan?.body.scenes ?? []
      expect(images).toHaveLength(2)
      expect(head(images[0].prompt)).toStartWith(scenes[2].scene)
      expect(head(images[1].prompt)).toStartWith(scenes[3].scene)
      const now = assetsOf(renderOf(await load(id)))
      expect(now.slice(0, 2)).toEqual(assetsOf(renderOf(stopped)))
      expect(now.every(([, a]) => a !== null)).toBe(true)
    },
    SLOW,
  )

  test(
    '"New picture" on slide 2 draws only its picture again from the same scene, with no chip, as take 2; the text and every other slide stay',
    async () => {
      const post = await drawnLook()
      const before = renderOf(post)
      images.length = 0

      ok(await commands.nudgeImage(ED, post.id, post.version, { slide: 2, nudge: null }))
      const now = await load(post.id)
      expect(now.current.revision?.id).toBe(post.current.revision?.id as string)
      expect(now.current.layout?.id).toBe(post.current.layout?.id as string)
      const after = renderOf(now)
      expect(images).toHaveLength(1)
      const scene = before.body.slideArt?.[1].scene as string
      expect(head(images[0].prompt)).toStartWith(scene)
      expect(head(images[0].prompt)).not.toContain('Change:')
      const was = before.body.slideArt ?? []
      const art = after.body.slideArt ?? []
      expect(art[1]).toMatchObject({ slide: 2, scene, take: 2, nudge: null, fallback: null })
      expect(art[1].assetId).not.toBe(was[1].assetId)
      expect(art.filter((_, i) => i !== 1)).toEqual(was.filter((_, i) => i !== 1))
    },
    SLOW,
  )

  test(
    'a drawn slide’s scene edited, then "Draw this one": only that slide is drawn again, from the edited scene',
    async () => {
      const post = await drawnLook()
      const before = renderOf(post)
      images.length = 0
      const mine = 'A student in a green scarf laughs with a friend on a park bench.'
      const { version } = ok(
        await commands.editImageScene(ED, post.id, post.version, { slide: 3, text: mine }),
      )
      ok(await commands.nudgeImage(ED, post.id, version, { slide: 3, nudge: null }))
      const now = await load(post.id)
      expect(now.current.revision?.id).toBe(post.current.revision?.id as string)
      expect(images).toHaveLength(1)
      expect(head(images[0].prompt)).toStartWith(mine)
      const was = before.body.slideArt ?? []
      const art = renderOf(now).body.slideArt ?? []
      expect(art[2]).toMatchObject({ slide: 3, scene: mine, take: 2, nudge: null })
      expect(art[2].assetId).not.toBe(was[2].assetId)
      expect(art.filter((_, i) => i !== 2)).toEqual(was.filter((_, i) => i !== 2))
    },
    SLOW,
  )

  test(
    'at a daily image limit of two, two of four images are drawn and kept and two read daily_limit; Draw remaining draws only those (GD14)',
    async () => {
      let { id, version } = await planned()
      const { dbCallLog } = await import('../ai/calls')
      const used = await dbCallLog.countToday('image', new Date().toISOString().slice(0, 10))
      active = makeActive(String(used + 2))

      ok(await commands.drawImages(ED, id, version))
      await settled()
      const first = await load(id)
      version = first.version
      expect(first.stage).toBe('rendered')
      const art = renderOf(first).body.slideArt ?? []
      expect(art.map((a) => a.fallback)).toEqual([null, null, 'daily_limit', 'daily_limit'])
      expect(art.map((a) => a.assetId !== null)).toEqual([true, true, false, false])
      expect(images).toHaveLength(2)
      // A nudge at the limit keeps the image it would replace.
      expect(await commands.nudgeImage(ED, id, version, { slide: 1, nudge: 'wider' })).toEqual({
        ok: false,
        error: dailyLimit,
      })
      expect((await load(id)).version).toBe(version)

      active = makeActive(process.env.AI_DAILY_CAP_IMAGE as string)
      images.length = 0
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const all = renderOf(await load(id)).body.slideArt ?? []
      expect(images).toHaveLength(2)
      expect(head(images[0].prompt)).toStartWith(art[2].scene)
      expect(head(images[1].prompt)).toStartWith(art[3].scene)
      expect(all.map((a) => a.fallback)).toEqual([null, null, null, null])
      expect(all.slice(0, 2)).toEqual(art.slice(0, 2))
      expect(all.every((a) => a.assetId !== null)).toBe(true)
    },
    SLOW,
  )

  test(
    'Postcard plans one wide scene and draws it as one 21:9 panorama across every slide (GD4, GD12)',
    async () => {
      const { id, version } = await planned('postcard')
      const plan = (await load(id)).current.artPlan
      expect(plan?.body.panorama).toBe(true)
      expect(plan?.body.scenes).toHaveLength(1)

      ok(await commands.drawImages(ED, id, version))
      await settled()
      const post = await load(id)
      const render = renderOf(post)
      expect(images.map((r) => r.aspectRatio)).toEqual(['21:9'])
      expect(head(images[0].prompt)).toStartWith(plan?.body.scenes[0].scene as string)
      expect(render.body.panorama?.assetId).toEqual(expect.any(String))
      expect(render.body.slideArt).toEqual([
        {
          slide: 1,
          assetId: render.body.panorama?.assetId as string,
          scene: plan?.body.scenes[0].scene as string,
          take: 1,
          nudge: null,
          fallback: null,
        },
      ])
      expect(render.body.slides).toHaveLength(post.current.layout?.body.slides.length as number)
    },
    SLOW,
  )

  test(
    'approving the text of a look post plans its images by itself, so Images opens on its scenes with nothing drawn (GD12)',
    async () => {
      const { id } = await approvedLook('field-notes')
      const post = await load(id)
      expect(post.stage).toBe('approved')
      const plan = post.current.artPlan
      expect(plan?.body.revisionId).toBe(post.current.revision?.id as string)
      expect(plan?.body.scenes.map((s) => s.slide)).toEqual([1, 2, 3, 4])
      expect(plan?.body.edited ?? false).toBe(false)
      expect(images).toEqual([])
    },
    SLOW,
  )

  test(
    'Plan again writes a new plan from the model in place of one with a scene in the editor’s words, which says so (GD12)',
    async () => {
      let { id, version } = await approvedLook('field-notes')
      const first = (await load(id)).current.artPlan
      if (!first) throw new Error('no plan')
      const mine = 'A student in a green scarf reads on a park bench.'
      ;({ version } = ok(await commands.editImageScene(ED, id, version, { slide: 2, text: mine })))
      const edited = (await load(id)).current.artPlan
      expect(edited?.body.edited).toBe(true)
      ok(await commands.planImages(ED, id, version))
      const again = (await load(id)).current.artPlan
      expect(again?.id).not.toBe(edited?.id as string)
      expect(again?.body.edited ?? false).toBe(false)
      expect(again?.body.scenes.map((s) => s.slide)).toEqual([1, 2, 3, 4])
      expect(again?.body.scenes[1]?.scene).not.toBe(mine)
      expect(images).toEqual([])
    },
    SLOW,
  )

  test(
    'Draw images without a plan is refused, and a look post refuses Render and Make covers (GD12)',
    async () => {
      // The automatic plan fails, so the post waits at approved with no plan. A cached plan from
      // another post's same text would stand in for the model, so none is kept.
      await db.delete(schema.aiCache).where(orm.eq(schema.aiCache.useCase, 'scene_plan'))
      planFails = true
      let approved: Awaited<ReturnType<typeof approvedLook>>
      try {
        approved = await approvedLook('field-notes')
      } finally {
        planFails = false
      }
      const { id, version } = approved
      expect((await load(id)).current.artPlan).toBeNull()
      expect(await commands.drawImages(ED, id, version)).toEqual({
        ok: false,
        error: errors.planFirst,
      })
      expect(await commands.renderPost(ED, id, version)).toEqual({
        ok: false,
        error: errors.drawImages,
      })
      expect((await load(id)).version).toBe(version)
      expect(images).toEqual([])

      const at = ok(await commands.planImages(ED, id, version)).version
      ok(await commands.drawImages(ED, id, at))
      await settled()
      const drawn = (await load(id)).version
      expect(await commands.makeCovers(ED, id, drawn, '')).toEqual({
        ok: false,
        error: errors.drawImages,
      })
    },
    SLOW,
  )

  test(
    "a reviewer's or an admin's plan, scene edit, draw or nudge is refused and nothing moves (GD12–GD14)",
    async () => {
      let { id, version } = await planned()
      for (const actor of [REV, ADMIN]) {
        for (const run of [
          () => commands.planImages(actor, id, version),
          () => commands.editImageScene(actor, id, version, { slide: 1, text: 'A quiet desk.' }),
          () => commands.drawImages(actor, id, version),
        ]) {
          expect(await run()).toEqual({ ok: false, error: errors.notAuthorised })
        }
      }
      expect((await load(id)).version).toBe(version)
      ok(await commands.drawImages(ED, id, version))
      await settled()
      version = (await load(id)).version
      images.length = 0
      for (const actor of [REV, ADMIN]) {
        // A chip, and "New picture" with none.
        for (const nudge of ['closer', null]) {
          expect(await commands.nudgeImage(actor, id, version, { slide: 1, nudge })).toEqual({
            ok: false,
            error: errors.notAuthorised,
          })
        }
      }
      expect((await load(id)).version).toBe(version)
      expect(images).toEqual([])
    },
    SLOW,
  )

  // ── Every redraw of a drawn look post keeps its pictures ─────────────────────────────────────

  test(
    'removing a claim, then restoring the earlier text, redraws a drawn Field Notes post with every image it had (GD12)',
    async () => {
      const before = await drawnLook()
      const was = renderOf(before)
      ok(await commands.removeClaim(ED, before.id, before.version, removableClaim(before)))
      await settled()
      const after = await load(before.id)
      expect(after.stage).toBe('rendered')
      const now = renderOf(after)
      expect(now.id).not.toBe(was.id)
      expect(now.body.slideArt).toEqual(was.body.slideArt as never)
      // The cover's words did not change: drawn with the same picture, it is the same PNG.
      expect(now.body.slides[0].pngAssetId).toBe(was.body.slides[0].pngAssetId)

      ok(
        await commands.restoreVersion(
          ED,
          after.id,
          after.version,
          before.current.revision?.id as string,
        ),
      )
      await settled()
      const restored = renderOf(await load(before.id))
      expect(restored.body.slideArt).toEqual(was.body.slideArt as never)
      expect(restored.body.slides[0].pngAssetId).toBe(was.body.slides[0].pngAssetId)
    },
    SLOW,
  )

  test(
    'a reorder moves each image with its slide (GD12)',
    async () => {
      const post = await drawnLook()
      const was = renderOf(post)
      const asset = new Map(assetsOf(was))
      // Body slides 1 to 3 are slides 2 to 4: the first body slide moves to the end.
      ok(await commands.lightEdit(ED, post.id, post.version, { kind: 'reorder', from: 1, to: 3 }))
      await settled()
      const now = renderOf(await load(post.id))
      const from = [1, 3, 4, 2]
      expect(assetsOf(now)).toEqual(
        from.map((n, i): [number, string | null] => [i + 1, asset.get(n) ?? null]),
      )
      expect(assetsOf(now).every(([, a]) => a !== null)).toBe(true)
      const scene = new Map((was.body.slideArt ?? []).map((a) => [a.slide, a.scene]))
      expect(now.body.slideArt?.map((a) => a.scene)).toEqual(
        [1, 3, 4, 2].map((n) => scene.get(n) as string),
      )
      expect(now.body.slides[0].pngAssetId).toBe(was.body.slides[0].pngAssetId)
    },
    SLOW,
  )

  test(
    'Swap image on a look post puts an earlier take back on that slide only (GD13)',
    async () => {
      const post = await drawnLook()
      const first = renderOf(post).body.slideArt ?? []
      ok(await commands.nudgeImage(ED, post.id, post.version, { slide: 2, nudge: 'closer' }))
      let at = await load(post.id)
      const take1 = first[1].assetId as string
      // An image that was never on slide 2 is not one of its takes.
      expect(
        await commands.lightEdit(ED, post.id, at.version, {
          kind: 'swapImage',
          slide: 2,
          image: { assetId: first[2].assetId as string },
        }),
      ).toEqual({ ok: false, error: errors.movedOn })
      ok(
        await commands.lightEdit(ED, post.id, at.version, {
          kind: 'swapImage',
          slide: 2,
          image: { assetId: take1 },
        }),
      )
      at = await load(post.id)
      expect(renderOf(at).body.slideArt).toEqual(first)
    },
    SLOW,
  )

  test(
    'the market version of a drawn look post is drawn with its pictures (GD12)',
    async () => {
      const post = await drawnLook()
      const render = renderOf(post)
      ok(await commands.makeMarket(ED, post.id, post.version, 'NP'))
      const market = (await load(post.id)).current.market
      if (!market) throw new Error('no market version')
      expect(market.body.renderId).toBe(render.id)
      // The cover carries no money: the same words on the same picture are the same PNG.
      expect(market.body.slides[0].pngAssetId).toBe(render.body.slides[0].pngAssetId)
    },
    SLOW,
  )

  test(
    'a Postcard post keeps its panorama after a claim is removed (GD4)',
    async () => {
      const post = await drawnLook('postcard')
      const was = renderOf(post)
      expect(was.body.panorama?.assetId).toEqual(expect.any(String))
      ok(await commands.removeClaim(ED, post.id, post.version, removableClaim(post)))
      await settled()
      const after = await load(post.id)
      expect(after.stage).toBe('rendered')
      const now = renderOf(after)
      expect(now.id).not.toBe(was.id)
      expect(now.body.panorama).toEqual(was.body.panorama as never)
      expect(now.body.slideArt).toEqual(was.body.slideArt as never)
      expect(now.body.slides[0].pngAssetId).toBe(was.body.slides[0].pngAssetId)
    },
    SLOW,
  )

  // ── Back to text and approved again: a slide whose text is unchanged keeps its picture ───────

  /**
   * The drawn post taken back to its text, changed there by `between` (given the version, giving
   * the next), and approved again, its scenes planned by themselves. Cached scene plans and images
   * are forgotten first, so every call the commands make reaches the model, and only the calls
   * from the approval on are counted.
   */
  async function backAndApprove(
    post: Awaited<ReturnType<typeof load>>,
    between: (version: number) => Promise<number> = async (v) => v,
  ) {
    ok(await commands.goBack(ED, post.id, post.version, 'structures'))
    await settled()
    await between((await load(post.id)).version)
    await settled()
    await db.delete(schema.aiCache).where(orm.eq(schema.aiCache.useCase, 'scene_plan'))
    await db
      .delete(schema.aiCache)
      .where(orm.eq(schema.aiCache.model, process.env.GEMINI_IMAGE_MODEL as string))
    plans.length = 0
    images.length = 0
    ok(await commands.approveStructure(ED, post.id, (await load(post.id)).version))
    await settled()
    return load(post.id)
  }

  /** The drawn post's images drawn again for its current plan. */
  async function drawAgain(id: string) {
    ok(await commands.drawImages(ED, id, (await load(id)).version))
    await settled()
    return renderOf(await load(id))
  }

  /** Slide `slide`'s first two words swapped in its first slot: the same length, other text. */
  async function changeSlide(id: string, version: number, slide: number) {
    const post = await load(id)
    const item = post.current.drafts?.body.items[post.pointers.picked ?? -1]
    const slots = item?.structure.slides[slide - 1]?.slots ?? {}
    const [key, slot] = Object.entries(slots)[0] ?? []
    if (!key || !slot) throw new Error(`slide ${slide} has no slot`)
    const words = slot.text.split(' ')
    ;[words[0], words[1]] = [words[1], words[0]]
    const text = words.join(' ')
    expect(text).not.toBe(slot.text)
    return ok(await commands.editSlot(ED, id, version, { slide, slot: key, text })).version
  }

  test(
    'only slide 3 changed after going back: the plan keeps the other slides’ scenes, and Draw images draws slide 3 alone, within an image cap of one (story 14)',
    async () => {
      const before = await drawnLook()
      const was = renderOf(before)
      const after = await backAndApprove(before, (v) => changeSlide(before.id, v, 3))
      expect(after.stage).toBe('approved')
      const plan = after.current.artPlan
      if (!plan) throw new Error('no plan')
      expect(plans).toEqual([[3]])
      const scene = new Map((was.body.slideArt ?? []).map((a) => [a.slide, a.scene]))
      expect(plan.body.scenes.filter((s) => s.slide !== 3).map((s) => [s.slide, s.scene])).toEqual(
        [1, 2, 4].map((n) => [n, scene.get(n) as string]),
      )

      // Only the new picture counts against the day's images.
      const { dbCallLog } = await import('../ai/calls')
      const used = await dbCallLog.countToday('image', new Date().toISOString().slice(0, 10))
      active = makeActive(String(used + 1))
      const now = await drawAgain(before.id)
      expect(images).toHaveLength(1)
      const three = plan.body.scenes.find((s) => s.slide === 3)?.scene as string
      expect(head(images[0].prompt)).toStartWith(three)
      const asset = new Map(assetsOf(was))
      expect(assetsOf(now).filter(([n]) => n !== 3)).toEqual(
        [1, 2, 4].map((n): [number, string | null] => [n, asset.get(n) ?? null]),
      )
      expect(now.body.slideArt?.map((a) => a.fallback)).toEqual([null, null, null, null])
      expect(now.body.slideArt?.find((a) => a.slide === 3)?.assetId).not.toBe(asset.get(3))
    },
    SLOW,
  )

  test(
    'the text unchanged after going back and forth: no scene is planned and no image drawn, and every slide keeps its picture (story 14)',
    async () => {
      const before = await drawnLook()
      const was = renderOf(before)
      const after = await backAndApprove(before)
      expect(plans).toEqual([])
      expect(after.current.artPlan?.body.scenes).toEqual(
        (was.body.slideArt ?? []).map((a) => ({
          slide: a.slide,
          scene: a.scene,
          assetId: a.assetId,
        })) as never,
      )
      const now = await drawAgain(before.id)
      expect(images).toEqual([])
      expect(now.id).not.toBe(was.id)
      expect(assetsOf(now)).toEqual(assetsOf(was))
    },
    SLOW,
  )

  test(
    'a kept slide whose scene the editor edits is drawn again from the edited scene (story 14)',
    async () => {
      const before = await drawnLook()
      const was = renderOf(before)
      const after = await backAndApprove(before)
      const mine = 'A student in a green scarf laughs with a friend on a park bench.'
      ok(await commands.editImageScene(ED, after.id, after.version, { slide: 2, text: mine }))
      const now = await drawAgain(before.id)
      expect(images).toHaveLength(1)
      expect(head(images[0].prompt)).toStartWith(mine)
      const asset = new Map(assetsOf(was))
      expect(assetsOf(now).filter(([n]) => n !== 2)).toEqual(
        [1, 3, 4].map((n): [number, string | null] => [n, asset.get(n) ?? null]),
      )
      expect(now.body.slideArt?.[1]).toMatchObject({ slide: 2, scene: mine, take: 1 })
    },
    SLOW,
  )

  test(
    'a slide reordered before going back keeps its own picture, matched by its text (story 14)',
    async () => {
      const drawn = await drawnLook()
      const asset = new Map(assetsOf(renderOf(drawn)))
      // The rendered post reordered, so its newest render has its slides in another order; the
      // text versions keep the order they had, which the next approval takes.
      ok(await commands.lightEdit(ED, drawn.id, drawn.version, { kind: 'reorder', from: 1, to: 3 }))
      await settled()
      const reordered = await load(drawn.id)
      expect(assetsOf(renderOf(reordered))[1][1]).toBe(asset.get(3) as string)
      const after = await backAndApprove(reordered)
      expect(plans).toEqual([])
      expect(after.current.revision?.body.structure).toEqual(
        drawn.current.revision?.body.structure as never,
      )
      const now = await drawAgain(drawn.id)
      expect(images).toEqual([])
      expect(assetsOf(now)).toEqual(assetsOf(renderOf(drawn)))
    },
    SLOW,
  )

  test(
    'another page chosen after going back plans and draws every slide again (story 14)',
    async () => {
      const before = await drawnLook()
      const { PAGE_BRANDS } = await import('../brands')
      const page = PAGE_BRANDS[0].id
      const after = await backAndApprove(
        before,
        async (v) => ok(await commands.choosePage(ED, before.id, v, page)).version,
      )
      expect(after.pointers.pageBrandId).toBe(page)
      expect(plans).toEqual([[1, 2, 3, 4]])
      await drawAgain(before.id)
      expect(images).toHaveLength(4)
    },
    SLOW,
  )

  test(
    'a Postcard post with its text unchanged after going back keeps its panorama, with no call (story 14)',
    async () => {
      const before = await drawnLook('postcard')
      const was = renderOf(before)
      await backAndApprove(before)
      expect(plans).toEqual([])
      const now = await drawAgain(before.id)
      expect(images).toEqual([])
      expect(now.body.panorama).toEqual(was.body.panorama as never)
      expect(now.body.slideArt).toEqual(was.body.slideArt as never)
    },
    SLOW,
  )

  test(
    'a post in an old template plans no images: it keeps Make covers (GD8)',
    async () => {
      const { id, version } = await approvedLook('the-line')
      expect(await commands.planImages(ED, id, version)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )
})
