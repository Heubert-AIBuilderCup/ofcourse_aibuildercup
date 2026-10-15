// Social versions (G6, criteria 62–68), called with their actor directly, against the development
// database (Docker, port 5433); off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/social.test.ts
// The model layer is the fake provider (AI_PROVIDER=fake) on the real call log and cache. Every
// account here has an id starting `sc-` and is deleted after, with the posts it made (records,
// steps and social versions go with their post) and their call log rows.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'
import type { Provider } from '../ai/client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '100000'
process.env.AI_DAILY_CAP_IMAGE = '100000'
process.env.GEMINI_IMAGE_MODEL = `sc-imagen-${randomUUID()}`
// The text models too: every answer this run caches is its own, and is deleted after, so none
// answers the dev server or a later run with a different post's reply.
process.env.GEMINI_FLASH_MODEL = `sc-flash-${randomUUID()}`
process.env.GEMINI_PRO_MODEL = `sc-pro-${randomUUID()}`

mock.module('server-only', () => ({}))

type User = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }
let session: { user: User } | null = null
mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))

const enabled = process.env.DB_TESTS === '1'
const P = 'sc-'
const SLOW = 60_000

const ED: User = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'SC ed' }
const REV: User = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'SC rev' }
const ADMIN: User = {
  id: `${P}admin`,
  role: 'admin',
  editor: false,
  reviewer: false,
  name: 'SC ad',
}
const STUDENT: User = { id: `${P}stu`, role: 'user', editor: false, reviewer: false, name: 'SC st' }

const GENERAL = {
  layer: 'general' as const,
  audience: { mode: 'everyone' as const, rules: [] },
  whyLine: null,
  expiry: { kind: 'none' as const },
  studioLink: null,
  tags: ['theme:books-movies'],
  sourcesAt: 'caption' as const,
}

/** Bytes that start like a PNG or a JPEG: a page's reference images; only the start is read. */
const png = (seed: number) => {
  const b = new Uint8Array(32).fill(seed)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return b
}
const jpeg = (seed: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, seed, seed, seed, seed])
/** A word for each page's look: a page's own name is a brand name, which the art style may not carry. */
const LOOK: Record<string, string> = {
  main: 'poster',
  cerebral: 'charcoal',
  infographics: 'diagram',
  comics: 'woodcut',
}

