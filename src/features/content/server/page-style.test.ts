// A page's design language (criterion 105) against the development database (Docker, port 5433);
// off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/page-style.test.ts
// The model layer is the fake provider (AI_PROVIDER=fake) on the real call log and cache, watched:
// each text call's data and each image call's references are recorded. Every account here has an
// id starting `ps-` and is deleted after, with its posts. The page styles saved before the run are
// put back after it, so the dev server's own are never lost.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { Provider } from '../ai/client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '100000'
process.env.AI_DAILY_CAP_IMAGE = '100000'
process.env.GEMINI_IMAGE_MODEL = `ps-imagen-${randomUUID()}`
process.env.GEMINI_FLASH_MODEL = `ps-flash-${randomUUID()}`
process.env.GEMINI_PRO_MODEL = `ps-pro-${randomUUID()}`

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'ps-'
const SLOW = 60_000

type User = { id: string; role: string; editor: boolean; reviewer: boolean; name: string }
const ED: User = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'PS ed' }
const SUPER: User = {
  id: `${P}su`,
  role: 'superadmin',
  editor: false,
  reviewer: false,
  name: 'PS su',
}
const REV: User = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'PS rev' }
const ADMIN: User = { id: `${P}ad`, role: 'admin', editor: false, reviewer: false, name: 'PS ad' }

const GENERAL = {
  layer: 'general' as const,
  audience: { mode: 'everyone' as const, rules: [] },
  whyLine: null,
  expiry: { kind: 'none' as const },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption' as const,
}

/** Bytes that start like a PNG, a JPEG or a GIF; only the start is read. */
const png = (n = 16, seed = 1) => {
  const b = new Uint8Array(n).fill(seed)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return b
}
const jpeg = (seed = 2) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, seed, seed, seed, seed])
const gif = () => new TextEncoder().encode('GIF89a-not-a-png')
const MB5 = 5 * 1024 * 1024
/** A word for each page's look: a page's own name is a brand name, which the art style may not carry. */
const LOOK: Record<string, string> = {
  main: 'poster',
  cerebral: 'charcoal',
  infographics: 'diagram',
}

