// Every post command, called with its actor directly, against the development database (Docker,
// port 5433); off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/commands.test.ts
// The model layer is the fake provider (AI_PROVIDER=fake) on the real call log and cache. Every
// account here has an id starting `cc-` and is deleted after, with the posts it made (records and
// steps go with their post) and their call log rows. The image model name is this run's own, so
// art cached by an earlier run never answers this one, and its cache rows are deleted after.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { Provider } from '../ai/client'
import type { FeedSettings } from '../model/types'
import { canonicalJson, sha256Hex } from './hash'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '100000'
process.env.AI_DAILY_CAP_IMAGE = '100000'
process.env.AI_DAILY_CAP_SEARCH = '100000'
process.env.GEMINI_IMAGE_MODEL = `cc-imagen-${randomUUID()}`
// The text models too: every answer this run caches is its own, and is deleted after, so none
// answers the dev server or a later run with a different post's reply.
process.env.GEMINI_FLASH_MODEL = `cc-flash-${randomUUID()}`
process.env.GEMINI_PRO_MODEL = `cc-pro-${randomUUID()}`

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'cc-'
const SLOW = 60_000

const ED = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'CC ed' }
const BOTH = { id: `${P}both`, role: 'user', editor: true, reviewer: true, name: 'CC both' }
const REV = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'CC rev' }
const ADMIN = { id: `${P}admin`, role: 'admin', editor: false, reviewer: false, name: 'CC admin' }

const GENERAL = {
  layer: 'general' as const,
  audience: { mode: 'everyone' as const, rules: [] },
  whyLine: null,
  expiry: { kind: 'none' as const },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption' as const,
}

