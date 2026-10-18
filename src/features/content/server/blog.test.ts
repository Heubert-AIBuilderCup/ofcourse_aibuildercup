// A blog's commands, called with their actor directly, against the development database (Docker,
// port 5433); off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/blog.test.ts
// The model layer is the fake provider (AI_PROVIDER=fake) on the real call log and cache. Every
// account here has an id starting `bl-` and is deleted after, with the posts it made (records and
// steps go with their post), their call log rows and this run's cached answers.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'
import type { Provider } from '../ai/client'

process.env.AI_PROVIDER = 'fake'
// The text model is this run's own (the lite one falls back to it), so no answer it caches
// answers another run, and no other suite's answers are left under it.
process.env.GEMINI_FLASH_MODEL = `bl-flash-${randomUUID()}`
// The pictures (BR4): this run's own image model, so the images it caches go with the run.
process.env.GEMINI_IMAGE_MODEL = `bl-imagen-${randomUUID()}`
process.env.AI_DAILY_CAP_IMAGE = '100000'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'bl-'
const SLOW = 60_000

const ED = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'BL ed' }
const REV = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'BL rev' }
const ADMIN = { id: `${P}admin`, role: 'admin', editor: false, reviewer: false, name: 'BL admin' }

const HEADING = '\n\nBrand guideline for the image:\n'
/** What the art prompt guard reads: the prompt before the guideline. */
const head = (prompt: string) => prompt.split(HEADING)[0]

/** The settings a feed post is published with. */
const GENERAL = {
  layer: 'general' as const,
  audience: { mode: 'everyone' as const, rules: [] },
  whyLine: null,
  expiry: { kind: 'none' as const },
  studioLink: null,
  tags: ['theme:books-movies'],
  sourcesAt: 'caption' as const,
}