describe.skipIf(!enabled)('social versions against the database', () => {
  let commands: typeof import('./commands')
  let social: typeof import('./social')
  let store: typeof import('./store')
  let pageStyle: typeof import('./page-style')
  /** The page styles saved before the run, put back after it, so the dev server's own are never lost. */
  let savedStyles: typeof import('@/shared/lib/db/schema').pageStyle.$inferSelect[] = []
  let errors: typeof import('../lib/workflow').WORKFLOW_ERRORS
  let exportName: typeof import('../layout/zip').exportName
  let unzipSync: typeof import('fflate').unzipSync
  let exportRoute: typeof import('../../../app/admin/(console)/posts/[id]/export/route')
  let paidWork: { title: string; kind: string; text: string }
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  const posts: string[] = []

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.createdByUserId, `${P}%`))
    if (posts.length > 0) {
      await db.delete(schema.aiCall).where(orm.inArray(schema.aiCall.postId, posts))
    }
    await db.delete(schema.aiCache).where(orm.like(schema.aiCache.model, 'sc-%'))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  /** The work the commands left to run after their response (./after.ts), not yet awaited. */
  const background: Promise<unknown>[] = []
  async function settled() {
    while (background.length > 0) await background.shift()
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

  /** A the-line feed post on paid-work, rendered. */
  async function rendered() {
    const requestId = randomUUID()
    posts.push(requestId)
    let { id, version } = ok(await commands.startFeedPost(ED, { requestId, ...paidWork }))
    ;({ version } = ok(await commands.tickTemplates(ED, id, version, ['the-line'])))
    ;({ version } = ok(await commands.draftPost(ED, id, version, false)))
    ;({ version } = ok(await commands.pickStructure(ED, id, version, 0)))
    ;({ version } = ok(await commands.chooseTheme(ED, id, version, 'paper')))
    ;({ version } = ok(await commands.approveStructure(ED, id, version)))
    ok(await commands.renderPost(ED, id, version))
    // The render is read back after it returns: wait for that, as the page does by polling.
    await settled()
    return { id, version: (await load(id)).version }
  }

  /** A rendered feed post, checked, sent to review and published by a reviewer. */
  async function live() {
    return publish(await rendered())
  }

  /** The rendered post checked, sent to review and published by a reviewer. */
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

  /**
   * A feed post in the look, on the Subdued preset, its images planned and drawn (an image per art
   * box, or Postcard's one panorama), then published.
   */
  async function liveLook(look: string) {
    const requestId = randomUUID()
    posts.push(requestId)
    let { id, version } = ok(await commands.startFeedPost(ED, { requestId, ...paidWork }))
    ;({ version } = ok(await commands.tickTemplates(ED, id, version, [look])))
    ;({ version } = ok(await commands.draftPost(ED, id, version, false)))
    ;({ version } = ok(await commands.pickStructure(ED, id, version, 0)))
    ;({ version } = ok(await commands.setPreset(ED, id, version, { preset: 'subdued' })))
    ok(await commands.approveStructure(ED, id, version))
    await settled()
    ;({ version } = ok(await commands.planImages(ED, id, (await load(id)).version)))
    ok(await commands.drawImages(ED, id, version))
    await settled()
    return publish({ id, version: (await load(id)).version })
  }

  /** A social version adapted from the feed post, its layout approved and rendered. */
  async function renderedVersion(
    feed: { id: string; version: number },
    brandId: string,
    platform: 'instagram' | 'linkedin' = 'instagram',
  ) {
    const requestId = randomUUID()
    let { id, version } = ok(
      await social.adaptPost(ED, feed.id, feed.version, { brandId, platform, requestId }),
    )
    ;({ version } = ok(await social.approveLayout(ED, id, version)))
    ok(await social.renderSocial(ED, id, version))
    await settled()
    return load(id)
  }

  /** Each stored slide SVG of the post's render, as text. */
  async function svgsOf(post: Awaited<ReturnType<typeof load>>): Promise<string[]> {
    const slides = post.current.render?.body.slides ?? []
    const assets = await store.getAssets(slides.map((s) => s.svgAssetId))
    return slides.map((s) => new TextDecoder().decode(assets.get(s.svgAssetId)?.bytes))
  }

  const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

  let parent: { id: string; version: number } | null = null
  /** One live feed post, shared: adapting it never changes it. */
  async function liveParent() {
    parent ??= await live()
    return parent
  }

  async function adapt(platform: 'instagram' | 'linkedin' = 'instagram', brandId = 'cerebral') {
    const { id, version } = await liveParent()
    const requestId = randomUUID()
    return ok(await social.adaptPost(ED, id, version, { brandId, platform, requestId }))
  }

  /** A social version rendered, at ready with its caption. */
  async function ready(platform: 'instagram' | 'linkedin' = 'instagram') {
    let { id, version } = await adapt(platform)
    ;({ version } = ok(await social.approveLayout(ED, id, version)))
    ok(await social.renderSocial(ED, id, version))
    await settled()
    return { id, version: (await load(id)).version }
  }

  /** A design language saved for the page, from two reference images (as page-style.test.ts does). */
  async function styled(brandId: string, seed: number) {
    const a = ok(await pageStyle.uploadReference(ED, brandId, png(seed)))
    const b = ok(await pageStyle.uploadReference(ED, brandId, jpeg(seed)))
    ok(
      await pageStyle.savePageStyle(ED, {
        brandId,
        artStyle: `Loose ink line, wide margins, the ${LOOK[brandId]} look.`,
        copyStyle: `Short lines in the ${LOOK[brandId]} voice.`,
        closestTemplateId: 'the-line',
        referenceAssetIds: [a.assetId, b.assetId],
      }),
    )
  }

  const childrenOf = async (parentId: string) =>
    (await store.listCards()).filter((c) => c.parentId === parentId)

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
    // A look's images (square, or a 21:9 panorama) each in a colour of its own prompt, so each
    // slide's image is its own asset; a feed cover (4:5) is the fake's, as it always was.
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
      json: (req) => fake.json(req),
      image: async (req) => (req.aspectRatio === '4:5' ? fake.image(req) : painted(req.prompt)),
    }
    const ai = client.makeAi({
      provider,
      config: aiConfig(process.env),
      calls: dbCallLog,
      cache: dbCache,
    })
    mock.module('../ai/client', () => ({ ...client, ai }))

    commands = await import('./commands')
    social = await import('./social')
    store = await import('./store')
    pageStyle = await import('./page-style')
    savedStyles = await db.select().from(schema.pageStyle)
    // No request here for after(): run each task at once, and keep it to await.
    ;(await import('./after')).scheduleWith((task) => {
      background.push(task())
    })
    ;({ WORKFLOW_ERRORS: errors } = await import('../lib/workflow'))
    ;({ exportName } = await import('../layout/zip'))
    ;({ unzipSync } = await import('fflate'))
    exportRoute = await import('../../../app/admin/(console)/posts/[id]/export/route')
    const { DEMO_SOURCES } = await import('../demo-sources')
    const demo = DEMO_SOURCES.find((s) => s.key === 'paid-work')
    if (!demo) throw new Error('demo source missing')
    paidWork = { title: demo.title, kind: demo.kind, text: demo.text }

    await cleanUp()
    await db.insert(schema.user).values(
      [ED, REV, ADMIN, STUDENT].map((a) => ({
        id: a.id,
        name: a.name,
        email: `${a.id}@sc.e2e.test`,
        role: a.role as 'user' | 'admin',
        editor: a.editor,
        reviewer: a.reviewer,
      })),
    )
  })

  afterAll(async () => {
    await cleanUp()
    await db.delete(schema.pageStyle)
    if (savedStyles.length > 0) await db.insert(schema.pageStyle).values(savedStyles)
  })

  test(
    'adaptPost on a rendered feed post is refused; a reviewer or admin may not adapt (62)',
    async () => {
      const { id, version } = await rendered()
      const input = { brandId: 'cerebral', platform: 'instagram' as const, requestId: randomUUID() }
      expect(await social.adaptPost(ED, id, version, input)).toEqual({
        ok: false,
        error: errors.notLive,
      })
      const { id: liveId, version: liveVersion } = await liveParent()
      for (const actor of [REV, ADMIN, STUDENT]) {
        expect(await social.adaptPost(actor, liveId, liveVersion, input)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect(await store.loadPost(input.requestId)).toBeNull()
    },
    SLOW,
  )

  test(
    'adaptPost on a live post makes a linked social version on the parent’s facts, once (63, 64)',
    async () => {
      const { id: parentId, version } = await liveParent()
      const before = await load(parentId)
      const requestId = randomUUID()
      const input = { brandId: 'cerebral', platform: 'instagram' as const, requestId }
      const made = ok(await social.adaptPost(ED, parentId, version, input))
      expect(made.id).toBe(requestId)
      // A second submit of the same request is the same post.
      expect(ok(await social.adaptPost(ED, parentId, version, input))).toEqual(made)

      const post = await load(made.id)
      expect(post).toMatchObject({
        kind: 'social',
        parentId,
        title: 'Instagram · Cerebral',
        stage: 'structures',
      })
      expect(post.pointers.social).toEqual({ brandId: 'cerebral', platform: 'instagram' })
      expect(post.pointers.sourceId).toBe(before.pointers.sourceId)
      expect(post.pointers.factsId).toBe(before.pointers.factsId)
      expect(post.current.facts?.id).toBe(before.current.facts?.id ?? '')
      expect(post.current.source?.id).toBe(before.current.source?.id ?? '')

      const revision = post.current.revision?.body
      expect(revision?.structure).toEqual(before.current.revision?.body.structure)
      expect(revision?.template).toEqual(before.current.revision?.body.template)
      expect(revision?.brand.id).toBe('cerebral')
      expect(revision?.themeId).toBe('cerebral')
      expect(revision?.note).toBe('social: Cerebral')
      expect(post.current.layout?.body.fitChecks).toEqual([])
      expect(post.current.layout?.body.slides.length).toBe(
        before.current.layout?.body.slides.length,
      )

      const card = (await store.listCards()).find((c) => c.id === made.id)
      expect(card).toMatchObject({ platform: 'instagram', brandName: 'Cerebral', parentId })
      // The parent is untouched.
      expect((await load(parentId)).version).toBe(before.version)

      expect(
        await social.adaptPost(ED, parentId, version, {
          ...input,
          requestId: randomUUID(),
          brandId: 'feed',
        }),
      ).toMatchObject({ ok: false })
    },
    SLOW,
  )

  test(
    'renderSocial draws the parent’s art, leaves its facts untouched and stores a checked caption (64)',
    async () => {
      const { id: parentId } = await liveParent()
      const before = await load(parentId)
      let { id, version } = await adapt()
      // Feed steps never run on a social version, nor social steps on a feed post.
      expect(await commands.approveStructure(ED, id, version)).toMatchObject({ ok: false })
      expect(await social.approveLayout(ED, parentId, before.version)).toMatchObject({ ok: false })
      expect(await social.approveLayout(REV, id, version)).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      ;({ version } = ok(await social.approveLayout(ED, id, version)))
      expect((await load(id)).stage).toBe('approved')
      expect(await commands.renderPost(ED, id, version)).toMatchObject({ ok: false })
      ;({ version } = ok(await social.renderSocial(ED, id, version)))
      await settled()

      const post = await load(id)
      expect(post.stage).toBe('ready')
      expect(post.current.render?.body.art.assetId).toBe(
        before.current.render?.body.art.assetId ?? '',
      )
      expect(post.current.render?.body.slides.length).toBe(post.current.layout?.body.slides.length)
      const caption = post.current.caption?.body
      expect(caption).toMatchObject({ platform: 'instagram', checked: true, notFound: [] })
      expect(caption?.approvedText).toBe(caption?.text ?? '')
      expect(caption?.approvedHashtags).toEqual(caption?.hashtags ?? [])
      // The body is the post's own lines, as they stand on the slides, under the model's hook and
      // before its call to action; the search line and the sources close it (GD31); the hashtags are
      // the parent's tags (109).
      const slides = post.current.revision?.body.structure.slides ?? []
      const firstBody = slides.find((s) => s.kind === 'body')?.slots.body.text ?? ''
      const takeaway = slides.find((s) => s.kind === 'take')?.slots.takeaway.text ?? ''
      expect(firstBody.length).toBeGreaterThan(0)
      expect(caption?.text).toContain(`\n\n${firstBody}\n`)
      expect(caption?.text).toContain(`${takeaway}\n\n`)
      expect(
        caption?.text.endsWith(
          `To find this again, search “OfCourse ${paidWork.title}”\n\nSources: ${paidWork.title}`,
        ),
      ).toBe(true)
      expect(caption?.text.split(/\s+/).length).toBeLessThanOrEqual(150)
      expect(caption?.hashtags).toEqual(['#BooksAndMovies'])

      const after = await load(parentId)
      expect(after.version).toBe(before.version)
      expect(after.pointers.factsId).toBe(before.pointers.factsId)
      expect(after.current.facts).toEqual(before.current.facts)
    },
    SLOW,
  )

  test(
    'a social render exports once its caption is checked; no vision check runs on it (103)',
    async () => {
      const { id, version } = await ready()
      const post = await load(id)
      expect(post.pointers.visionId).toBeNull()
      ok(await social.markExported(ED, id, version))
      expect((await load(id)).stage).toBe('exported')
    },
    SLOW,
  )

  test(
    'an edited caption blocks markExported until reset or checked again (66)',
    async () => {
      let { id, version } = await ready()
      const approved = (await load(id)).current.caption?.body
      if (!approved) throw new Error('no caption')

      ;({ version } = ok(
        await social.editCaption(ED, id, version, 'Students who work 35 hours do better.', []),
      ))
      expect((await load(id)).current.caption?.body.checked).toBe(false)
      expect(await social.markExported(ED, id, version)).toEqual({
        ok: false,
        error: errors.captionCheck,
      })
      ;({ version } = ok(await social.checkCaption(ED, id, version)))
      const checked = (await load(id)).current.caption?.body
      expect(checked?.checked).toBe(false)
      expect(checked?.notFound).toEqual(['Students who work 35 hours do better.'])
      expect(await social.markExported(ED, id, version)).toMatchObject({ ok: false })

      ;({ version } = ok(await social.resetCaption(ED, id, version)))
      const reset = (await load(id)).current.caption?.body
      expect(reset).toMatchObject({
        text: approved.text,
        hashtags: approved.hashtags,
        checked: true,
      })

      // The same words back again count as approved. The check reads only the new wording: the
      // approved hook stays unasked (no paragraph says it), and a sentence the source holds passes.
      ;({ version } = ok(
        await social.editCaption(ED, id, version, approved.text, approved.hashtags),
      ))
      expect((await load(id)).current.caption?.body.checked).toBe(true)
      const { sentences } = await import('../text/sentences')
      const hook = sentences(approved.text)[0]
      const fromSource = sentences(paidWork.text).find((s) => !approved.text.includes(s))
      if (!fromSource) throw new Error('no source sentence outside the caption')
      ;({ version } = ok(
        await social.editCaption(ED, id, version, `${hook} ${fromSource}`, ['#study']),
      ))
      ;({ version } = ok(await social.checkCaption(ED, id, version)))
      expect((await load(id)).current.caption?.body).toMatchObject({ checked: true, notFound: [] })

      ;({ version } = ok(await social.markExported(ED, id, version)))
      const exported = await load(id)
      expect(exported.stage).toBe('exported')
      expect(exported.current.export?.body.fileName).toBe(
        exportName('Cerebral', paidWork.title, 'instagram'),
      )
    },
    SLOW,
  )

  test(
    'LinkedIn takes no hashtags, and a caption edit is refused once exported',
    async () => {
      let { id, version } = await ready('linkedin')
      expect((await load(id)).current.caption?.body.hashtags).toEqual([])
      expect(await social.editCaption(ED, id, version, 'Text.', ['#study'])).toMatchObject({
        ok: false,
      })
      ;({ version } = ok(await social.markExported(ED, id, version)))
      expect(await social.editCaption(ED, id, version, 'Text.', [])).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )

  test(
    'recordPostUrl keeps the post’s Instagram link as a record on the exported version; any other URL, version or platform is refused (89)',
    async () => {
      const first = 'https://www.instagram.com/p/C-abc123/'
      let { id, version } = await ready()
      // Not exported yet: nothing has been posted.
      expect(await social.recordPostUrl(ED, id, version, first)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
      ;({ version } = ok(await social.markExported(ED, id, version)))
      const exportId = (await load(id)).current.export?.id
      expect(exportId).toBeTruthy()

      for (const url of [
        'http://instagram.com/p/x',
        'https://example.com',
        'https://instagram.com.evil.test/p/x',
        'javascript:alert(1)',
        'not a url',
      ]) {
        expect(await social.recordPostUrl(ED, id, version, url)).toEqual({
          ok: false,
          error: social.SOCIAL_ERRORS.url,
        })
      }
      for (const actor of [REV, ADMIN, STUDENT]) {
        expect(await social.recordPostUrl(actor, id, version, first)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      expect((await load(id)).pointers.socialLinkId).toBeNull()

      ;({ version } = ok(await social.recordPostUrl(ED, id, version, first)))
      const linked = await load(id)
      expect(linked.stage).toBe('exported')
      const linkId = linked.pointers.socialLinkId as string
      expect(linkId).toMatch(/^social_link_/)
      expect(linked.records.get(linkId)).toMatchObject({
        kind: 'social_link',
        body: {
          exportId,
          platform: 'instagram',
          url: first,
          by: { userId: ED.id, name: ED.name },
        },
      })

      // A later URL is a new record; the first one stays as it was written.
      const second = 'https://instagram.com/p/C-def456/'
      ;({ version } = ok(await social.recordPostUrl(ED, id, version, second)))
      const again = await load(id)
      expect(again.pointers.socialLinkId).not.toBe(linkId)
      expect(again.records.get(again.pointers.socialLinkId as string)?.body).toMatchObject({
        url: second,
      })
      const rows = await db
        .select({ id: schema.contentArtifact.id })
        .from(schema.contentArtifact)
        .where(
          orm.and(
            orm.eq(schema.contentArtifact.postId, id),
            orm.eq(schema.contentArtifact.kind, 'social_link'),
          ),
        )
      expect(rows.map((r) => r.id).sort()).toEqual(
        [linkId, again.pointers.socialLinkId as string].sort(),
      )

      // A LinkedIn version has no Instagram link.
      const linkedIn = await ready('linkedin')
      const exportedLi = ok(await social.markExported(ED, linkedIn.id, linkedIn.version))
      expect(await social.recordPostUrl(ED, linkedIn.id, exportedLi.version, first)).toEqual({
        ok: false,
        error: errors.movedOn,
      })
    },
    SLOW,
  )

  test(
    'makeSet: an Instagram version per page with a design language, none for the rest, and the quote card, each rendered with its caption, once; exports as today (108)',
    async () => {
      const { id: parentId, version } = await liveParent()
      const parent = await load(parentId)
      const ids = () => ({ main: randomUUID(), cerebral: randomUUID(), quote: randomUUID() })
      // Who may: editors, on a live feed post; nothing is made otherwise.
      const refused = { requestIds: ids() }
      for (const actor of [REV, ADMIN, STUDENT]) {
        expect(await social.makeSet(actor, parentId, version, refused)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      const drafted = await rendered()
      expect(await social.makeSet(ED, drafted.id, drafted.version, refused)).toEqual({
        ok: false,
        error: errors.notLive,
      })
      for (const id of Object.values(refused.requestIds)) {
        expect(await store.loadPost(id)).toBeNull()
      }

      await db.delete(schema.pageStyle)
      try {
        await styled('main', 5)
        await styled('cerebral', 6)
        // Infographics has no design language.
        const before = (await childrenOf(parentId)).length

        // One request id per styled page and one for the quote card, or nothing is made.
        const short = { requestIds: { infographics: randomUUID(), quote: randomUUID() } }
        expect(await social.makeSet(ED, parentId, version, short)).toEqual({
          ok: false,
          error: social.SOCIAL_ERRORS.set,
        })
        expect(await store.loadPost(short.requestIds.quote)).toBeNull()

        const requestIds = ids()
        posts.push(...Object.values(requestIds))
        const made = ok(await social.makeSet(ED, parentId, version, { requestIds }))
        expect(made).toMatchObject({ id: parentId, version })
        expect(
          made.versions.map((v) => [
            v.id,
            v.title,
            v.brandId,
            v.kind,
            v.stage,
            v.error,
            v.ownCover,
          ]),
        ).toEqual([
          [requestIds.main, 'Instagram · Main', 'main', 'page', 'ready', null, true],
          [requestIds.cerebral, 'Instagram · Cerebral', 'cerebral', 'page', 'ready', null, true],
          [requestIds.quote, 'Quote card · Main', 'main', 'quote', 'ready', null, false],
        ])
        await settled()

        // Three linked cards, none for the page without a design language; the parent is untouched.
        const cards = await childrenOf(parentId)
        expect(cards.length).toBe(before + 3)
        expect(cards.some((c) => c.brandName === 'Infographics')).toBe(false)
        expect((await load(parentId)).version).toBe(parent.version)

        const parentArt = parent.current.render?.body.art
        for (const v of made.versions) {
          const post = await load(v.id)
          expect(post).toMatchObject({ kind: 'social', parentId, stage: 'ready' })
          expect(post.pointers.social).toEqual({ brandId: v.brandId, platform: 'instagram' })
          const caption = post.current.caption?.body
          expect(caption).toMatchObject({
            platform: 'instagram',
            checked: true,
            hashtags: ['#BooksAndMovies'],
          })
          expect(
            caption?.text.endsWith(
              `To find this again, search “OfCourse ${paidWork.title}”\n\nSources: ${paidWork.title}`,
            ),
          ).toBe(true)
          expect(post.current.render?.body.slides.length).toBe(
            post.current.layout?.body.slides.length,
          )
          // A styled page draws its own cover in its art style; the quote card has no art box,
          // so it keeps the feed post's art and spends no image on one.
          const art = post.current.render?.body.art
          expect(art?.prompt === parentArt?.prompt).toBe(v.kind === 'quote')
          if (v.kind === 'page') expect(art?.prompt).toContain(`the ${LOOK[v.brandId]} look`)
        }

        // The quote card: the first bound factual slot's first sentence, bound to that slot's
        // facts, as the one slide of the quote-card template, with the source and search lines.
        const slides = parent.current.revision?.body.structure.slides ?? []
        const firstBody = slides.find((s) => s.kind === 'body')?.slots.body
        const { sentences } = await import('../text/sentences')
        const quote = sentences(firstBody?.text ?? '')[0]
        expect(quote.length).toBeGreaterThan(0)
        expect(firstBody?.factIds.length).toBeGreaterThan(0)
        const card = await load(requestIds.quote)
        const revision = card.current.revision?.body
        expect(revision?.template.id).toBe('quote-card')
        expect(revision?.brand.id).toBe('main')
        expect(revision?.note).toBe('quote card: Main')
        expect(revision?.structure).toEqual({
          templateId: 'quote-card',
          slides: [
            {
              kind: 'single',
              slots: { quote: { text: quote, factIds: firstBody?.factIds ?? [], factual: true } },
            },
          ],
          artPrompt: parent.current.revision?.body.structure.artPrompt ?? '',
        })
        const laid = card.current.layout?.body.slides ?? []
        expect(laid).toHaveLength(1)
        expect(laid[0].searchLine).toBe(`To find this again, search “OfCourse ${paidWork.title}”`)
        expect(laid[0].sourceLine).toMatch(/^Source: /)
        expect(laid[0].lines.some((l) => l.slot === 'quote')).toBe(true)
        expect(card.current.caption?.body.text).toContain(`\n\n${quote}\n\n`)

        // The same request ids again make nothing new: a double press finds the set made.
        const again = ok(await social.makeSet(ED, parentId, version, { requestIds }))
        expect(again.versions.map((v) => [v.id, v.stage, v.error])).toEqual(
          made.versions.map((v) => [v.id, 'ready', null]),
        )
        expect((await childrenOf(parentId)).length).toBe(before + 3)

        // Each exports as today.
        ok(await social.markExported(ED, card.id, card.version))
        const exported = await load(card.id)
        expect(exported.stage).toBe('exported')
        expect(exported.current.export?.body.fileName).toBe(
          exportName('Main', paidWork.title, 'instagram'),
        )
      } finally {
        await db.delete(schema.pageStyle)
      }
    },
    SLOW * 2,
  )

  test(
    'a feed post never goes to the Comics page: adapting it there is refused, and makeSet leaves a styled Comics page out (RC8)',
    async () => {
      const { id: parentId, version } = await liveParent()
      const refused = { brandId: 'comics', platform: 'instagram' as const, requestId: randomUUID() }
      expect(await social.adaptPost(ED, parentId, version, refused)).toEqual({
        ok: false,
        error: social.SOCIAL_ERRORS.brand,
      })
      expect(await store.loadPost(refused.requestId)).toBeNull()

      await db.delete(schema.pageStyle)
      try {
        await styled('main', 9)
        await styled('comics', 10)
        const before = (await childrenOf(parentId)).length
        const requestIds = { main: randomUUID(), quote: randomUUID() }
        posts.push(...Object.values(requestIds))
        const made = ok(await social.makeSet(ED, parentId, version, { requestIds }))
        await settled()
        expect(made.versions.map((v) => [v.id, v.brandId, v.kind, v.stage])).toEqual([
          [requestIds.main, 'main', 'page', 'ready'],
          [requestIds.quote, 'main', 'quote', 'ready'],
        ])
        const cards = await childrenOf(parentId)
        expect(cards.length).toBe(before + 2)
        expect(cards.some((c) => c.brandName === 'OfCourse Comics')).toBe(false)
      } finally {
        await db.delete(schema.pageStyle)
      }
    },
    SLOW * 2,
  )

  test(
    'a look post adapted for Main keeps its look and Subdued preset in Main’s fonts, and draws each slide with the parent’s own image, tinted (GD8, GD12)',
    async () => {
      const { presetThemes, GUIDELINE } = await import('../brands/guideline')
      const { tintFilter } = await import('../layout/tint')
      const { imagesOf } = await import('./commands/shared')
      const feed = await liveLook('field-notes')
      const before = await load(feed.id)
      const parentRender = before.current.render?.body
      if (!parentRender?.slideArt) throw new Error('the look post has no images')

      const post = await renderedVersion(feed, 'main')
      const revision = post.current.revision?.body
      expect(revision?.template).toEqual(before.current.revision?.body.template)
      expect(revision?.structure).toEqual(before.current.revision?.body.structure)
      expect(revision?.brand.id).toBe('main')
      expect(revision?.themeId).toBe('subdued')
      expect(post.pointers.themeId).toBe('subdued')
      expect(post.stage).toBe('ready')

      // The parent's pictures, slide by slide, and no cover of its own.
      const render = post.current.render?.body
      expect(render?.slideArt).toEqual(parentRender.slideArt)
      expect(render?.art).toEqual(parentRender.art)
      const images = await imagesOf(parentRender)
      const surfaces = presetThemes('subdued')
      const tint = tintFilter('subdued', GUIDELINE)
      const laid = post.current.layout?.body.slides ?? []
      const svgs = await svgsOf(post)
      expect(svgs).toHaveLength(laid.length)
      let pictured = 0
      for (const [i, svg] of svgs.entries()) {
        const surface = laid[i].surface
        if (!surface) throw new Error('a look slide has no surface')
        expect(svg).toContain(`fill="${surfaces[surface].bg}"`)
        const bytes = images?.slideArt.find((a) => a.slide === i + 1)?.bytes
        if (laid[i].artBox && bytes) {
          pictured += 1
          expect(svg).toContain(base64(bytes))
          expect(svg).toContain(tint)
          expect(svg).toContain('filter="url(#tint)"')
        }
      }
      expect(pictured).toBe(parentRender.slideArt.length)
      expect((await load(feed.id)).version).toBe(before.version)
    },
    SLOW,
  )

  test(
    'a Postcard post’s social version shows the same panorama windows as the post (GD4, GD12)',
    async () => {
      const feed = await liveLook('postcard')
      const before = await load(feed.id)
      const parentRender = before.current.render?.body
      expect(parentRender?.panorama?.assetId).toEqual(expect.any(String))

      const post = await renderedVersion(feed, 'cerebral', 'linkedin')
      expect(post.current.revision?.body.themeId).toBe('subdued')
      expect(post.current.render?.body.panorama).toEqual(parentRender?.panorama ?? null)
      const windows = (svgs: string[]) =>
        svgs.map((svg) => svg.match(/<svg x="[^"]*" y="[^"]*"[^>]*viewBox="[^"]*"[^>]*>/)?.[0])
      const mine = windows(await svgsOf(post))
      expect(mine.length).toBeGreaterThan(1)
      expect(mine.every((w) => w !== undefined)).toBe(true)
      expect(mine).toEqual(windows(await svgsOf(before)))
      const wide = (await store.getAsset(parentRender?.panorama?.assetId as string))?.bytes
      for (const svg of await svgsOf(post)) expect(svg).toContain(base64(wide as Uint8Array))
    },
    SLOW,
  )

  test(
    'a the-line post adapts and renders as before: its page’s first theme, the single art, no images, the stored SVG as drawn from them',
    async () => {
      const { draw } = await import('./commands/shared')
      const { id } = await ready()
      const post = await load(id)
      const revision = post.current.revision
      const layout = post.current.layout
      const render = post.current.render?.body
      if (!revision || !layout || !render) throw new Error('the version is not rendered')
      expect(revision.body.themeId).toBe(revision.body.brand.themes[0].id)
      expect(render.slideArt).toBeUndefined()
      expect(render.panorama).toBeUndefined()
      const art = render.art.assetId ? (await store.getAsset(render.art.assetId))?.bytes : null
      const drawn = draw(revision.body, layout.body, art ?? null)
      expect(await svgsOf(post)).toEqual(drawn.slides.map((s) => new TextDecoder().decode(s.svg)))
    },
    SLOW,
  )

  test(
    'makeSet on a look post makes its page versions, each with the post’s look, preset and pictures, and the quote card (GD8, 108)',
    async () => {
      const feed = await liveLook('field-notes')
      const before = await load(feed.id)
      const parentRender = before.current.render?.body
      await db.delete(schema.pageStyle)
      try {
        await styled('main', 7)
        await styled('cerebral', 8)
        const requestIds = { main: randomUUID(), cerebral: randomUUID(), quote: randomUUID() }
        posts.push(...Object.values(requestIds))
        const made = ok(await social.makeSet(ED, feed.id, feed.version, { requestIds }))
        await settled()
        expect(made.versions.map((v) => [v.id, v.kind, v.stage, v.error, v.ownCover])).toEqual([
          [requestIds.main, 'page', 'ready', null, false],
          [requestIds.cerebral, 'page', 'ready', null, false],
          [requestIds.quote, 'quote', 'ready', null, false],
        ])
        for (const brandId of ['main', 'cerebral'] as const) {
          const post = await load(requestIds[brandId])
          expect(post.current.revision?.body).toMatchObject({
            template: before.current.revision?.body.template,
            themeId: 'subdued',
            brand: { id: brandId },
          })
          expect(post.current.render?.body.slideArt).toEqual(parentRender?.slideArt)
        }
        const card = await load(requestIds.quote)
        expect(card.current.revision?.body.template.id).toBe('quote-card')
        expect(card.current.revision?.body.themeId).toBe(
          card.current.revision?.body.brand.themes[0].id,
        )
        expect(card.current.render?.body.slideArt).toBeUndefined()
      } finally {
        await db.delete(schema.pageStyle)
      }
    },
    SLOW * 2,
  )

  test(
    'the export route returns the render’s stored PNGs byte for byte, to editors only (67, 68)',
    async () => {
      let { id, version } = await ready()
      const ctx = { params: Promise.resolve({ id }) } as never
      const get = () =>
        exportRoute.GET(new Request(`http://localhost/admin/posts/${id}/export`) as never, ctx)

      session = { user: ED }
      // Not exported yet: nothing to download.
      expect((await get()).status).toBe(404)
      ;({ version } = ok(await social.markExported(ED, id, version)))

      for (const user of [null, STUDENT, REV, ADMIN]) {
        session = user ? { user } : null
        expect((await get()).status).toBe(404)
      }

      session = { user: ED }
      const res = await get()
      expect(res.status).toBe(200)
      const post = await load(id)
      const fileName = post.current.export?.body.fileName
      expect(res.headers.get('content-type')).toBe('application/zip')
      expect(res.headers.get('content-disposition')).toBe(`attachment; filename="${fileName}"`)

      const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
      const slides = post.current.render?.body.slides ?? []
      expect(slides.length).toBeGreaterThan(0)
      expect(Object.keys(files).sort()).toEqual(
        [
          'caption.txt',
          ...slides.flatMap((_, i) => [`slide-${i + 1}.png`, `slide-${i + 1}.svg`]),
        ].sort(),
      )
      for (const [i, slide] of slides.entries()) {
        const png = await store.getAsset(slide.pngAssetId)
        const svg = await store.getAsset(slide.svgAssetId)
        expect(files[`slide-${i + 1}.png`]).toEqual(new Uint8Array(png?.bytes ?? []))
        expect(files[`slide-${i + 1}.svg`]).toEqual(new Uint8Array(svg?.bytes ?? []))
      }
      const caption = post.current.caption?.body
      expect(new TextDecoder().decode(files['caption.txt'])).toBe(
        `${caption?.text}\n\n${caption?.hashtags.join(' ')}`,
      )
      session = null
    },
    SLOW,
  )
})