describe.skipIf(!enabled)('the post commands against the database', () => {
  let commands: typeof import('./commands')
  let store: typeof import('./store')
  let preview: typeof import('./preview')
  let steps: typeof import('./steps')
  let after: typeof import('./after')
  let pageError: string
  // A link that could not be read is listed with this, whatever the reason (GD19).
  const UNREAD = 'Could not read this page'
  let firstTemplate: string
  let errors: typeof import('../lib/workflow').WORKFLOW_ERRORS
  let unboundSlots: typeof import('../lib/claims').unboundSlots
  let paidWork: { title: string; kind: string; text: string }
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  /** While true, the image model answers a prompt marked [fake:fail-art] as if it were unmarked. */
  let artBack = false
  /** While set, the market model answers with this instead of the fake's answer. */
  let marketAnswer: ((data: unknown) => unknown) | null = null
  /** While set, the source check's judge answers with this instead of the fake's answer. */
  let judgeAnswer: ((data: unknown) => unknown) | null = null
  /** The claims the source check's judge was asked about, in order. */
  const judged: string[] = []
  /** While set, the draft model answers with the fake's answer changed by this. */
  let draftTweak: ((answer: DraftJson) => DraftJson) | null = null
  type DraftJson = { versions: { slides: { slots: { key: string; text: string }[] }[] }[] }
  /** The DATA of every slide call that reached the model, in order. */
  const slideData: unknown[] = []
  /** While set, the slide model answers with the fake's answer changed by this. */
  let slideTweak: ((answer: SlideJson) => SlideJson) | null = null
  type SlideJson = { slots: { key: string; text: string }[] }
  /** How many extraction calls reached the model. */
  let extractCalls = 0
  /** The DATA of every extraction and draft call that reached the model, in order. */
  const extractData: unknown[] = []
  const draftData: unknown[] = []
  /** While true, every draft call fails as the model would. */
  let draftFails = false
  /** While true, every outline call fails as the model would. */
  let outlineFails = false
  /** The DATA of every outline call that reached the model, in order. */
  const outlineData: unknown[] = []
  /** While set, each draft request waits for it first, as a test looks at the post mid-draft. */
  let duringDraft: (() => Promise<void>) | null = null
  /** The DATA of every ideas call that reached the model, in order. */
  const ideasData: unknown[] = []
  /** While true, the ideas model answers a source marked [fake:fail-ideas] as if it were unmarked. */
  let ideasBack = false
  /** The work the commands left to run after their response (./after.ts), not yet awaited. */
  const background: Promise<unknown>[] = []
  /** Waits for every read-back the commands left running, as the page waits by polling. */
  async function settled() {
    while (background.length > 0) await background.shift()
  }
  const runAtOnce = (task: () => Promise<unknown>) => {
    background.push(task())
  }
  /** The use case of every search that reached the model, in order (BR12, BR14). */
  const searches: string[] = []
  /** While set, a research search answers with the fake's answer changed by this (BR14). */
  let researchTweak: ((answer: ResearchJson) => ResearchJson) | null = null
  type ResearchJson = { sources: { title: string; site: string; sentence: string }[] }
  let artPromptError: string
  let emotionError: string
  let aiFailed: string
  const posts: string[] = []

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.createdByUserId, `${P}%`))
    if (posts.length > 0) {
      await db.delete(schema.aiCall).where(orm.inArray(schema.aiCall.postId, posts))
    }
    await db.delete(schema.aiCache).where(orm.like(schema.aiCache.model, 'cc-%'))
    // A search for an idea belongs to no post: its call is this run's by its model.
    await db.delete(schema.aiCall).where(orm.like(schema.aiCall.model, 'cc-%'))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  function ok<T extends { ok: boolean }>(res: T): Extract<T, { ok: true }> {
    if (!res.ok) throw new Error((res as unknown as { error: string }).error)
    return res as Extract<T, { ok: true }>
  }

  /** A command that saves a render, once its read-back has run, at the post's version after it. */
  async function done(command: Promise<{ ok: boolean }>): Promise<{ id: string; version: number }> {
    const { id } = ok(await command) as unknown as { id: string }
    await settled()
    return { id, version: (await load(id)).version }
  }

  async function load(id: string) {
    const post = await store.loadPost(id)
    if (!post) throw new Error(`post ${id} missing`)
    return post
  }

  async function start(
    actor: typeof ED,
    source: { title: string; kind: string; text: string } = paidWork,
  ) {
    const requestId = randomUUID()
    posts.push(requestId)
    return ok(await commands.startFeedPost(actor, { requestId, ...source }))
  }

  /**
   * Forgets the Nepal answers this run cached. A test that sets marketAnswer caches its answer
   * under the same prompt as any other post with the same slots, which would then get it too.
   */
  async function forgetMarketAnswers() {
    await db
      .delete(schema.aiCache)
      .where(
        orm.and(orm.eq(schema.aiCache.useCase, 'market'), orm.like(schema.aiCache.model, 'cc-%')),
      )
  }

  /** A post at structures with one template drafted, picked and themed. */
  async function picked(actor: typeof ED, templateId: string, source = paidWork) {
    let { id, version } = await start(actor, source)
    ;({ version } = ok(await commands.tickTemplates(actor, id, version, [templateId])))
    ;({ version } = ok(await commands.draftPost(actor, id, version, false)))
    ;({ version } = ok(await commands.pickStructure(actor, id, version, 0)))
    ;({ version } = ok(await commands.chooseTheme(actor, id, version, 'paper')))
    return { id, version }
  }

  /**
   * A post at structures with nothing picked: every version the drafting made kept a banned
   * phrase, and such a version is never picked (criterion 97), not even for the editor.
   */
  async function nonePicked() {
    // A source of its own, so no clean cached answer stands in for the tweaked one.
    let { id, version } = await start(ED, {
      ...paidWork,
      text: `${paidWork.text}\n\nCc none picked ${randomUUID()}.`,
    })
    ;({ version } = ok(await commands.tickTemplates(ED, id, version, ['the-line'])))
    draftTweak = (answer) => {
      for (const v of answer.versions) v.slides[0].slots[0].text = 'The best research'
      return answer
    }
    try {
      ;({ version } = ok(await commands.draftPost(ED, id, version, false)))
    } finally {
      draftTweak = null
    }
    expect((await load(id)).pointers.picked).toBeNull()
    return { id, version }
  }

  async function approved(actor: typeof ED, templateId: string, source = paidWork) {
    const { id, version } = await picked(actor, templateId, source)
    return ok(await commands.approveStructure(actor, id, version))
  }

  async function rendered(actor: typeof ED, source = paidWork) {
    const { id, version } = await approved(actor, 'the-line', source)
    return await done(commands.renderPost(actor, id, version))
  }

  /** A rendered the-line post, its not-found claims marked opinion, sent to review. */
  async function inReview(actor: typeof ED, settings: FeedSettings = GENERAL, source = paidWork) {
    let { id, version } = await rendered(actor, source)
    ;({ version } = ok(await commands.saveSettings(actor, id, version, settings)))
    const claims = (await load(id)).current.sourceCheck?.body.claims ?? []
    for (const [i, claim] of claims.entries()) {
      if (claim.result === 'not_found') {
        ;({ version } = ok(await commands.markOpinion(actor, id, version, i)))
      }
    }
    return ok(await commands.sendToReview(actor, id, version))
  }

  beforeAll(async () => {
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')

    // The fake provider on the real call log and cache, with a switch for the image model.
    const client = await import('../ai/client')
    const { aiConfig } = await import('../ai/config')
    const { makeFake } = await import('../ai/fake')
    const { dbCallLog } = await import('../ai/calls')
    const { dbCache } = await import('../ai/cache')
    const fake = makeFake()
    const unmark = (text: string) => (artBack ? text.replaceAll('[fake:fail-art]', '') : text)
    // The fake draws every image alike; a prompt marked [cc:blue] gets other pixels, so a
    // regenerated cover can be told from the first.
    const { Resvg } = await import('@resvg/resvg-js')
    const blue = new Uint8Array(
      new Resvg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#336699"/></svg>',
      )
        .render()
        .asPng(),
    )
    const provider: Provider = {
      json: async (req) => {
        if (req.useCase === 'draft') draftData.push(req.data)
        if (req.useCase === 'draft' && duringDraft) await duringDraft()
        if (req.useCase === 'extract') {
          extractCalls++
          extractData.push(req.data)
          // Long enough for a second submit to arrive while the first is still extracting.
          await new Promise((r) => setTimeout(r, 50))
        }
        if (req.useCase === 'source_check') {
          judged.push((req.data as { claim: string }).claim)
          if (judgeAnswer) return JSON.stringify(judgeAnswer(req.data))
        }
        if (req.useCase === 'ideas') {
          ideasData.push(req.data)
          if (ideasBack) {
            const unmarked = JSON.stringify(req.data).replaceAll('[fake:fail-ideas]', '')
            return fake.json({ ...req, data: JSON.parse(unmarked) })
          }
        }
        if (req.useCase === 'draft_slide') {
          slideData.push(req.data)
          if (slideTweak) {
            return JSON.stringify(slideTweak(JSON.parse(await fake.json(req)) as SlideJson))
          }
        }
        if (req.useCase === 'draft' && draftFails) throw new Error('cc: the draft model fails')
        if (req.useCase === 'outline') {
          outlineData.push(req.data)
          if (outlineFails) throw new Error('cc: the outline model fails')
        }
        if (req.useCase === 'draft' && draftTweak) {
          return JSON.stringify(draftTweak(JSON.parse(await fake.json(req)) as DraftJson))
        }
        return req.useCase === 'market' && marketAnswer
          ? JSON.stringify(marketAnswer(req.data))
          : fake.json(req)
      },
      search: async (req) => {
        searches.push(req.useCase)
        const search = fake.search
        if (!search) throw new Error('the fake has no search')
        const answer = await search(req)
        if (req.useCase !== 'research_claim' || !researchTweak) return answer
        return { ...answer, text: JSON.stringify(researchTweak(JSON.parse(answer.text))) }
      },
      image: async (req) =>
        req.prompt.includes('[cc:blue]')
          ? blue
          : fake.image({
              ...req,
              prompt: unmark(req.prompt),
              data: JSON.parse(unmark(JSON.stringify(req.data))),
            }),
    }
    const ai = client.makeAi({
      provider,
      config: aiConfig(process.env),
      calls: dbCallLog,
      cache: dbCache,
    })
    mock.module('../ai/client', () => ({ ...client, ai }))

    commands = await import('./commands')
    store = await import('./store')
    preview = await import('./preview')
    steps = await import('./steps')
    after = await import('./after')
    // No request here for after(): run each task at once, and keep it to await.
    after.scheduleWith(runAtOnce)
    ;({ PAGE_ERROR: pageError } = await import('./fetch-page'))
    firstTemplate = (await import('../templates')).TEMPLATES[0].id
    ;({ WORKFLOW_ERRORS: errors } = await import('../lib/workflow'))
    ;({ unboundSlots } = await import('../lib/claims'))
    ;({ ART_PROMPT_ERROR: artPromptError } = await import('../ai/draft'))
    ;({ EMOTION_ERROR: emotionError } = await import('../emotions'))
    aiFailed = (await import('../ai/client')).AI_ERRORS.failed
    const { DEMO_SOURCES } = await import('../demo-sources')
    const demo = DEMO_SOURCES.find((s) => s.key === 'paid-work')
    if (!demo) throw new Error('demo source missing')
    paidWork = { title: demo.title, kind: demo.kind, text: demo.text }

    await cleanUp()
    await db.insert(schema.user).values(
      [ED, BOTH, REV, ADMIN].map((a) => ({
        id: a.id,
        name: a.name,
        email: `${a.id}@cc.e2e.test`,
        role: a.role as 'user' | 'admin',
        editor: a.editor,
        reviewer: a.reviewer,
      })),
    )
  })

  afterAll(cleanUp)

  test(
    'startFeedPost on paid-work stores five paragraphs at structures, and a second submit returns the same post (22)',
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const input = { requestId, ...paidWork }
      const first = ok(await commands.startFeedPost(ED, input))
      expect(first.id).toBe(requestId)
      const post = await load(first.id)
      expect(post.stage).toBe('structures')
      expect(post.current.source?.body.paragraphs).toHaveLength(5)
      expect(post.current.facts?.body.facts.length).toBeGreaterThan(0)

      const again = await commands.startFeedPost(ED, input)
      expect(again).toEqual({ ok: true, id: first.id, version: first.version })
      const rows = await db
        .select({ id: schema.contentPost.id })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, requestId))
      expect(rows).toHaveLength(1)
    },
    SLOW,
  )

  test(
    'two overlapping submits with one request id extract once and make one post',
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      // A text of its own, so no cached answer from another test serves either call.
      const input = {
        requestId,
        ...paidWork,
        text: `${paidWork.text}

Run ${requestId}`,
      }
      const before = extractCalls
      const results = await Promise.all([
        commands.startFeedPost(ED, input),
        commands.startFeedPost(ED, input),
      ])
      expect(extractCalls - before).toBe(1)
      expect(results.filter((r) => r.ok)).toHaveLength(1)
      expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: errors.running }])
      const rows = await db
        .select({ id: schema.contentPost.id })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, requestId))
      expect(rows).toHaveLength(1)
      expect((await load(requestId)).stage).toBe('structures')
    },
    SLOW,
  )

  test('a failed extraction leaves no post behind, so the same request can try again (5)', async () => {
    const requestId = randomUUID()
    posts.push(requestId)
    const failing = {
      requestId,
      ...paidWork,
      text: `${paidWork.text}

[fake:fail-extract]`,
    }
    const res = await commands.startFeedPost(ED, failing)
    expect(res.ok).toBe(false)
    expect(await store.loadPost(requestId)).toBeNull()
  })

  /** A page reader that answers `answer` and records each link it is given. */
  function reader(answer: import('./fetch-page').PageResult) {
    const reads: string[] = []
    const read = async (url: string) => {
      reads.push(url)
      return answer
    }
    return { reads, read }
  }
  const LINK = 'https://www.campustimes.example/news/paid-work'

  /** The post's idea cards record (GD1), which its pointers name. */
  async function ideasOf(id: string) {
    const post = await load(id)
    const record = post.pointers.ideasId ? await store.loadRecord(id, post.pointers.ideasId) : null
    if (record?.kind !== 'ideas') throw new Error(`post ${id} has no ideas`)
    return record.body as import('../model/artifacts').Body<'ideas'>
  }

  /** A post just made, at its idea cards. */
  async function atIdeas(source = paidWork) {
    const requestId = randomUUID()
    posts.push(requestId)
    ok(await commands.makePost(ED, { requestId, ...source }))
    await settled()
    return load(requestId)
  }

  /** The post's first idea card outlined (GD32), with no versions yet. */
  async function outlined(id: string, cards = [0]) {
    const { version } = await load(id)
    ok(await commands.pickIdeas(ED, id, version, { cards }))
    return load(id)
  }

  /** The post's versions drafted for its first idea card (GD2), written to its outline (GD32). */
  async function drafted(id: string, cards = [0]) {
    const { version } = await outlined(id, cards)
    ok(await commands.writeSlides(ED, id, version))
    return load(id)
  }

  test(
    'makePost runs extraction, then the idea cards, and stops at them with no versions drafted (GD1)',
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const drafts = draftData.length
      const made = ok(await commands.makePost(ED, { requestId, ...paidWork }))
      await settled()
      expect(made.id).toBe(requestId)
      const post = await load(requestId)
      expect(made.version).toBe(post.version)
      expect(post.stage).toBe('structures')
      expect(post.current.facts?.body.facts.length).toBeGreaterThan(0)
      expect(post.current.drafts).toBeNull()
      expect(post.pointers.draftsId).toBeNull()
      expect(draftData.length).toBe(drafts)
      const ideas = await ideasOf(requestId)
      expect(ideas.factsId).toBe(post.pointers.factsId as string)
      expect(ideas.cards).toHaveLength(4)
      expect(ideas.rounds).toBe(1)
      expect(await steps.runningSteps(requestId)).toEqual([])
      expect(await steps.failedSteps(requestId)).toEqual([])
    },
    SLOW,
  )

  test(
    'makePost from an idea with no links stores each sentence of the idea as a supported fact without asking the model, and its slides draft from them (bug, 18 Oct)',
    async () => {
      const { IDEA_KIND } = await import('../model/artifacts')
      const requestId = randomUUID()
      posts.push(requestId)
      // A run of its own, so no answer cached by another test serves its ideas or drafts.
      const said = [
        'Do not always push yourself.',
        `Enjoy what we have right now, cc ${requestId}.`,
      ]
      const idea = said.join(' ')
      const before = extractCalls
      ok(
        await commands.makePost(ED, {
          requestId,
          links: [],
          title: idea,
          kind: IDEA_KIND,
          text: idea,
        }),
      )
      await settled()
      expect(extractCalls).toBe(before)
      let post = await load(requestId)
      expect(post.current.source?.body.kind).toBe(IDEA_KIND)
      expect(
        post.current.facts?.body.facts.map((f) => [f.id, f.text, f.quote, f.supported]),
      ).toEqual([
        ['f1', said[0], said[0], true],
        ['f2', said[1], said[1], true],
      ])
      expect((await ideasOf(requestId)).cards.length).toBeGreaterThan(0)

      post = await drafted(requestId)
      expect(post.current.drafts?.body.items).toHaveLength(3)
      expect(await steps.failedSteps(requestId)).toEqual([])
    },
    SLOW,
  )

  test(
    'a [fake:fail-ideas] source keeps the source and facts, shows the ideas step failed, and Try again makes the cards (GD1, 93)',
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const text = `${paidWork.text}\n\nRun ${requestId} [fake:fail-ideas]`
      const made = ok(await commands.makePost(ED, { requestId, ...paidWork, text }))
      let post = await load(requestId)
      expect(made.version).toBe(post.version)
      expect(post.stage).toBe('structures')
      expect(post.current.source).not.toBeNull()
      expect(post.current.facts?.body.facts.length).toBeGreaterThan(0)
      expect(post.pointers.ideasId).toBeNull()
      expect(post.current.drafts).toBeNull()
      expect(await steps.failedSteps(requestId)).toEqual(['ideas'])

      ideasBack = true
      try {
        ok(await commands.moreIdeas(ED, requestId, post.version))
      } finally {
        ideasBack = false
      }
      post = await load(requestId)
      expect((await ideasOf(requestId)).cards).toHaveLength(4)
      expect(await steps.failedSteps(requestId)).toEqual([])
    },
    SLOW,
  )

  test(
    "picking card 2 outlines that idea slide by slide in its card's look, and drafts nothing (GD32)",
    async () => {
      const post = await atIdeas()
      const { cards } = await ideasOf(post.id)
      const before = { drafts: draftData.length, outlines: outlineData.length }
      ok(await commands.pickIdeas(ED, post.id, post.version, { cards: [1] }))
      const after = await load(post.id)
      expect(after.stage).toBe('structures')
      expect(after.current.drafts).toBeNull()
      expect(after.pointers.draftsId).toBeNull()
      expect(draftData.length).toBe(before.drafts)
      const outline = after.current.outline?.body
      expect(outline?.factsId).toBe(after.pointers.factsId as string)
      expect(outline?.ideas).toEqual([cards[1]])
      expect(cards[1].format).toBeDefined()
      expect(outline?.format).toBe(cards[1].format ?? null)
      expect(outline?.note).toBe('Outlined')
      const { outlineShape } = await import('../lib/outline')
      const { templateById } = await import('../templates')
      const look = templateById(cards[1].look)
      if (!look) throw new Error('no look')
      expect(
        outlineShape(
          look,
          (outline?.slides ?? []).map((s) => s.layout),
        ),
      ).toEqual([])
      const sent = outlineData.slice(before.outlines)
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({
        look: { id: cards[1].look },
        idea: { combine: false, cards: [{ angle: cards[1].angle, hook: cards[1].hook }] },
      })
      // The cards stay, for "Back to ideas".
      expect(after.pointers.ideasId).toBe(post.pointers.ideasId)
      expect(await steps.failedSteps(post.id)).toEqual([])
    },
    SLOW,
  )

  test(
    "writing the slides drafts three versions in the card's look that follow the outline: its slides, in order, in its layouts (GD2, GD32)",
    async () => {
      const post = await outlined((await atIdeas()).id, [1])
      const { cards } = await ideasOf(post.id)
      const outline = post.current.outline?.body
      if (!outline) throw new Error('no outline')
      const before = draftData.length
      ok(await commands.writeSlides(ED, post.id, post.version))
      const after = await load(post.id)
      const drafts = after.current.drafts?.body
      expect(drafts?.items).toHaveLength(3)
      for (const item of drafts?.items ?? []) {
        expect(item.template.id).toBe(cards[1].look)
        expect(item.structure.slides.map((s) => s.layout)).toEqual(
          outline.slides.map((s) => s.layout),
        )
        expect(item.problems).toEqual([])
      }
      expect(drafts?.idea).toEqual({ cards: [cards[1]] })
      // Version A and Pop are chosen for the editor, so nothing waits on a choice nobody made.
      expect(after.pointers).toMatchObject({ picked: 0, themeId: 'pop' })
      const sent = draftData.slice(before)
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({
        idea: { combine: false, cards: [{ angle: cards[1].angle, hook: cards[1].hook }] },
        outline: {
          format: cards[1].format,
          slides: outline.slides.map((s, i) => ({ slide: i + 1, ...s })),
        },
      })
      // The outline stays, passed, for the Outline step.
      expect(after.pointers.outlineId).toBe(post.pointers.outlineId)
    },
    SLOW,
  )

  test(
    'editPostOutline moves, adds, removes and changes slides, each saved as a new outline with its note; the drafts follow the edited outline (GD32)',
    async () => {
      let post = await outlined((await atIdeas()).id)
      const ideas = post.current.outline?.body.ideas
      const first = post.current.outline?.body.slides ?? []
      expect(first.map((s) => s.layout)).toEqual([
        'cover',
        'picture',
        'picture',
        'picture',
        'takeaway',
      ])
      const edit = async (op: import('../lib/outline').OutlineOp) => {
        ok(await commands.editPostOutline(ED, post.id, post.version, op))
        post = await load(post.id)
        return post.current.outline?.body
      }
      let body = await edit({
        op: 'add',
        at: 5,
        slide: { job: 'step', layout: 'checklist', point: ' Plan your shifts around study. ' },
      })
      expect(body?.slides[4]).toEqual({
        job: 'step',
        layout: 'checklist',
        point: 'Plan your shifts around study.',
      })
      expect(body?.note).toBe('Slide added')
      body = await edit({ op: 'change', slide: 3, layout: 'number', job: 'proof' })
      expect(body?.slides[2]).toMatchObject({ job: 'proof', layout: 'number' })
      expect(body?.note).toBe('Slide 3 changed')
      body = await edit({ op: 'move', slide: 5, to: 2 })
      expect(body?.slides[1].layout).toBe('checklist')
      expect(body?.note).toBe('Slide 5 moved')
      body = await edit({ op: 'remove', slide: 4 })
      expect(body?.slides.map((s) => s.layout)).toEqual([
        'cover',
        'checklist',
        'picture',
        'picture',
        'takeaway',
      ])
      expect(body?.note).toBe('Slide 4 removed')
      // The cards, the facts and the format stay.
      expect(body?.ideas).toEqual(ideas as never)
      expect(body?.factsId).toBe(post.pointers.factsId as string)
      expect(body?.format).toBe(ideas?.[0].format ?? null)
      expect(post.current.drafts).toBeNull()

      ok(await commands.writeSlides(ED, post.id, post.version))
      const items = (await load(post.id)).current.drafts?.body.items ?? []
      expect(items).toHaveLength(3)
      for (const item of items) {
        expect(item.structure.slides.map((s) => s.layout)).toEqual(
          (body?.slides ?? []).map((s) => s.layout),
        )
      }
    },
    SLOW,
  )

  test(
    'the first cards carry a format each and the three formats ranked best; More ideas keeps those three (GD33)',
    async () => {
      // A source of its own, so its More ideas answers no other test's from the cache.
      const own = { ...paidWork, text: `${paidWork.text}\n\nCc formats ${randomUUID()}.` }
      const post = await atIdeas(own)
      const first = await ideasOf(post.id)
      const { FORMAT_IDS } = await import('../model/types')
      expect(first.formats).toHaveLength(3)
      for (const card of first.cards) expect(FORMAT_IDS).toContain(card.format as never)
      expect(first.cards[0].format).toBe(first.formats?.[0] as never)
      ok(await commands.moreIdeas(ED, post.id, post.version))
      const more = await ideasOf(post.id)
      expect(more.cards.length).toBeGreaterThan(first.cards.length)
      expect(more.formats).toEqual(first.formats)
    },
    SLOW,
  )

  test(
    'changing the format outlines the idea again in it, one call each press and never the cached first answer; versions written before are set aside (GD33)',
    async () => {
      // A source of its own, so no earlier run's outlines answer these from the cache.
      const own = { ...paidWork, text: `${paidWork.text}\n\nCc format change ${randomUUID()}.` }
      let post = await drafted((await atIdeas(own)).id)
      const ideas = post.current.outline?.body.ideas
      const cardFormat = ideas?.[0].format
      if (!cardFormat) throw new Error('the card has no format')
      expect(post.current.drafts).not.toBeNull()
      const change = async (format: string) => {
        const before = outlineData.length
        ok(await commands.setOutlineFormat(ED, post.id, post.version, { format }))
        post = await load(post.id)
        return { calls: outlineData.slice(before) as { format: { id: string } | null }[] }
      }
      let { calls } = await change('then-vs-now')
      expect(calls.map((d) => d.format?.id)).toEqual(['then-vs-now'])
      let body = post.current.outline?.body
      expect(body?.format).toBe('then-vs-now')
      expect(body?.note).toBe('Format: Then vs now (timeline)')
      expect(body?.ideas).toEqual(ideas as never)
      expect(post.current.drafts).toBeNull()
      expect(post.pointers.picked).toBeNull()
      expect(post.stage).toBe('structures')
      // The same format again, and back to the card's: each is outlined again, not read back.
      ;({ calls } = await change('then-vs-now'))
      expect(calls).toHaveLength(1)
      ;({ calls } = await change(cardFormat))
      expect(calls.map((d) => d.format?.id)).toEqual([cardFormat])
      body = post.current.outline?.body
      expect(body?.format).toBe(cardFormat)
      expect(body?.attempt).toBe(4)
    },
    SLOW,
  )

  test(
    'a format the file does not have, or a post with no outline, is refused before any call, and nothing moves (GD33)',
    async () => {
      const post = await outlined((await atIdeas()).id)
      const calls = outlineData.length
      for (const format of ['listicle', '', 'Myth vs fact']) {
        expect(await commands.setOutlineFormat(ED, post.id, post.version, { format })).toEqual({
          ok: false,
          error: errors.format,
        })
      }
      const bare = await atIdeas()
      expect(
        await commands.setOutlineFormat(ED, bare.id, bare.version, { format: 'then-vs-now' }),
      ).toEqual({ ok: false, error: errors.movedOn })
      expect(outlineData.length).toBe(calls)
      expect((await load(post.id)).version).toBe(post.version)
    },
    SLOW,
  )

  test(
    'an outline edit the look does not take, a slide that is not there or an empty point is refused, and nothing moves (GD32)',
    async () => {
      const post = await outlined((await atIdeas()).id)
      const { OUTLINE_ERRORS } = await import('../lib/outline')
      for (const [op, error] of [
        [{ op: 'remove', slide: 2 }, 'A Field Notes post has 5 to 7 slides.'],
        [
          { op: 'change', slide: 2, layout: 'takeaway' },
          'Field Notes takes 3 to 5 middle slides; this outline has 2.',
        ],
        [
          { op: 'move', slide: 1, to: 3 },
          "Keep the slides in the look's order: cover, then middle, then takeaway.",
        ],
        [{ op: 'remove', slide: 9 }, OUTLINE_ERRORS.slide],
        [{ op: 'change', slide: 2, point: '  ' }, OUTLINE_ERRORS.point],
      ] as const) {
        expect(await commands.editPostOutline(ED, post.id, post.version, op)).toEqual({
          ok: false,
          error,
        })
      }
      expect((await load(post.id)).version).toBe(post.version)
    },
    SLOW,
  )

  test(
    'an outline edit after the slides are written puts the post back at its outline with no versions, and a post with no outline cannot be edited or written (GD32, GD28)',
    async () => {
      const post = await drafted((await atIdeas()).id)
      expect(post.current.drafts).not.toBeNull()
      ok(
        await commands.editPostOutline(ED, post.id, post.version, {
          op: 'change',
          slide: 2,
          point: 'A sharper point.',
        }),
      )
      const after = await load(post.id)
      expect(after.stage).toBe('structures')
      expect(after.current.drafts).toBeNull()
      expect(after.pointers.picked).toBeNull()
      expect(after.current.outline?.body.slides[1].point).toBe('A sharper point.')

      const bare = await atIdeas()
      expect(await commands.writeSlides(ED, bare.id, bare.version)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      expect(
        await commands.editPostOutline(ED, bare.id, bare.version, { op: 'remove', slide: 2 }),
      ).toEqual({ ok: false, error: errors.movedOn })
    },
    SLOW,
  )

  test(
    'while versions are drafted the draft step says how many: three for an idea, three per ticked template',
    async () => {
      // A source of its own, so no versions an earlier test drafted answer from the cache.
      const post = await atIdeas({
        ...paidWork,
        text: `${paidWork.text}

Cc idea drafting count ${randomUUID()}.`,
      })
      const seen: unknown[] = []
      let watching = post.id
      duringDraft = async () => {
        seen.push(await steps.runningNow(watching))
      }
      const { version: at } = ok(
        await commands.pickIdeas(ED, post.id, post.version, { cards: [0] }),
      )
      try {
        ok(await commands.writeSlides(ED, post.id, at))
        let { id, version } = await start(ED, {
          ...paidWork,
          text: `${paidWork.text}

Cc drafting count paragraph.`,
        })
        watching = id
        ;({ version } = ok(
          await commands.tickTemplates(ED, id, version, ['the-line', 'the-question']),
        ))
        ok(await commands.draftPost(ED, id, version, false))
      } finally {
        duringDraft = null
      }
      const drafting = (total: number) => ({
        running: ['draft'],
        progress: { draft: { done: 0, total } },
      })
      expect(seen).toEqual([drafting(3), drafting(6), drafting(6)])
    },
    SLOW,
  )

  test(
    "combining two cards outlines and drafts in the first card's look with both ideas passed to combine (GD2, GD32)",
    async () => {
      const post = await atIdeas()
      const { cards } = await ideasOf(post.id)
      const before = draftData.length
      const outlines = outlineData.length
      await drafted(post.id, [3, 0])
      const after = await load(post.id)
      expect(after.current.outline?.body.ideas).toEqual([cards[3], cards[0]])
      expect(outlineData.slice(outlines)).toMatchObject([{ idea: { combine: true } }])
      const drafts = after.current.drafts?.body
      expect(drafts?.items.map((i) => i.template.id)).toEqual(Array(3).fill(cards[3].look))
      expect(drafts?.idea).toEqual({ cards: [cards[3], cards[0]] })
      const [sent] = draftData.slice(before) as { idea: { combine: boolean; cards: object[] } }[]
      expect(sent.idea.combine).toBe(true)
      expect(sent.idea.cards).toEqual([
        { angle: cards[3].angle, hook: cards[3].hook, audience: cards[3].audience },
        { angle: cards[0].angle, hook: cards[0].hook, audience: cards[0].audience },
      ])
    },
    SLOW,
  )

  test(
    'combining four cards outlines all four in the first card’s look (GD2)',
    async () => {
      const post = await atIdeas()
      const { cards } = await ideasOf(post.id)
      const outlines = outlineData.length
      await outlined(post.id, [2, 0, 1, 3])
      const after = await load(post.id)
      expect(after.current.outline?.body.ideas).toEqual([cards[2], cards[0], cards[1], cards[3]])
      expect(outlineData.slice(outlines)).toMatchObject([{ idea: { combine: true } }])
    },
    SLOW,
  )

  test(
    'a failed draft after "Write the slides" saves nothing and shows the draft step failed; Try again drafts for the same idea (93, GD32)',
    async () => {
      const post = await outlined((await atIdeas()).id, [2])
      const { cards } = await ideasOf(post.id)
      draftFails = true
      try {
        expect(await commands.writeSlides(ED, post.id, post.version)).toEqual({
          ok: false,
          error: aiFailed,
        })
      } finally {
        draftFails = false
      }
      const failed = await load(post.id)
      expect(failed.version).toBe(post.version)
      expect(failed.current.drafts).toBeNull()
      expect(failed.current.outline).not.toBeNull()
      expect(failed.current.facts).not.toBeNull()
      expect(await steps.failedSteps(post.id)).toEqual(['draft'])

      // "Try again" writes the same outline at the same version.
      ok(await commands.writeSlides(ED, post.id, failed.version))
      const drafts = (await load(post.id)).current.drafts?.body
      expect(drafts?.items).toHaveLength(3)
      expect(drafts?.idea).toEqual({ cards: [cards[2]] })
      expect(drafts?.items.every((i) => i.template.id === cards[2].look)).toBe(true)
      expect(await steps.failedSteps(post.id)).toEqual([])
    },
    SLOW,
  )

  test(
    'a failed outline after "Use this idea" saves nothing, keeps the cards and shows the outline step failed; Try again outlines it (93, GD32)',
    async () => {
      const post = await atIdeas({
        ...paidWork,
        text: `${paidWork.text}\n\nCc outline fails ${randomUUID()}.`,
      })
      outlineFails = true
      try {
        expect(await commands.pickIdeas(ED, post.id, post.version, { cards: [0] })).toEqual({
          ok: false,
          error: aiFailed,
        })
      } finally {
        outlineFails = false
      }
      const failed = await load(post.id)
      expect(failed.version).toBe(post.version)
      expect(failed.current.outline).toBeNull()
      expect(failed.current.ideas?.id).toBe(post.current.ideas?.id as string)
      expect(await steps.failedSteps(post.id)).toEqual(['outline'])

      ok(await commands.pickIdeas(ED, post.id, failed.version, { cards: [0] }))
      expect((await load(post.id)).current.outline).not.toBeNull()
      expect(await steps.failedSteps(post.id)).toEqual([])
    },
    SLOW,
  )

  test('picking no card, five cards, the same card twice or one that is not there is refused, and nothing moves (GD2)', async () => {
    const post = await atIdeas()
    for (const cards of [[], [0, 1, 2, 3, 0], [1, 1], [4], [-1], [0.5]]) {
      expect(await commands.pickIdeas(ED, post.id, post.version, { cards })).toEqual({
        ok: false,
        error: errors.ideas,
      })
    }
    expect((await load(post.id)).version).toBe(post.version)
  })

  test(
    'More ideas keeps the cards shown and adds up to four new ones, told which hooks to avoid (GD3)',
    async () => {
      const post = await atIdeas()
      const first = await ideasOf(post.id)
      const before = ideasData.length
      ok(await commands.moreIdeas(ED, post.id, post.version))
      const more = await ideasOf(post.id)
      expect(more.rounds).toBe(2)
      expect(more.cards.slice(0, first.cards.length)).toEqual(first.cards)
      const added = more.cards.slice(first.cards.length)
      expect(added.length).toBeGreaterThan(0)
      expect(added.length).toBeLessThanOrEqual(4)
      // The first cards' top three stay the only ones recommended (GD29).
      expect(first.cards.map((c) => c.recommended)).toEqual([true, true, true, false])
      for (const card of added) expect(card.recommended).toBe(false)
      const shown = first.cards.map((c) => c.hook)
      for (const card of added) expect(shown).not.toContain(card.hook)
      const sent = ideasData.slice(before) as { avoid: string[] }[]
      expect(sent).toHaveLength(1)
      expect(sent[0].avoid).toEqual(shown)
    },
    SLOW,
  )

  test(
    "a reviewer's or an admin's pick, More ideas, outline edit or Write the slides is refused, and nothing moves (GD1–GD3, GD32)",
    async () => {
      const post = await outlined((await atIdeas()).id)
      const calls = {
        ideas: ideasData.length,
        drafts: draftData.length,
        outlines: outlineData.length,
      }
      const refused = { ok: false as const, error: errors.notAuthorised }
      for (const actor of [REV, ADMIN]) {
        expect(await commands.pickIdeas(actor, post.id, post.version, { cards: [0] })).toEqual(
          refused,
        )
        expect(await commands.moreIdeas(actor, post.id, post.version)).toEqual(refused)
        expect(
          await commands.editPostOutline(actor, post.id, post.version, {
            op: 'change',
            slide: 2,
            point: 'Not yours to change.',
          }),
        ).toEqual(refused)
        expect(await commands.writeSlides(actor, post.id, post.version)).toEqual(refused)
        expect(
          await commands.setOutlineFormat(actor, post.id, post.version, { format: 'then-vs-now' }),
        ).toEqual(refused)
      }
      expect({
        ideas: ideasData.length,
        drafts: draftData.length,
        outlines: outlineData.length,
      }).toEqual(calls)
      expect((await load(post.id)).version).toBe(post.version)
    },
    SLOW,
  )

  test(
    "makePost from a link reads the page and keeps its address and site on the source for its sources; a look's slides carry no source line (94, GD31)",
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const page = {
        title: `Paid work and grades ${requestId}`,
        paragraphs: paidWork.text.split('\n\n'),
        url: LINK,
        site: 'campustimes.example',
      }
      const { reads, read } = reader({ ok: true, page })
      ok(
        await commands.makePost(
          ED,
          { requestId, title: '', kind: 'article', text: '', links: [` ${LINK} `] },
          read,
        ),
      )
      await settled()
      expect(reads).toEqual([LINK])
      let post = await load(requestId)
      expect(post.current.source?.body).toMatchObject({
        title: page.title,
        kind: 'article',
        url: LINK,
        site: 'campustimes.example',
      })
      expect(post.current.source?.body.paragraphs).toHaveLength(5)
      post = await drafted(requestId)
      expect(post.current.drafts?.body.items).toHaveLength(3)

      let version = post.version
      ;({ version } = ok(await commands.pickStructure(ED, requestId, version, 0)))
      ;({ version } = ok(await commands.chooseTheme(ED, requestId, version, 'paper')))
      ok(await commands.approveStructure(ED, requestId, version))
      post = await load(requestId)
      // The sources go where the settings put them, never on each slide of a look (GD31).
      expect(post.current.layout?.body.slides.map((s) => s.sourceLine)).toEqual(
        (post.current.layout?.body.slides ?? []).map(() => null),
      )
    },
    SLOW,
  )

  test(
    'a link that cannot be read is refused and leaves no post; the pasted text then makes it with the same request (94)',
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const failing = reader({ ok: false, error: pageError })
      const input = { requestId, title: 'Paid work', kind: 'article', text: '', links: [LINK] }
      expect(await commands.makePost(ED, input, failing.read)).toEqual({
        ok: false,
        error: pageError,
        failed: [{ url: LINK, error: UNREAD }],
      })
      expect(await store.loadPost(requestId)).toBeNull()

      // A page whose first paragraph alone is over the text limit gives nothing to extract.
      const page = { title: 'Long', paragraphs: ['x'.repeat(60_001)], url: LINK, site: 'x' }
      expect(await commands.makePost(ED, input, reader({ ok: true, page }).read)).toEqual({
        ok: false,
        error: pageError,
        failed: [{ url: LINK, error: UNREAD }],
      })
      expect(await store.loadPost(requestId)).toBeNull()

      const unused = reader({ ok: false, error: pageError })
      const text = `${paidWork.text}\n\nRun ${requestId}`
      ok(await commands.makePost(ED, { ...input, links: [], text }, unused.read))
      await settled()
      expect(unused.reads).toEqual([])
      expect((await load(requestId)).current.source?.body.url).toBeUndefined()
    },
    SLOW,
  )

  test(
    'a web address pasted as the source text is read as the link; one that cannot be read asks for the Links field or the text (smoke test, 12 Oct)',
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const title = 'Personality Profiles by Occupations'
      const input = { requestId, title, kind: 'article', text: `  ${LINK}\n`, links: [] }
      const failing = reader({ ok: false, error: pageError })
      expect(await commands.makePost(ED, input, failing.read)).toEqual({
        ok: false,
        error: "That looks like a link. Paste it in the Links field, or paste the article's text.",
      })
      expect(failing.reads).toEqual([LINK])
      expect(await store.loadPost(requestId)).toBeNull()

      const page = {
        title: 'Hours of paid work',
        paragraphs: paidWork.text.split('\n\n'),
        url: LINK,
        site: 'campustimes.example',
      }
      const { reads, read } = reader({ ok: true, page })
      ok(await commands.makePost(ED, input, read))
      await settled()
      expect(reads).toEqual([LINK])
      const source = (await load(requestId)).current.source?.body
      expect(source).toMatchObject({ title, url: LINK, site: 'campustimes.example' })
      expect(source?.paragraphs).toHaveLength(5)
      expect(source?.text).not.toContain(LINK)
    },
    SLOW,
  )

  /** A page reader that answers each link with its own page, or a failure for a link it has none for. */
  function pages(byLink: Record<string, import('./fetch-page').Page>) {
    const reads: string[] = []
    const read = async (url: string): Promise<import('./fetch-page').PageResult> => {
      reads.push(url)
      const page = byLink[url]
      return page ? { ok: true, page } : { ok: false, error: pageError }
    }
    return { reads, read }
  }
  const LINK_A = 'https://www.abc.example/news/paid-work'
  const LINK_B = 'https://www.studyaustralia.example/work-rights'
  /** Two pages, the paid-work paragraphs split between them, each marked with this run. */
  function twoPages(run: string) {
    const texts = paidWork.text.split('\n\n')
    return {
      [LINK_A]: {
        title: `Paid work and grades ${run}`,
        paragraphs: [...texts.slice(0, 3), `Run ${run} on abc.`],
        url: LINK_A,
        site: 'abc.example',
      },
      [LINK_B]: {
        title: `Work rights ${run}`,
        paragraphs: [...texts.slice(3), `Run ${run} on studyaustralia.`],
        url: LINK_B,
        site: 'studyaustralia.example',
      },
    }
  }

  test(
    "makePost from two links makes one source of two parts with paragraphs numbered on and facts from both; a look's slides carry no source line (GD19, GD31)",
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const { reads, read } = pages(twoPages(requestId))
      const input = { requestId, kind: 'article', text: '', links: [LINK_A, ` ${LINK_B} `] }
      ok(await commands.makePost(ED, input, read))
      await settled()
      expect(reads.toSorted()).toEqual([LINK_A, LINK_B])
      let post = await load(requestId)
      const source = post.current.source?.body
      const titleA = `Paid work and grades ${requestId}`
      const titleB = `Work rights ${requestId}`
      expect(source?.title).toBe(titleA)
      expect(source?.parts).toEqual([
        { url: LINK_A, site: 'abc.example', title: titleA, from: 1, to: 4 },
        { url: LINK_B, site: 'studyaustralia.example', title: titleB, from: 5, to: 7 },
      ])
      expect(source?.paragraphs.map((p) => p.ref)).toEqual([
        '¶1',
        '¶2',
        '¶3',
        '¶4',
        '¶5',
        '¶6',
        '¶7',
      ])
      expect(source?.url).toBeUndefined()
      const refs = (post.current.facts?.body.facts ?? []).map((f) => Number(f.ref.slice(1)))
      expect(refs.some((n) => n <= 4)).toBe(true)
      expect(refs.some((n) => n >= 5)).toBe(true)

      post = await drafted(requestId)
      let version = post.version
      ;({ version } = ok(await commands.pickStructure(ED, requestId, version, 0)))
      ;({ version } = ok(await commands.chooseTheme(ED, requestId, version, 'paper')))
      ok(await commands.approveStructure(ED, requestId, version))
      post = await load(requestId)
      // The sources go where the settings put them, never on each slide of a look (GD31).
      expect(post.current.layout?.body.slides.map((s) => s.sourceLine)).toEqual(
        (post.current.layout?.body.slides ?? []).map(() => null),
      )
    },
    SLOW,
  )

  test(
    'a link of two that cannot be read is listed in failed while the other makes the post (GD19)',
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const both = twoPages(requestId)
      const { read } = pages({ [LINK_B]: both[LINK_B] })
      const input = { requestId, kind: 'article', text: '', links: [LINK_A, LINK_B] }
      ok(await commands.makePost(ED, input, read))
      await settled()
      const source = (await load(requestId)).current.source?.body
      const title = `Work rights ${requestId}`
      expect(source?.failed).toEqual([{ url: LINK_A, error: UNREAD }])
      expect(source?.parts).toEqual([
        { url: LINK_B, site: 'studyaustralia.example', title, from: 1, to: 3 },
      ])
      expect(source?.title).toBe(title)
    },
    SLOW,
  )

  test('when every link fails nothing is made, and each is listed (GD19)', async () => {
    const requestId = randomUUID()
    posts.push(requestId)
    const { reads, read } = pages({})
    const input = { requestId, kind: 'article', text: '', links: [LINK_A, LINK_B] }
    expect(await commands.makePost(ED, input, read)).toEqual({
      ok: false,
      error: pageError,
      failed: [
        { url: LINK_A, error: UNREAD },
        { url: LINK_B, error: UNREAD },
      ],
    })
    expect(reads.toSorted()).toEqual([LINK_A, LINK_B])
    expect(await store.loadPost(requestId)).toBeNull()
  })

  test('six links, a framing line over 200 characters, and no link or text are refused before any page is read (GD18)', async () => {
    const requestId = randomUUID()
    const { reads, read } = pages({})
    const six = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`)
    const base = { requestId, kind: 'article', text: '' }
    expect(await commands.makePost(ED, { ...base, links: six }, read)).toEqual({
      ok: false,
      error: 'Up to five links.',
    })
    expect(
      await commands.makePost(ED, { ...base, links: [LINK_A], framing: 'x'.repeat(201) }, read),
    ).toEqual({ ok: false, error: 'Keep it to 200 characters.' })
    // Counted as the stored source counts it: 201 emoji are refused by name.
    expect(
      await commands.makePost(ED, { ...base, links: [LINK_A], framing: '😀'.repeat(201) }, read),
    ).toEqual({ ok: false, error: 'Keep it to 200 characters.' })
    // Links and pasted text together: neither silently wins.
    expect(
      await commands.makePost(ED, { ...base, links: [LINK_A], text: paidWork.text }, read),
    ).toEqual({ ok: false, error: 'Use either links or pasted text.' })
    expect(await commands.makePost(ED, { ...base, links: ['', '  '] }, read)).toEqual({
      ok: false,
      error: 'Paste a link or some text.',
    })
    expect(reads).toEqual([])
    expect(await store.loadPost(requestId)).toBeNull()
    // 200 emoji pass the rule, and the page is read, rather than failing when stored.
    expect(
      await commands.makePost(ED, { ...base, links: [LINK_A], framing: '😀'.repeat(200) }, read),
    ).toMatchObject({ ok: false, error: pageError })
    expect(reads).toEqual([LINK_A])
  })

  test(
    'the framing line reaches the extraction and the idea cards as editor_intent and the notes do not; the notes reach the drafts as editor_notes (GD20, GD21)',
    async () => {
      const requestId = randomUUID()
      posts.push(requestId)
      const framing = 'Show first-year students why 20 hours is the limit'
      const notes = `I worked 25 hours a week in first year. ${requestId}`
      const { read } = pages(twoPages(requestId))
      const extracts = extractData.length
      const ideas = ideasData.length
      const drafts = draftData.length
      const links = [LINK_A, LINK_B]
      ok(await commands.makePost(ED, { requestId, text: '', links, framing, notes }, read))
      await settled()
      const extracted = extractData.slice(extracts)
      expect(extracted).toHaveLength(1)
      expect(extracted[0]).toMatchObject({ editor_intent: framing })
      expect(JSON.stringify(extracted[0])).not.toContain('I worked 25 hours')
      const offered = ideasData.slice(ideas)
      expect(offered).toHaveLength(1)
      expect(offered[0]).toMatchObject({ editor_intent: framing })
      expect(JSON.stringify(offered[0])).not.toContain('I worked 25 hours')
      await drafted(requestId)
      const sent = draftData.slice(drafts)
      expect(sent.length).toBeGreaterThan(0)
      for (const data of sent) expect(data).toMatchObject({ editor_notes: notes })
      const source = (await load(requestId)).current.source?.body
      expect(source).toMatchObject({ framing, notes })
      expect(source?.text).not.toContain('I worked 25 hours')
    },
    SLOW,
  )

  test(
    'a Nepali editor edits a slide in Devanagari and a Thai editor types a scene and the emotion in Thai: each saves, lays out and passes its checks (GD37, GD38)',
    async () => {
      const { nativeOf } = await import('../text/native-fixtures')
      const { charCount } = await import('../text/script')
      const { findSlideSpec } = await import('../templates')

      // Sources of their own: the answer cache is keyed by the prompt, and another test's Nepali or
      // Thai post of the same source would be answered from this one's.
      const own = (language: string) =>
        ({
          ...paidWork,
          text: `${paidWork.text}\n\nCc native edit marker ${randomUUID()}.`,
          language,
        }) as typeof paidWork

      // Nepali: one slot of the picked version, in Devanagari, more code points than its limit.
      const nepali = await atIdeas(own('ne'))
      let { version } = await outlined(nepali.id)
      ;({ version } = ok(await commands.writeSlides(ED, nepali.id, version)))
      ;({ version } = ok(await commands.pickStructure(ED, nepali.id, version, 0)))
      await settled()
      ;({ version } = await load(nepali.id))
      const item = (await load(nepali.id)).current.drafts?.body.items[0]
      if (!item) throw new Error('no version drafted')
      const [at] = item.structure.slides.flatMap((slide, i) =>
        (findSlideSpec(item.template, slide)?.slots ?? [])
          .filter((s) => s.limit.unit === 'chars' && !s.factual && s.limit.max >= 30)
          .map((s) => ({ slide: i + 1, slot: s.key, max: s.limit.max })),
      )
      if (!at) throw new Error('no characters slot to edit')
      const text = nativeOf('ne', Math.floor(at.max * 0.75))
      expect(Array.from(text).length).toBeGreaterThan(at.max)
      ;({ version } = ok(
        await commands.editSlot(ED, nepali.id, version, { slide: at.slide, slot: at.slot, text }),
      ))
      await settled()
      ;({ version } = await load(nepali.id))
      ;({ version } = ok(await commands.chooseTheme(ED, nepali.id, version, 'paper')))
      ok(await commands.approveStructure(ED, nepali.id, version))
      await settled()
      const laid = (await load(nepali.id)).current
      expect(laid.revision?.body.structure.slides[at.slide - 1].slots[at.slot].text).toBe(text)
      const row = laid.layout?.body.fitChecks.find(
        (c) => c.check === 'length' && c.slide === at.slide && c.slot === at.slot,
      )
      expect(row).toMatchObject({ value: charCount(text), pass: true })
      expect(laid.layout?.body.fitChecks.filter((c) => !c.pass)).toEqual([])

      // Thai: drafted again in the editor's own emotion word, then a planned scene typed in Thai.
      const emotion = 'ตื่นเต้น'
      const thai = await atIdeas(own('th'))
      ;({ version } = await outlined(thai.id))
      ;({ version } = ok(await commands.writeSlides(ED, thai.id, version)))
      ;({ version } = ok(await commands.draftPost(ED, thai.id, version, true, emotion)))
      ;({ version } = ok(await commands.pickStructure(ED, thai.id, version, 0)))
      await settled()
      ;({ version } = await load(thai.id))
      ;({ version } = ok(await commands.chooseTheme(ED, thai.id, version, 'paper')))
      ok(await commands.approveStructure(ED, thai.id, version))
      await settled()
      const planned = await load(thai.id)
      const [first] = planned.current.artPlan?.body.scenes ?? []
      if (!first) throw new Error('no scene planned')
      const scene = nativeOf('th', 180)
      expect(Array.from(scene).length).toBeGreaterThan(200)
      ;({ version } = ok(
        await commands.editImageScene(ED, thai.id, planned.version, {
          slide: first.slide,
          text: scene,
        }),
      ))
      ;({ version } = await done(commands.drawImages(ED, thai.id, version)))
      const drawn = (await load(thai.id)).current
      expect(drawn.drafts?.body.emotion).toBe(emotion)
      expect(drawn.revision?.body.emotion).toBe(emotion)
      expect(drawn.artPlan?.body.scenes.find((s) => s.slide === first.slide)?.scene).toBe(scene)
      expect(drawn.render?.body.slideArt?.find((a) => a.slide === first.slide)).toMatchObject({
        scene,
        fallback: null,
      })
      expect(drawn.layout?.body.fitChecks.filter((c) => !c.pass)).toEqual([])
    },
    SLOW,
  )

  test(
    'makePost takes a Nepali, Hindi or Thai title, framing line and notes at their limits in characters as a reader sees them (GD18, GD36)',
    async () => {
      const { nativeOf } = await import('../text/native-fixtures')
      for (const language of ['ne', 'hi', 'th'] as const) {
        const requestId = randomUUID()
        posts.push(requestId)
        const made = await commands.makePost(ED, {
          requestId,
          ...paidWork,
          title: nativeOf(language, 200),
          framing: nativeOf(language, 200),
          notes: nativeOf(language, 2000),
          language,
        })
        expect(made, language).toEqual({ ok: true, id: requestId, version: expect.any(Number) })
        await settled()
        const source = (await load(requestId)).current.source?.body
        expect(source?.title, language).toBe(nativeOf(language, 200))
        expect(source?.framing, language).toBe(nativeOf(language, 200))
        expect(source?.notes, language).toBe(nativeOf(language, 2000))
      }
    },
    SLOW,
  )

  test(
    'makePost keeps the language chosen on the source, English when none is (GD36)',
    async () => {
      const nepali = randomUUID()
      const english = randomUUID()
      posts.push(nepali, english)
      ok(await commands.makePost(ED, { requestId: nepali, ...paidWork, language: 'ne' }))
      ok(await commands.makePost(ED, { requestId: english, ...paidWork }))
      await settled()
      expect((await load(nepali)).current.source?.body.language).toBe('ne')
      expect((await load(english)).current.source?.body.language).toBe('en')
      expect(
        await commands.makePost(ED, {
          requestId: randomUUID(),
          ...paidWork,
          language: 'fr' as never,
        }),
      ).toEqual({ ok: false, error: expect.any(String) })
    },
    SLOW,
  )

  test(
    "a Nepali post's ideas, outline, format change, versions, another take and nudge carry its language, and its text comes back in Devanagari (GD37)",
    async () => {
      const { scriptShare } = await import('../text/script')
      const nepali = { id: 'ne', label: 'Nepali' }
      const post = await atIdeas({ ...paidWork, language: 'ne' } as typeof paidWork)
      expect(ideasData.at(-1)).toMatchObject({ language: nepali })
      const cards = (await ideasOf(post.id)).cards
      expect(scriptShare(cards[0].hook, 'devanagari')).toBe(1)

      let { version } = await outlined(post.id)
      expect(outlineData.at(-1)).toMatchObject({ language: nepali })
      ;({ version } = ok(
        await commands.setOutlineFormat(ED, post.id, version, { format: 'then-vs-now' }),
      ))
      expect(outlineData.at(-1)).toMatchObject({ language: nepali })

      ;({ version } = ok(await commands.writeSlides(ED, post.id, version)))
      expect(draftData.at(-1)).toMatchObject({ language: nepali })
      const items = (await load(post.id)).current.drafts?.body.items ?? []
      expect(items).toHaveLength(3)
      for (const item of items) {
        const words = item.structure.slides.flatMap((s) =>
          Object.values(s.slots).map((x) => x.text),
        )
        expect(scriptShare(words.join('\n'), 'devanagari')).toBeGreaterThan(0.6)
      }

      ;({ version } = ok(await commands.pickStructure(ED, post.id, version, 0)))
      await settled()
      ;({ version } = await load(post.id))
      ;({ version } = ok(await commands.redraftSlide(ED, post.id, version, 1)))
      expect(slideData.at(-1)).toMatchObject({ language: nepali })
      await settled()
      ;({ version } = await load(post.id))
      ok(await commands.nudgeVersion(ED, post.id, version, { index: 1, nudge: 'simpler' }))
      expect(draftData.at(-1)).toMatchObject({ language: nepali, nudge: expect.any(String) })
      await settled()
    },
    SLOW,
  )

  test(
    "a Thai post's approved layout ends with the Thai search line and swipes in Thai (GD39)",
    async () => {
      const post = await atIdeas({ ...paidWork, language: 'th' } as typeof paidWork)
      let { version } = await outlined(post.id)
      ;({ version } = ok(await commands.writeSlides(ED, post.id, version)))
      ;({ version } = ok(await commands.pickStructure(ED, post.id, version, 0)))
      await settled()
      ;({ version } = await load(post.id))
      ;({ version } = ok(await commands.chooseTheme(ED, post.id, version, 'paper')))
      ok(await commands.approveStructure(ED, post.id, version))
      const slides = (await load(post.id)).current.layout?.body.slides ?? []
      expect(slides.at(-1)?.searchLine).toBe(
        `หากต้องการกลับมาอ่านอีกครั้ง ให้ค้นหา “OfCourse ${paidWork.title}”`,
      )
      expect(slides[0]?.frame?.swipe).toBe('ปัดเพื่อดูต่อ')
      await settled()
    },
    SLOW,
  )

  test(
    'a number found only in the notes is refused in any slot, a heading too, and the model asked again (GD21)',
    async () => {
      const run = randomUUID()
      const post = await atIdeas({
        ...paidWork,
        text: `${paidWork.text}\n\nCc notes figure marker ${run}.`,
        notes: 'I worked 25 hours a week in first year.',
      } as typeof paidWork)
      // The second version of every answer puts the notes' figure in its first, unfactual slot.
      draftTweak = (answer) => {
        answer.versions[1].slides[0].slots[0].text = 'Twenty-five hours a week'
        return answer
      }
      try {
        await drafted(post.id)
        await settled()
      } finally {
        draftTweak = null
      }
      // Asked again on every rung of the ladder, then kept with its problem and refused as the pick:
      // this post's own draft calls, whatever another post's drafting does meanwhile.
      expect((await modelCalls(post.id, 'draft')).length).toBeGreaterThan(1)
      const items = (await load(post.id)).current.drafts?.body.items ?? []
      expect(items[1].problems).toEqual([
        'slides.0.slots.kicker: "Twenty-five hours a week" states a number no fact gives. Use only the facts\' numbers.',
      ])
      expect(items[0].problems ?? []).toEqual([])
    },
    SLOW,
  )

  test("an admin's or a reviewer's makePost is refused before any page is read or post made", async () => {
    for (const actor of [ADMIN, REV]) {
      const requestId = randomUUID()
      const { reads, read } = reader({ ok: false, error: pageError })
      for (const input of [
        { requestId, title: '', kind: 'article', text: '', links: [LINK] },
        { requestId, ...paidWork },
      ]) {
        expect(await commands.makePost(actor, input, read)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect(reads).toEqual([])
      expect(await store.loadPost(requestId)).toBeNull()
    }
  })

  test("an admin's or a reviewer's suggestSources is refused before any search or read (BR12)", async () => {
    const { reads, read } = reader({ ok: false, error: pageError })
    for (const actor of [ADMIN, REV]) {
      expect(
        await commands.suggestSources(actor, { idea: 'Working while you study' }, read),
      ).toEqual({ ok: false, error: errors.notAuthorised })
    }
    expect(reads).toEqual([])
  })

  test('an idea with digits is searched; one that is only a link, empty or over 200 characters is refused before any search (BR12)', async () => {
    const { reads, read } = reader({ ok: false, error: pageError })
    const { SOURCE_ERRORS } = await import('../model/artifacts')
    const before = searches.length
    // Search text, not an image prompt: digits are fine. No page reads here, so none is left.
    expect(
      await commands.suggestSources(ED, { idea: '20 hours a week on a student visa' }, read),
    ).toEqual({ ok: false, error: 'Try a more specific idea.' })
    expect(searches.length - before).toBe(1)
    reads.length = 0
    expect(
      await commands.suggestSources(ED, { idea: 'https://www.studyaustralia.gov.au/work' }, read),
    ).toEqual({ ok: false, error: SOURCE_ERRORS.ideaLink })
    expect(await commands.suggestSources(ED, { idea: '  ' }, read)).toEqual({
      ok: false,
      error: SOURCE_ERRORS.ideaEmpty,
    })
    expect(await commands.suggestSources(ED, { idea: 'a'.repeat(201) }, read)).toEqual({
      ok: false,
      error: 'Keep the idea to 200 characters.',
    })
    expect(reads).toEqual([])
    expect(searches.length - before).toBe(1)
  })

  test("an admin's tickTemplates is refused and the version is unchanged (14)", async () => {
    const { id, version } = await start(ED)
    expect(await commands.tickTemplates(ADMIN, id, version, ['the-line'])).toEqual({
      ok: false,
      error: errors.notAuthorised,
    })
    expect((await load(id)).version).toBe(version)
  })

  test('four templates are refused with the ticks message (25)', async () => {
    const { id, version } = await start(ED)
    const four = ['the-line', 'the-question', 'the-long-read', 'sketch-insight']
    expect(await commands.tickTemplates(ED, id, version, four)).toEqual({
      ok: false,
      error: errors.ticks,
    })
  })

  test(
    'the-question with an unbound claim is refused, and approves at approved once fixed (28, 31)',
    async () => {
      let { id, version } = await picked(ED, 'the-question')
      expect(await commands.approveStructure(ED, id, version)).toEqual({
        ok: false,
        error: errors.unbound,
      })

      let post = await load(id)
      const facts = post.current.facts?.body.facts ?? []
      const fact = facts.find((f) => f.supported)
      if (!fact) throw new Error('no supported fact')
      const item = () => post.current.drafts?.body.items[post.pointers.picked ?? 0]
      for (;;) {
        const draft = item()
        if (!draft) throw new Error('no picked draft')
        const [unbound] = unboundSlots(draft.structure, draft.template, facts)
        if (!unbound) break
        const at = { slide: unbound.slide, slot: unbound.slot, factId: fact.id }
        ;({ version } = ok(await commands.fixUnbound(ED, id, version, at)))
        post = await load(id)
        const slot = item()?.structure.slides[at.slide - 1].slots[at.slot]
        expect(slot).toMatchObject({ text: fact.text, factIds: [fact.id] })
      }

      ;({ version } = ok(await commands.approveStructure(ED, id, version)))
      post = await load(id)
      expect(post.stage).toBe('approved')
      expect(post.current.revision?.body).toMatchObject({ themeId: 'paper', note: 'approved' })
      expect(post.current.layout).not.toBeNull()
    },
    SLOW,
  )

  test(
    'approves a post drafted before draftChoices, with no theme stored, in the default theme (17 Oct)',
    async () => {
      const { id, version } = await picked(ED, 'the-line')
      await db
        .update(schema.contentPost)
        .set({
          pointers: orm.sql`jsonb_set(${schema.contentPost.pointers}, '{themeId}', 'null'::jsonb)`,
        })
        .where(orm.eq(schema.contentPost.id, id))
      expect((await load(id)).pointers.themeId).toBeNull()

      ok(await commands.approveStructure(ED, id, version))
      const post = await load(id)
      expect(post.stage).toBe('approved')
      expect(post.current.revision?.body.themeId).toBe('paper')
    },
    SLOW,
  )

  test(
    'reopenStructures goes back to structures and keeps the old revision record (32)',
    async () => {
      const { id } = await approved(ED, 'the-line')
      // The approved text's check runs first: no move back while a step runs (118).
      await settled()
      const { version, pointers } = await load(id)
      const revisionId = pointers.revisionId
      if (!revisionId) throw new Error('no revision')
      ok(await commands.reopenStructures(ED, id, version))
      const post = await load(id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.revisionId).toBeNull()
      expect(post.pointers.layoutId).toBeNull()
      const rows = await db
        .select({ id: schema.contentArtifact.id })
        .from(schema.contentArtifact)
        .where(orm.eq(schema.contentArtifact.id, revisionId))
      expect(rows).toHaveLength(1)
    },
    SLOW,
  )

  test(
    'the chosen emotion is stored on the drafts and carried onto the approved revision; a brand name or a bad word as the editor’s own is refused (100)',
    async () => {
      let { id, version } = await start(ED)
      ;({ version } = ok(await commands.tickTemplates(ED, id, version, ['the-line'])))
      expect(await commands.draftPost(ED, id, version, false, 'OfCourse')).toEqual({
        ok: false,
        error: artPromptError,
      })
      expect(await commands.draftPost(ED, id, version, false, 'calm2')).toEqual({
        ok: false,
        error: emotionError,
      })
      ;({ version } = ok(await commands.draftPost(ED, id, version, false, 'hopeful')))
      expect((await load(id)).current.drafts?.body.emotion).toBe('hopeful')
      ;({ version } = ok(await commands.pickStructure(ED, id, version, 0)))
      ;({ version } = ok(await commands.chooseTheme(ED, id, version, 'paper')))
      ;({ version } = ok(await commands.approveStructure(ED, id, version)))
      expect((await load(id)).current.revision?.body.emotion).toBe('hopeful')
    },
    SLOW,
  )

  test(
    'drafting picks version A and the brand’s first theme for the editor, and drafting again keeps what she chose',
    async () => {
      let { id, version } = await start(ED)
      ;({ version } = ok(await commands.tickTemplates(ED, id, version, ['the-line'])))
      ;({ version } = ok(await commands.draftPost(ED, id, version, false)))
      expect((await load(id)).pointers).toMatchObject({ picked: 0, themeId: 'paper' })
      ;({ version } = ok(await commands.pickStructure(ED, id, version, 2)))
      ;({ version } = ok(await commands.chooseTheme(ED, id, version, 'ink')))
      ;({ version } = ok(await commands.draftPost(ED, id, version, true)))
      expect((await load(id)).pointers).toMatchObject({ picked: 2, themeId: 'ink' })
    },
    SLOW,
  )

  test(
    'drafting stores three versions per ticked template, each with its angle; a version the ladder left with problems is kept, shown, and refused as the pick (97)',
    async () => {
      // A source of its own: the answer cache is keyed by the prompt, and another test's clean
      // answer for the same source and template would stand in for the tweaked one.
      let { id, version } = await start(ED, {
        ...paidWork,
        text: `${paidWork.text}

Cc versions marker paragraph.`,
      })
      ;({ version } = ok(
        await commands.tickTemplates(ED, id, version, ['the-line', 'the-question']),
      ))
      // The second version of every template keeps a banned phrase through every rung.
      draftTweak = (answer) => {
        answer.versions[1].slides[0].slots[0].text = 'The best research'
        return answer
      }
      try {
        ;({ version } = ok(await commands.draftPost(ED, id, version, false)))
      } finally {
        draftTweak = null
      }
      const items = (await load(id)).current.drafts?.body.items ?? []
      expect(items.map((i) => i.template.id)).toEqual([
        'the-line',
        'the-line',
        'the-line',
        'the-question',
        'the-question',
        'the-question',
      ])
      expect(new Set(items.slice(0, 3).map((i) => i.angle)).size).toBe(3)
      expect(items.map((i) => (i.problems ?? []).length > 0)).toEqual([
        false,
        true,
        false,
        false,
        true,
        false,
      ])
      expect(items[1].problems).toEqual(['slides.0.slots.kicker: remove "best".'])

      expect(await commands.pickStructure(ED, id, version, 1)).toEqual({
        ok: false,
        error: 'This version has problems. Draft again.',
      })
      ;({ version } = ok(await commands.pickStructure(ED, id, version, 2)))
      expect((await load(id)).pointers.picked).toBe(2)
    },
    SLOW,
  )

  test(
    'addFact saves a new facts record with the sentence word for word, removeFact one without the fact; the drafts and the pick stay (95)',
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      const before = await load(id)
      const oldFacts = before.current.facts
      if (!oldFacts) throw new Error('no facts')
      const sentence = 'The drop was largest in the first year of study.'
      expect(oldFacts.body.facts.some((f) => f.text === sentence)).toBe(false)

      ;({ version } = ok(await commands.addFact(ED, id, version, '¶3.2')))
      let post = await load(id)
      const added = post.current.facts?.body.facts.at(-1)
      expect(post.current.facts?.id).not.toBe(oldFacts.id)
      expect(post.current.facts?.body.facts).toHaveLength(oldFacts.body.facts.length + 1)
      expect(added).toMatchObject({
        id: `f${oldFacts.body.facts.length + 1}`,
        text: sentence,
        quote: sentence,
        ref: '¶3',
        sentenceId: '¶3.2',
        supported: true,
      })
      expect(post.current.drafts?.body.items).toEqual(before.current.drafts?.body.items)
      expect(post.pointers.picked).toBe(before.pointers.picked)
      expect(post.pointers.themeId).toBe(before.pointers.themeId)
      // Records are never changed: the first facts record is still there.
      const rows = await db
        .select({ id: schema.contentArtifact.id })
        .from(schema.contentArtifact)
        .where(orm.eq(schema.contentArtifact.id, oldFacts.id))
      expect(rows).toHaveLength(1)

      expect(await commands.addFact(ED, id, version, '¶3.2')).toEqual({
        ok: false,
        error: 'That sentence is already a fact.',
      })
      expect(await commands.addFact(ED, id, version, '¶9.1')).toEqual({
        ok: false,
        error: 'That sentence is not in the source.',
      })

      if (!added) throw new Error('no added fact')
      ;({ version } = ok(await commands.removeFact(ED, id, version, added.id)))
      post = await load(id)
      expect(post.current.facts?.body.facts.map((f) => f.id)).toEqual(
        oldFacts.body.facts.map((f) => f.id),
      )
      expect(post.current.drafts?.body.items).toEqual(before.current.drafts?.body.items)
      expect(await commands.removeFact(ED, id, version, added.id)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )

  test(
    'a fact added after a bound fact was removed never takes its id, so no slot is bound to another sentence (95)',
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      const post = await load(id)
      const n = (factId: string) => Number(factId.slice(1))
      const bound = (post.current.drafts?.body.items ?? []).flatMap((item) =>
        item.structure.slides.flatMap((s) => Object.values(s.slots).flatMap((x) => x.factIds)),
      )
      const top = Math.max(...bound.map(n))
      // Every fact from the highest one a draft binds up is removed.
      for (const fact of post.current.facts?.body.facts ?? []) {
        if (n(fact.id) < top) continue
        ;({ version } = ok(await commands.removeFact(ED, id, version, fact.id)))
      }
      ;({ version } = ok(await commands.addFact(ED, id, version, '¶3.2')))
      const added = (await load(id)).current.facts?.body.facts.at(-1)
      expect(added?.sentenceId).toBe('¶3.2')
      expect(n(added?.id ?? 'f0')).toBeGreaterThan(top)
    },
    SLOW,
  )

  test(
    "a reviewer's or an admin's addFact and removeFact are refused, and once approved a fact removed moves the post back to its text versions (95, GD28)",
    async () => {
      const { id, version } = await start(ED)
      const fact = (await load(id)).current.facts?.body.facts[0]
      if (!fact) throw new Error('no fact')
      for (const actor of [REV, ADMIN]) {
        expect(await commands.addFact(actor, id, version, '¶3.2')).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
        expect(await commands.removeFact(actor, id, version, fact.id)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect((await load(id)).version).toBe(version)

      const approvedPost = await approved(ED, 'the-line')
      await settled()
      const at = (await load(approvedPost.id)).version
      const moved = ok(await commands.removeFact(ED, approvedPost.id, at, 'f1'))
      expect(moved.note).toBe('Text changed: the slides will be rendered again')
      const after = await load(approvedPost.id)
      expect(after.stage).toBe('structures')
      expect(after.current.facts?.body.facts.map((f) => f.id)).not.toContain('f1')
    },
    SLOW,
  )

  test('renderPost at structures is refused as moved on (33)', async () => {
    const { id, version } = await picked(ED, 'the-line')
    expect(await commands.renderPost(ED, id, version)).toEqual({
      ok: false,
      error: errors.movedOn,
    })
  })

  test(
    'the-long-read approved is refused at render with the fit message (35)',
    async () => {
      const { id, version } = await approved(ED, 'the-long-read')
      expect(await commands.renderPost(ED, id, version)).toEqual({
        ok: false,
        error: errors.fitFailed,
      })
    },
    SLOW,
  )

  test(
    'the-line approved on Paper renders every slide as stored svg and png at rendered (36)',
    async () => {
      const { id } = await rendered(ED)
      const post = await load(id)
      expect(post.stage).toBe('rendered')
      const render = post.current.render?.body
      if (!render) throw new Error('no render')
      expect(render.slides.length).toBe(post.current.layout?.body.slides.length ?? -1)
      expect(render.art).toMatchObject({ version: 1, fallback: null })
      for (const slide of render.slides) {
        expect((await store.getAsset(slide.svgAssetId))?.mime).toBe('image/svg+xml')
        expect((await store.getAsset(slide.pngAssetId))?.mime).toBe('image/png')
      }
      expect(render.art.assetId).not.toBeNull()
      expect(await store.getAsset(render.art.assetId ?? '')).not.toBeNull()
    },
    SLOW,
  )

  test(
    'a not-found claim blocks review until it is marked opinion (42, 43)',
    async () => {
      // No button: the check ran by itself after approval.
      let { id, version } = await rendered(ED)
      let claims = (await load(id)).current.sourceCheck?.body.claims ?? []
      const notFound = claims.flatMap((c, i) => (c.result === 'not_found' ? [i] : []))
      expect(notFound).toHaveLength(1)

      ;({ version } = ok(await commands.saveSettings(ED, id, version, GENERAL)))
      expect(await commands.sendToReview(ED, id, version)).toEqual({
        ok: false,
        error: errors.notFound,
      })
      ;({ version } = ok(await commands.markOpinion(ED, id, version, notFound[0])))
      claims = (await load(id)).current.sourceCheck?.body.claims ?? []
      expect(claims[notFound[0]].result).toBe('opinion')
      ;({ version } = ok(await commands.sendToReview(ED, id, version)))
      expect((await load(id)).stage).toBe('in_review')
    },
    SLOW,
  )

  test(
    'removeClaim makes a new revision, checked again by itself; the earlier check no longer counts',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = ok(await commands.saveSettings(ED, id, version, GENERAL)))
      const before = await load(id)
      const claims = before.current.sourceCheck?.body.claims ?? []
      const index = claims.findIndex((c) => c.result === 'not_found')
      const claim = claims[index]
      ;({ version } = await done(commands.removeClaim(ED, id, version, index)))

      const after = await load(id)
      expect(after.pointers.revisionId).not.toBe(before.pointers.revisionId)
      expect(after.current.revision?.body.note).toBe('remove claim')
      const slot = after.current.revision?.body.structure.slides[claim.slide - 1].slots[claim.slot]
      expect(slot?.text).not.toContain(claim.text)
      const check = after.current.sourceCheck
      expect(check?.id).not.toBe(before.current.sourceCheck?.id as string)
      expect(check?.body.revisionId).toBe(after.pointers.revisionId as string)
      expect(check?.body.claims.map((c) => c.text)).not.toContain(claim.text)
      expect(after.stage).toBe('rendered')
      expect(after.current.render?.body.art).toEqual(before.current.render?.body.art as never)
      expect(after.pointers.renderId).not.toBe(before.pointers.renderId)
      ok(await commands.sendToReview(ED, id, version))
    },
    SLOW,
  )

  test(
    'a removal that would leave a slot too short is refused, naming it: nothing saved, the post stays rendered (18 Oct)',
    async () => {
      // A source of its own, so no cached draft stands in for the tweaked one: the planted
      // sentence's slot keeps only 20 words before it, so it passes (32 of 30–70) and its removal
      // would leave 20.
      const source = { ...paidWork, text: `${paidWork.text}\n\nCc short slot ${randomUUID()}.` }
      draftTweak = (answer) => {
        for (const v of answer.versions) {
          for (const s of v.slides) {
            for (const slot of s.slots) {
              const at = slot.text.indexOf(PLANTED)
              if (at < 0) continue
              const kept = slot.text.slice(0, at).split(/\s+/).filter(Boolean).slice(0, 20)
              slot.text = `${kept.join(' ').replace(/[.!?,;:]?$/, '.')} ${PLANTED}`
            }
          }
        }
        return answer
      }
      let id: string
      let version: number
      try {
        ;({ id, version } = await rendered(ED, source))
      } finally {
        draftTweak = null
      }
      const before = await load(id)
      const claims = before.current.sourceCheck?.body.claims ?? []
      const index = claims.findIndex((c) => c.text === PLANTED && c.result === 'not_found')
      expect(index).toBeGreaterThanOrEqual(0)
      const { slide } = claims[index]

      expect(await commands.removeClaim(ED, id, version, index)).toEqual({
        ok: false,
        error: `Removing it would leave Slide ${slide} · Body too short. Use the source's wording, or edit it on Text.`,
      })
      await settled()
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.stage).toBe('rendered')
      expect(after.pointers).toEqual(before.pointers)
    },
    SLOW,
  )

  // ── Editing on the slide, checked as you go (criteria 98, 104) ──────────────────────────────

  /** The fake's planted line: in the second body slide of the-line, bound to a fact it is not. */
  const PLANTED = 'First year is the worst time to find out where your limit is.'
  /** A fair paraphrase of paid-work ¶1's first sentence, which the first body slide binds. */
  const PARAPHRASE =
    'A survey of 3,100 international students compared paid-work hours with results.'

  /**
   * Forgets the source check answers cached for the model this run's posts were checked with, so
   * the judge is asked again. That model is not always this file's own: the AI client reads its
   * config once, for the first file in the process to load it, so another file's model name (and
   * its cached answers) can be the one in use. It is read from the calls these posts logged.
   */
  async function forgetCheckAnswers() {
    const used = await db
      .selectDistinct({ model: schema.aiCall.model })
      .from(schema.aiCall)
      .where(
        orm.and(
          orm.eq(schema.aiCall.useCase, 'source_check'),
          orm.inArray(schema.aiCall.postId, posts),
        ),
      )
    const models = used.map((row) => row.model)
    if (models.length === 0) return
    await db
      .delete(schema.aiCache)
      .where(
        orm.and(
          orm.eq(schema.aiCache.useCase, 'source_check'),
          orm.inArray(schema.aiCache.model, models),
        ),
      )
  }

  /** The picked version of a post, and where its first body slide's body slot is. */
  async function pickedVersion(id: string) {
    const post = await load(id)
    const drafts = post.current.drafts
    const item = drafts?.body.items[post.pointers.picked ?? -1]
    if (!drafts || !item) throw new Error('nothing picked')
    const slide = item.structure.slides.findIndex((s) => s.kind === 'body') + 1
    return { post, drafts, item, at: { slide, slot: 'body' } }
  }

  test(
    'picking a version checks it by itself, before approval, and a flag names the source sentence (98, 104)',
    async () => {
      const { id } = await picked(ED, 'the-line')
      await settled()
      const { post, item } = await pickedVersion(id)
      const check = post.current.sourceCheck?.body
      expect(check?.revisionId).toBeNull()
      expect(check?.draft).toEqual({ draftsId: post.pointers.draftsId as string, index: 0 })
      const flagged = check?.claims.filter((c) => c.result === 'not_found') ?? []
      expect(flagged.map((c) => c.text)).toEqual([PLANTED])
      // Beside it, the sentence of the fact its slot binds.
      const slot = item.structure.slides[flagged[0].slide - 1].slots[flagged[0].slot]
      const fact = post.current.facts?.body.facts.find((f) => f.id === slot.factIds[0])
      expect(flagged[0].suggestion).toEqual({ ref: fact?.ref ?? '', text: fact?.text ?? '' })
    },
    SLOW,
  )

  test(
    'an edited slot saves new drafts: the preview and fit rows follow, and its sentence is checked with no button (98)',
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      const before = await pickedVersion(id)
      const { facts, source } = before.post.current
      if (!facts || !source) throw new Error('no facts')
      const fits = (drafts: typeof before.drafts.body) =>
        preview.draftFitChecks(drafts, 'paper', facts.body.facts, source.body.title)[0]
      const png = (draftsId: string) =>
        preview.draftPreviewPng({
          postId: id,
          draftsId,
          index: 0,
          slide: before.at.slide,
          themeId: 'paper',
        })
      const judgedBefore = judged.length

      ;({ version } = ok(
        await commands.editSlot(ED, id, version, { ...before.at, text: `  ${PARAPHRASE}  ` }),
      ))
      await settled()
      const after = await pickedVersion(id)
      expect(after.post.stage).toBe('structures')
      expect(after.post.pointers.draftsId).not.toBe(before.post.pointers.draftsId)
      expect(after.item.structure.slides[before.at.slide - 1].slots.body).toEqual({
        ...before.item.structure.slides[before.at.slide - 1].slots.body,
        text: PARAPHRASE,
      })
      // Only that slot changed; the other versions stay as drafted.
      expect(after.drafts.body.items.slice(1)).toEqual(before.drafts.body.items.slice(1))
      // The preview is drawn again from the new drafts, and the fit rows read the new text.
      const oldPng = await png(before.post.pointers.draftsId as string)
      const newPng = await png(after.post.pointers.draftsId as string)
      if (!oldPng || !newPng) throw new Error('no preview')
      expect(Buffer.from(oldPng).equals(Buffer.from(newPng))).toBe(false)
      const row = (checks: ReturnType<typeof fits>) =>
        checks.find((c) => c.check === 'length' && c.slide === before.at.slide && c.slot === 'body')
      expect(row(fits(before.drafts.body))?.pass).toBe(true)
      expect(row(fits(after.drafts.body))).toMatchObject({ pass: false, value: 11 })

      // The changed sentence was read against its fact, by itself; the check names these drafts.
      expect(judged.slice(judgedBefore)).toEqual([PARAPHRASE])
      const check = after.post.current.sourceCheck?.body
      expect(check?.draft).toEqual({ draftsId: after.post.pointers.draftsId as string, index: 0 })
      expect(check?.claims.find((c) => c.text === PARAPHRASE)).toMatchObject({
        slide: before.at.slide,
        result: 'found',
        ref: '¶1',
      })

      // The same text again saves nothing.
      expect(await commands.editSlot(ED, id, version, { ...before.at, text: PARAPHRASE })).toEqual({
        ok: true,
        id,
        version,
      })
      expect((await load(id)).pointers.draftsId).toBe(after.post.pointers.draftsId)
    },
    SLOW,
  )

  test(
    'an unchanged slot is not read again when another one is edited (98)',
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      const { at } = await pickedVersion(id)
      // From here the judge says yes to anything and has nothing cached: a sentence read again
      // would turn found.
      await forgetCheckAnswers()
      judgeAnswer = (data) => ({
        supported: true,
        ref: (data as { paragraphs: { ref: string }[] }).paragraphs[0].ref,
        why: 'Yes.',
      })
      try {
        ;({ version } = ok(await commands.editSlot(ED, id, version, { ...at, text: PARAPHRASE })))
        await settled()
      } finally {
        judgeAnswer = null
      }
      const claims = (await load(id)).current.sourceCheck?.body.claims ?? []
      expect(claims.find((c) => c.text === PLANTED)?.result).toBe('not_found')
      expect(claims.find((c) => c.text === PARAPHRASE)?.result).toBe('found')
    },
    SLOW,
  )

  test(
    "Use the source's wording puts the source sentence in place of the flagged one and checks clean (104)",
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      const before = await pickedVersion(id)
      const claims = before.post.current.sourceCheck?.body.claims ?? []
      const index = claims.findIndex((c) => c.text === PLANTED)
      const { suggestion, slide, slot } = claims[index]
      if (!suggestion) throw new Error('no suggestion')
      // Nothing to use on a sentence the check found.
      const found = claims.findIndex((c) => c.result === 'found')
      expect(await commands.applySourceWording(ED, id, version, found)).toEqual({
        ok: false,
        error: errors.movedOn,
      })

      ;({ version } = ok(await commands.applySourceWording(ED, id, version, index)))
      await settled()
      const after = await pickedVersion(id)
      const text = after.item.structure.slides[slide - 1].slots[slot].text
      expect(text).not.toContain(PLANTED)
      expect(text).toBe(
        before.item.structure.slides[slide - 1].slots[slot].text.replace(PLANTED, suggestion.text),
      )
      const check = after.post.current.sourceCheck?.body
      expect(check?.draft?.draftsId).toBe(after.post.pointers.draftsId as string)
      expect(check?.claims.filter((c) => c.result === 'not_found')).toEqual([])
    },
    SLOW,
  )

  test(
    'measureSlot gives the fit rows a slot would have with the typed text and saves nothing; a reviewer and an admin are refused (98)',
    async () => {
      const { id, version } = await picked(ED, 'the-line')
      await settled()
      const { post, at } = await pickedVersion(id)
      const typed = { ...at, text: PARAPHRASE }

      const measured = await commands.measureSlot(ED, id, version, typed)
      if (!measured.ok) throw new Error(measured.error)
      expect(measured.rows.length).toBeGreaterThan(0)
      expect(measured.rows.every((r) => r.slide === at.slide && r.slot === at.slot)).toBe(true)
      // The same row the saved drafts show once this text is saved (the editSlot test above).
      expect(measured.rows.find((r) => r.check === 'length')).toMatchObject({
        pass: false,
        value: 11,
      })
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.pointers.draftsId).toBe(post.pointers.draftsId)

      for (const actor of [REV, ADMIN]) {
        expect(await commands.measureSlot(actor, id, version, typed)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect(await commands.measureSlot(ED, id, version, { ...typed, slide: 99 })).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )

  test(
    'editSlot and applySourceWording refuse a reviewer and an admin, and a slot that is not there (98, 104)',
    async () => {
      const { id, version } = await picked(ED, 'the-line')
      await settled()
      const { at } = await pickedVersion(id)
      for (const actor of [REV, ADMIN]) {
        expect(await commands.editSlot(actor, id, version, { ...at, text: PARAPHRASE })).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
        expect(await commands.applySourceWording(actor, id, version, 0)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect(
        await commands.editSlot(ED, id, version, { slide: 99, slot: 'body', text: PARAPHRASE }),
      ).toEqual({ ok: false, error: errors.movedOn })
      expect((await commands.editSlot(ED, id, version, { ...at, text: '   ' })).ok).toBe(false)
      expect((await load(id)).version).toBe(version)
    },
    SLOW,
  )

  test(
    'a failed automatic check keeps the text and says so; Try again checks it (98)',
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      const { at } = await pickedVersion(id)
      await forgetCheckAnswers()
      judgeAnswer = () => {
        throw new Error('The judge is down.')
      }
      try {
        ;({ version } = ok(await commands.editSlot(ED, id, version, { ...at, text: PARAPHRASE })))
        await settled()
      } finally {
        judgeAnswer = null
      }
      const failed = await pickedVersion(id)
      expect(failed.item.structure.slides[at.slide - 1].slots.body.text).toBe(PARAPHRASE)
      expect(failed.post.current.sourceCheck).toBeNull()
      expect(await steps.failedSteps(id)).toContain('source_check')

      ;({ version } = ok(await commands.checkSource(ED, id, version)))
      const checked = await pickedVersion(id)
      expect(checked.post.current.sourceCheck?.body.draft?.draftsId).toBe(
        checked.post.pointers.draftsId as string,
      )
      expect(await steps.failedSteps(id)).not.toContain('source_check')
    },
    SLOW,
  )

  // ── Another take on one slide (criterion 99) ───────────────────────────────────────────────

  test(
    'another take rewords only that slide of the picked version, as a new drafts record the old one stays beside, checked by itself (99)',
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      const before = await pickedVersion(id)
      const { slide } = before.at
      const bytes = (s: unknown) => JSON.stringify(s)

      ;({ version } = ok(await commands.redraftSlide(ED, id, version, slide)))
      await settled()
      const after = await pickedVersion(id)
      expect(after.post.stage).toBe('structures')
      expect(after.post.pointers.draftsId).not.toBe(before.post.pointers.draftsId)
      expect(after.post.pointers.picked).toBe(before.post.pointers.picked)
      const was = before.item.structure.slides[slide - 1]
      const now = after.item.structure.slides[slide - 1]
      // New wording in the slide's own slots, bound to the same facts.
      expect(Object.keys(now.slots)).toEqual(Object.keys(was.slots))
      expect(now.slots.body.text).not.toBe(was.slots.body.text)
      expect(now.slots.heading.text).not.toBe(was.slots.heading.text)
      expect(now.slots.body.factIds).toEqual(was.slots.body.factIds)
      // Every other slide, the template, the angle and the other versions: the same bytes.
      const rest = (item: (typeof before)['item']) =>
        bytes({
          ...item,
          structure: { ...item.structure, slides: item.structure.slides.toSpliced(slide - 1, 1) },
        })
      expect(rest(after.item)).toBe(rest(before.item))
      expect(bytes(after.drafts.body.items.slice(1))).toBe(bytes(before.drafts.body.items.slice(1)))
      expect(after.drafts.body.emotion).toBe(before.drafts.body.emotion)
      // The history keeps the old wording: the record it came from is still there, unchanged.
      const [old] = await db
        .select({ kind: schema.contentArtifact.kind, body: schema.contentArtifact.body })
        .from(schema.contentArtifact)
        .where(orm.eq(schema.contentArtifact.id, before.drafts.id))
      expect(old?.kind).toBe('drafts')
      // By content: a body is read back through its schema, which orders its keys its own way.
      expect(canonicalJson(old?.body)).toBe(canonicalJson(before.drafts.body))
      // The new text is checked by itself, and the check names the new drafts.
      const check = after.post.current.sourceCheck?.body
      expect(check?.draft).toEqual({ draftsId: after.post.pointers.draftsId as string, index: 0 })
    },
    SLOW,
  )

  test(
    'a failed take keeps the slide and marks its own step failed; the next take clears it (99)',
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      const { at } = await pickedVersion(id)
      const step = `draft_slide:${at.slide}`
      // The marker reaches the model through the slide's own words.
      ;({ version } = ok(
        await commands.editSlot(ED, id, version, {
          ...at,
          slot: 'heading',
          text: 'Finding [fake:fail-draft_slide]',
        }),
      ))
      await settled()
      const before = await pickedVersion(id)
      expect(await commands.redraftSlide(ED, id, version, at.slide)).toEqual({
        ok: false,
        error: aiFailed,
      })
      const failed = await pickedVersion(id)
      expect(failed.post.pointers.draftsId).toBe(before.post.pointers.draftsId)
      expect(failed.post.version).toBe(version)
      expect(await steps.failedSteps(id)).toContain(step)

      ;({ version } = ok(
        await commands.editSlot(ED, id, version, { ...at, slot: 'heading', text: 'Finding' }),
      ))
      await settled()
      ;({ version } = ok(await commands.redraftSlide(ED, id, version, at.slide)))
      await settled()
      expect(await steps.failedSteps(id)).not.toContain(step)
      expect(
        (await pickedVersion(id)).item.structure.slides[at.slide - 1].slots.heading.text,
      ).not.toBe('Finding')
    },
    SLOW,
  )

  test(
    'another take refuses a reviewer, an admin, a slide that is not there, and a post with no pick (99)',
    async () => {
      const { id, version } = await picked(ED, 'the-line')
      await settled()
      const { at } = await pickedVersion(id)
      for (const actor of [REV, ADMIN]) {
        expect(await commands.redraftSlide(actor, id, version, at.slide)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect(await commands.redraftSlide(ED, id, version, 99)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      expect((await load(id)).version).toBe(version)

      const unpicked = await nonePicked()
      expect(await commands.redraftSlide(ED, unpicked.id, unpicked.version, 1)).toEqual({
        ok: false,
        error: errors.noPick,
      })
    },
    SLOW,
  )

  test(
    "after render, the source's wording makes a new revision, redrawn with its art and checked clean (104)",
    async () => {
      let { id, version } = await rendered(ED)
      const before = await load(id)
      const claims = before.current.sourceCheck?.body.claims ?? []
      const index = claims.findIndex((c) => c.text === PLANTED)
      const { suggestion, slide, slot } = claims[index]
      if (!suggestion) throw new Error('no suggestion')

      ;({ version } = await done(commands.applySourceWording(ED, id, version, index)))
      const after = await load(id)
      expect(after.stage).toBe('rendered')
      expect(after.current.revision?.body.note).toBe('source wording')
      expect(after.current.revision?.body.structure.slides[slide - 1].slots[slot].text).toBe(
        before.current.revision?.body.structure.slides[slide - 1].slots[slot].text.replace(
          PLANTED,
          suggestion.text,
        ),
      )
      expect(after.pointers.renderId).not.toBe(before.pointers.renderId)
      expect(after.current.render?.body.art).toEqual(before.current.render?.body.art as never)
      const check = after.current.sourceCheck?.body
      expect(check?.revisionId).toBe(after.pointers.revisionId as string)
      expect(check?.claims.filter((c) => c.result === 'not_found')).toEqual([])
    },
    SLOW,
  )

  test(
    'approval checks the approved revision by itself, from what the pick already found (43, 98)',
    async () => {
      const { id } = await picked(ED, 'the-line')
      await settled()
      const pickedCheck = (await load(id)).current.sourceCheck?.body
      const judgedBefore = judged.length
      const { version } = ok(await commands.approveStructure(ED, id, (await load(id)).version))
      await settled()
      const post = await load(id)
      expect(post.version).toBe(version)
      expect(post.current.sourceCheck?.body.revisionId).toBe(post.pointers.revisionId as string)
      expect(post.current.sourceCheck?.body.claims).toEqual(pickedCheck?.claims as never)
      // Nothing changed, so nothing was read again.
      expect(judged.slice(judgedBefore)).toEqual([])
    },
    SLOW,
  )

  test(
    'approveAndPublish pins the render and says whether the creator reviewed it (45, 46, 54)',
    async () => {
      const own = await inReview(BOTH)
      ok(await commands.approveAndPublish(BOTH, own.id, own.version))
      const post = await load(own.id)
      expect(post.stage).toBe('live')
      expect(post.current.approval?.body).toMatchObject({
        selfReviewed: true,
        renderId: post.pointers.renderId,
        revisionId: post.pointers.revisionId,
      })
      // The approval students see is named in the same save (116, 117).
      const [row] = await db
        .select({ published: schema.contentPost.publishedApprovalId })
        .from(schema.contentPost)
        .where(orm.eq(schema.contentPost.id, own.id))
      expect(row?.published).toBe(post.pointers.approvalId as string)

      const other = await inReview(ED)
      ok(await commands.approveAndPublish(REV, other.id, other.version))
      expect((await load(other.id)).current.approval?.body.selfReviewed).toBe(false)
    },
    SLOW,
  )

  test(
    "a published post's board card reads its approved settings (54)",
    async () => {
      const live = await inReview(ED, { ...GENERAL, expiry: { kind: 'days', days: 90 } })
      ok(await commands.approveAndPublish(REV, live.id, live.version))
      const waiting = await inReview(ED)
      const cards = await store.listCards()
      expect(cards.find((c) => c.id === live.id)?.liveLine).toBe(
        'General · Everyone · Leaves the feed in 90 days',
      )
      expect(cards.find((c) => c.id === waiting.id)?.liveLine).toBeNull()
    },
    SLOW,
  )

  test(
    'sendBack needs a reason, then returns the post to rendered with it (47)',
    async () => {
      const { id, version } = await inReview(ED)
      expect(await commands.sendBack(REV, id, version, '  ', 'structures')).toEqual({
        ok: false,
        error: errors.reasonRequired,
      })
      ok(await commands.sendBack(REV, id, version, 'Cite the survey year.', 'structures'))
      const post = await load(id)
      expect(post.stage).toBe('rendered')
      expect(post.current.sendBack?.body.reason).toBe('Cite the survey year.')
      expect(post.current.sendBack?.body.step).toBe('structures')
    },
    SLOW,
  )

  test('a second save from the same version is refused with who changed it (21)', async () => {
    const { id, version } = await start(ED)
    ok(await commands.tickTemplates(ED, id, version, ['the-line']))
    expect(await commands.tickTemplates(BOTH, id, version, ['the-question'])).toEqual({
      ok: false,
      error: 'Changed by CC ed just now',
    })
    expect((await load(id)).pointers.ticked).toEqual(['the-line'])
  })

  test(
    'failed art stores a render with no art, and retryArt renders it again with art (37)',
    async () => {
      const source = {
        title: 'Paid work and grades, art test',
        kind: paidWork.kind,
        text: `${paidWork.text}\n\nArt note [fake:fail-art]`,
      }
      let { id, version } = await rendered(ED, source)
      const first = await load(id)
      expect(first.stage).toBe('rendered')
      expect(first.current.render?.body.art).toMatchObject({ fallback: 'no_art', assetId: null })

      artBack = true
      try {
        ;({ version } = await done(commands.retryArt(ED, id, version)))
      } finally {
        artBack = false
      }
      const second = await load(id)
      expect(second.pointers.renderId).not.toBe(first.pointers.renderId)
      expect(second.current.render?.body.layoutId).toBe(first.pointers.layoutId as string)
      expect(second.current.render?.body.art.fallback).toBeNull()
      expect(second.current.render?.body.art.assetId).not.toBeNull()
    },
    SLOW,
  )

  test(
    'no slide vision check runs; a post and its market version go to review and publish without one (103)',
    async () => {
      let { id, version } = await rendered(BOTH)
      ;({ version } = await done(commands.makeMarket(BOTH, id, version, 'NP')))
      const made = await load(id)
      expect(made.pointers.visionId).toBeNull()
      expect(made.pointers.marketVisionId).toBeNull()
      const visions = await db
        .select({ id: schema.contentArtifact.id })
        .from(schema.contentArtifact)
        .where(
          orm.and(
            orm.eq(schema.contentArtifact.postId, id),
            orm.eq(schema.contentArtifact.kind, 'vision'),
          ),
        )
      expect(visions).toEqual([])
      expect(await steps.runningSteps(id)).toEqual([])
      expect(await steps.failedSteps(id)).toEqual([])

      ;({ version } = ok(await commands.saveSettings(BOTH, id, version, GENERAL)))
      const claims = (await load(id)).current.sourceCheck?.body.claims ?? []
      for (const [i, claim] of claims.entries()) {
        if (claim.result === 'not_found') {
          ;({ version } = ok(await commands.markOpinion(BOTH, id, version, i)))
        }
      }
      ;({ version } = ok(await commands.sendToReview(BOTH, id, version)))
      ok(await commands.approveAndPublish(BOTH, id, version))
      const live = await load(id)
      expect(live.stage).toBe('live')
      expect(live.current.approval?.body).toMatchObject({
        marketId: made.pointers.marketId as string,
        visionId: null,
        overrideId: null,
      })
    },
    SLOW,
  )

  /** The post's structure and revision rows, by id: the history's records, with when each was written. */
  const textRecords = (id: string) =>
    db
      .select({ id: schema.contentArtifact.id, createdAt: schema.contentArtifact.createdAt })
      .from(schema.contentArtifact)
      .where(
        orm.and(
          orm.eq(schema.contentArtifact.postId, id),
          orm.inArray(schema.contentArtifact.kind, ['drafts', 'revision']),
        ),
      )
      .orderBy(schema.contentArtifact.id)

  test(
    'restoreVersion makes an earlier structure current again as a new version, adds no record and checks it; a reviewer, an admin and an unknown record are refused (101)',
    async () => {
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      const before = await pickedVersion(id)
      const oldId = before.post.pointers.draftsId as string
      ;({ version } = ok(
        await commands.editSlot(ED, id, version, { ...before.at, text: PARAPHRASE }),
      ))
      await settled()
      const edited = await load(id)
      const history = await store.listHistory(id)
      expect(history.map((h) => [h.id, h.kind, h.note, h.by])).toEqual([
        [edited.pointers.draftsId, 'drafts', `Slide ${before.at.slide} edited`, ED.name],
        [oldId, 'drafts', 'Drafted', ED.name],
      ])
      const rows = await textRecords(id)

      for (const actor of [REV, ADMIN]) {
        expect(await commands.restoreVersion(actor, id, version, oldId)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect(await commands.restoreVersion(ED, id, version, `drafts_${'0'.repeat(32)}`)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      expect((await load(id)).version).toBe(version)

      const restored = ok(await commands.restoreVersion(ED, id, version, oldId))
      expect(restored.version).toBe(version + 1)
      await settled()
      const after = await pickedVersion(id)
      expect(after.post.stage).toBe('structures')
      expect(after.post.pointers.draftsId).toBe(oldId)
      expect(after.post.pointers.picked).toBe(before.post.pointers.picked)
      expect(after.item).toEqual(before.item)
      // The source check followed, on the restored text.
      expect(after.post.current.sourceCheck?.body.draft).toEqual({
        draftsId: oldId,
        index: before.post.pointers.picked as number,
      })
      // Nothing was written or changed: the same records, the same history, the old one current.
      expect(await textRecords(id)).toEqual(rows)
      expect((await store.listHistory(id)).map((h) => h.id)).toEqual(history.map((h) => h.id))
    },
    SLOW,
  )

  test(
    'restoreVersion brings an approved text back past a light edit, redrawn with its art; covers count again only for the text they were made for; a structure restored from rendered reopens it (101)',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = ok(await commands.makeCovers(ED, id, version, freshIdea('A quiet desk'))))
      const first = await load(id)
      const revA = first.pointers.revisionId as string
      const covA = first.pointers.coversId as string
      expect(first.current.covers?.id).toBe(covA)

      const edit = { kind: 'phrase', slide: 1, slot: 'phrase', text: 'Side jobs' } as const
      ;({ version } = await done(commands.lightEdit(ED, id, version, edit)))
      const edited = await load(id)
      const revB = edited.pointers.revisionId as string
      expect(edited.current.covers).toBeNull()
      const rows = await textRecords(id)

      ;({ version } = await done(commands.restoreVersion(ED, id, version, revA)))
      const back = await load(id)
      expect(back.stage).toBe('rendered')
      expect(back.pointers.revisionId).toBe(revA)
      expect(back.current.revision?.body.structure).toEqual(
        first.current.revision?.body.structure as never,
      )
      expect(back.current.layout?.body.slides).toEqual(first.current.layout?.body.slides as never)
      expect(back.pointers.renderId).not.toBe(edited.pointers.renderId)
      expect(back.current.render?.body.art).toEqual(edited.current.render?.body.art as never)
      expect(back.current.covers?.id).toBe(covA)
      expect(back.current.sourceCheck?.body.revisionId).toBe(revA)
      expect(await textRecords(id)).toEqual(rows)
      const history = await store.listHistory(id)
      expect(history.filter((h) => h.kind === 'revision').map((h) => [h.id, h.note])).toEqual([
        [revB, 'light edit: phrase'],
        [revA, 'approved'],
      ])

      // The other way round, the covers were made for another text and stop counting.
      ;({ version } = await done(commands.restoreVersion(ED, id, version, revB)))
      expect((await load(id)).current.covers).toBeNull()
      expect((await store.listHistory(id)).map((h) => h.id)).toEqual(history.map((h) => h.id))

      // A structure restored from a rendered post reopens the structures with it.
      const draftsId = history.find((h) => h.kind === 'drafts')?.id as string
      ;({ version } = ok(await commands.restoreVersion(ED, id, version, draftsId)))
      await settled()
      const reopened = await load(id)
      expect(reopened.stage).toBe('structures')
      expect(reopened.pointers.draftsId).toBe(draftsId)
      expect(reopened.pointers.revisionId).toBeNull()
      expect(reopened.current.drafts?.id).toBe(draftsId)
      // A revision is never restored across the gate backwards.
      expect(await commands.restoreVersion(ED, id, reopened.version, revA)).toEqual({
        ok: false,
        error: errors.restoreGate,
      })
    },
    SLOW,
  )

  /** The fact ids of every slot of the post's current revision, slide by slide. */
  const factIdsOf = (post: Awaited<ReturnType<typeof load>>) =>
    post.current.revision?.body.structure.slides.map((s) =>
      Object.fromEntries(Object.entries(s.slots).map(([key, slot]) => [key, slot.factIds])),
    )

  test(
    'a phrase edit makes a new revision with the same fact ids, checked again; an over-limit one is refused (40)',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = ok(await commands.saveSettings(ED, id, version, GENERAL)))
      const before = await load(id)

      const over = { kind: 'phrase', slide: 1, slot: 'phrase', text: 'Part-time work' } as const
      expect(await commands.lightEdit(ED, id, version, over)).toEqual({
        ok: false,
        error: 'Slide 1 · 14 chars (1–10) · Over',
      })
      expect((await load(id)).version).toBe(version)

      const edit = { kind: 'phrase', slide: 1, slot: 'phrase', text: 'Side jobs' } as const
      ;({ version } = await done(commands.lightEdit(ED, id, version, edit)))
      const after = await load(id)
      expect(after.pointers.revisionId).not.toBe(before.pointers.revisionId)
      expect(after.current.revision?.body.note).toBe('light edit: phrase')
      expect(after.current.revision?.body.structure.slides[0].slots.phrase.text).toBe('Side jobs')
      expect(after.current.revision?.body.factsId).toBe(before.current.facts?.id as string)
      expect(factIdsOf(after)).toEqual(factIdsOf(before) as never)
      expect(after.current.render?.body.art).toEqual(before.current.render?.body.art as never)
      // The new revision is checked by itself; its claim not found still holds review back.
      expect(after.current.sourceCheck?.body.revisionId).toBe(after.pointers.revisionId as string)
      expect(await commands.sendToReview(ED, id, version)).toEqual({
        ok: false,
        error: errors.notFound,
      })
    },
    SLOW,
  )

  test(
    'reorder swaps body slides 2 and 3; the cover and the take stay first and last (40)',
    async () => {
      const { id, version } = await rendered(ED)
      const before = await load(id)
      const slides = before.current.revision?.body.structure.slides ?? []
      const bodies = slides.filter((s) => s.kind === 'body')
      expect(bodies.length).toBeGreaterThanOrEqual(3)

      expect(
        await commands.lightEdit(ED, id, version, { kind: 'reorder', from: 2, to: 9 }),
      ).toEqual({ ok: false, error: errors.movedOn })
      await done(commands.lightEdit(ED, id, version, { kind: 'reorder', from: 2, to: 3 }))
      const after = await load(id)
      const next = after.current.revision?.body.structure.slides ?? []
      expect(after.current.revision?.body.note).toBe('reorder')
      expect(next.map((s) => s.kind)).toEqual(slides.map((s) => s.kind))
      expect(next[0]).toEqual(slides[0])
      expect(next.at(-1)).toEqual(slides.at(-1) as never)
      const moved = next.filter((s) => s.kind === 'body')
      expect(moved[0]).toEqual(bodies[0])
      expect(moved[1]).toEqual(bodies[2])
      expect(moved[2]).toEqual(bodies[1])
      expect(factIdsOf(after)?.flatMap(Object.values).flat().sort()).toEqual(
        factIdsOf(before)?.flatMap(Object.values).flat().sort() as never,
      )
    },
    SLOW,
  )

  test(
    'swapImage keeps the revision and the source check, from the library or an earlier art (40)',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = ok(await commands.checkSource(ED, id, version)))
      const before = await load(id)
      const first = before.current.render?.body
      if (!first?.art.assetId) throw new Error('no art')

      const library = { kind: 'swapImage', image: { library: 'open-book' } } as const
      ;({ version } = await done(commands.lightEdit(ED, id, version, library)))
      const swapped = await load(id)
      const render = swapped.current.render?.body
      expect(swapped.pointers.renderId).not.toBe(before.pointers.renderId)
      expect(swapped.pointers.revisionId).toBe(before.pointers.revisionId)
      expect(swapped.current.sourceCheck?.id).toBe(before.current.sourceCheck?.id as string)
      expect(render?.art.assetId).not.toBe(first.art.assetId)
      expect(render?.slides[0].pngAssetId).not.toBe(first.slides[0].pngAssetId)
      expect(render?.slides.slice(1)).toEqual(first.slides.slice(1))

      // The library image is not offered as an earlier version; the first art is.
      expect(await commands.earlierArt(id)).toEqual([
        { assetId: first.art.assetId, version: 1, prompt: first.art.prompt },
      ])
      const back = { kind: 'swapImage', image: { assetId: first.art.assetId } } as const
      ;({ version } = await done(commands.lightEdit(ED, id, version, back)))
      expect((await load(id)).current.render?.body).toEqual(first)

      for (const image of [{ library: '../open-book' }, { assetId: 'not-this-posts-art' }]) {
        expect(await commands.lightEdit(ED, id, version, { kind: 'swapImage', image })).toEqual({
          ok: false,
          error: errors.movedOn,
        })
      }
    },
    SLOW,
  )

  // ── Covers (criteria 102, 103) ──────────────────────────────────────────────────────────

  /** An idea of letters only that no other test gives, so no other post's cached art answers it. */
  const freshIdea = (words: string) =>
    `${words} ${randomUUID()
      .replace(/[^a-f]/g, '')
      .slice(0, 12)}`

  /** The art cache key of one cover option, as ai/art.ts computes it. */
  const coverKey = (prompt: string, set: number, option: number, attempt = 1) =>
    sha256Hex(
      canonicalJson({
        model: process.env.GEMINI_IMAGE_MODEL ?? '',
        prompt,
        aspectRatio: '4:5',
        set,
        option,
        attempt,
      }),
    )

  /** The post's model calls of one use case: those that reached the model, or with `cached` all. */
  async function modelCalls(postId: string, useCase: string, cached = false) {
    return db
      .select({ id: schema.aiCall.id })
      .from(schema.aiCall)
      .where(
        orm.and(
          orm.eq(schema.aiCall.postId, postId),
          orm.eq(schema.aiCall.useCase, useCase),
          cached ? undefined : orm.eq(schema.aiCall.cached, false),
        ),
      )
  }

  test(
    "the render's cover is drawn from a prompt code builds: the version's scene, its angle and the rule against text (102)",
    async () => {
      const { id } = await rendered(ED)
      const post = await load(id)
      const prompt = post.current.render?.body.art.prompt ?? ''
      expect(prompt).toStartWith(post.current.revision?.body.structure.artPrompt ?? '-')
      expect(prompt).toContain('Angle: The surprising number.')
      expect(prompt).toContain(
        'No text, letters, numbers, logos or watermarks anywhere in the image.',
      )
      // The brand guideline code appends carries hex codes; the rule is about the prompt's own words.
      const heading = '\n\nBrand guideline for the image:\n'
      expect(prompt).toContain(heading)
      expect(prompt.slice(0, prompt.lastIndexOf(heading))).not.toMatch(/\d/)
    },
    SLOW,
  )

  test(
    'makeCovers draws three options for the text, each its own image call and cache key, each checked for text (102, 103)',
    async () => {
      let { id, version } = await rendered(ED)
      const renderId = (await load(id)).pointers.renderId
      const idea = freshIdea('A rainy window')
      const images = (await modelCalls(id, 'art')).length
      // The same art read before is answered from the cache: every image is checked either way.
      const checks = (await modelCalls(id, 'art_check', true)).length
      ;({ version } = ok(await commands.makeCovers(ED, id, version, ` ${idea} `)))
      const post = await load(id)
      expect(post.version).toBe(version)
      expect(post.stage).toBe('rendered')
      const options = post.current.covers?.body.options ?? []
      expect(post.current.covers?.body.revisionId).toBe(post.pointers.revisionId as string)
      expect(options).toHaveLength(3)
      for (const option of options) {
        expect(option).toMatchObject({ set: 1, fallback: null })
        expect(option.assetId).not.toBeNull()
        expect(option.previewAssetId).not.toBeNull()
        expect(option.prompt).toContain(`Idea: ${idea}.`)
      }
      expect((await modelCalls(id, 'art')).length - images).toBe(3)
      expect((await modelCalls(id, 'art_check', true)).length - checks).toBe(3)
      const keys = [1, 2, 3].map((option) => coverKey(options[0].prompt, 1, option))
      const cached = await db
        .select({ key: schema.aiCache.key })
        .from(schema.aiCache)
        .where(orm.inArray(schema.aiCache.key, keys))
      expect(cached.map((c) => c.key).sort()).toEqual([...keys].sort())
      // The render stands until the editor picks one.
      expect(post.pointers.renderId).toBe(renderId)
    },
    SLOW,
  )

  test(
    '"Another set" adds three more, and "Use this cover" makes art version 2 that changes only the cover (41, 102)',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = ok(await commands.checkSource(ED, id, version)))
      ;({ version } = ok(await commands.makeCovers(ED, id, version, '')))
      ;({ version } = ok(await commands.makeCovers(ED, id, version, freshIdea('A desk [cc:blue]'))))
      const before = await load(id)
      const first = before.current.render?.body
      const options = before.current.covers?.body.options ?? []
      expect(options.map((o) => o.set)).toEqual([1, 1, 1, 2, 2, 2])
      if (!first) throw new Error('no render')

      ;({ version } = ok(await commands.chooseCover(ED, id, version, 4)))
      const after = await load(id)
      const render = after.current.render?.body
      expect(render?.art).toMatchObject({
        assetId: options[4].assetId as string,
        prompt: options[4].prompt,
        version: 2,
        fallback: null,
      })
      expect(render?.art.assetId).not.toBe(first.art.assetId)
      expect(render?.slides[0].pngAssetId).toBe(options[4].previewAssetId as string)
      expect(render?.slides.slice(1)).toEqual(first.slides.slice(1))
      expect(after.pointers.revisionId).toBe(before.pointers.revisionId)
      expect(after.current.sourceCheck?.id).toBe(before.current.sourceCheck?.id as string)
      // The options stay to choose from.
      expect(after.current.covers?.id).toBe(before.current.covers?.id as string)
    },
    SLOW,
  )

  test(
    'an option with text is drawn again once; one with text again is never offered and shows No art (103)',
    async () => {
      let { id, version } = await rendered(ED)
      const images = (await modelCalls(id, 'art')).length
      ;({ version } = ok(
        await commands.makeCovers(ED, id, version, freshIdea('A shop front [fake:art-text]')),
      ))
      const options = (await load(id)).current.covers?.body.options ?? []
      expect(options.map((o) => [o.assetId, o.previewAssetId, o.fallback])).toEqual([
        [null, null, 'no_art'],
        [null, null, 'no_art'],
        [null, null, 'no_art'],
      ])
      expect((await modelCalls(id, 'art')).length - images).toBe(6)
      // Nothing to use: the render stands.
      expect(await commands.chooseCover(ED, id, version, 0)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )

  test(
    'an idea with a digit, a brand or over 120 characters is refused before any call (38, 102)',
    async () => {
      const { id, version } = await rendered(ED)
      const images = (await modelCalls(id, 'art')).length
      for (const idea of ['Three 3 books', 'A Cerebral poster', 'A desk with "hello"']) {
        expect(await commands.makeCovers(ED, id, version, idea)).toEqual({
          ok: false,
          error: artPromptError,
        })
      }
      expect(await commands.makeCovers(ED, id, version, 'x'.repeat(121))).toEqual({
        ok: false,
        error: errors.coverIdea,
      })
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.pointers.coversId).toBeNull()
      expect((await modelCalls(id, 'art')).length).toBe(images)
    },
    SLOW,
  )

  test(
    'a cover used is numbered past every earlier version, even after a swap back (41)',
    async () => {
      let { id, version } = await rendered(ED)
      const first = (await load(id)).current.render?.body.art
      if (!first?.assetId) throw new Error('no art')
      ;({ version } = ok(await commands.makeCovers(ED, id, version, freshIdea('A desk [cc:blue]'))))
      ;({ version } = ok(await commands.chooseCover(ED, id, version, 0)))
      expect((await load(id)).current.render?.body.art.version).toBe(2)

      const back = { kind: 'swapImage', image: { assetId: first.assetId } } as const
      ;({ version } = await done(commands.lightEdit(ED, id, version, back)))
      expect((await load(id)).current.render?.body.art.version).toBe(1)

      ok(await commands.chooseCover(ED, id, version, 1))
      expect((await load(id)).current.render?.body.art.version).toBe(3)
    },
    SLOW,
  )

  test(
    'covers drawn for older text are not offered once the text changes (102)',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = ok(await commands.makeCovers(ED, id, version, freshIdea('A desk [cc:blue]'))))
      const edit = { kind: 'phrase', slide: 1, slot: 'phrase', text: 'Side jobs' } as const
      ;({ version } = await done(commands.lightEdit(ED, id, version, edit)))
      const after = await load(id)
      expect(after.pointers.coversId).not.toBeNull()
      expect(after.current.covers).toBeNull()
      expect(await commands.chooseCover(ED, id, version, 0)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      // A new set starts again from the first.
      ;({ version } = ok(await commands.makeCovers(ED, id, version, '')))
      expect((await load(id)).current.covers?.body.options.map((o) => o.set)).toEqual([1, 1, 1])
    },
    SLOW,
  )

  test(
    'light edits and covers are refused for a reviewer and an admin, and in review',
    async () => {
      const { id, version } = await rendered(ED)
      const edit = { kind: 'reorder', from: 1, to: 2 } as const
      for (const actor of [REV, ADMIN]) {
        expect(await commands.lightEdit(actor, id, version, edit)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
        expect(await commands.makeCovers(actor, id, version, '')).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
        expect(await commands.chooseCover(actor, id, version, 0)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect((await load(id)).version).toBe(version)

      const review = await inReview(ED)
      expect(await commands.lightEdit(ED, review.id, review.version, edit)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      expect(await commands.makeCovers(ED, review.id, review.version, '')).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      expect(await commands.chooseCover(ED, review.id, review.version, 0)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )

  test(
    'two renders at once: one renders, the other is refused as running',
    async () => {
      const { id, version } = await approved(ED, 'the-line')
      const results = await Promise.all([
        commands.renderPost(ED, id, version),
        commands.renderPost(ED, id, version),
      ])
      expect(results.filter((r) => r.ok)).toHaveLength(1)
      expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: errors.running }])
    },
    SLOW,
  )

  // ── Market versions (Nepal here; every market alike: 56–61, 85) ─────────────────────────

  /** Paid-work with its money paragraph first, so the-line's first body slide carries AUD 499. */
  async function moneySource() {
    const { PAID_WORK_TEXTS } = await import('../demo-sources/paid-work')
    const [p1, p2, p3, p4, p5] = PAID_WORK_TEXTS
    return {
      title: 'CC money first',
      kind: 'research summary',
      text: [p5, p2, p3, p1, p4].join('\n\n'),
    }
  }

  test(
    'makeMarket NP at rendered stores, at once and with no model call, a market whose money slide reads AUD 499 (≈ NPR 43,900) with the rate line in the approved wording, and leaves facts and bindings untouched (57, 59, 110)',
    async () => {
      const { id, version } = await rendered(ED, await moneySource())
      const before = await load(id)
      const saved = ok(await commands.makeMarket(ED, id, version, 'NP'))
      const after = await load(id)
      expect(after.stage).toBe('rendered')
      const market = after.current.market
      if (!market) throw new Error('no market')
      // Made by code alone: the model is not asked, nothing is reworded, and the feed excerpt is
      // the default version's (110).
      expect(await modelCalls(id, 'market', true)).toEqual([])
      expect(market.body.reworded ?? false).toBe(false)
      expect(market.body.slots).toEqual([])
      expect(market.body.feedExcerpt).toBe(
        before.current.revision?.body.structure.slides
          .map((s) => s.slots.body?.text)
          .find((t) => t) ?? '-',
      )
      expect(market.body.replays).toEqual([])

      const body = market.body.layout[1].lines
        .filter((l) => l.slot === 'body')
        .map((l) => l.text)
        .join(' ')
      expect(body).toContain('AUD 499 (≈ NPR 43,900)')
      const svg = await store.getAsset(market.body.slides[1].svgAssetId)
      expect(new TextDecoder().decode(svg?.bytes)).toContain(
        'NPR at 88 per AUD · mock rate · 1 Oct 2026',
      )
      // The rate line goes only on a slide that carries a conversion.
      const take = await store.getAsset(market.body.slides[4].svgAssetId)
      expect(new TextDecoder().decode(take?.bytes)).not.toContain('NPR at 88')
      expect(market.body.conversions.map((c) => c.from)).toContain('AUD 499')
      expect(market.body.fitChecks.every((c) => c.pass)).toBe(true)

      // Facts, revision and bindings are the default version's.
      expect(after.pointers.factsId).toBe(before.pointers.factsId)
      expect(after.pointers.revisionId).toBe(before.pointers.revisionId)
      expect(after.pointers.renderId).toBe(before.pointers.renderId)
      expect(after.current.revision?.body).toEqual(before.current.revision?.body)
      expect(saved.version).toBe(version + 1)
    },
    SLOW,
  )

  test(
    'rewordMarket runs the model on top of the instant version: a new market record with the presentational slots reworded, the excerpt framed, the money still converted (56, 110)',
    async () => {
      let { id, version } = await rendered(ED, await moneySource())
      ;({ version } = await done(commands.makeMarket(ED, id, version, 'NP')))
      const instant = await load(id)
      const saved = ok(await commands.rewordMarket(ED, id, version))
      const after = await load(id)
      const market = after.current.market
      if (!market) throw new Error('no market')
      expect(after.stage).toBe('rendered')
      expect(saved.version).toBe(version + 1)
      expect(market.id).not.toBe(instant.current.market?.id)
      expect(after.pointers.marketId).toBe(market.id)
      expect(market.body.market).toBe('NP')
      expect(market.body.renderId).toBe(instant.current.market?.body.renderId ?? '')
      expect(market.body.reworded).toBe(true)
      expect(market.body.slots.map((s) => `${s.slide}:${s.slot}`).sort()).toEqual([
        '1:kicker',
        '1:phrase',
        '5:takeaway',
      ])
      expect(market.body.feedExcerpt).toBe("Deciding with your family how many hours you'll work?")
      expect(
        market.body.layout[0].lines
          .filter((l) => l.slot === 'kicker')
          .map((l) => l.text)
          .join(' '),
      ).toContain('With your family')
      expect(market.body.conversions).toEqual(instant.current.market?.body.conversions ?? [])
      expect(await modelCalls(id, 'market', true)).toHaveLength(1)
    },
    SLOW,
  )

  test(
    'rewordMarket is refused before there is a market version, and for a reviewer (110)',
    async () => {
      let { id, version } = await rendered(ED, await moneySource())
      expect(await commands.rewordMarket(ED, id, version)).toEqual({
        ok: false,
        error: 'Make the market version first.',
      })
      expect((await load(id)).version).toBe(version)
      ;({ version } = await done(commands.makeMarket(ED, id, version, 'NP')))
      expect(await commands.rewordMarket(REV, id, version)).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      expect((await load(id)).version).toBe(version)
      expect(await modelCalls(id, 'market', true)).toEqual([])
    },
    SLOW,
  )

  test(
    'makeMarket IN stores a market body for India whose conversions are into INR at the file rate (85)',
    async () => {
      const { id, version } = await rendered(ED, await moneySource())
      await done(commands.makeMarket(ED, id, version, 'IN'))
      const market = (await load(id)).current.market
      if (!market) throw new Error('no market')
      expect(market.body.market).toBe('IN')
      // Every money figure the source quotes goes into INR at the file's AUD row.
      expect(market.body.conversions.length).toBeGreaterThan(0)
      expect(new Set(market.body.conversions.map((c) => c.toCurrency))).toEqual(new Set(['INR']))
      expect(market.body.conversions).toContainEqual(
        expect.objectContaining({ from: 'AUD 499', rate: 55, toCurrency: 'INR' }),
      )
      expect((await store.listCards()).find((c) => c.id === id)?.market).toBe('IN')
    },
    SLOW,
  )

  test(
    'makeMarket is refused in review as moved on, for a reviewer, and for a market not in the file (61, 85)',
    async () => {
      const review = await inReview(ED)
      expect(await commands.makeMarket(ED, review.id, review.version, 'NP')).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      const { id, version } = await rendered(ED)
      expect(await commands.makeMarket(REV, id, version, 'NP')).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      expect(await commands.makeMarket(ED, id, version, 'XX')).toEqual({
        ok: false,
        error: 'Choose a market.',
      })
      expect((await load(id)).pointers.marketId).toBeNull()
      expect((await load(id)).version).toBe(version)
    },
    SLOW,
  )

  test(
    'a reworded slot that overflows its box fails the rewording on every attempt, and nothing is cached or stored: the instant version stays',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = await done(commands.makeMarket(ED, id, version, 'NP')))
      const instant = await load(id)
      // An answer cached by another test would answer instead of this one.
      await forgetMarketAnswers()
      marketAnswer = () => ({
        slots: [{ slide: 1, slot: 'kicker', text: 'WWWWWWWWWWWWWWW WWWWWWWWWWWWWW' }],
        feed_excerpt: 'Deciding together.',
      })
      try {
        expect(await commands.rewordMarket(ED, id, version)).toEqual({
          ok: false,
          error: aiFailed,
        })
        const cached = await db
          .select({ key: schema.aiCache.key })
          .from(schema.aiCache)
          .where(
            orm.and(
              orm.eq(schema.aiCache.useCase, 'market'),
              orm.like(schema.aiCache.model, 'cc-%'),
            ),
          )
        expect(cached).toEqual([])
      } finally {
        marketAnswer = null
        await forgetMarketAnswers()
      }
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.pointers.marketId).toBe(instant.pointers.marketId)
      expect(after.current.market?.body.reworded ?? false).toBe(false)
    },
    SLOW,
  )

  test(
    'a factual slot that overflows only once its figure is converted is refused with its fit row, with no model to retry',
    async () => {
      // The first body fits its box at 17 lines; with " (≈ NPR 43,900)" it needs 18. Rewording the
      // presentational slots cannot change that, so it is the fit row that refuses, not the model.
      draftTweak = (answer) => {
        for (const version of answer.versions) {
          const body = version.slides[1].slots.find((slot) => slot.key === 'body')
          if (!body) throw new Error('no body slot')
          body.text = `The course costs AUD 499 ${Array(49).fill('unquestionably').join(' ')}`
        }
        return answer
      }
      const source = await moneySource()
      let id: string
      let version: number
      try {
        ;({ id, version } = await rendered(ED, {
          ...source,
          text: `${source.text}

Cc overflow marker paragraph.`,
        }))
      } finally {
        draftTweak = null
      }
      await forgetMarketAnswers()
      try {
        expect(await commands.makeMarket(ED, id, version, 'NP')).toEqual({
          ok: false,
          error: 'Slide 2 · body · needs 18 lines, room for 17 · Over',
        })
      } finally {
        await forgetMarketAnswers()
      }
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.pointers.marketId).toBeNull()
    },
    SLOW,
  )

  test(
    'a look post whose body slide says "AUD 30,000 a year" gets its Nepal version: the words the conversion adds do not count against the slot',
    async () => {
      const { PAID_WORK_TEXTS } = await import('../demo-sources/paid-work')
      const fee = 'Tuition for an international student costs about AUD 30,000 a year (mock).'
      const source = {
        title: 'CC tuition',
        kind: 'research summary',
        text: [...PAID_WORK_TEXTS, fee].join('\n\n'),
      }
      // 23 words, the figure bound to the fee's fact: " (≈ NPR …)" would make it 26 of 25.
      const body =
        'Tuition for an international student costs about AUD 30,000 a year, so every paid shift has to fit around classes, rest and sleep.'
      draftTweak = (answer) => {
        const { facts } = draftData.at(-1) as { facts: { id: string; text: string }[] }
        const bound = facts.find((f) => f.text.includes('AUD 30,000'))
        if (!bound) throw new Error('no tuition fact')
        for (const version of answer.versions) {
          const slot = version.slides[1].slots.find((s) => s.key === 'body') as
            | { key: string; text: string; fact_ids: string[] }
            | undefined
          if (!slot) throw new Error('no body slot on slide 2')
          slot.text = body
          slot.fact_ids = [bound.id]
        }
        return answer
      }
      let id: string
      let version: number
      try {
        ;({ id, version } = await picked(ED, 'field-notes', source))
      } finally {
        draftTweak = null
      }
      ;({ version } = await done(commands.approveStructure(ED, id, version)))
      ;({ version } = await done(commands.drawImages(ED, id, version)))
      expect((await load(id)).stage).toBe('rendered')

      ok(await commands.makeMarket(ED, id, version, 'NP'))
      const market = (await load(id)).current.market
      if (!market) throw new Error('no market version')
      const text = market.body.layout[1].lines
        .filter((l) => l.slot === 'body')
        .map((l) => l.text)
        .join(' ')
      expect(text).toContain('AUD 30,000 (≈ NPR')
      expect(market.body.fitChecks.find((c) => c.slide === 2 && c.slot === 'body')).toMatchObject({
        check: 'length',
        value: 23,
        pass: true,
      })
    },
    SLOW,
  )

  test(
    'new cover art drops the Nepal version until it is made again, on the post and the board',
    async () => {
      let { id, version } = await rendered(ED, await moneySource())
      ;({ version } = await done(commands.makeMarket(ED, id, version, 'NP')))
      const first = await load(id)
      expect(first.current.market?.body.renderId).toBe(first.pointers.renderId ?? '')

      ;({ version } = ok(await commands.makeCovers(ED, id, version, freshIdea('A desk [cc:blue]'))))
      ;({ version } = ok(await commands.chooseCover(ED, id, version, 0)))
      const regenerated = await load(id)
      expect(regenerated.current.market).toBeNull()
      expect((await store.listCards()).find((c) => c.id === id)?.market).toBeNull()

      ;({ version } = await done(commands.makeMarket(ED, id, version, 'NP')))
      const again = await load(id)
      expect(again.current.market?.body.renderId).toBe(again.pointers.renderId ?? '')
      expect(again.current.market?.id).not.toBe(first.current.market?.id)
      expect((await store.listCards()).find((c) => c.id === id)?.market).toBe('NP')
    },
    SLOW,
  )

  test(
    'the approval pins the Nepal version, and the board reports it (56, 60)',
    async () => {
      let { id, version } = await rendered(BOTH, await moneySource())
      ;({ version } = await done(commands.makeMarket(BOTH, id, version, 'NP')))
      const marketId = (await load(id)).pointers.marketId
      expect(marketId).not.toBeNull()
      expect((await store.listCards()).find((c) => c.id === id)?.market).toBe('NP')

      ;({ version } = ok(await commands.checkSource(BOTH, id, version)))
      ;({ version } = ok(await commands.saveSettings(BOTH, id, version, GENERAL)))
      const claims = (await load(id)).current.sourceCheck?.body.claims ?? []
      for (const [i, claim] of claims.entries()) {
        if (claim.result === 'not_found') {
          ;({ version } = ok(await commands.markOpinion(BOTH, id, version, i)))
        }
      }
      ;({ version } = ok(await commands.sendToReview(BOTH, id, version)))
      ok(await commands.approveAndPublish(BOTH, id, version))
      const live = await load(id)
      expect(live.stage).toBe('live')
      expect(live.current.approval?.body.marketId).toBe(marketId)
      expect(live.current.market?.id ?? null).toBe(marketId)
    },
    SLOW,
  )

  // ── The moves back (story 14) ──────────────────────────────────────────────────────────────────

  /** Every record of the post, by id. */
  const recordIds = async (id: string) =>
    (
      await db
        .select({ id: schema.contentArtifact.id })
        .from(schema.contentArtifact)
        .where(orm.eq(schema.contentArtifact.postId, id))
    )
      .map((r) => r.id)
      .sort()

  /** The approval students see (Task 60). */
  const publishedOf = async (id: string) => {
    const [row] = await db
      .select({
        published: schema.contentPost.publishedApprovalId,
        slug: schema.contentPost.slug,
      })
      .from(schema.contentPost)
      .where(orm.eq(schema.contentPost.id, id))
    if (!row) throw new Error(`post ${id} missing`)
    return row
  }

  /** A step of the post held running, as runStep holds it, until freed. */
  async function holdStep(id: string, step: string) {
    await db
      .insert(schema.contentStep)
      .values({ postId: id, step, status: 'running', startedVersion: 1, startedAt: orm.sql`now()` })
      .onConflictDoUpdate({
        target: [schema.contentStep.postId, schema.contentStep.step],
        set: { status: 'running', startedAt: orm.sql`now()` },
      })
  }
  async function freeStep(id: string, step: string) {
    await db
      .update(schema.contentStep)
      .set({ status: 'done', finishedAt: orm.sql`now()` })
      .where(orm.and(orm.eq(schema.contentStep.postId, id), orm.eq(schema.contentStep.step, step)))
  }

  /** A heading no drafted version has: a changed text that still fits. */
  const NEW_HEADING = 'Hours that count'

  /** Settings, the not-found claims marked opinion, and to review, as inReview does. */
  async function toReview(actor: typeof ED, id: string, at: number) {
    let version = ok(await commands.saveSettings(actor, id, at, GENERAL)).version
    const claims = (await load(id)).current.sourceCheck?.body.claims ?? []
    for (const [i, claim] of claims.entries()) {
      if (claim.result === 'not_found') {
        ;({ version } = ok(await commands.markOpinion(actor, id, version, i)))
      }
    }
    return ok(await commands.sendToReview(actor, id, version))
  }

  test(
    'goBack to the text versions from approved and rendered clears everything from the revision on, keeps the source, facts, versions and pick, and deletes no record (112)',
    async () => {
      for (const make of [() => approved(ED, 'the-line'), () => rendered(ED)]) {
        const { id } = await make()
        await settled()
        const before = await load(id)
        const records = await recordIds(id)
        ok(await commands.goBack(ED, id, before.version, 'structures'))
        await settled()
        const after = await load(id)
        expect(after.stage).toBe('structures')
        for (const key of ['sourceId', 'factsId', 'draftsId', 'picked', 'themeId'] as const) {
          expect(after.pointers[key]).toBe(before.pointers[key] as never)
        }
        for (const key of [
          'revisionId',
          'layoutId',
          'renderId',
          'coversId',
          'settingsId',
          'approvalId',
          'sendBackId',
        ] as const) {
          expect(after.pointers[key]).toBeNull()
        }
        expect(await recordIds(id)).toEqual(expect.arrayContaining(records))
      }
    },
    SLOW,
  )

  test(
    'goBack to the source from structures, approved and rendered lands at source, keeping the source, facts, versions and pick (112)',
    async () => {
      for (const make of [
        async () => {
          const { id } = await picked(ED, 'the-line')
          await settled()
          return { id }
        },
        () => approved(ED, 'the-line'),
        () => rendered(ED),
      ]) {
        const { id } = await make()
        await settled()
        const before = await load(id)
        const records = await recordIds(id)
        ok(await commands.goBack(ED, id, before.version, 'source'))
        await settled()
        const after = await load(id)
        expect(after.stage).toBe('source')
        for (const key of ['sourceId', 'factsId', 'draftsId', 'picked'] as const) {
          expect(after.pointers[key]).toBe(before.pointers[key] as never)
        }
        for (const key of ['revisionId', 'layoutId', 'renderId', 'approvalId'] as const) {
          expect(after.pointers[key]).toBeNull()
        }
        expect(await recordIds(id)).toEqual(records)
      }
    },
    SLOW,
  )

  test(
    'a move from a stage it does not run at is moved on, and a reviewer without editor is refused; nothing moves (112, 115, 116)',
    async () => {
      const { id, version } = await rendered(ED)
      await settled()
      expect(await commands.editLive(ED, id, version)).toEqual({ ok: false, error: errors.movedOn })
      expect(await commands.withdrawFromReview(ED, id, version)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      for (const run of [
        () => commands.goBack(REV, id, version, 'structures'),
        () => commands.goBack(REV, id, version, 'source'),
        () => commands.goBack(ADMIN, id, version, 'structures'),
      ]) {
        expect(await run()).toEqual({ ok: false, error: errors.notAuthorised })
      }
      const review = await inReview(ED)
      expect(await commands.withdrawFromReview(REV, review.id, review.version)).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      expect(await commands.goBack(ED, review.id, review.version, 'structures')).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      expect((await load(id)).version).toBe(version)
      expect((await load(review.id)).version).toBe(review.version)
    },
    SLOW,
  )

  test(
    'every move back is refused, naming the step, while a step of the post runs (118)',
    async () => {
      const { id, version } = await rendered(ED)
      await settled()
      await holdStep(id, 'covers')
      try {
        for (const to of ['structures', 'source'] as const) {
          expect(await commands.goBack(ED, id, version, to)).toEqual({
            ok: false,
            error: 'Covers are being drawn. Wait for it to finish.',
          })
        }
      } finally {
        await freeStep(id, 'covers')
      }
      expect((await load(id)).version).toBe(version)

      const review = await inReview(ED)
      await settled()
      await holdStep(review.id, 'source_check')
      try {
        expect(await commands.withdrawFromReview(ED, review.id, review.version)).toEqual({
          ok: false,
          error: 'The source check is running. Wait for it to finish.',
        })
      } finally {
        await freeStep(review.id, 'source_check')
      }
      expect((await load(review.id)).stage).toBe('in_review')
    },
    SLOW,
  )

  test(
    "withdrawFromReview returns the post to rendered with no send-back, off the reviewer's waiting list, and it can be sent to review again (115)",
    async () => {
      const { id, version } = await inReview(ED)
      await settled()
      const before = await load(id)
      const records = await recordIds(id)
      const withdrawn = ok(await commands.withdrawFromReview(ED, id, version))
      const after = await load(id)
      expect(after.stage).toBe('rendered')
      expect(after.pointers).toEqual(before.pointers)
      expect(await recordIds(id)).toEqual(records)
      expect((await store.listCards()).find((c) => c.id === id)?.stage).toBe('rendered')

      ok(await commands.sendToReview(ED, id, withdrawn.version))
      expect((await load(id)).stage).toBe('in_review')
    },
    SLOW,
  )

  test(
    'editLive takes a live post back to its text versions while students keep the live version; a changed text published again replaces it at the same slug (116, 117)',
    async () => {
      const review = await inReview(ED)
      ok(await commands.approveAndPublish(REV, review.id, review.version))
      const id = review.id
      const live = await load(id)
      const published = await publishedOf(id)
      expect(published.slug).not.toBeNull()
      const slug = published.slug as string
      const feedBefore = (await store.listLive()).find((p) => p.id === id)
      const pageBefore = await store.liveBySlug(slug)
      expect(feedBefore).toBeDefined()
      expect(pageBefore).not.toBeNull()
      const records = await recordIds(id)

      // A step running refuses the edit, naming it.
      await holdStep(id, 'market')
      try {
        expect(await commands.editLive(ED, id, live.version)).toEqual({
          ok: false,
          error: 'The market version is being made. Wait for it to finish.',
        })
      } finally {
        await freeStep(id, 'market')
      }
      expect(await commands.editLive(REV, id, live.version)).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })

      ok(await commands.editLive(ED, id, live.version))
      await settled()
      const editing = await load(id)
      expect(editing.stage).toBe('structures')
      expect(editing.pointers.approvalId).toBeNull()
      expect(editing.pointers.revisionId).toBeNull()
      expect(editing.pointers.draftsId).toBe(live.pointers.draftsId)
      expect(editing.pointers.picked).toBe(live.pointers.picked)
      expect(await recordIds(id)).toEqual(expect.arrayContaining(records))
      expect(await publishedOf(id)).toEqual(published)
      expect((await store.listLive()).find((p) => p.id === id)).toEqual(feedBefore as never)
      expect(await store.liveBySlug(slug)).toEqual(pageBefore)

      // A changed text, approved, rendered, reviewed and published, replaces it at the same slug.
      const { at } = await pickedVersion(id)
      let { version } = ok(
        await commands.editSlot(ED, id, editing.version, {
          ...at,
          slot: 'heading',
          text: NEW_HEADING,
        }),
      )
      await settled()
      ;({ version } = ok(await commands.approveStructure(ED, id, version)))
      await settled()
      ;({ version } = await done(commands.renderPost(ED, id, version)))
      // Nothing reaches students before it is published.
      expect(await store.liveBySlug(slug)).toEqual(pageBefore)
      ;({ version } = await toReview(ED, id, version))
      ok(await commands.approveAndPublish(REV, id, version))
      const republished = await load(id)
      expect(republished.stage).toBe('live')
      const now = await publishedOf(id)
      expect(now.slug).toBe(slug)
      expect(now.published).toBe(republished.pointers.approvalId as string)
      expect(now.published).not.toBe(published.published)
      const page = await store.liveBySlug(slug)
      expect(page?.main.slides).not.toEqual(pageBefore?.main.slides as never)
      expect(JSON.stringify(page?.main)).toContain(NEW_HEADING)
    },
    SLOW,
  )

  test(
    'discardChanges returns an edited live post to live with its published records; the live pages stay as they were and the discarded work stays in the history (119)',
    async () => {
      const review = await inReview(ED)
      ok(await commands.approveAndPublish(REV, review.id, review.version))
      const id = review.id
      const live = await load(id)
      const published = await publishedOf(id)
      const slug = published.slug as string
      const pageBefore = await store.liveBySlug(slug)
      const feedBefore = (await store.listLive()).find((p) => p.id === id)
      expect(pageBefore).not.toBeNull()

      // Edited: taken back, its source remade, so even the facts and source move.
      ok(await commands.editLive(ED, id, live.version))
      await settled()
      ok(await commands.goBack(ED, id, (await load(id)).version, 'source'))
      await settled()
      ok(
        await commands.remakeFromSource(ED, id, (await load(id)).version, {
          text: changedText(),
        }),
      )
      await settled()
      const edited = await load(id)
      expect(edited.pointers.sourceId).not.toBe(live.pointers.sourceId)
      const discarded = edited.pointers.draftsId as string
      const records = await recordIds(id)

      expect(await commands.discardChanges(REV, id, edited.version)).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      ok(await commands.discardChanges(ED, id, edited.version))
      const back = await load(id)
      expect(back.stage).toBe('live')
      for (const key of [
        'approvalId',
        'revisionId',
        'layoutId',
        'renderId',
        'sourceCheckId',
        'settingsId',
        'marketId',
        'factsId',
        'sourceId',
        'draftsId',
        'picked',
      ] as const) {
        expect(back.pointers[key]).toBe(live.pointers[key] as never)
      }
      // The versions it was picked from, read back from the history.
      expect(back.pointers.ticked).toEqual(live.pointers.ticked)
      // The published approval counts again on the post itself.
      expect(back.current.approval?.id).toBe(published.published as string)
      expect(await publishedOf(id)).toEqual(published)
      expect(await store.liveBySlug(slug)).toEqual(pageBefore)
      expect((await store.listLive()).find((p) => p.id === id)).toEqual(feedBefore as never)
      // Nothing deleted: the discarded versions are still in the history.
      expect(await recordIds(id)).toEqual(expect.arrayContaining(records))
      expect((await store.listHistory(id)).map((h) => h.id)).toContain(discarded)
    },
    SLOW,
  )

  test(
    'discardChanges brings back the published theme, page and pick after they changed on the same facts (119)',
    async () => {
      const review = await inReview(ED)
      ok(await commands.approveAndPublish(REV, review.id, review.version))
      const id = review.id
      const live = await load(id)
      ok(await commands.editLive(ED, id, live.version))
      await settled()
      let { version } = ok(await commands.choosePage(ED, id, (await load(id)).version, 'cerebral'))
      ;({ version } = ok(await commands.chooseTheme(ED, id, version, 'ink')))
      ;({ version } = ok(await commands.pickStructure(ED, id, version, 2)))
      await settled()
      const edited = await load(id)
      expect(edited.pointers).toMatchObject({ pageBrandId: 'cerebral', themeId: 'ink', picked: 2 })
      expect(edited.pointers.factsId).toBe(live.pointers.factsId as string)

      ok(await commands.discardChanges(ED, id, edited.version))
      const back = await load(id)
      expect(back.stage).toBe('live')
      expect(back.pointers.themeId).toBe(live.pointers.themeId as string)
      expect(back.pointers.pageBrandId).toBeNull()
      expect(back.pointers.picked).toBe(live.pointers.picked as number)
      expect(back.pointers.draftsId).toBe(live.pointers.draftsId as string)
    },
    SLOW,
  )

  test(
    'discardChanges is refused for a post with no published version, and nothing moves (119)',
    async () => {
      const { id } = await rendered(ED)
      await settled()
      const at = (await load(id)).version
      expect(await commands.discardChanges(ED, id, at)).toEqual({
        ok: false,
        error: errors.noPublished,
      })
      expect((await load(id)).version).toBe(at)
    },
    SLOW,
  )

  // ── An edit at a passed step moves the post back by itself (GD28) ─────────────────────────────

  /** Slide `slide`'s first slot of the picked version, its first two words swapped: other text that still fits. */
  async function swappedSlot(id: string, slide: number) {
    const { item } = await pickedVersion(id)
    const [slot, value] = Object.entries(item.structure.slides[slide - 1]?.slots ?? {})[0] ?? []
    if (!slot || !value) throw new Error(`slide ${slide} has no slot`)
    const words = value.text.split(' ')
    ;[words[0], words[1]] = [words[1], words[0]]
    return { slide, slot, text: words.join(' ') }
  }

  test(
    'editSlot on a rendered look post lands at its text versions with the edit saved and no approval, in one save, saying what will be made again (GD28)',
    async () => {
      let { id, version } = await pickedLook()
      ;({ version } = ok(await commands.approveStructure(ED, id, version)))
      await settled()
      ;({ version } = await done(commands.drawImages(ED, id, (await load(id)).version)))
      const before = await load(id)
      expect(before.stage).toBe('rendered')
      const records = await recordIds(id)

      const edit = await swappedSlot(id, 2)
      const edited = ok(await commands.editSlot(ED, id, version, edit))
      expect(edited.version).toBe(version + 1)
      expect(edited.note).toBe('Text changed: the pictures of changed slides will be planned again')
      await settled()
      const after = await load(id)
      expect(after.stage).toBe('structures')
      for (const key of ['revisionId', 'renderId', 'approvalId'] as const) {
        expect(after.pointers[key]).toBeNull()
      }
      expect(after.current.artPlan).toBeNull()
      expect(after.pointers.picked).toBe(before.pointers.picked)
      const item = after.current.drafts?.body.items[after.pointers.picked ?? -1]
      expect(item?.structure.slides[1].slots[edit.slot]?.text).toBe(edit.text)
      expect(after.current.drafts?.body.note).toBe('Slide 2 edited')
      expect(await recordIds(id)).toEqual(expect.arrayContaining(records))
    },
    SLOW,
  )

  test(
    'an edit on a live post moves it back while students keep the published version (GD28, 116)',
    async () => {
      const review = await inReview(ED)
      ok(await commands.approveAndPublish(REV, review.id, review.version))
      const id = review.id
      const live = await load(id)
      const published = await publishedOf(id)
      const pageBefore = await store.liveBySlug(published.slug as string)
      expect(pageBefore).not.toBeNull()

      const { at } = await pickedVersion(id)
      const edited = ok(
        await commands.editSlot(ED, id, live.version, {
          ...at,
          slot: 'heading',
          text: NEW_HEADING,
        }),
      )
      expect(edited.note).toBe(
        'Text changed: the slides will be rendered again · students keep the live version until it is published again',
      )
      await settled()
      const after = await load(id)
      expect(after.stage).toBe('structures')
      expect(after.pointers.approvalId).toBeNull()
      expect(await publishedOf(id)).toEqual(published)
      expect(await store.liveBySlug(published.slug as string)).toEqual(pageBefore)
    },
    SLOW,
  )

  test(
    'an edit at a passed step is refused, naming the step, while a step of the post runs; nothing moves (GD28, 118)',
    async () => {
      const { id, version } = await rendered(ED)
      await settled()
      const { at } = await pickedVersion(id)
      await holdStep(id, 'covers')
      try {
        expect(
          await commands.editSlot(ED, id, version, { ...at, slot: 'heading', text: NEW_HEADING }),
        ).toEqual({ ok: false, error: 'Covers are being drawn. Wait for it to finish.' })
      } finally {
        await freeStep(id, 'covers')
      }
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.stage).toBe('rendered')
    },
    SLOW,
  )

  test(
    'a request for changes naming covers stays current through the moves back and forward, and is cleared by sending to review again (120)',
    async () => {
      const review = await inReview(ED)
      const id = review.id
      ok(await commands.sendBack(REV, id, review.version, 'Make the cover calmer.', 'covers'))
      const sent = await load(id)
      expect(sent.current.sendBack?.body).toMatchObject({
        reason: 'Make the cover calmer.',
        step: 'covers',
      })
      const note = sent.pointers.sendBackId

      ok(await commands.goBack(ED, id, sent.version, 'structures'))
      await settled()
      let post = await load(id)
      expect(post.pointers.sendBackId).toBe(note)
      expect(post.current.sendBack?.body.step).toBe('covers')

      // Forward again on a new revision: still there.
      ok(await commands.approveStructure(ED, id, post.version))
      await settled()
      const { version } = await done(commands.renderPost(ED, id, (await load(id)).version))
      post = await load(id)
      expect(post.pointers.revisionId).not.toBe(sent.pointers.revisionId)
      expect(post.current.sendBack?.id).toBe(note as string)

      ok(await toReview(ED, id, version))
      post = await load(id)
      expect(post.pointers.sendBackId).toBeNull()
      expect(post.current.sendBack).toBeNull()
      // Withdrawn after: nothing comes back.
      ok(await commands.withdrawFromReview(ED, id, post.version))
      expect((await load(id)).current.sendBack).toBeNull()
    },
    SLOW,
  )

  test(
    'covers made before count again when the same text comes back through the moves, and not for a changed text (114)',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = ok(await commands.makeCovers(ED, id, version, freshIdea('A quiet desk'))))
      await settled()
      const first = await load(id)
      const options = first.current.covers?.body.options
      expect(options).toHaveLength(3)

      // Back and forward with the text unchanged: the covers count for the new revision.
      ;({ version } = ok(await commands.goBack(ED, id, first.version, 'structures')))
      await settled()
      ;({ version } = ok(await commands.approveStructure(ED, id, (await load(id)).version)))
      await settled()
      ;({ version } = await done(commands.renderPost(ED, id, (await load(id)).version)))
      const again = await load(id)
      expect(again.pointers.revisionId).not.toBe(first.pointers.revisionId)
      expect(again.current.covers?.body.revisionId).toBe(again.pointers.revisionId as string)
      expect(again.current.covers?.body.options).toEqual(options as never)

      // Back with the text changed: no covers until they are made again.
      ok(await commands.goBack(ED, id, version, 'structures'))
      await settled()
      const { at } = await pickedVersion(id)
      ;({ version } = ok(
        await commands.editSlot(ED, id, (await load(id)).version, {
          ...at,
          slot: 'heading',
          text: NEW_HEADING,
        }),
      ))
      await settled()
      ok(await commands.approveStructure(ED, id, (await load(id)).version))
      await settled()
      await done(commands.renderPost(ED, id, (await load(id)).version))
      const changed = await load(id)
      expect(changed.pointers.coversId).toBeNull()
      expect(changed.current.covers).toBeNull()
    },
    SLOW,
  )

  test(
    'covers made before do not count again when the page changed, though the text is the same (114, 105)',
    async () => {
      let { id, version } = await rendered(ED)
      ;({ version } = ok(await commands.makeCovers(ED, id, version, freshIdea('A quiet desk'))))
      await settled()
      ;({ version } = ok(await commands.goBack(ED, id, (await load(id)).version, 'structures')))
      await settled()
      ;({ version } = ok(await commands.choosePage(ED, id, (await load(id)).version, 'cerebral')))
      ok(await commands.approveStructure(ED, id, version))
      await settled()
      const approved = await load(id)
      expect(approved.pointers.coversId).toBeNull()
      expect(approved.current.covers).toBeNull()
    },
    SLOW,
  )

  /** A post with versions drafted and one picked, taken back to its source. */
  async function atSource(actor: typeof ED) {
    const { id } = await picked(actor, 'the-line')
    await settled()
    ok(await commands.goBack(actor, id, (await load(id)).version, 'source'))
    await settled()
    return load(id)
  }

  /** The source text with a paragraph of its own, so no cached answer serves its calls. */
  const changedText = () => `${paidWork.text}\n\nRun ${randomUUID()} counted every shift.`

  test(
    'remakeFromSource with a changed text makes a new source, facts and versions at structures; the old records stay, and restoring an old version points back at its own facts and source (113)',
    async () => {
      const before = await atSource(ED)
      const id = before.id
      const old = before.pointers
      const records = await recordIds(id)
      const text = changedText()

      ok(await commands.remakeFromSource(ED, id, before.version, { text }))
      await settled()
      let post = await load(id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.sourceId).not.toBe(old.sourceId)
      expect(post.pointers.factsId).not.toBe(old.factsId)
      expect(post.current.source?.body.text).toBe(text)
      expect(post.current.source?.body.title).toBe(before.current.source?.body.title as string)
      expect(post.current.facts?.body.facts.length).toBeGreaterThan(0)
      expect(post.current.drafts?.body.items.map((i) => i.template.id)).toEqual([
        'the-line',
        'the-line',
        'the-line',
      ])
      expect(post.current.drafts?.id).not.toBe(old.draftsId as string)
      expect(await recordIds(id)).toEqual(expect.arrayContaining(records))
      const history = await store.listHistory(id)
      expect(history.map((h) => h.id)).toContain(old.draftsId as string)

      ok(await commands.restoreVersion(ED, id, post.version, old.draftsId as string))
      await settled()
      post = await load(id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.draftsId).toBe(old.draftsId)
      expect(post.pointers.factsId).toBe(old.factsId)
      expect(post.pointers.sourceId).toBe(old.sourceId)
      // Its fact bindings resolve: current() keeps the version on the facts it was drafted from.
      expect(post.current.drafts?.id).toBe(old.draftsId as string)
      expect(post.current.facts?.id).toBe(old.factsId as string)
    },
    SLOW,
  )

  test(
    'remakeFromSource from a link reads the page, keeps its address and site, and takes its title (113, 94)',
    async () => {
      const before = await atSource(ED)
      const page = {
        title: `Hours and grades ${randomUUID()}`,
        paragraphs: changedText().split('\n\n'),
        url: LINK,
        site: 'campustimes.example',
      }
      const { reads, read } = reader({ ok: true, page })
      ok(
        await commands.remakeFromSource(
          ED,
          before.id,
          before.version,
          { links: [` ${LINK} `] },
          read,
        ),
      )
      await settled()
      expect(reads).toEqual([LINK])
      const post = await load(before.id)
      expect(post.stage).toBe('structures')
      expect(post.current.source?.body).toMatchObject({
        title: page.title,
        url: LINK,
        site: 'campustimes.example',
      })
      expect(post.current.drafts?.body.items).toHaveLength(3)

      // A link that cannot be read moves nothing.
      ok(await commands.goBack(ED, post.id, post.version, 'source'))
      await settled()
      const failing = reader({ ok: false, error: pageError })
      const at = (await load(post.id)).version
      expect(
        await commands.remakeFromSource(ED, post.id, at, { links: [LINK] }, failing.read),
      ).toEqual({ ok: false, error: pageError, failed: [{ url: LINK, error: UNREAD }] })
      expect((await load(post.id)).stage).toBe('source')
    },
    SLOW,
  )

  test(
    'remakeFromSource takes the same fields as "Make post": several links, a framing line and notes (113, GD18)',
    async () => {
      const before = await atSource(ED)
      const run = randomUUID()
      const { read } = pages(twoPages(run))
      const framing = 'Why 20 hours matters'
      const notes = 'Kept as opinion.'
      const six = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`)
      expect(
        await commands.remakeFromSource(ED, before.id, before.version, { links: six }, read),
      ).toEqual({ ok: false, error: 'Up to five links.' })

      const links = [LINK_A, LINK_B]
      const input = { links, framing, notes }
      ok(await commands.remakeFromSource(ED, before.id, before.version, input, read))
      await settled()
      const source = (await load(before.id)).current.source?.body
      expect(source?.parts?.map((p) => p.site)).toEqual(['abc.example', 'studyaustralia.example'])
      expect(source).toMatchObject({ title: `Paid work and grades ${run}`, framing, notes })
    },
    SLOW,
  )

  test(
    "remakeFromSource with another language makes a new source in it; one sent without a language keeps the source's (GD36, GD28)",
    async () => {
      const before = await atSource(ED)
      const text = before.current.source?.body.text as string
      expect(before.current.source?.body.language).toBe('en')

      ok(await commands.remakeFromSource(ED, before.id, before.version, { text, language: 'th' }))
      await settled()
      let post = await load(before.id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.sourceId).not.toBe(before.pointers.sourceId)
      expect(post.current.source?.body.language).toBe('th')

      ok(await commands.goBack(ED, post.id, post.version, 'source'))
      await settled()
      ok(
        await commands.remakeFromSource(ED, post.id, (await load(post.id)).version, {
          text: changedText(),
        }),
      )
      await settled()
      post = await load(before.id)
      expect(post.current.source?.body.language).toBe('th')
    },
    SLOW,
  )

  test(
    'a failed draft after a remake keeps the new source and facts, shows the draft step failed, and Try again drafts (113, 93)',
    async () => {
      const before = await atSource(ED)
      const id = before.id
      draftFails = true
      try {
        ok(await commands.remakeFromSource(ED, id, before.version, { text: changedText() }))
        await settled()
      } finally {
        draftFails = false
      }
      let post = await load(id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.factsId).not.toBe(before.pointers.factsId)
      expect(post.current.facts?.body.facts.length).toBeGreaterThan(0)
      expect(post.current.drafts).toBeNull()
      expect(await steps.failedSteps(id)).toContain('draft')

      ok(await commands.draftPost(ED, id, post.version, false))
      post = await load(id)
      expect(post.current.drafts?.body.items).toHaveLength(3)
      expect(await steps.failedSteps(id)).not.toContain('draft')
    },
    SLOW,
  )

  test(
    'continueWithSource returns to structures with the same source, facts, versions and pick, and makes no model call (113)',
    async () => {
      const before = await atSource(ED)
      const id = before.id
      const calls = { extract: extractCalls, judged: judged.length }
      const drafted = (await modelCalls(id, 'draft')).length

      ok(await commands.continueWithSource(ED, id, before.version))
      await settled()
      const post = await load(id)
      expect(post.stage).toBe('structures')
      for (const key of ['sourceId', 'factsId', 'draftsId', 'picked'] as const) {
        expect(post.pointers[key]).toBe(before.pointers[key] as never)
      }
      expect({ extract: extractCalls, judged: judged.length }).toEqual(calls)
      expect((await modelCalls(id, 'draft')).length).toBe(drafted)
      // The source check followed, on the picked version, from what it had read before.
      expect(post.current.sourceCheck?.body.draft).toEqual({
        draftsId: before.pointers.draftsId as string,
        index: before.pointers.picked as number,
      })
    },
    SLOW,
  )

  test(
    'continueWithSource on a post from before ideas, with facts and no versions, drafts three versions from those facts and lands at structures (113, 93)',
    async () => {
      const started = await start(ED, { ...paidWork, text: changedText() })
      const requestId = started.id
      const { version } = ok(
        await commands.tickTemplates(ED, requestId, started.version, [firstTemplate]),
      )
      let post = await load(requestId)
      expect(post.current.drafts).toBeNull()
      expect(post.pointers.ideasId).toBeNull()
      ok(await commands.goBack(ED, requestId, version, 'source'))
      await settled()
      const before = await load(requestId)
      expect(before.stage).toBe('source')

      ok(await commands.continueWithSource(ED, requestId, before.version))
      await settled()
      post = await load(requestId)
      expect(post.stage).toBe('structures')
      expect(post.pointers.sourceId).toBe(before.pointers.sourceId)
      expect(post.pointers.factsId).toBe(before.pointers.factsId)
      expect(post.current.drafts?.body.factsId).toBe(before.pointers.factsId as string)
      expect(post.current.drafts?.body.items.map((i) => i.template.id)).toEqual([
        firstTemplate,
        firstTemplate,
        firstTemplate,
      ])
      expect(post.pointers.ideasId).toBeNull()
      expect(await steps.failedSteps(requestId)).not.toContain('draft')
    },
    SLOW,
  )

  /** A post made through the ideas, its first card drafted, moved back to the source. */
  async function ideasAtSource() {
    const made = await atIdeas({ ...paidWork, text: changedText() })
    await drafted(made.id)
    // Drafting starts the source check on the version chosen for her: let it finish first.
    await settled()
    ok(await commands.goBack(ED, made.id, (await load(made.id)).version, 'source'))
    await settled()
    return load(made.id)
  }

  test(
    'for a post made through the ideas, remakeFromSource stops at new idea cards for the new facts, with no versions drafted (GD1, 113)',
    async () => {
      const before = await ideasAtSource()
      const drafts = draftData.length
      ok(await commands.remakeFromSource(ED, before.id, before.version, { text: changedText() }))
      await settled()
      const post = await load(before.id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.factsId).not.toBe(before.pointers.factsId)
      expect(post.current.drafts).toBeNull()
      expect(draftData.length).toBe(drafts)
      expect(post.pointers.ideasId).not.toBe(before.pointers.ideasId)
      expect(post.current.ideas?.body).toMatchObject({
        factsId: post.pointers.factsId as string,
        rounds: 1,
      })
      expect(post.current.ideas?.body.cards).toHaveLength(4)
      expect(await steps.failedSteps(post.id)).toEqual([])
    },
    SLOW,
  )

  test(
    'continueWithSource on a post made through the ideas, with facts and no versions, offers the cards it has, with no model call (GD1, 113)',
    async () => {
      const made = await atIdeas({ ...paidWork, text: changedText() })
      ok(await commands.goBack(ED, made.id, made.version, 'source'))
      const before = await load(made.id)
      const calls = { ideas: ideasData.length, drafts: draftData.length }
      ok(await commands.continueWithSource(ED, made.id, before.version))
      await settled()
      const post = await load(made.id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.ideasId).toBe(made.pointers.ideasId)
      expect(post.current.ideas?.id).toBe(made.pointers.ideasId as string)
      expect(post.current.drafts).toBeNull()
      expect({ ideas: ideasData.length, drafts: draftData.length }).toEqual(calls)
    },
    SLOW,
  )

  test(
    'a remade source whose ideas step failed keeps its new facts; continueWithSource then makes cards for those facts (GD1, 93, 113)',
    async () => {
      const before = await ideasAtSource()
      const text = `${changedText()} [fake:fail-ideas]`
      ok(await commands.remakeFromSource(ED, before.id, before.version, { text }))
      await settled()
      let post = await load(before.id)
      expect(post.stage).toBe('structures')
      expect(post.pointers.factsId).not.toBe(before.pointers.factsId)
      expect(post.current.ideas).toBeNull()
      expect(post.current.drafts).toBeNull()
      expect(await steps.failedSteps(post.id)).toEqual(['ideas'])

      ok(await commands.goBack(ED, post.id, post.version, 'source'))
      const back = await load(post.id)
      ideasBack = true
      try {
        ok(await commands.continueWithSource(ED, post.id, back.version))
      } finally {
        ideasBack = false
      }
      await settled()
      post = await load(post.id)
      expect(post.stage).toBe('structures')
      expect(post.current.ideas?.body.factsId).toBe(post.pointers.factsId as string)
      expect(post.current.ideas?.body.cards).toHaveLength(4)
      expect(post.current.drafts).toBeNull()
      expect(await steps.failedSteps(post.id)).toEqual([])
    },
    SLOW,
  )

  test(
    'Draft again drafts for the idea the versions serve, in its look, to its outline (GD2, GD32)',
    async () => {
      const made = await atIdeas()
      const cards = made.current.ideas?.body.cards ?? []
      const { version, current } = await drafted(made.id, [1])
      const before = draftData.length
      ok(await commands.draftPost(ED, made.id, version, true))
      const [sent] = draftData.slice(before) as { idea: unknown; outline: { slides: unknown[] } }[]
      expect(sent.idea).toEqual({
        combine: false,
        cards: [{ angle: cards[1].angle, hook: cards[1].hook, audience: cards[1].audience }],
      })
      expect(sent.outline.slides).toHaveLength(current.outline?.body.slides.length ?? -1)
      const drafts = (await load(made.id)).current.drafts?.body
      expect(drafts?.attempt).toBe(2)
      expect(drafts?.idea).toEqual({ cards: [cards[1]] })
      expect(drafts?.items.map((i) => i.template.id)).toEqual(Array(3).fill(cards[1].look))
    },
    SLOW,
  )

  test(
    'adding a fact keeps the outline, carried onto the new facts (GD32, 95)',
    async () => {
      const made = await outlined((await atIdeas()).id)
      ok(await commands.addFact(ED, made.id, made.version, '¶3.2'))
      const post = await load(made.id)
      expect(post.pointers.factsId).not.toBe(made.pointers.factsId)
      expect(post.current.outline?.body.factsId).toBe(post.pointers.factsId as string)
      expect(post.current.outline?.body.slides).toEqual(made.current.outline?.body.slides as never)
    },
    SLOW,
  )

  test(
    'adding a fact keeps the idea cards, offered for the new facts (GD1, 95)',
    async () => {
      const made = await atIdeas()
      const cards = made.current.ideas?.body.cards
      ok(await commands.addFact(ED, made.id, made.version, '¶3.2'))
      const post = await load(made.id)
      expect(post.pointers.factsId).not.toBe(made.pointers.factsId)
      expect(post.current.ideas?.body.factsId).toBe(post.pointers.factsId as string)
      expect(post.current.ideas?.body.cards).toEqual(cards as never)
    },
    SLOW,
  )

  test(
    'More ideas stops at twelve cards: the next press is refused with no model call (GD3)',
    async () => {
      const made = await atIdeas()
      let { version } = made
      ;({ version } = ok(await commands.moreIdeas(ED, made.id, version)))
      ;({ version } = ok(await commands.moreIdeas(ED, made.id, version)))
      expect((await load(made.id)).current.ideas?.body.cards).toHaveLength(12)
      const calls = ideasData.length
      expect(await commands.moreIdeas(ED, made.id, version)).toEqual({
        ok: false,
        error: "That's plenty of ideas. Pick one, or go back to the source to start again.",
      })
      expect(ideasData.length).toBe(calls)
      expect((await load(made.id)).version).toBe(version)
    },
    SLOW,
  )

  test(
    "a reviewer's or an admin's remake or continue is refused before any page is read, and nothing moves (113)",
    async () => {
      const before = await atSource(ED)
      const { reads, read } = reader({ ok: false, error: pageError })
      for (const actor of [REV, ADMIN]) {
        for (const run of [
          () =>
            commands.remakeFromSource(actor, before.id, before.version, { links: [LINK] }, read),
          () => commands.remakeFromSource(actor, before.id, before.version, { text: 'New.' }),
          () => commands.continueWithSource(actor, before.id, before.version),
        ]) {
          expect(await run()).toEqual({ ok: false, error: errors.notAuthorised })
        }
      }
      expect(reads).toEqual([])
      expect((await load(before.id)).version).toBe(before.version)
      // At structures neither move runs.
      const { id } = await picked(ED, 'the-line')
      await settled()
      const at = (await load(id)).version
      expect(await commands.continueWithSource(ED, id, at)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )

  test(
    'a live post being edited with a remade source keeps its published source for students, in liveById and in Related (113, 116, 117)',
    async () => {
      const review = await inReview(ED)
      ok(await commands.approveAndPublish(REV, review.id, review.version))
      const id = review.id
      const live = await load(id)
      const publishedSource = live.pointers.sourceId as string
      expect((await store.liveById(id))?.sourceId).toBe(publishedSource)

      ok(await commands.editLive(ED, id, live.version))
      await settled()
      ok(await commands.goBack(ED, id, (await load(id)).version, 'source'))
      await settled()
      ok(
        await commands.remakeFromSource(ED, id, (await load(id)).version, {
          text: changedText(),
        }),
      )
      await settled()
      const working = (await load(id)).pointers.sourceId as string
      expect(working).not.toBe(publishedSource)

      expect((await store.liveById(id))?.sourceId).toBe(publishedSource)
      const other = randomUUID()
      const onPublished = await store.relatedCandidates({
        id: other,
        sourceId: publishedSource,
        tags: [],
      })
      expect(onPublished.map((p) => p.id)).toContain(id)
      const onWorking = await store.relatedCandidates({ id: other, sourceId: working, tags: [] })
      expect(onWorking.map((p) => p.id)).not.toContain(id)
    },
    SLOW,
  )

  /** Every model call of the post, whether or not it reached the model. */
  async function allCalls(postId: string) {
    return db
      .select({ id: schema.aiCall.id })
      .from(schema.aiCall)
      .where(orm.eq(schema.aiCall.postId, postId))
  }

  /** A look post drafted and picked, its source check landed, at the version after it. */
  async function pickedLook(look = 'field-notes') {
    const { id } = await picked(ED, look)
    await settled()
    return { id, version: (await load(id)).version }
  }

  test(
    'where sources go: saving it lays a rendered look post out again and redraws it with its pictures; the next approval keeps it (GD31)',
    async () => {
      let { id, version } = await pickedLook()
      ;({ version } = ok(await commands.approveStructure(ED, id, version)))
      await settled()
      ;({ version } = await done(commands.drawImages(ED, id, (await load(id)).version)))
      const before = await load(id)
      const count = before.current.layout?.body.slides.length ?? 0
      expect(before.current.layout?.body.slides.every((s) => s.sourceLine === null)).toBe(true)

      ;({ version } = ok(
        await commands.saveSettings(ED, id, version, { ...GENERAL, sourcesAt: 'sources_slide' }),
      ))
      const slide = await load(id)
      expect(slide.stage).toBe('rendered')
      expect(slide.pointers.revisionId).toBe(before.pointers.revisionId)
      expect(slide.pointers.sourceCheckId).toBe(before.pointers.sourceCheckId)
      expect(slide.current.layout?.body.slides).toHaveLength(count + 1)
      expect(slide.current.render?.body.slides).toHaveLength(count + 1)
      expect(slide.current.render?.body.slideArt).toEqual(before.current.render?.body.slideArt)
      const extra = slide.current.layout?.body.slides.at(-1)
      expect(extra?.lines.find((l) => l.slot === 'heading')?.text).toBe('Sources')

      ;({ version } = ok(
        await commands.saveSettings(ED, id, version, { ...GENERAL, sourcesAt: 'last_slide' }),
      ))
      const line = await load(id)
      expect(line.current.layout?.body.slides).toHaveLength(count)
      expect(line.current.layout?.body.slides.at(-1)?.lines.some((l) => l.slot === 'sources')).toBe(
        true,
      )

      // A setting that moves no source leaves the render as it is.
      ;({ version } = ok(
        await commands.saveSettings(ED, id, version, {
          ...GENERAL,
          sourcesAt: 'last_slide',
          tags: ['theme:books-movies'],
        }),
      ))
      expect((await load(id)).pointers.renderId).toBe(line.pointers.renderId)

      // A light edit lays the slides out again with the sources where the settings put them.
      ok(await commands.lightEdit(ED, id, version, { kind: 'reorder', from: 1, to: 2 }))
      await settled()
      const again = await load(id)
      expect(again.pointers.renderId).not.toBe(line.pointers.renderId)
      expect(
        again.current.layout?.body.slides.at(-1)?.lines.some((l) => l.slot === 'sources'),
      ).toBe(true)
    },
    SLOW,
  )

  test(
    'setSlideLayout lays one slide out again by code in a new drafts record, and setLook changes the look keeping every slot (GD4, GD5)',
    async () => {
      const { relayout } = await import('../layout/relayout')
      const { templateById } = await import('../templates')
      let { id, version } = await pickedLook()
      const before = await load(id)
      const facts = before.current.facts?.body.facts ?? []
      const item = before.current.drafts?.body.items[0]
      if (!item) throw new Error('no drafts')
      // A body slide whose bound fact holds a number.
      const n =
        item.structure.slides.findIndex(
          (s) =>
            s.kind === 'body' &&
            Object.values(s.slots).some((slot) =>
              slot.factIds.some((f) => facts.find((fact) => fact.id === f)?.value),
            ),
        ) + 1
      expect(n).toBeGreaterThan(0)
      const calls = (await allCalls(id)).length

      ;({ version } = ok(
        await commands.setSlideLayout(ED, id, version, { index: 0, slide: n, layout: 'number' }),
      ))
      await settled()
      const laid = await load(id)
      expect(laid.pointers.draftsId).not.toBe(before.pointers.draftsId)
      expect(laid.current.drafts?.body.note).toBe(`Slide ${n}: Big number`)
      const slides = laid.current.drafts?.body.items[0].structure.slides ?? []
      expect(slides[n - 1]).toEqual(relayout(item.structure.slides[n - 1], 'number', facts))
      expect(slides[n - 1].layout).toBe('number')
      expect(slides.filter((_, i) => i !== n - 1)).toEqual(
        item.structure.slides.filter((_, i) => i !== n - 1),
      )
      // Code moved the text: nothing reached a model, nor the cache.
      expect((await allCalls(id)).length).toBe(calls)

      // One bound fact cannot fill the bars; a middle slide is no cover. Nothing is saved.
      version = (await load(id)).version
      expect(
        await commands.setSlideLayout(ED, id, version, { index: 0, slide: n, layout: 'bars' }),
      ).toEqual({ ok: false, error: 'Bars need two numbers from facts on this slide.' })
      expect(
        await commands.setSlideLayout(ED, id, version, { index: 0, slide: n, layout: 'cover' }),
      ).toEqual({ ok: false, error: 'A cover goes on the first slide.' })
      expect((await load(id)).version).toBe(version)

      ;({ version } = ok(await commands.setLook(ED, id, version, { index: 0, look: 'data-desk' })))
      await settled()
      const looked = await load(id)
      const moved = looked.current.drafts?.body.items[0]
      expect(moved?.template).toEqual(
        templateById('data-desk') as NonNullable<typeof moved>['template'],
      )
      expect(moved?.structure.templateId).toBe('data-desk')
      expect(moved?.structure.slides).toEqual(slides)
      expect(looked.current.drafts?.body.note).toBe('Look: Data Desk')
      // An old template is not a look.
      version = looked.version
      expect(await commands.setLook(ED, id, version, { index: 0, look: 'the-line' })).toEqual({
        ok: false,
        error: errors.look,
      })
      expect((await allCalls(id)).length).toBe(calls)
    },
    SLOW,
  )

  test(
    'setPreset is refused on a post whose versions are not looks, and its theme stays (GD9)',
    async () => {
      const { id, version } = await picked(ED, 'the-line')
      expect(await commands.setPreset(ED, id, version, { preset: 'pop' })).toEqual({
        ok: false,
        error: errors.preset,
      })
      expect((await load(id)).pointers.themeId).toBe('paper')
    },
    SLOW,
  )

  test(
    'setPreset Subdued draws the preview on Subdued surfaces, and the fit rows and the approved layout check contrast on them (GD9)',
    async () => {
      const { presetThemes } = await import('../brands/guideline')
      const { slideSpec } = await import('../templates')
      const { Resvg } = await import('@resvg/resvg-js')
      let { id, version } = await pickedLook()
      expect(await commands.setPreset(ED, id, version, { preset: 'paper' as 'pop' })).toEqual({
        ok: false,
        error: errors.preset,
      })
      ;({ version } = ok(await commands.setPreset(ED, id, version, { preset: 'subdued' })))
      const post = await load(id)
      expect(post.pointers.themeId).toBe('subdued')
      const { drafts, facts, source } = post.current
      if (!drafts || !facts || !source) throw new Error('post incomplete')

      // The last slide has no art box: its corner is the surface's background.
      const item = drafts.body.items[0]
      const last = item.structure.slides.length
      const png = await preview.draftPreviewPng({
        postId: id,
        draftsId: drafts.id,
        index: 0,
        slide: last,
        themeId: post.pointers.themeId,
      })
      if (!png) throw new Error('no preview')
      const uri = `data:image/png;base64,${Buffer.from(png).toString('base64')}`
      const pixels = new Resvg(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><image width="1080" height="1350" href="${uri}"/></svg>`,
      ).render().pixels
      const surface = slideSpec(item.template, item.structure.slides[last - 1]).surface
      const bg = presetThemes('subdued')[surface].bg
      const rgb = [1, 3, 5].map((i) => Number.parseInt(bg.slice(i, i + 2), 16))
      const at = (8 * 1080 + 8) * 4
      expect([pixels[at], pixels[at + 1], pixels[at + 2]]).toEqual(rgb)

      const contrast = (rows: { check: string; label: string }[]) =>
        rows.filter((r) => r.check === 'contrast').map((r) => r.label)
      const shown = contrast(
        preview.draftFitChecks(drafts.body, 'subdued', facts.body.facts, source.body.title)[0],
      )
      expect(shown.length).toBeGreaterThan(0)
      for (const label of shown) expect(label).toStartWith('Contrast · Subdued ')

      ok(await commands.approveStructure(ED, id, version))
      const approved = await load(id)
      expect(approved.current.revision?.body.themeId).toBe('subdued')
      expect(contrast(approved.current.layout?.body.fitChecks ?? [])).toEqual(shown)
      await settled()
    },
    SLOW,
  )

  test(
    "a reviewer's or an admin's layout, look or preset is refused and nothing moves (GD4, GD5, GD9)",
    async () => {
      const { id, version } = await pickedLook()
      for (const actor of [REV, ADMIN]) {
        for (const run of [
          () =>
            commands.setSlideLayout(actor, id, version, {
              index: 0,
              slide: 2,
              layout: 'checklist',
            }),
          () => commands.setLook(actor, id, version, { index: 0, look: 'postcard' }),
          () => commands.setPreset(actor, id, version, { preset: 'subdued' }),
        ]) {
          expect(await run()).toEqual({ ok: false, error: errors.notAuthorised })
        }
      }
      expect((await load(id)).version).toBe(version)
    },
    SLOW,
  )

  // ── Text chips (GD10) ──────────────────────────────────────────────────────────────────────────

  const words = (text: string) => text.split(/\s+/).filter(Boolean).length

  test(
    "nudgeSlide rewords only that slide of the picked version in the chip's direction, as a new drafts record noted in the history (GD10)",
    async () => {
      const { textNudge } = await import('../nudges')
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      ;({ version } = await load(id))
      const before = await pickedVersion(id)
      const { slide } = before.at
      const sent = slideData.length

      ;({ version } = ok(await commands.nudgeSlide(ED, id, version, { slide, nudge: 'shorter' })))
      await settled()
      const after = await pickedVersion(id)
      // The data sent carries the chip's instruction.
      expect(slideData.slice(sent).map((d) => (d as { nudge: unknown }).nudge)).toEqual([
        textNudge('shorter')?.instruction,
      ])
      const was = before.item.structure.slides[slide - 1].slots.body
      const now = after.item.structure.slides[slide - 1].slots.body
      expect(words(now.text)).toBeLessThan(words(was.text))
      expect(now.factIds).toEqual(was.factIds)
      // Every other slide and every other version: the same bytes.
      const rest = (item: (typeof before)['item']) =>
        JSON.stringify(item.structure.slides.toSpliced(slide - 1, 1))
      expect(rest(after.item)).toBe(rest(before.item))
      expect(JSON.stringify(after.drafts.body.items.slice(1))).toBe(
        JSON.stringify(before.drafts.body.items.slice(1)),
      )
      // The history names the change, and keeps the record with the old wording.
      const history = await store.listHistory(id)
      expect(history[0]).toMatchObject({ kind: 'drafts', note: `Slide ${slide}: Shorter` })
      expect(history.map((h) => h.id)).toContain(before.drafts.id)
    },
    SLOW,
  )

  test(
    "nudgeVersion rewords only that version in one draft call from its slides and the chip's instruction (GD10)",
    async () => {
      const { textNudge } = await import('../nudges')
      let { id, version } = await picked(ED, 'the-line')
      await settled()
      ;({ version } = await load(id))
      const before = await pickedVersion(id)
      const items = before.drafts.body.items
      const sent = draftData.length

      ;({ version } = ok(
        await commands.nudgeVersion(ED, id, version, { index: 1, nudge: 'simpler' }),
      ))
      await settled()
      const after = await pickedVersion(id)
      const calls = draftData.slice(sent) as { nudge: string; base: { angle: string } }[]
      expect(calls).toHaveLength(1)
      expect(calls[0].nudge).toBe(textNudge('simpler')?.instruction as string)
      expect(calls[0].base.angle).toBe(items[1].angle as string)

      const now = after.drafts.body.items
      expect(JSON.stringify([now[0], now[2]])).toBe(JSON.stringify([items[0], items[2]]))
      expect(now[1].angle).toBe(items[1].angle)
      expect(now[1].template).toEqual(items[1].template)
      const slides = (item: (typeof items)[number]) => item.structure.slides
      expect(slides(now[1]).map((s) => [s.kind, s.slots.body?.factIds])).toEqual(
        slides(items[1]).map((s) => [s.kind, s.slots.body?.factIds]),
      )
      const n = before.at.slide - 1
      expect(words(slides(now[1])[n].slots.body.text)).toBeLessThan(
        words(slides(items[1])[n].slots.body.text),
      )
      expect(after.post.pointers.picked).toBe(0)
      const history = await store.listHistory(id)
      expect(history[0]).toMatchObject({ kind: 'drafts', note: 'Version B: Simpler words' })
      expect(history.map((h) => h.id)).toContain(before.drafts.id)
    },
    SLOW,
  )

  test(
    'a nudge whose answer states a number its facts lack is refused, and the old wording stays (GD10)',
    async () => {
      const { id } = await picked(ED, 'the-line')
      await settled()
      const { version } = await load(id)
      const before = await pickedVersion(id)
      const { slide } = before.at
      const withNumber = (slots: { key: string; text: string }[]) =>
        slots.map((s) =>
          s.key === 'body' ? { ...s, text: `${s.text} Pass rates fell by 12 points.` } : s,
        )
      try {
        draftTweak = (answer) => ({
          versions: answer.versions.map((v) => ({
            ...v,
            slides: v.slides.map((s) => ({ ...s, slots: withNumber(s.slots) })),
          })),
        })
        expect(await commands.nudgeVersion(ED, id, version, { index: 0, nudge: 'warmer' })).toEqual(
          { ok: false, error: "Couldn't apply “Warmer”. Try again." },
        )
        slideTweak = (answer) => ({ slots: withNumber(answer.slots) })
        expect(await commands.nudgeSlide(ED, id, version, { slide, nudge: 'practical' })).toEqual({
          ok: false,
          error: "Couldn't apply “More practical”. Try again.",
        })
      } finally {
        draftTweak = null
        slideTweak = null
      }
      const after = await load(id)
      expect(after.version).toBe(version)
      expect(after.pointers.draftsId).toBe(before.post.pointers.draftsId)
    },
    SLOW,
  )

  test(
    "a reviewer's or an admin's chip is refused, as are an unknown chip and a post with no pick, and nothing moves (GD10)",
    async () => {
      const { id } = await picked(ED, 'the-line')
      await settled()
      const { version } = await load(id)
      for (const actor of [REV, ADMIN]) {
        for (const run of [
          () => commands.nudgeSlide(actor, id, version, { slide: 2, nudge: 'shorter' }),
          () => commands.nudgeVersion(actor, id, version, { index: 0, nudge: 'shorter' }),
        ]) {
          expect(await run()).toEqual({ ok: false, error: errors.notAuthorised })
        }
      }
      // An image chip is no text chip.
      expect(await commands.nudgeSlide(ED, id, version, { slide: 2, nudge: 'closer' })).toEqual({
        ok: false,
        error: errors.nudge,
      })
      expect(await commands.nudgeVersion(ED, id, version, { index: 0, nudge: 'louder' })).toEqual({
        ok: false,
        error: errors.nudge,
      })
      expect((await load(id)).version).toBe(version)

      const { id: other, version: at } = await nonePicked()
      expect(await commands.nudgeSlide(ED, other, at, { slide: 2, nudge: 'shorter' })).toEqual({
        ok: false,
        error: errors.noPick,
      })
    },
    SLOW,
  )

  // ── Research a sentence the check did not find (BR14) ───────────────────────────────────────

  /** The page "Research this" finds for the planted line, past the grounding redirect. */
  const RESEARCHED = 'https://www.studyaustralia.gov.au/en/first-year'
  /** A sentence on that page that supports the planted line without saying it word for word. */
  const SUPPORT =
    'For most students the first year is the worst time to find out where the limit on paid work lies.'
  /** The researched pages: the first redirect resolves to RESEARCHED, saying `said`; the visa page says neither. */
  function researchReader(said: string) {
    return async (url: string): Promise<import('./fetch-page').PageResult> => {
      const { FAKE_SOURCES } = await import('../ai/fake')
      const page = (at: string, paragraphs: string[]) => ({
        ok: true as const,
        page: { url: at, site: new URL(at).hostname.replace(/^www\./, ''), title: '', paragraphs },
      })
      if (url === FAKE_SOURCES[0].url || url === RESEARCHED) {
        return page(RESEARCHED, [
          'Starting university is a big change.',
          `We asked new students about work. ${said}`,
        ])
      }
      if (url === FAKE_SOURCES[1].url) return page(url, ['A student visa lets you study here.'])
      return { ok: false, error: pageError }
    }
  }
  /** Gemini quotes SUPPORT from each page; the judge finds it supports the planted line, and nothing else changes. */
  async function researchAnswers() {
    const { FAKE_ANSWERS } = await import('../ai/fake')
    researchTweak = (answer) => ({
      sources: answer.sources.map((s) => ({ ...s, sentence: SUPPORT })),
    })
    judgeAnswer = (data) => {
      const { claim, paragraphs } = data as {
        claim: string
        paragraphs: { ref: string; text: string }[]
      }
      const holds = paragraphs.find((p) => p.text.includes(SUPPORT))
      return claim === PLANTED && holds
        ? { supported: true, ref: holds.ref, why: 'Supported.' }
        : FAKE_ANSWERS.source_check?.(data)
    }
    await forgetCheckAnswers()
  }

  test("a reviewer's or an admin's research is refused before any search or read (BR14)", async () => {
    const { id } = await picked(ED, 'the-line')
    await settled()
    const { version } = await load(id)
    const reads: string[] = []
    const read = async (url: string) => {
      reads.push(url)
      return { ok: false as const, error: pageError }
    }
    const before = searches.length
    for (const actor of [REV, ADMIN]) {
      expect(await commands.researchClaim(actor, id, version, { sentence: PLANTED }, read)).toEqual(
        { ok: false, error: errors.notAuthorised },
      )
      expect(
        await commands.addResearchSource(
          actor,
          id,
          version,
          { claim: PLANTED, url: RESEARCHED, sentence: SUPPORT },
          read,
        ),
      ).toEqual({ ok: false, error: errors.notAuthorised })
    }
    expect(searches.length - before).toBe(0)
    expect(reads).toEqual([])
    expect((await load(id)).version).toBe(version)
  })

  test(
    'one search per press offers only a page that holds a supporting sentence, at its own address, and saves nothing (BR14)',
    async () => {
      const { id } = await picked(ED, 'the-line')
      await settled()
      const { version } = await load(id)
      const before = searches.length
      const found = await commands.researchClaim(
        ED,
        id,
        version,
        { sentence: PLANTED },
        researchReader(PLANTED),
      )
      // The page the redirect resolves to holds the sentence; the visa page does not; the last is unread.
      expect(found).toEqual({
        ok: true,
        sources: [
          {
            url: RESEARCHED,
            site: 'studyaustralia.gov.au',
            title: 'Work while you study',
            sentence: PLANTED,
          },
        ],
        entryPoint: expect.any(String),
      })
      expect(searches.slice(before)).toEqual(['research_claim'])
      expect((await load(id)).version).toBe(version)

      // Only a sentence the check did not find is researched: no search for any other text.
      expect(
        await commands.researchClaim(ED, id, version, { sentence: 'Any other sentence.' }),
      ).toEqual({ ok: false, error: errors.movedOn })
      expect(searches.slice(before)).toEqual(['research_claim'])
    },
    SLOW,
  )

  test(
    '"Add as a source" on a rendered post makes a new source with the page as a part and its sentence a fact, and the sentence then checks found (BR14)',
    async () => {
      const { id, version } = await rendered(ED)
      expect((await load(id)).current.sourceCheck?.body.claims).toContainEqual(
        expect.objectContaining({ text: PLANTED, result: 'not_found' }),
      )
      await researchAnswers()
      try {
        const read = researchReader(SUPPORT)
        const found = ok(await commands.researchClaim(ED, id, version, { sentence: PLANTED }, read))
        expect(found.sources.map((s) => [s.url, s.sentence])).toEqual([[RESEARCHED, SUPPORT]])
        const searched = searches.length

        // A sentence the page does not hold is refused, and nothing moves.
        const missing = { claim: PLANTED, url: RESEARCHED, sentence: 'Not on the page.' }
        expect((await commands.addResearchSource(ED, id, version, missing, read)).ok).toBe(false)
        expect((await load(id)).version).toBe(version)

        const before = await load(id)
        const old = before.current.source?.body
        if (!old) throw new Error('no source')
        const added = ok(
          await commands.addResearchSource(
            ED,
            id,
            version,
            { claim: PLANTED, url: RESEARCHED, sentence: SUPPORT },
            read,
          ),
        )
        // A new source changes the sources the slides list: the text is laid out again (GD28).
        expect(added.note).toEqual(expect.any(String))
        await settled()
        const post = await load(id)
        expect(post.stage).toBe('structures')
        const source = post.current.source?.body
        const facts = post.current.facts?.body
        if (!source || !facts) throw new Error('no source')
        expect(post.pointers.sourceId).not.toBe(before.pointers.sourceId)
        expect(facts.sourceId).toBe(post.pointers.sourceId as string)
        // The pasted source keeps its paragraphs as the first part; the page is the next one.
        const n = old.paragraphs.length
        expect(source.paragraphs.slice(0, n)).toEqual(old.paragraphs)
        expect(source.parts?.at(-1)).toEqual({
          url: RESEARCHED,
          site: 'studyaustralia.gov.au',
          title: 'studyaustralia.gov.au',
          from: n + 1,
          to: n + 2,
        })
        expect(source.parts).toHaveLength(2)
        expect(source.demoKey).toBeNull()
        const fact = facts.facts.at(-1)
        expect(fact).toMatchObject({
          text: SUPPORT,
          quote: SUPPORT,
          supported: true,
          ref: `¶${n + 2}`,
        })
        // The slide's sentence now rests on it.
        const { item } = await pickedVersion(id)
        const claim = post.current.sourceCheck?.body.claims.find((c) => c.text === PLANTED)
        expect(claim?.result).toBe('found')
        const slot = item.structure.slides[(claim?.slide ?? 0) - 1].slots[claim?.slot ?? '']
        expect(slot.factIds).toContain(fact?.id as string)
        // Adding and checking again searched nothing.
        expect(searches.length).toBe(searched)
      } finally {
        researchTweak = null
        judgeAnswer = null
      }
    },
    SLOW,
  )
})