describe.skipIf(!enabled)("a blog's commands against the database", () => {
  let commands: typeof import('./commands')
  let social: typeof import('./social')
  let store: typeof import('./store')
  let blogUrl: typeof import('../lib/public-blog').blogUrl
  let steps: typeof import('../lib/steps')
  let errors: typeof import('../lib/workflow').WORKFLOW_ERRORS
  let outlineErrors: typeof import('../lib/blog-outline').BLOG_OUTLINE_ERRORS
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let paidWork: { title: string; kind: string; text: string }
  let textErrors: typeof import('../lib/blog-text').BLOG_TEXT_ERRORS
  let pictures: typeof import('../lib/blog-pictures')
  let closer: string
  let slugOf: typeof import('../lib/public-post').slugOf
  let dailyLimit: string
  /** The DATA of every ideas and blog outline call that reached the model, in order. */
  const ideasData: unknown[] = []
  const outlineData: unknown[] = []
  /** The DATA of every scene plan call, and every image request, that reached the model, in order. */
  const scenePlans: { slides: { slide: number; layout: string | null; text: string[] }[] }[] = []
  const images: { prompt: string; aspectRatio: string }[] = []
  /** While set, each image request waits here, one at a time, until the test lets it through. */
  let hold: (() => void)[] | null = null
  /** The image requests, counted from 1 in each test, that fail, as a busy or slow model may. */
  let failAt = new Set<number>()
  let imageCalls = 0
  /** The step lock (./steps.ts): its timeout, and what runs on a post now. */
  let stepLock: typeof import('./steps')
  /** The ai the commands call: the run's own, or one with a lower image cap for a test. */
  let active: ReturnType<typeof import('../ai/client').makeAi>
  let makeActive: (imageCap: string) => typeof active
  /** The prompt of every blog text call that reached the model, and every claim the judge read. */
  const textUsers: string[] = []
  const judged: string[] = []
  /** While true, the first answer of each blog text call carries a number no fact holds. */
  let plantNumber = false
  const PLANTED = 'Most students work 999 hours a year.'
  const posts: string[] = []
  /** The work the commands left to run after their response (./after.ts), not yet awaited. */
  const background: Promise<unknown>[] = []
  /** Waits for every run the commands left going, as the page waits by polling. */
  async function settled() {
    while (background.length > 0) await background.shift()
  }

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

  /** "Make blog" from the paid-work source: a blog at its angles. */
  async function newBlog() {
    const requestId = randomUUID()
    posts.push(requestId)
    return ok(await commands.makePost(ED, { requestId, ...paidWork, postKind: 'blog' }))
  }

  /** A blog with its first angle outlined. */
  async function outlined() {
    const { id, version } = await newBlog()
    return ok(await commands.pickBlogAngle(ED, id, version, { card: 0 }))
  }

  /** A blog with its text written and checked, at the version after. */
  async function written() {
    const { id, version } = await outlined()
    ok(await commands.writeBlog(ED, id, version))
    await settled()
    return { id, version: (await load(id)).version }
  }

  /** A blog with its text approved and its pictures planned by themselves, at the version after. */
  async function approved() {
    const { id, version } = await written()
    ok(await commands.approveBlogText(ED, id, version))
    await settled()
    return { id, version: (await load(id)).version }
  }

  /** A the-line feed post on paid-work, rendered. */
  async function renderedFeed() {
    const requestId = randomUUID()
    posts.push(requestId)
    let { id, version } = ok(await commands.startFeedPost(ED, { requestId, ...paidWork }))
    ;({ version } = ok(await commands.tickTemplates(ED, id, version, ['the-line'])))
    ;({ version } = ok(await commands.draftPost(ED, id, version, false)))
    ;({ version } = ok(await commands.pickStructure(ED, id, version, 0)))
    ;({ version } = ok(await commands.chooseTheme(ED, id, version, 'paper')))
    ;({ version } = ok(await commands.approveStructure(ED, id, version)))
    ok(await commands.renderPost(ED, id, version))
    await settled()
    return { id, version: (await load(id)).version }
  }

  /** The rendered feed post checked, sent to review and published by a reviewer. */
  async function publish(at: { id: string; version: number }) {
    let { id, version } = at
    ;({ version } = ok(await commands.checkSource(ED, id, version)))
    ;({ version } = ok(await commands.saveSettings(ED, id, version, GENERAL)))
    const claims = (await load(id)).current.sourceCheck?.body.claims ?? []
    for (const [i, claim] of claims.entries()) {
      if (claim.result === 'not_found') {
        ;({ version } = ok(await commands.markOpinion(ED, id, version, i)))
      }
    }
    ;({ version } = ok(await commands.sendToReview(ED, id, version)))
    return ok(await commands.approveAndPublish(REV, id, version))
  }

  /** The feed post linked to the blog, or to none, as linking does (BR7, BR8). */
  async function linkTo(postId: string, blogId: string | null) {
    await db.update(schema.contentPost).set({ blogId }).where(orm.eq(schema.contentPost.id, postId))
  }

  /** One change to the text, once the check it starts has landed, at the version after. */
  async function edit(
    id: string,
    version: number,
    change: Parameters<typeof commands.editBlogSection>[3],
  ) {
    ok(await commands.editBlogSection(ED, id, version, change))
    await settled()
    return (await load(id)).version
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
    const fake = makeFake()
    const { RETRY_LEAD } = await import('../ai/prompts')
    const { Resvg } = await import('@resvg/resvg-js')
    // Each image a colour of its own prompt and place in the run, so a new take is its own asset.
    const painted = (prompt: string) => {
      const hex = createHash('sha256').update(prompt).digest('hex').slice(0, 6)
      return new Uint8Array(
        new Resvg(
          `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#${hex}"/></svg>`,
        )
          .render()
          .asPng(),
      )
    }
    const provider: Provider = {
      json: async (req) => {
        if (req.useCase === 'ideas') ideasData.push(req.data)
        if (req.useCase === 'blog_outline') outlineData.push(req.data)
        if (req.useCase === 'scene_plan') scenePlans.push(req.data as (typeof scenePlans)[number])
        if (req.useCase === 'source_check') judged.push((req.data as { claim: string }).claim)
        if (req.useCase !== 'blog_text') return fake.json(req)
        textUsers.push(req.user)
        const answer = JSON.parse(await fake.json(req)) as { sections: { body: string }[] }
        if (plantNumber && !req.user.includes(RETRY_LEAD)) {
          answer.sections[0].body = `${answer.sections[0].body} ${PLANTED}`
        }
        return JSON.stringify(answer)
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
    dailyLimit = client.AI_ERRORS.dailyLimit
    pictures = await import('../lib/blog-pictures')
    ;({ slugOf } = await import('../lib/public-post'))
    closer = (await import('../nudges')).imageNudge('closer')?.instruction as string

    commands = await import('./commands')
    social = await import('./social')
    store = await import('./store')
    ;({ blogUrl } = await import('../lib/public-blog'))
    // No request here for after(): run each task at once, and keep it to await.
    ;(await import('./after')).scheduleWith((task) => {
      background.push(task())
    })
    ;({ BLOG_TEXT_ERRORS: textErrors } = await import('../lib/blog-text'))
    steps = await import('../lib/steps')
    stepLock = await import('./steps')
    ;({ WORKFLOW_ERRORS: errors } = await import('../lib/workflow'))
    ;({ BLOG_OUTLINE_ERRORS: outlineErrors } = await import('../lib/blog-outline'))
    const { DEMO_SOURCES } = await import('../demo-sources')
    const demo = DEMO_SOURCES.find((s) => s.key === 'paid-work')
    if (!demo) throw new Error('demo source missing')
    paidWork = { title: demo.title, kind: demo.kind, text: demo.text }

    await cleanUp()
    await db.insert(schema.user).values(
      [ED, REV, ADMIN].map((a) => ({
        id: a.id,
        name: a.name,
        email: `${a.id}@bl.e2e.test`,
        role: a.role as 'user' | 'admin',
        editor: a.editor,
        reviewer: a.reviewer,
      })),
    )
  })

  afterAll(cleanUp)

  beforeEach(async () => {
    scenePlans.length = 0
    images.length = 0
    failAt = new Set()
    imageCalls = 0
    active = makeActive(process.env.AI_DAILY_CAP_IMAGE as string)
    // Every blog plans the same scenes: forget the images an earlier test drew, so each test's
    // images reach the model.
    await db
      .delete(schema.aiCache)
      .where(orm.eq(schema.aiCache.model, process.env.GEMINI_IMAGE_MODEL as string))
  })

  test(
    '"Make blog" makes a blog that stops at its angles: the ideas asked for a blog, with no formats, the top three recommended (BR1)',
    async () => {
      ideasData.length = 0
      const { id } = await newBlog()
      const post = await load(id)
      expect(post.kind).toBe('blog')
      expect(post.stage).toBe('structures')
      expect(post.pointers.ticked).toEqual([])
      const cards = post.current.ideas?.body.cards ?? []
      expect(cards.length).toBeGreaterThanOrEqual(2)
      expect(cards.every((c) => c.format === undefined)).toBe(true)
      expect(cards.slice(0, 3).every((c) => c.recommended)).toBe(true)
      expect(post.current.ideas?.body.formats ?? []).toEqual([])
      expect(ideasData).toHaveLength(1)
      expect(ideasData[0]).toMatchObject({ kind: 'blog', formats: [] })
      expect(steps.stepOf(steps.stepPost({ ...post, running: [], failed: [] }))).toBe('ideas')
    },
    SLOW,
  )

  test(
    "picking an angle saves the blog's outline: question headings, takeaways and an FAQ, and the blog opens at it (BR2)",
    async () => {
      const { id, version } = await newBlog()
      const card = (await load(id)).current.ideas?.body.cards[1]
      outlineData.length = 0
      const saved = ok(await commands.pickBlogAngle(ED, id, version, { card: 1 }))
      expect(saved.version).toBe(version + 1)
      const post = await load(id)
      const outline = post.current.blogOutline
      expect(post.pointers.blogOutlineId).toBe(outline?.id ?? 'missing')
      expect(outline?.body).toMatchObject({ idea: card, note: 'Outlined' })
      expect(outline?.body.factsId).toBe(post.current.facts?.id ?? 'missing')
      expect(outline?.body.sections.length).toBeGreaterThanOrEqual(3)
      expect(outline?.body.sections.every((s) => s.heading.endsWith('?'))).toBe(true)
      expect(outline?.body.takeaways.length).toBeGreaterThanOrEqual(3)
      expect(outline?.body.faq.length).toBeGreaterThanOrEqual(3)
      expect(outlineData).toHaveLength(1)
      expect(outlineData[0]).toMatchObject({
        angle: { angle: card?.angle, hook: card?.hook, audience: card?.audience },
      })
      expect(steps.stepOf(steps.stepPost({ ...post, running: [], failed: [] }))).toBe('outline')
    },
    SLOW,
  )

  test(
    'an angle that is not shown is refused, and nothing moves',
    async () => {
      const { id, version } = await newBlog()
      const shown = (await load(id)).current.ideas?.body.cards.length ?? 0
      for (const card of [-1, shown, 1.5]) {
        expect(await commands.pickBlogAngle(ED, id, version, { card })).toEqual({
          ok: false,
          error: errors.angle,
        })
      }
      expect((await load(id)).version).toBe(version)
    },
    SLOW,
  )

  test(
    'each change to the sections is a new outline record with its note; the takeaways and FAQ stay (BR2)',
    async () => {
      let { id, version } = await outlined()
      const first = (await load(id)).current.blogOutline
      if (!first) throw new Error('no outline')
      const headings = first.body.sections.map((s) => s.heading)
      ;({ version } = ok(
        await commands.editBlogOutline(ED, id, version, { op: 'move', section: 2, to: 1 }),
      ))
      ;({ version } = ok(
        await commands.editBlogOutline(ED, id, version, {
          op: 'add',
          at: 1,
          section: { heading: 'Who is this for?', point: 'Students who work.' },
        }),
      ))
      ;({ version } = ok(
        await commands.editBlogOutline(ED, id, version, {
          op: 'reword',
          section: 2,
          heading: 'Who does it apply to, exactly?',
        }),
      ))
      ok(await commands.editBlogOutline(ED, id, version, { op: 'remove', section: 3 }))
      const post = await load(id)
      const outline = post.current.blogOutline
      expect(outline?.body.sections.map((s) => s.heading)).toEqual([
        'Who is this for?',
        'Who does it apply to, exactly?',
        ...headings.slice(2),
      ])
      expect(outline?.body.note).toBe('Section 3 removed')
      expect(outline?.body.takeaways).toEqual(first.body.takeaways)
      expect(outline?.body.faq).toEqual(first.body.faq)
      expect(outline?.body.idea).toEqual(first.body.idea)
      const notes = await db
        .select({ note: orm.sql<string>`${schema.contentArtifact.body}->>'note'` })
        .from(schema.contentArtifact)
        .where(
          orm.and(
            orm.eq(schema.contentArtifact.postId, id),
            orm.eq(schema.contentArtifact.kind, 'blog_outline'),
          ),
        )
      expect(notes.map((n) => n.note).sort()).toEqual(
        [
          'Outlined',
          'Section 2 moved',
          'Section added',
          'Section 2 reworded',
          'Section 3 removed',
        ].sort(),
      )
    },
    SLOW,
  )

  test(
    'the sections never go above eight or below one, and a refused change saves nothing (BR2)',
    async () => {
      let { id, version } = await outlined()
      const count = (await load(id)).current.blogOutline?.body.sections.length ?? 0
      for (let n = count; n < 8; n++) {
        ;({ version } = ok(
          await commands.editBlogOutline(ED, id, version, {
            op: 'add',
            at: 1,
            section: { heading: `Which question ${'abcdefgh'[n]}?`, point: 'A point.' },
          }),
        ))
      }
      expect(
        await commands.editBlogOutline(ED, id, version, {
          op: 'add',
          at: 1,
          section: { heading: 'One too many?', point: 'A point.' },
        }),
      ).toEqual({ ok: false, error: outlineErrors.most })
      for (let n = 8; n > 1; n--) {
        ;({ version } = ok(
          await commands.editBlogOutline(ED, id, version, { op: 'remove', section: 1 }),
        ))
      }
      expect(await commands.editBlogOutline(ED, id, version, { op: 'remove', section: 1 })).toEqual(
        { ok: false, error: outlineErrors.fewest },
      )
      const post = await load(id)
      expect(post.version).toBe(version)
      expect(post.current.blogOutline?.body.sections).toHaveLength(1)
    },
    SLOW,
  )

  test(
    'a reviewer\'s or an admin\'s "Make blog", angle pick and outline change are refused, and nothing is made or moved',
    async () => {
      for (const actor of [REV, ADMIN]) {
        const requestId = randomUUID()
        expect(
          await commands.makePost(actor, { requestId, ...paidWork, postKind: 'blog' }),
        ).toEqual({ ok: false, error: errors.notAuthorised })
        expect(await store.loadPost(requestId)).toBeNull()
      }
      const { id, version } = await outlined()
      for (const actor of [REV, ADMIN]) {
        expect(await commands.pickBlogAngle(actor, id, version, { card: 0 })).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
        expect(
          await commands.editBlogOutline(actor, id, version, { op: 'remove', section: 1 }),
        ).toEqual({ ok: false, error: errors.notAuthorised })
      }
      expect((await load(id)).version).toBe(version)
    },
    SLOW,
  )

  test(
    "a feed post's ideas are not a blog's: picking an angle on one is refused",
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const { id, version } = ok(await commands.makePost(ED, { requestId, ...paidWork }))
      expect((await load(id)).kind).toBe('feed')
      expect(await commands.pickBlogAngle(ED, id, version, { card: 0 })).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )

  /** The words of a text's section bodies, in all. */
  const bodyWords = (sections: { body: string }[]) =>
    sections.reduce((n, s) => n + s.body.split(/\s+/).filter(Boolean).length, 0)

  test(
    '"Write the blog" writes its text from the outline in the background, counting its sections, and the source check reads it after (BR3)',
    async () => {
      const { id, version } = await outlined()
      const outline = (await load(id)).current.blogOutline
      if (!outline) throw new Error('no outline')
      // The request returns at once; the text lands after it.
      expect(await commands.writeBlog(ED, id, version)).toEqual({ ok: true, id, version })
      await settled()
      const post = await load(id)
      const text = post.current.blogText
      expect(post.pointers.blogTextId).toBe(text?.id ?? 'missing')
      expect(text?.body.outlineId).toBe(outline.id)
      expect(text?.body.note).toBe('Written')
      expect(text?.body.sections.map((s) => s.heading)).toEqual(
        outline.body.sections.map((s) => s.heading),
      )
      expect(text?.body.faq.map((f) => f.q)).toEqual(outline.body.faq.map((f) => f.q))
      const words = bodyWords(text?.body.sections ?? [])
      expect(words).toBeGreaterThanOrEqual(600)
      expect(words).toBeLessThanOrEqual(1200)
      const [row] = await db
        .select({ status: schema.contentStep.status, progress: schema.contentStep.progress })
        .from(schema.contentStep)
        .where(
          orm.and(
            orm.eq(schema.contentStep.postId, id),
            orm.eq(schema.contentStep.step, 'blog_text'),
          ),
        )
      expect(row).toEqual({
        status: 'done',
        progress: { done: 0, total: outline.body.sections.length },
      })
      // The check read this text: every sentence of the fake's is a fact, word for word.
      const check = post.current.sourceCheck
      expect(check?.body.blogTextId).toBe(text?.id ?? 'missing')
      expect(check?.body.claims.length).toBeGreaterThan(0)
      expect(check?.body.claims.every((c) => c.result === 'found')).toBe(true)
      expect(steps.stepOf(steps.stepPost({ ...post, running: [], failed: [] }))).toBe('text')
    },
    SLOW,
  )

  test(
    'a number no fact holds goes back to the model with the problem, and only the text that fixes it is saved (BR3, GD21)',
    async () => {
      // An angle no other test writes, so no cached text answers it.
      const made = await newBlog()
      const { id, version } = ok(
        await commands.pickBlogAngle(ED, made.id, made.version, { card: 2 }),
      )
      textUsers.length = 0
      plantNumber = true
      try {
        ok(await commands.writeBlog(ED, id, version))
        await settled()
      } finally {
        plantNumber = false
      }
      expect(textUsers).toHaveLength(2)
      expect(textUsers[1]).toContain(`"${PLANTED}" states a number its fact_ids do not.`)
      const text = (await load(id)).current.blogText
      expect(text?.body.sections[0].body).not.toContain('999')
    },
    SLOW,
  )

  test(
    'an edit saves the new text with its facts and reruns the check, reading only the sentences that changed (BR3)',
    async () => {
      let { id, version } = await written()
      const before = (await load(id)).current.blogText
      if (!before) throw new Error('no text')
      const said =
        'Students who work up to 20 hours a week get grades similar to students who do not work.'
      const body = `${before.body.sections[0].body} ${said}`
      judged.length = 0
      version = await edit(id, version, { part: 'section', index: 0, field: 'body', text: body })
      let post = await load(id)
      expect(post.current.blogText?.body.sections[0]).toEqual({ ...before.body.sections[0], body })
      expect(post.current.blogText?.body.note).toBe('Section 1 edited')
      expect(post.current.blogText?.body.outlineId).toBe(before.body.outlineId)
      // Only the new sentence was read; the rest were read before on the same basis.
      expect(judged).toEqual([said])
      const claim = post.current.sourceCheck?.body.claims.find((c) => c.text === said)
      expect(claim).toMatchObject({ slide: 1, slot: 'section', result: 'found' })

      // A heading is not a claim: the check runs on the new text and reads nothing again.
      judged.length = 0
      await edit(id, version, {
        part: 'section',
        index: 1,
        field: 'heading',
        text: 'Who is it for?',
      })
      post = await load(id)
      expect(post.current.sourceCheck?.body.blogTextId).toBe(post.current.blogText?.id ?? '-')
      expect(judged).toEqual([])
      expect(post.current.sourceCheck?.body.claims.find((c) => c.text === said)?.result).toBe(
        'found',
      )
    },
    SLOW,
  )

  test(
    'the text is approved only on a clean check: a sentence the check could not find holds it at the text until it is fixed (BR3, criterion 43)',
    async () => {
      let { id, version } = await written()
      const was = (await load(id)).current.blogText?.body.sections[2].body ?? ''
      const wrong = 'Most students work 35 hours a week.'
      version = await edit(id, version, {
        part: 'section',
        index: 2,
        field: 'body',
        text: `${was} ${wrong}`,
      })
      const claim = (await load(id)).current.sourceCheck?.body.claims.find((c) => c.text === wrong)
      expect(claim?.result).toBe('not_found')
      expect(await commands.approveBlogText(ED, id, version)).toEqual({
        ok: false,
        error: errors.blogNotFound,
      })
      expect((await load(id)).stage).toBe('structures')

      version = await edit(id, version, { part: 'section', index: 2, field: 'body', text: was })
      const approved = ok(await commands.approveBlogText(ED, id, version))
      expect(approved.version).toBe(version + 1)
      // The pictures are planned by themselves after (BR4).
      await settled()
      let post = await load(id)
      expect(post.stage).toBe('approved')
      // The text approved is the one the post points at; an edit takes the blog back to its text.
      const textId = post.pointers.blogTextId
      expect(textId).toBe(post.current.blogText?.id ?? '-')
      await edit(id, post.version, { part: 'takeaway', index: 0, text: 'Know your hours.' })
      post = await load(id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.blogTextId).not.toBe(textId)
    },
    SLOW,
  )

  test(
    'a takeaway or a question is removed down to three, and a part that is not there, or not a part, is refused with nothing saved (BR3)',
    async () => {
      const { id, version } = await written()
      const faq = (await load(id)).current.blogText?.body.faq ?? []
      expect(faq).toHaveLength(3)
      const refused = [
        [{ part: 'faq', index: 0, remove: true }, textErrors.fewestQuestions],
        [{ part: 'section', index: 99, field: 'body', text: 'A.' }, textErrors.part],
        [{ part: 'slide', index: 0, text: 'A.' }, textErrors.part],
        [{ part: 'faq', index: 0, field: 'q', text: 'No question' }, textErrors.question],
      ] as const
      for (const [change, error] of refused) {
        expect(
          await commands.editBlogSection(
            ED,
            id,
            version,
            change as unknown as Parameters<typeof commands.editBlogSection>[3],
          ),
        ).toEqual({ ok: false, error })
      }
      expect((await load(id)).version).toBe(version)
    },
    SLOW,
  )

  test(
    "a reviewer's or an admin's writing, edit and approval are refused, and nothing moves",
    async () => {
      const { id, version } = await written()
      for (const actor of [REV, ADMIN]) {
        expect(await commands.writeBlog(actor, id, version)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
        expect(
          await commands.editBlogSection(actor, id, version, {
            part: 'takeaway',
            index: 0,
            text: 'Know your hours.',
          }),
        ).toEqual({ ok: false, error: errors.notAuthorised })
        expect(await commands.approveBlogText(actor, id, version)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      const post = await load(id)
      expect(post.version).toBe(version)
      expect(post.stage).toBe('structures')
    },
    SLOW,
  )

  test(
    "a blog refuses a feed post's slide steps, and a feed post the blog's text steps, as moved on",
    async () => {
      const blog = await written()
      const movedOn = { ok: false as const, error: errors.movedOn }
      const { id, version } = blog
      expect(await commands.pickIdeas(ED, id, version, { cards: [0] })).toEqual(movedOn)
      expect(await commands.writeSlides(ED, id, version)).toEqual(movedOn)
      expect(await commands.editPostOutline(ED, id, version, { op: 'remove', slide: 2 })).toEqual(
        movedOn,
      )
      expect(
        await commands.editSlot(ED, id, version, { slide: 1, slot: 'title', text: 'A.' }),
      ).toEqual(movedOn)
      expect(await commands.nudgeSlide(ED, id, version, { slide: 1, nudge: 'shorter' })).toEqual(
        movedOn,
      )
      expect(await commands.approveStructure(ED, id, version)).toEqual(movedOn)
      expect((await load(id)).version).toBe(version)

      const requestId = randomUUID()
      posts.push(requestId)
      const feed = ok(await commands.makePost(ED, { requestId, ...paidWork }))
      expect(await commands.writeBlog(ED, feed.id, feed.version)).toEqual(movedOn)
      expect(
        await commands.editBlogSection(ED, feed.id, feed.version, {
          part: 'takeaway',
          index: 0,
          text: 'A.',
        }),
      ).toEqual(movedOn)
      expect(await commands.approveBlogText(ED, feed.id, feed.version)).toEqual(movedOn)
    },
    SLOW,
  )

  test(
    'approving the text plans the pictures by themselves: a cover from the title and takeaways, and pictures after sections, each from its section (BR4)',
    async () => {
      const { id, version } = await written()
      ok(await commands.approveBlogText(ED, id, version))
      await settled()
      const post = await load(id)
      const text = post.current.blogText
      const plan = post.current.artPlan
      if (!text || !plan) throw new Error('no text or plan')
      expect(plan.body.blogTextId).toBe(text.id)
      expect(plan.body.revisionId).toBeUndefined()
      expect(plan.body.panorama).toBe(false)
      const targets = pictures.blogPictureTargets(text.body.sections.length)
      expect(targets.length).toBeGreaterThan(1)
      expect(plan.body.scenes.map(({ slide, target }) => ({ slide, target }))).toEqual(targets)
      expect(plan.body.scenes.every((s) => s.scene.length > 0)).toBe(true)
      expect(images).toEqual([])

      // The model planned from the blog's own words: the cover from the title and takeaways,
      // each inline picture from the section it follows.
      expect(scenePlans).toHaveLength(1)
      const asked = scenePlans[0].slides
      expect(asked[0]).toEqual({
        slide: 1,
        layout: 'cover',
        text: [post.title, ...text.body.takeaways],
      })
      for (const { slide, target } of targets.slice(1)) {
        if (target === 'cover') throw new Error('one cover only')
        const section = text.body.sections[target.after - 1]
        expect(asked[slide - 1]).toEqual({
          slide,
          layout: `after section ${target.after}`,
          text: [section.heading, section.body],
        })
      }

      // A scene in the editor's words keeps its place.
      const mine = 'A student in a green scarf reads on a sunny lawn.'
      ok(await commands.editImageScene(ED, id, post.version, { slide: 2, text: mine }))
      const edited = (await load(id)).current.artPlan?.body.scenes[1]
      expect(edited).toEqual({ slide: 2, scene: mine, target: targets[1].target })
    },
    SLOW,
  )

  test(
    '"Draw images" draws the cover at 16:9 and the pictures between sections at 4:3, each kept beside its tinted copy, and the blog is rendered; a nudge draws one again (BR4, GD13, GD16)',
    async () => {
      const { id, version } = await approved()
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const post = await load(id)
      expect(post.stage).toBe('rendered')
      const plan = post.current.artPlan?.body
      const drawn = post.current.blogImages?.body
      if (!plan || !drawn) throw new Error('no plan or pictures')
      expect(drawn.blogTextId).toBe(post.current.blogText?.id ?? '-')
      expect(drawn.embeds).toEqual([])
      expect(drawn.images.map((p) => [p.slide, p.target, p.scene, p.take, p.fallback])).toEqual(
        plan.scenes.map((s) => [s.slide, s.target ?? null, s.scene, 1, null]),
      )
      expect(images.map((r) => r.aspectRatio)).toEqual([
        '16:9',
        ...plan.scenes.slice(1).map(() => '4:3'),
      ])
      images.forEach((r, i) => {
        expect(head(r.prompt)).toStartWith(plan.scenes[i].scene)
      })

      // Each picture's original is kept, and the tinted copy beside it is another PNG of it.
      const ids = drawn.images.flatMap((p) => [p.assetId, p.tintedAssetId])
      expect(ids.every((a) => a !== null)).toBe(true)
      const assets = await store.getAssets(ids as string[])
      for (const p of drawn.images) {
        expect(p.tintedAssetId).not.toBe(p.assetId)
        expect(assets.get(p.tintedAssetId as string)?.mime).toBe('image/png')
        expect(assets.get(p.assetId as string)?.mime).toBe('image/png')
      }

      // Drawn again with nothing changed: no image is asked for.
      images.length = 0
      ok(await commands.drawImages(ED, id, post.version))
      await settled()
      expect(images).toEqual([])
      expect((await load(id)).version).toBe(post.version)

      // "Closer" on the second picture: its next take, at its own shape; the others keep theirs.
      ok(await commands.nudgeImage(ED, id, post.version, { slide: 2, nudge: 'closer' }))
      const nudged = (await load(id)).current.blogImages?.body
      if (!nudged) throw new Error('no pictures')
      expect(images).toHaveLength(1)
      expect(images[0].aspectRatio).toBe('4:3')
      expect(head(images[0].prompt)).toContain(closer)
      expect(nudged.version).toBe(drawn.version + 1)
      expect(nudged.images[1]).toMatchObject({ slide: 2, take: 2, nudge: 'closer', fallback: null })
      expect(nudged.images[1].assetId).not.toBe(drawn.images[1].assetId)
      expect(nudged.images[1].tintedAssetId).not.toBe(drawn.images[1].tintedAssetId)
      expect(nudged.images.filter((p) => p.slide !== 2)).toEqual(
        drawn.images.filter((p) => p.slide !== 2),
      )
    },
    SLOW,
  )

  test(
    'at the daily image limit the pictures drawn stay and the rest read daily_limit; "Draw images" again draws only those (BR4)',
    async () => {
      let { id, version } = await approved()
      const { dbCallLog } = await import('../ai/calls')
      const used = await dbCallLog.countToday('image', new Date().toISOString().slice(0, 10))
      active = makeActive(String(used + 1))

      ok(await commands.drawImages(ED, id, version))
      await settled()
      const first = await load(id)
      version = first.version
      expect(first.stage).toBe('rendered')
      const was = first.current.blogImages?.body.images ?? []
      expect(was.length).toBeGreaterThan(1)
      expect(was.map((p) => p.fallback)).toEqual([
        null,
        ...was.slice(1).map(() => 'daily_limit' as const),
      ])
      expect(was.map((p) => p.assetId !== null)).toEqual([true, ...was.slice(1).map(() => false)])
      // A nudge at the limit keeps the picture it would replace.
      expect(await commands.nudgeImage(ED, id, version, { slide: 1, nudge: 'wider' })).toEqual({
        ok: false,
        error: dailyLimit,
      })

      active = makeActive(process.env.AI_DAILY_CAP_IMAGE as string)
      images.length = 0
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const all = (await load(id)).current.blogImages?.body.images ?? []
      expect(images).toHaveLength(was.length - 1)
      expect(all[0]).toEqual(was[0])
      expect(all.every((p) => p.fallback === null && p.assetId !== null)).toBe(true)
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
    'a picture whose call fails three times could not be drawn while the others are, the step recording every picture done; "Try this one again" draws it as its first take (BR4)',
    async () => {
      const { id, version } = await approved()
      failAt = new Set([2, 3, 4])
      ok(await commands.drawImages(ED, id, version))
      await settled()
      const post = await load(id)
      const drawn = post.current.blogImages?.body.images ?? []
      const total = post.current.artPlan?.body.scenes.length ?? 0
      expect(total).toBeGreaterThan(1)
      expect(drawn.map((p) => p.fallback)).toEqual([
        null,
        'no_art',
        ...drawn.slice(2).map(() => null),
      ])
      expect(drawn.map((p) => p.assetId !== null)).toEqual([
        true,
        false,
        ...drawn.slice(2).map(() => true),
      ])
      expect(await imagesStep(id)).toEqual({ status: 'done', progress: { done: total, total } })

      ok(await commands.nudgeImage(ED, id, post.version, { slide: 2, nudge: null }))
      const again = (await load(id)).current.blogImages?.body.images ?? []
      expect(again[1]).toMatchObject({ slide: 2, take: 1, nudge: null, fallback: null })
      expect(again[1].assetId).toEqual(expect.any(String))
      expect(again.filter((p) => p.slide !== 2)).toEqual(drawn.filter((p) => p.slide !== 2))
    },
    SLOW,
  )

  test(
    'a drawing stopped after the cover, its lock lost as after a crash, leaves the rest undrawn and unreached; drawing again draws only the rest (BR4)',
    async () => {
      const { id, version } = await approved()
      const waiting: (() => void)[] = []
      hold = waiting
      try {
        ok(await commands.drawImages(ED, id, version))
        await until(() => waiting.length === 1)
        waiting.shift()?.()
        // The second picture is being drawn when the run is lost: not heard from since long ago.
        await until(() => waiting.length === 1)
        await db
          .update(schema.contentStep)
          .set({
            startedAt: new Date(Date.now() - stepLock.STEP_TIMEOUT_MS - 60_000),
            beatAt: null,
          })
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
      const scenes = stopped.current.artPlan?.body.scenes ?? []
      expect(scenes.length).toBeGreaterThan(1)
      const kept = stopped.current.blogImages?.body.images ?? []
      // Only the cover was saved: every other planned picture has no entry, which the screen reads
      // as a drawing to go on with.
      expect(kept.map((p) => [p.slide, p.assetId !== null])).toEqual([[1, true]])
      expect(await stepLock.runningSteps(id)).toEqual([])

      // Opening Images again draws what is left; the cover is not asked again.
      await db
        .delete(schema.aiCache)
        .where(orm.eq(schema.aiCache.model, process.env.GEMINI_IMAGE_MODEL as string))
      images.length = 0
      ok(await commands.drawImages(ED, id, stopped.version))
      await settled()
      expect(images).toHaveLength(scenes.length - 1)
      images.forEach((r, i) => {
        expect(head(r.prompt)).toStartWith(scenes[i + 1].scene)
      })
      const now = (await load(id)).current.blogImages?.body.images ?? []
      expect(now[0]).toEqual(kept[0])
      expect(now.map((p) => p.slide)).toEqual(scenes.map((s) => s.slide))
      expect(now.every((p) => p.assetId !== null && p.fallback === null)).toBe(true)
    },
    SLOW,
  )

  test(
    "a linked live post's slides are embedded after a section in place of the picture there; a post not linked or not live, a place not a section, and a reviewer are refused (BR4)",
    async () => {
      let { id, version } = await approved()
      const plan = (await load(id)).current.artPlan?.body.scenes ?? []
      const spot = plan[1]?.target
      if (!spot || spot === 'cover') throw new Error('no picture between sections')
      const feed = await renderedFeed()
      const embed = (actor = ED, at = spot.after, postId = feed.id) =>
        commands.embedPostSlides(actor, id, version, { postId, at })
      const refused = (error: string) => ({ ok: false as const, error })

      // Not linked, and not live.
      expect(await embed()).toEqual(refused(pictures.BLOG_PICTURE_ERRORS.notLinked))
      await linkTo(feed.id, id)
      expect(await embed()).toEqual(refused(pictures.BLOG_PICTURE_ERRORS.notLive))
      // Live, but linked to no blog; and a post that is not there.
      await publish(feed)
      await linkTo(feed.id, null)
      expect(await embed()).toEqual(refused(pictures.BLOG_PICTURE_ERRORS.notLinked))
      expect(await embed(ED, spot.after, 'no-such-post')).toEqual(
        refused(pictures.BLOG_PICTURE_ERRORS.notLinked),
      )
      await linkTo(feed.id, id)
      // A place that is not one of the sections, and a reviewer.
      expect(await embed(ED, 99)).toEqual(refused(pictures.BLOG_PICTURE_ERRORS.at))
      expect(await embed(REV)).toEqual(refused(errors.notAuthorised))
      expect((await load(id)).version).toBe(version)

      ;({ version } = ok(await embed()))
      let post = await load(id)
      expect(post.stage).toBe('approved')
      expect(post.current.blogImages?.body.embeds).toEqual([{ after: spot.after, postId: feed.id }])

      // The picture planned there gives way: it is not drawn. (The feed post drew its own cover.)
      images.length = 0
      ok(await commands.drawImages(ED, id, version))
      await settled()
      post = await load(id)
      const drawn = post.current.blogImages?.body
      expect(drawn?.embeds).toEqual([{ after: spot.after, postId: feed.id }])
      expect(drawn?.images.map((p) => p.slide)).toEqual(
        plan.filter((s) => s.slide !== plan[1].slide).map((s) => s.slide),
      )
      expect(images).toHaveLength(plan.length - 1)
    },
    SLOW,
  )

  /** A blog with its pictures drawn: rendered, at the version after. */
  async function renderedBlog(at?: { id: string; version: number }) {
    const { id, version } = at ?? (await approved())
    ok(await commands.drawImages(ED, id, version))
    await settled()
    const post = await load(id)
    expect(post.stage).toBe('rendered')
    return { id, version: post.version }
  }

  /** The rendered blog given its settings and sent to review by its editor. */
  async function inReview(at: { id: string; version: number }) {
    let { id, version } = at
    ;({ version } = ok(await commands.saveSettings(ED, id, version, GENERAL)))
    ;({ version } = ok(await commands.sendToReview(ED, id, version)))
    expect((await load(id)).stage).toBe('in_review')
    return { id, version }
  }

  /** The approval a published post's students see, read back. */
  async function publishedApproval(id: string) {
    const post = await load(id)
    const record = await store.loadRecord(id, post.publishedApprovalId ?? '-')
    if (record?.kind !== 'approval') throw new Error('no published approval')
    return record as typeof record & {
      body: import('../model/artifacts').Body<'approval'>
    }
  }

  test(
    "a blog in review is published by a reviewer, never by its editor alone: the approval pins its text, pictures and settings, students see it at /blog/<slug> with its parts, and a linked post's slides only while that post is live (BR5, BR9)",
    async () => {
      let { id, version } = await approved()
      const spot = (await load(id)).current.artPlan?.body.scenes[1]?.target
      if (!spot || spot === 'cover') throw new Error('no picture between sections')
      const feed = await renderedFeed()
      await publish(feed)
      await linkTo(feed.id, id)
      ;({ version } = ok(
        await commands.embedPostSlides(ED, id, version, { postId: feed.id, at: spot.after }),
      ))
      ;({ id, version } = await inReview(await renderedBlog({ id, version })))

      // The editor alone, and an admin who is neither, cannot publish.
      expect(await commands.approveAndPublish(ED, id, version)).toEqual({
        ok: false,
        error: errors.waitingForReviewer,
      })
      expect(await commands.approveAndPublish(ADMIN, id, version)).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      let post = await load(id)
      expect(post.publishedApprovalId).toBeNull()
      expect(post.stage).toBe('in_review')

      ok(await commands.approveAndPublish(REV, id, version))
      post = await load(id)
      expect(post.stage).toBe('live')
      expect(post.publishedApprovalId).toBe(post.pointers.approvalId ?? '-')
      const { blogText, blogImages, settings, sourceCheck, source } = post.current
      if (!blogText || !blogImages || !settings || !sourceCheck || !source) {
        throw new Error('missing pinned records')
      }
      const approval = await publishedApproval(id)
      expect(approval.body).toMatchObject({
        blogTextId: blogText.id,
        blogImagesId: blogImages.id,
        settingsId: settings.id,
        sourceCheckId: sourceCheck.id,
        marketId: null,
        selfReviewed: false,
      })
      expect(approval.body.revisionId).toBeUndefined()
      expect(approval.body.renderId).toBeUndefined()
      expect(post.current.approval?.id).toBe(approval.id)

      // Its slug is the title's, read at /blog/<slug> and never at /posts/<slug>.
      const [row] = await db
        .select({ slug: schema.contentPost.slug })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, id))
      const slug = row?.slug ?? '-'
      expect(slug.startsWith(slugOf(post.title))).toBe(true)
      expect(await store.liveBySlug(slug)).toBeNull()

      const blog = await store.liveBlogBySlug(slug)
      if (!blog) throw new Error('the live blog does not read')
      const at = approval.body.by.at
      expect(blog).toMatchObject({
        id,
        title: post.title,
        slug,
        publishedAt: at,
        updatedAt: at,
        tags: GENERAL.tags,
        takeaways: blogText.body.takeaways,
        language: 'en',
      })
      expect(blog.sections).toEqual(
        blogText.body.sections.map(({ heading, body }) => ({ heading, body })),
      )
      expect(blog.faq).toEqual(blogText.body.faq.map(({ q, a }) => ({ q, a })))
      // Its pictures are the tinted copies, each in its place; the spot with the embed has none.
      expect(blog.pictures).toEqual(
        blogImages.body.images.map((p) => ({
          target: p.target,
          assetId: p.tintedAssetId as string,
          alt: p.scene,
        })),
      )
      expect(blog.pictures.some((p) => JSON.stringify(p.target) === JSON.stringify(spot))).toBe(
        false,
      )
      // The pasted source, by its title, with no link.
      expect(blog.sources).toEqual([{ site: null, title: source.body.title, url: null }])
      // The linked post's slides after its section, as the feed shows them.
      const live = await store.liveById(feed.id)
      expect(blog.embeds).toEqual([
        {
          after: spot.after,
          postId: feed.id,
          title: live?.title ?? '-',
          slides: live?.main.slides ?? [],
        },
      ])
      expect((await store.liveBlogs()).find((b) => b.id === id)).toEqual(blog)
      expect((await store.listLiveBlogSlugs()).find((r) => r.slug === slug)).toEqual({
        slug,
        approvedAt: at,
        settings: settings.body,
      })

      // Its tinted pictures are served; their originals and a post's slides are not a blog's.
      const picture = blogImages.body.images[0]
      expect(await store.isLiveBlogAsset(picture.tintedAssetId as string)).toBe(true)
      expect(await store.isLiveBlogAsset(picture.assetId as string)).toBe(false)
      expect(await store.isLiveBlogAsset(live?.main.slides[0].pngAssetId ?? '-')).toBe(false)

      // The linked post no longer published: its slides leave the blog.
      await db
        .update(schema.contentPost)
        .set({ publishedApprovalId: null })
        .where(orm.eq(schema.contentPost.id, feed.id))
      expect((await store.liveBlogBySlug(slug))?.embeds).toEqual([])
    },
    SLOW * 3,
  )

  test(
    'a blog not yet published reads as nothing at any slug, and its pictures are not served (BR9)',
    async () => {
      const { id } = await inReview(await renderedBlog())
      const post = await load(id)
      const [row] = await db
        .select({ slug: schema.contentPost.slug })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, id))
      expect(row?.slug).toBeNull()
      expect(await store.liveBlogBySlug(slugOf(post.title))).toBeNull()
      expect((await store.liveBlogs()).some((b) => b.id === id)).toBe(false)
      const tinted = post.current.blogImages?.body.images[0]?.tintedAssetId ?? '-'
      expect(await store.isLiveBlogAsset(tinted)).toBe(false)
    },
    SLOW * 2,
  )

  test(
    '"Request changes" sends a blog back with the note on its text, and "Withdraw" takes it back unasked; an editor cannot request changes (BR5, criteria 115, 120)',
    async () => {
      let { id, version } = await inReview(await renderedBlog())
      expect(await commands.sendBack(ED, id, version, 'The intro is long.', 'structures')).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      ;({ version } = ok(
        await commands.sendBack(REV, id, version, 'The intro is long.', 'structures'),
      ))
      let post = await load(id)
      expect(post.stage).toBe('rendered')
      expect(post.current.sendBack?.body).toMatchObject({
        blogTextId: post.current.blogText?.id ?? '-',
        reason: 'The intro is long.',
        step: 'structures',
      })

      ;({ version } = ok(await commands.sendToReview(ED, id, version)))
      post = await load(id)
      expect(post.stage).toBe('in_review')
      expect(post.current.sendBack).toBeNull()
      ok(await commands.withdrawFromReview(ED, id, version))
      post = await load(id)
      expect(post.stage).toBe('rendered')
      expect(post.current.sendBack).toBeNull()
    },
    SLOW * 2,
  )

  test(
    'a live blog edited stays up as published; republished, it keeps its slug and published date and its "updated" date moves; "Discard changes" goes back to the live version (BR5, BR10, criteria 116, 117, 119)',
    async () => {
      // A takeaway the source states word for word, so the check finds it.
      const FOUND =
        'Students who work up to 20 hours a week get grades similar to students who do not work.'
      let { id, version } = await inReview(await renderedBlog())
      ;({ version } = ok(await commands.approveAndPublish(REV, id, version)))
      const first = await publishedApproval(id)
      const [row] = await db
        .select({ slug: schema.contentPost.slug })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, id))
      const slug = row?.slug ?? '-'
      const before = await store.liveBlogBySlug(slug)
      if (!before)
        throw new Error('the live blog does not read')

        // Taken back for editing: students still read what was published.
      ;({ version } = ok(await commands.editLive(ED, id, version)))
      await settled()
      version = await edit(id, (await load(id)).version, {
        part: 'takeaway',
        index: 0,
        text: FOUND,
      })
      expect((await load(id)).stage).toBe('structures')
      expect(await store.liveBlogBySlug(slug)).toEqual(before)

      // "Discard changes": the live version again, its records the published approval's.
      ;({ version } = ok(await commands.discardChanges(ED, id, version)))
      let post = await load(id)
      expect(post.stage).toBe('live')
      expect(post.pointers.approvalId).toBe(first.id)
      expect(post.current.approval?.id).toBe(first.id)
      expect(post.current.blogText?.id).toBe(first.body.blogTextId ?? '-')
      expect(post.current.blogImages?.id).toBe(first.body.blogImagesId ?? '-')

      // Edited again and republished.
      ;({ version } = ok(await commands.editLive(ED, id, version)))
      await settled()
      version = await edit(id, (await load(id)).version, {
        part: 'takeaway',
        index: 0,
        text: FOUND,
      })
      ;({ version } = ok(await commands.approveBlogText(ED, id, version)))
      await settled()
      ;({ version } = await inReview(await renderedBlog({ id, version: (await load(id)).version })))
      ok(await commands.approveAndPublish(REV, id, version))
      const second = await publishedApproval(id)
      expect(second.id).not.toBe(first.id)

      const after = await store.liveBlogBySlug(slug)
      expect(after?.slug).toBe(slug)
      expect(after?.publishedAt).toBe(first.body.by.at)
      expect(after?.updatedAt).toBe(second.body.by.at)
      expect(Date.parse(after?.updatedAt ?? '')).toBeGreaterThan(Date.parse(before.updatedAt))
      expect(after?.takeaways[0]).toBe(FOUND)
      post = await load(id)
      const [still] = await db
        .select({ slug: schema.contentPost.slug })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, id))
      expect(still?.slug).toBe(slug)
      expect((await store.listLiveBlogSlugs()).find((r) => r.slug === slug)?.approvedAt).toBe(
        second.body.by.at,
      )
    },
    SLOW * 4,
  )

  test(
    'a live blog is in the sitemap at /blog/<slug>, last modified when it was published, and in the feed as a blog card under a chip it carries, not under another (BR10, BR11, criterion 81)',
    async () => {
      const { id, version } = await inReview(await renderedBlog())
      ok(await commands.approveAndPublish(REV, id, version))
      const approval = await publishedApproval(id)
      const [row] = await db
        .select({ slug: schema.contentPost.slug })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, id))
      const { SITE_URL } = await import('@/shared/lib/site')
      const { default: sitemap } = await import('@/app/sitemap')
      const url = new URL(`/blog/${row?.slug ?? '-'}`, SITE_URL).href
      expect((await sitemap()).filter((e) => e.url === url)).toEqual([
        { url, lastModified: approval.body.by.at },
      ])

      const feed = await import('../lib/feed')
      const { feedBlogOf } = await import('../lib/public-blog')
      const [posts, blogs] = await Promise.all([store.listLive(), store.liveBlogs()])
      const items = feed.feedOrder([...posts, ...blogs.map(feedBlogOf)], new Date())
      const chips = { destination: [], home: null, age: [], q: '' }
      const card = feed
        .applyFilters(items, { ...chips, theme: ['books-movies'] })
        .find((i) => i.id === id)
      expect(card && feed.isFeedBlog(card) ? card.cover?.assetId : null).toBeString()
      expect(card && feed.isFeedBlog(card) ? card.minutes : 0).toBeGreaterThan(0)
      expect(
        feed.applyFilters(items, { ...chips, theme: ['work-study-life'] }).some((i) => i.id === id),
      ).toBe(false)
    },
    SLOW * 2,
  )

  test(
    "a feed post refuses a blog's embedded slides as moved on",
    async () => {
      const feed = await renderedFeed()
      expect(
        await commands.embedPostSlides(ED, feed.id, feed.version, { postId: feed.id, at: 1 }),
      ).toEqual({ ok: false, error: errors.movedOn })
    },
    SLOW,
  )

  /** A blog published by a reviewer, with its slug. */
  async function liveBlog(at?: { id: string; version: number }) {
    const { id, version } = at ?? (await inReview(await renderedBlog()))
    const published = ok(await commands.approveAndPublish(REV, id, version))
    return { id, version: published.version, slug: await slugOfPost(id) }
  }

  async function slugOfPost(id: string): Promise<string> {
    const [row] = await db
      .select({ slug: schema.contentPost.slug })
      .from(schema.contentPost)
      .where(orm.eq(schema.contentPost.id, id))
    if (!row?.slug) throw new Error(`post ${id} has no slug`)
    return row.slug
  }

  /** The post's blog_link records, oldest first. */
  async function linkRecords(postId: string) {
    const rows = await db
      .select({ body: schema.contentArtifact.body })
      .from(schema.contentArtifact)
      .where(
        orm.and(
          orm.eq(schema.contentArtifact.postId, postId),
          orm.eq(schema.contentArtifact.kind, 'blog_link'),
        ),
      )
      .orderBy(schema.contentArtifact.createdAt)
    return rows.map((r) => r.body)
  }

  const refused = (error: string) => ({ ok: false as const, error })

  test(
    '"Make posts from this blog" starts a feed post whose source is the live blog\'s sections, each a part at the blog\'s address, linked to the blog, its ideas drawn from the sections; any number can be made; a blog not live, a feed post and a reviewer are refused (BR6)',
    async () => {
      const blog = await liveBlog()
      const read = await store.liveBlogBySlug(blog.slug)
      if (!read) throw new Error('the live blog does not read')
      const make = (actor = ED, id = blog.id, version = blog.version) => {
        const requestId = randomUUID()
        posts.push(requestId)
        return commands.makePostsFromBlog(actor, id, version, { requestId })
      }
      expect(await make(REV)).toEqual(refused(errors.notAuthorised))

      ideasData.length = 0
      const first = ok(await make())
      const post = await load(first.id)
      expect(post.kind).toBe('feed')
      expect(post.stage).toBe('structures')
      expect(await store.linkedBlogOf(first.id)).toBe(blog.id)
      const source = post.current.source?.body
      if (!source) throw new Error('no source')
      // Each section's body is a part, at the blog's public address, in the blog's order.
      expect(source.title).toBe(read.title)
      expect(source.parts?.length).toBe(read.sections.length)
      for (const [i, part] of (source.parts ?? []).entries()) {
        expect(part).toMatchObject({ url: blogUrl(blog.slug), title: read.title })
        const text = source.paragraphs.slice(part.from - 1, part.to).map((p) => p.text)
        expect(text.join('\n\n')).toBe(read.sections[i].body.trim())
      }
      const headings = read.sections.map((s) => s.heading)
      expect(source.blogSections).toEqual(headings)
      // Its idea cards, asked for from the sections.
      expect(post.current.ideas?.body.cards.length ?? 0).toBeGreaterThanOrEqual(2)
      expect(ideasData).toHaveLength(1)
      expect(ideasData[0]).toMatchObject({ kind: 'feed', from_blog_sections: headings })
      expect(await linkRecords(first.id)).toEqual([
        { kind: 'from_blog', blogId: blog.id, postId: first.id },
      ])

      // Again: another post, and the blog itself unchanged.
      const second = ok(await make())
      expect(second.id).not.toBe(first.id)
      expect(await store.linkedBlogOf(second.id)).toBe(blog.id)
      expect((await load(blog.id)).version).toBe(blog.version)

      // A blog not yet published has no address to cite; a feed post is not a blog.
      const draft = await newBlog()
      expect(await make(ED, draft.id, draft.version)).toEqual(refused(errors.blogNotLive))
      expect(await make(ED, first.id, (await load(first.id)).version)).toEqual(
        refused(errors.movedOn),
      )
    },
    SLOW * 3,
  )

  test(
    "a Nepali blog's outline and text carry its language, and a post made from it once live is in Nepali too (GD37)",
    async () => {
      const nepali = { id: 'ne', label: 'Nepali' }
      const requestId = randomUUID()
      posts.push(requestId)
      const made = ok(
        await commands.makePost(ED, { requestId, ...paidWork, postKind: 'blog', language: 'ne' }),
      )
      const { id } = made
      let { version } = ok(await commands.pickBlogAngle(ED, id, made.version, { card: 0 }))
      expect(outlineData.at(-1)).toMatchObject({ language: nepali })
      ok(await commands.writeBlog(ED, id, version))
      await settled()
      expect(textUsers.at(-1)).toContain('"language": {\n    "id": "ne",')
      // Its Devanagari sentences are found in the English source by meaning.
      ;({ version } = await load(id))
      const claims = (await load(id)).current.sourceCheck?.body.claims ?? []
      expect(claims.length).toBeGreaterThan(0)
      expect(claims.filter((c) => c.result === 'not_found')).toEqual([])
      ok(await commands.approveBlogText(ED, id, version))
      await settled()
      ;({ version } = await load(id))
      const blog = await liveBlog(await inReview(await renderedBlog({ id, version })))
      // Live, it reads in Nepali, for its page's language and its card's label (GD40).
      expect((await store.liveBlogById(id))?.language).toBe('ne')

      ideasData.length = 0
      const postId = randomUUID()
      posts.push(postId)
      const fromBlog = ok(
        await commands.makePostsFromBlog(ED, blog.id, blog.version, { requestId: postId }),
      )
      expect((await load(fromBlog.id)).current.source?.body.language).toBe('ne')
      expect(ideasData[0]).toMatchObject({ language: nepali })
    },
    SLOW * 3,
  )

  test(
    '"Make a blog" starts a blog with the post\'s source and facts, at its angles, and links the post; a reviewer and a blog are refused (BR8)',
    async () => {
      const feed = await renderedFeed()
      const before = await load(feed.id)
      expect(
        await commands.makeBlogFromPost(REV, feed.id, feed.version, { requestId: randomUUID() }),
      ).toEqual(refused(errors.notAuthorised))

      const requestId = randomUUID()
      posts.push(requestId)
      const made = ok(await commands.makeBlogFromPost(ED, feed.id, feed.version, { requestId }))
      expect(made.id).toBe(requestId)
      const blog = await load(made.id)
      expect(blog.kind).toBe('blog')
      expect(blog.stage).toBe('structures')
      expect(blog.current.source?.body).toEqual(before.current.source?.body)
      expect(blog.current.facts?.body.facts).toEqual(before.current.facts?.body.facts ?? [])
      expect(blog.current.facts?.body.sourceId).toBe(blog.current.source?.id ?? '-')
      // Its cards are blog angles: no format (an earlier blog on these facts may have asked already).
      const cards = blog.current.ideas?.body.cards ?? []
      expect(cards.length).toBeGreaterThanOrEqual(2)
      expect(cards.every((c) => c.format === undefined)).toBe(true)

      // The post is linked, and otherwise where it was.
      const post = await load(feed.id)
      expect(post.stage).toBe(before.stage)
      expect(post.pointers).toEqual(before.pointers)
      expect(await store.linkedBlogOf(feed.id)).toBe(made.id)
      expect(await linkRecords(feed.id)).toEqual([
        { kind: 'linked', blogId: made.id, postId: feed.id },
      ])

      // A blog is not made from a blog.
      expect(
        await commands.makeBlogFromPost(ED, made.id, blog.version, { requestId: randomUUID() }),
      ).toEqual(refused(errors.movedOn))
    },
    SLOW * 2,
  )

  test(
    'a post linked to a blog, draft or live, and unlinked writes a blog_link record each time; a reviewer, a blog id that is not a blog, and a blog as the post are refused (BR8)',
    async () => {
      const feed = await renderedFeed()
      const draft = await newBlog()
      let { version } = feed
      const link = (blogId: string | null, actor = ED) =>
        commands.linkToBlog(actor, feed.id, version, { blogId })

      expect(await link(draft.id, REV)).toEqual(refused(errors.notAuthorised))
      expect(await link(feed.id)).toEqual(refused(errors.notABlog))
      expect(await link('no-such-post')).toEqual(refused(errors.notABlog))
      expect(await linkRecords(feed.id)).toEqual([])
      expect((await load(feed.id)).version).toBe(version)

      ;({ version } = ok(await link(draft.id)))
      expect(await store.linkedBlogOf(feed.id)).toBe(draft.id)
      // The workbench's reads (Task 11): the blogs a post may link to, never a feed post, and a
      // blog's posts, each with whether students see it.
      const choices = await store.blogChoices()
      expect(choices.some((b) => b.id === draft.id)).toBe(true)
      expect(choices.some((b) => b.id === feed.id)).toBe(false)
      expect(await store.postsOfBlog(draft.id)).toEqual([
        { id: feed.id, title: (await load(feed.id)).title, live: false },
      ])
      ;({ version } = ok(await link(null)))
      expect(await store.linkedBlogOf(feed.id)).toBeNull()
      expect(await store.postsOfBlog(draft.id)).toEqual([])
      expect(await linkRecords(feed.id)).toEqual([
        { kind: 'linked', blogId: draft.id, postId: feed.id },
        { kind: 'unlinked', blogId: draft.id, postId: feed.id },
      ])

      // A blog is not linked to a blog.
      expect(await commands.linkToBlog(ED, draft.id, draft.version, { blogId: draft.id })).toEqual(
        refused(errors.movedOn),
      )
    },
    SLOW * 2,
  )

  test(
    'a linked post carries "Read the full guide" on its feed and public reads and at the end of its caption once its blog is live, not before and not once it is unpublished; the blog lists only its live posts under "From this guide" (BR7)',
    async () => {
      const blogAt = await inReview(await renderedBlog())
      const feed = await publish(await renderedFeed())
      const unpublished = await renderedFeed()
      let { version } = ok(
        await commands.linkToBlog(ED, feed.id, feed.version, { blogId: blogAt.id }),
      )
      ok(await commands.linkToBlog(ED, unpublished.id, unpublished.version, { blogId: blogAt.id }))
      const feedSlug = await slugOfPost(feed.id)

      /** A social version of the feed post, rendered: its caption as written. */
      async function caption() {
        const requestId = randomUUID()
        const adapted = ok(
          await social.adaptPost(ED, feed.id, version, {
            brandId: 'cerebral',
            platform: 'instagram',
            requestId,
          }),
        )
        const approved = ok(await social.approveLayout(ED, adapted.id, adapted.version))
        ok(await social.renderSocial(ED, adapted.id, approved.version))
        await settled()
        return (await load(adapted.id)).current.caption?.body.text ?? '-'
      }

      // The blog in review: no guide anywhere.
      expect((await store.liveById(feed.id))?.guide ?? null).toBeNull()
      expect((await store.liveBySlug(feedSlug))?.guide ?? null).toBeNull()
      expect(await caption()).not.toContain('Read the full guide')

      const blog = await liveBlog(blogAt)
      version = (await load(feed.id)).version
      const guide = { id: blog.id, slug: blog.slug }
      expect((await store.liveById(feed.id))?.guide).toEqual(guide)
      expect((await store.liveBySlug(feedSlug))?.guide).toEqual(guide)
      expect((await store.listLive()).find((p) => p.id === feed.id)?.guide).toEqual(guide)
      expect(await caption()).toEndWith(`\n\nRead the full guide: ${blogUrl(blog.slug)}`)

      // Only the live post is from this guide; the one never published is not.
      const read = await store.liveBlogBySlug(blog.slug)
      const live = await store.liveById(feed.id)
      expect(read?.posts).toEqual([{ id: feed.id, slug: feedSlug, title: live?.title ?? '-' }])

      // The blog unpublished: the guide line is hidden.
      await db
        .update(schema.contentPost)
        .set({ publishedApprovalId: null })
        .where(orm.eq(schema.contentPost.id, blog.id))
      expect((await store.liveById(feed.id))?.guide ?? null).toBeNull()
    },
    SLOW * 4,
  )
})