describe.skipIf(!enabled)('page styles against the database', () => {
  let pageStyle: typeof import('./page-style')
  let commands: typeof import('./commands')
  let social: typeof import('./social')
  let store: typeof import('./store')
  let limits: typeof import('../lib/page-style')
  let errors: typeof import('../lib/workflow').WORKFLOW_ERRORS
  let paidWork: { title: string; kind: string; text: string }
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let saved: typeof import('@/shared/lib/db/schema').pageStyle.$inferSelect[] = []
  const posts: string[] = []

  /** What reached the model: each text call's use case and data, each image call's references. */
  const calls: { useCase: string; data: unknown }[] = []
  const images: { prompt: string; references: string[] }[] = []
  /** While true, every image call fails as the model would. */
  let imageFails = false

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

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.createdByUserId, `${P}%`))
    if (posts.length > 0) {
      await db.delete(schema.aiCall).where(orm.inArray(schema.aiCall.postId, posts))
    }
    await db.delete(schema.aiCache).where(orm.like(schema.aiCache.model, `${P}%`))
    await db.delete(schema.pageStyle)
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  /** Two reference images uploaded for the page, and its design language saved from them. */
  async function styled(brandId: string, seed: number) {
    const a = ok(await pageStyle.uploadReference(ED, brandId, png(32, seed)))
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
    return [a.assetId, b.assetId]
  }

  /** A post made with "Make post" on this page (or none), drafted after the response. */
  async function made(pageBrandId: string | null) {
    const requestId = randomUUID()
    posts.push(requestId)
    ok(await commands.makePost(ED, { requestId, ...paidWork, pageBrandId }))
    await settled()
    // "Make post" stops at the idea cards (GD1): the first one is outlined, then written (GD32).
    let { version } = await load(requestId)
    ;({ version } = ok(await commands.pickIdeas(ED, requestId, version, { cards: [0] })))
    ok(await commands.writeSlides(ED, requestId, version))
    return load(requestId)
  }

  /** The post approved, then rendered by `render` once its source check has landed. */
  async function approvedThen(
    post: { id: string; version: number },
    render: (id: string, version: number) => Promise<void>,
  ) {
    let { id, version } = post
    ;({ version } = ok(await commands.pickStructure(ED, id, version, 0)))
    ;({ version } = ok(await commands.chooseTheme(ED, id, version, 'paper')))
    ok(await commands.approveStructure(ED, id, version))
    await settled()
    await render(id, (await load(id)).version)
    await settled()
    return { id, version: (await load(id)).version }
  }

  /** A look post on this page (an idea card's), its images planned and drawn (GD12). */
  async function rendered(pageBrandId: string | null) {
    return approvedThen(await made(pageBrandId), async (id, version) => {
      const planned = ok(await commands.planImages(ED, id, version))
      ok(await commands.drawImages(ED, id, planned.version))
    })
  }

  /** A post on this page in an old template, rendered with its one cover (GD8). */
  async function renderedLegacy(pageBrandId: string | null) {
    const post = await made(pageBrandId)
    let { version } = ok(await commands.tickTemplates(ED, post.id, post.version, ['the-line']))
    ;({ version } = ok(await commands.draftPost(ED, post.id, version, false)))
    return approvedThen({ id: post.id, version }, async (id, at) => {
      ok(await commands.renderPost(ED, id, at))
    })
  }

  async function live(pageBrandId: string | null) {
    let { id, version } = await renderedLegacy(pageBrandId)
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

  /** A social version of the live post on this page, rendered with its caption. */
  async function socialOn(parent: { id: string; version: number }, brandId: string) {
    const requestId = randomUUID()
    const at = (await load(parent.id)).version
    let { id, version } = ok(
      await social.adaptPost(ED, parent.id, at, { brandId, platform: 'instagram', requestId }),
    )
    ;({ version } = ok(await social.approveLayout(ED, id, version)))
    const res = await social.renderSocial(ED, id, version)
    await settled()
    return { res, post: await load(id) }
  }

  const draftData = () =>
    calls.filter((c) => c.useCase === 'draft').map((c) => c.data as Record<string, unknown>)

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
    const provider: Provider = {
      json: async (req) => {
        calls.push({ useCase: req.useCase, data: req.data })
        return fake.json(req)
      },
      image: async (req) => {
        images.push({
          prompt: req.prompt,
          references: (req.references ?? []).map((r) => `${r.mime}:${r.base64}`),
        })
        if (imageFails) throw new Error('image down')
        return fake.image(req)
      },
    }
    const ai = client.makeAi({
      provider,
      config: aiConfig(process.env),
      calls: dbCallLog,
      cache: dbCache,
    })
    mock.module('../ai/client', () => ({ ...client, ai }))

    pageStyle = await import('./page-style')
    commands = await import('./commands')
    social = await import('./social')
    store = await import('./store')
    limits = await import('../lib/page-style')
    ;({ WORKFLOW_ERRORS: errors } = await import('../lib/workflow'))
    ;(await import('./after')).scheduleWith((task) => {
      background.push(task())
    })
    const { DEMO_SOURCES } = await import('../demo-sources')
    const demo = DEMO_SOURCES.find((s) => s.key === 'paid-work')
    if (!demo) throw new Error('demo source missing')
    paidWork = { title: demo.title, kind: demo.kind, text: demo.text }

    saved = await db.select().from(schema.pageStyle)
    await cleanUp()
    await db.insert(schema.user).values(
      [ED, SUPER, REV, ADMIN].map((a) => ({
        id: a.id,
        name: a.name,
        email: `${a.id}@ps.e2e.test`,
        role: a.role as 'user' | 'admin' | 'superadmin',
        editor: a.editor,
        reviewer: a.reviewer,
      })),
    )
  })

  afterAll(async () => {
    await cleanUp()
    if (saved.length > 0) await db.insert(schema.pageStyle).values(saved)
  })

  beforeEach(async () => {
    calls.length = 0
    images.length = 0
    imageFails = false
    await db.delete(schema.pageStyle)
  })

  describe('reference images', () => {
    test('refuses anything but a PNG or JPEG by its bytes, over 5 MB, or empty', async () => {
      const refusals: [Uint8Array, string][] = [
        [gif(), limits.PAGE_STYLE_ERRORS.type],
        [
          new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
          limits.PAGE_STYLE_ERRORS.type,
        ],
        [png(MB5 + 1), limits.PAGE_STYLE_ERRORS.size],
        [new Uint8Array(0), limits.PAGE_STYLE_ERRORS.type],
      ]
      for (const [bytes, error] of refusals) {
        expect(await pageStyle.uploadReference(ED, 'cerebral', bytes)).toEqual({ ok: false, error })
      }
      // Exactly 5 MB is allowed.
      expect((await pageStyle.uploadReference(ED, 'cerebral', png(MB5))).ok).toBe(true)
    })

    test('stores a PNG and a JPEG as content assets, typed by their bytes', async () => {
      const a = ok(await pageStyle.uploadReference(ED, 'main', png()))
      const b = ok(await pageStyle.uploadReference(SUPER, 'main', jpeg()))
      expect((await store.getAsset(a.assetId))?.mime).toBe('image/png')
      expect((await store.getAsset(b.assetId))?.mime).toBe('image/jpeg')
    })

    test('refuses reviewers, admins and the feed brand', async () => {
      for (const who of [REV, ADMIN]) {
        expect(await pageStyle.uploadReference(who, 'main', png())).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      for (const brandId of ['feed', 'nope']) {
        expect(await pageStyle.uploadReference(ED, brandId, png())).toEqual({
          ok: false,
          error: limits.PAGE_STYLE_ERRORS.brand,
        })
      }
    })
  })

  describe('describing and saving', () => {
    test(
      'describes the style from one or two uploaded images, with the images sent to the model',
      async () => {
        const a = ok(await pageStyle.uploadReference(ED, 'cerebral', png()))
        const b = ok(await pageStyle.uploadReference(ED, 'cerebral', jpeg()))
        const res = ok(await pageStyle.describePageStyle(ED, 'cerebral', [a.assetId, b.assetId]))
        expect(res.fields.artStyle.length).toBeGreaterThan(0)
        expect(res.fields.copyStyle.length).toBeGreaterThan(0)
        expect(res.fields.closestTemplateId).toBe('field-notes')
        expect(calls.map((c) => c.useCase)).toEqual(['design_language'])
        // Nothing is saved until the editor saves.
        expect(await pageStyle.pageStyleOf('cerebral')).toBeNull()
      },
      SLOW,
    )

    test('refuses no image, three, an unknown asset and one that is not a PNG or JPEG', async () => {
      const a = ok(await pageStyle.uploadReference(ED, 'cerebral', png()))
      const svg = await store.putAsset(null, new TextEncoder().encode('<svg/>'), 'image/svg+xml')
      for (const ids of [[], [a.assetId, a.assetId, a.assetId], ['asset-nope'], [svg]]) {
        expect(await pageStyle.describePageStyle(ED, 'cerebral', ids)).toEqual({
          ok: false,
          error: limits.PAGE_STYLE_ERRORS.images,
        })
      }
      expect(await pageStyle.describePageStyle(REV, 'cerebral', [a.assetId])).toEqual({
        ok: false,
        error: errors.notAuthorised,
      })
      expect(calls).toHaveLength(0)
    })

    test('saves the fields, which are editable, and reads them back for the page alone', async () => {
      const refs = await styled('cerebral', 3)
      expect(await pageStyle.pageStyleOf('cerebral')).toMatchObject({
        brandId: 'cerebral',
        artStyle: 'Loose ink line, wide margins, the charcoal look.',
        copyStyle: 'Short lines in the charcoal voice.',
        closestTemplateId: 'the-line',
        referenceAssetIds: refs,
        updatedByName: ED.name,
      })
      ok(
        await pageStyle.savePageStyle(SUPER, {
          brandId: 'cerebral',
          artStyle: '  Charcoal sketches, close crops.  ',
          copyStyle: 'One question per slide.',
          closestTemplateId: 'the-question',
          referenceAssetIds: [refs[0]],
        }),
      )
      expect(await pageStyle.pageStyleOf('cerebral')).toMatchObject({
        artStyle: 'Charcoal sketches, close crops.',
        copyStyle: 'One question per slide.',
        closestTemplateId: 'the-question',
        referenceAssetIds: [refs[0]],
        updatedByName: SUPER.name,
      })
      expect(await pageStyle.pageStyleOf('main')).toBeNull()
      expect(await pageStyle.pageStyleOf(null)).toBeNull()
      expect([...(await pageStyle.pageStyles()).keys()]).toEqual(['cerebral'])
      const design = await pageStyle.designLanguageOf('cerebral')
      expect(design?.artStyle).toBe('Charcoal sketches, close crops.')
      expect(design?.references.map((r) => [r.assetId, r.mime])).toEqual([[refs[0], 'image/png']])
    })

    test('refuses a save from a reviewer or an admin, and fields the rules refuse', async () => {
      const a = ok(await pageStyle.uploadReference(ED, 'main', png()))
      const good = {
        brandId: 'main',
        artStyle: 'Ink line.',
        copyStyle: 'Short lines.',
        closestTemplateId: 'the-line',
        referenceAssetIds: [a.assetId],
      }
      for (const who of [REV, ADMIN]) {
        expect(await pageStyle.savePageStyle(who, good)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
      }
      const refused: [Partial<typeof good>, string][] = [
        [{ artStyle: 'Three panels' + ' 3' }, limits.PAGE_STYLE_ERRORS.artStyle],
        [{ artStyle: 'An OfCourse poster' }, limits.PAGE_STYLE_ERRORS.artStyle],
        [{ artStyle: 'x'.repeat(241) }, limits.PAGE_STYLE_ERRORS.fields],
        [{ copyStyle: '  ' }, limits.PAGE_STYLE_ERRORS.fields],
        [{ closestTemplateId: 'nope' }, limits.PAGE_STYLE_ERRORS.fields],
        [{ referenceAssetIds: [] }, limits.PAGE_STYLE_ERRORS.images],
        [{ brandId: 'feed' }, limits.PAGE_STYLE_ERRORS.brand],
      ]
      for (const [over, error] of refused) {
        expect(await pageStyle.savePageStyle(ED, { ...good, ...over })).toEqual({
          ok: false,
          error,
        })
      }
      expect(await pageStyle.pageStyleOf('main')).toBeNull()
    })
  })

  describe("a post on a page follows the page's design language", () => {
    test(
      "passes the copy style into the draft data and the reference images into each cover's image request",
      async () => {
        const refs = await styled('cerebral', 4)
        const post = await made('cerebral')
        expect(post.pointers.pageBrandId).toBe('cerebral')
        expect(draftData().map((d) => d.copy_style)).toEqual(['Short lines in the charcoal voice.'])

        images.length = 0
        const { id, version } = await rendered('cerebral')
        // An image per art box of the look (GD12), each in the page's look.
        expect(images.length).toBeGreaterThan(1)
        // The page's art style replaces the guideline's style sentence, and only it (GD15).
        const { GUIDELINE } = await import('../brands/guideline')
        const stored = await Promise.all(refs.map((r) => store.getAsset(r)))
        for (const image of images) {
          expect(image.prompt).toContain('Style: Loose ink line, wide margins, the charcoal look.')
          expect(image.prompt).not.toContain(`Style: ${GUIDELINE.art.style}`)
          expect(image.prompt).toContain(`Never show: ${GUIDELINE.art.neverShow.join('; ')}`)
          expect(image.references).toEqual(
            stored.map((a) => `${a?.mime}:${Buffer.from(a?.bytes ?? []).toString('base64')}`),
          )
        }

        // A nudged image too (GD13).
        images.length = 0
        ok(await commands.nudgeImage(ED, id, version, { slide: 1, nudge: 'wider' }))
        expect(images).toHaveLength(1)
        expect(images[0].references).toHaveLength(2)
      },
      SLOW,
    )

    test(
      'a post with no page, or on a page with no design language, drafts and draws as before',
      async () => {
        await styled('cerebral', 5)
        for (const page of [null, 'main']) {
          calls.length = 0
          images.length = 0
          // The same source drafts the same prompt: forget the last answer so the model is asked.
          await db.delete(schema.aiCache).where(orm.like(schema.aiCache.model, `${P}%`))
          const post = await made(page)
          expect(post.pointers.pageBrandId).toBe(page)
          expect(draftData()).toHaveLength(1)
          expect('copy_style' in draftData()[0]).toBe(false)
        }
        images.length = 0
        await rendered(null)
        expect(images.length).toBeGreaterThan(1)
        // No design language: the guideline's own style sentence, and nothing of another page's.
        const { GUIDELINE } = await import('../brands/guideline')
        for (const image of images) {
          expect(image.references).toEqual([])
          expect(image.prompt).toContain(`Style: ${GUIDELINE.art.style}`)
          expect(image.prompt).not.toContain('charcoal')
        }
      },
      SLOW,
    )

    test(
      'the page is chosen at structures, refused when unknown, and changed past approval only by moving the post back to its text (GD28)',
      async () => {
        await styled('infographics', 6)
        const post = await made(null)
        const { id } = post
        let { version } = ok(await commands.choosePage(ED, id, post.version, 'infographics'))
        expect((await load(id)).pointers.pageBrandId).toBe('infographics')
        expect(await commands.choosePage(ED, id, version, 'feed')).toEqual({
          ok: false,
          error: errors.page,
        })
        // The Comics page takes only comics (RC7).
        expect(await commands.choosePage(ED, id, version, 'comics')).toEqual({
          ok: false,
          error: errors.page,
        })
        expect(await commands.choosePage(REV, id, version, null)).toEqual({
          ok: false,
          error: errors.notAuthorised,
        })
        // Drafting again follows the page now chosen.
        calls.length = 0
        ;({ version } = ok(await commands.draftPost(ED, id, version, true)))
        expect(draftData().map((d) => d.copy_style)).toEqual(['Short lines in the diagram voice.'])
        ;({ version } = ok(await commands.choosePage(ED, id, version, null)))
        expect((await load(id)).pointers.pageBrandId).toBeNull()
        ;({ version } = ok(await commands.pickStructure(ED, id, version, 0)))
        ;({ version } = ok(await commands.chooseTheme(ED, id, version, 'paper')))
        ok(await commands.approveStructure(ED, id, version))
        // Moves wait while the images planned after approval run.
        await settled()
        ok(await commands.choosePage(ED, id, (await load(id)).version, 'main'))
        const moved = await load(id)
        expect(moved.stage).toBe('structures')
        expect(moved.pointers.revisionId).toBeNull()
        expect(moved.pointers.pageBrandId).toBe('main')
        expect(
          await commands.makePost(ED, {
            requestId: randomUUID(),
            ...paidWork,
            pageBrandId: 'feed',
          }),
        ).toEqual({
          ok: false,
          error: errors.page,
        })
        expect(
          await commands.makePost(ED, {
            requestId: randomUUID(),
            ...paidWork,
            pageBrandId: 'comics',
          }),
        ).toEqual({
          ok: false,
          error: errors.page,
        })
      },
      SLOW,
    )
  })

  describe('social versions', () => {
    test(
      "on another page with a design language: its own cover with that page's references, and its copy style in the caption",
      async () => {
        const refs = await styled('infographics', 7)
        await styled('cerebral', 8)
        const parent = await live('cerebral')
        const parentArt = (await load(parent.id)).current.render?.body.art

        images.length = 0
        calls.length = 0
        const other = await socialOn(parent, 'infographics')
        ok(other.res)
        expect(images).toHaveLength(1)
        const stored = await Promise.all(refs.map((r) => store.getAsset(r)))
        expect(images[0].references).toEqual(
          stored.map((a) => `${a?.mime}:${Buffer.from(a?.bytes ?? []).toString('base64')}`),
        )
        expect(images[0].prompt).toContain('the diagram look')
        expect(other.post.current.render?.body.art.prompt).toContain('the diagram look')
        const caption = calls.find((c) => c.useCase === 'caption')?.data as {
          brand: { copy_style?: string }
        }
        expect(caption.brand.copy_style).toBe('Short lines in the diagram voice.')

        // On the post's own page: the post's art as it is, no image call; its copy style still.
        images.length = 0
        calls.length = 0
        const own = await socialOn(parent, 'cerebral')
        ok(own.res)
        expect(images).toHaveLength(0)
        expect(own.post.current.render?.body.art).toMatchObject({
          assetId: parentArt?.assetId,
          prompt: parentArt?.prompt,
        })
        const ownCaption = calls.find((c) => c.useCase === 'caption')?.data as {
          brand: { copy_style?: string }
        }
        expect(ownCaption.brand.copy_style).toBe('Short lines in the charcoal voice.')
      },
      SLOW,
    )

    test(
      "on a page with no design language: the post's art and caption as before; a failed cover falls back to the post's art",
      async () => {
        await styled('infographics', 9)
        const parent = await live(null)
        const parentArt = (await load(parent.id)).current.render?.body.art

        images.length = 0
        calls.length = 0
        const plain = await socialOn(parent, 'main')
        ok(plain.res)
        expect(images).toHaveLength(0)
        expect(plain.post.current.render?.body.art.prompt).toBe(parentArt?.prompt)
        const caption = calls.find((c) => c.useCase === 'caption')?.data as {
          brand: Record<string, unknown>
        }
        expect('copy_style' in caption.brand).toBe(false)

        imageFails = true
        images.length = 0
        const failed = await socialOn(parent, 'infographics')
        ok(failed.res)
        expect(images.length).toBeGreaterThan(0)
        expect(failed.post.current.render?.body.art).toMatchObject({
          assetId: parentArt?.assetId,
          prompt: parentArt?.prompt,
          fallback: parentArt?.fallback,
        })
      },
      SLOW,
    )
  })
})
