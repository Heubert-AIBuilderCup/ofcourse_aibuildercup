// The comic character (RC9): planned, edited, drawn, redrawn with a note and approved, called with
// its actor directly, against a database (Docker, port 5433); off by default so the suite runs
// without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/character.test.ts
// The model layer is the fake provider on the real call log and cache, painting each image in a
// colour of its own prompt and place, so a redrawn sheet can be told from the one before. Every
// account here has an id starting `ch-` and is deleted after, with this run's call log and cache
// rows. The Comics page's character and page style rows are put back as they were.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'
import type { Provider } from '../ai/client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '100000'
process.env.AI_DAILY_CAP_IMAGE = '100000'
process.env.GEMINI_IMAGE_MODEL = `ch-imagen-${randomUUID()}`
process.env.GEMINI_LITE_MODEL = `ch-lite-${randomUUID()}`
process.env.GEMINI_FLASH_MODEL = `ch-flash-${randomUUID()}`
process.env.GEMINI_PRO_MODEL = `ch-pro-${randomUUID()}`

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'ch-'
const SLOW = 60_000

const ED = { id: `${P}ed`, role: 'user', editor: true, reviewer: false, name: 'CH ed' }
const REV = { id: `${P}rev`, role: 'user', editor: false, reviewer: true, name: 'CH rev' }
const ADMIN = { id: `${P}admin`, role: 'admin', editor: false, reviewer: false, name: 'CH admin' }
const DESCRIPTION = 'A gender-neutral student in their early twenties, casual clothes'
const NOT_AUTHORISED = 'Not authorised.'

describe.skipIf(!enabled)('the comic character against the database', () => {
  let character: typeof import('./character')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let artPromptError: string
  let comicStyle: string
  /** Every image request that reached the model, in order. */
  const images: { prompt: string; aspectRatio: string; references: number }[] = []
  let active: ReturnType<typeof import('../ai/client').makeAi>
  let makeActive: (imageCap: string) => typeof active
  /** The Comics page's rows as they were before the run, put back after. */
  let savedCharacter: typeof import('@/shared/lib/db/schema').comicCharacter.$inferSelect[] = []
  let savedStyle: typeof import('@/shared/lib/db/schema').pageStyle.$inferSelect[] = []

  const comics = () => orm.eq(schema.comicCharacter.brandId, 'comics')

  async function row() {
    const [found] = await db.select().from(schema.comicCharacter).where(comics())
    return found ?? null
  }

  async function cleanUp() {
    await db.delete(schema.comicCharacter).where(comics())
    await db.delete(schema.pageStyle).where(orm.eq(schema.pageStyle.brandId, 'comics'))
    await db.delete(schema.aiCall).where(orm.like(schema.aiCall.model, `${P}%`))
    await db.delete(schema.aiCache).where(orm.like(schema.aiCache.model, `${P}%`))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  function ok<T extends { ok: boolean }>(res: T): Extract<T, { ok: true }> {
    if (!res.ok) throw new Error((res as unknown as { error: string }).error)
    return res as Extract<T, { ok: true }>
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
    const painted = (seed: string) => {
      const hex = createHash('sha256').update(seed).digest('hex').slice(0, 6)
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
      image: async (req) => {
        images.push({
          prompt: req.prompt,
          aspectRatio: req.aspectRatio,
          references: req.references?.length ?? 0,
        })
        return painted(`${req.prompt}#${randomUUID()}`)
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

    character = await import('./character')
    ;({ ART_PROMPT_ERROR: artPromptError } = await import('../ai/draft'))
    comicStyle = (await import('../brands')).DEFAULT_COMIC_STYLE

    savedCharacter = await db.select().from(schema.comicCharacter).where(comics())
    savedStyle = await db
      .select()
      .from(schema.pageStyle)
      .where(orm.eq(schema.pageStyle.brandId, 'comics'))
    await cleanUp()
    await db.insert(schema.user).values(
      [ED, REV, ADMIN].map((a) => ({
        id: a.id,
        name: a.name,
        email: `${a.id}@ch.e2e.test`,
        role: a.role as 'user' | 'admin',
        editor: a.editor,
        reviewer: a.reviewer,
      })),
    )
  })

  afterAll(async () => {
    await cleanUp()
    if (savedCharacter.length > 0) await db.insert(schema.comicCharacter).values(savedCharacter)
    if (savedStyle.length > 0) await db.insert(schema.pageStyle).values(savedStyle)
  })

  beforeEach(async () => {
    images.length = 0
    active = makeActive(process.env.AI_DAILY_CAP_IMAGE as string)
    await db.delete(schema.comicCharacter).where(comics())
    await db.delete(schema.pageStyle).where(orm.eq(schema.pageStyle.brandId, 'comics'))
  })

  test(
    'plan, then edit a view, then draw, then approve: the row at each step (RC9)',
    async () => {
      expect(await character.characterOf()).toBeNull()

      ok(await character.planCharacter(ED, { description: ` ${DESCRIPTION} ` }))
      const planned = await character.characterOf()
      expect(planned).toMatchObject({
        description: DESCRIPTION,
        sheetAssetId: null,
        sheetNote: null,
        approvedAssetId: null,
        approvedBy: null,
        approvedAt: null,
      })
      expect(planned?.views).toHaveLength(5)
      expect((await row())?.updatedBy).toBe(ED.id)

      ok(
        await character.editCharacterView(ED, {
          index: 1,
          label: ' Walking ',
          scene: ' In profile, mid stride, a yellow raincoat. ',
        }),
      )
      const edited = await character.characterOf()
      expect(edited?.views[1]).toEqual({
        label: 'Walking',
        scene: 'In profile, mid stride, a yellow raincoat.',
      })
      expect(edited?.views.filter((_, i) => i !== 1)).toEqual(
        planned?.views.filter((_, i) => i !== 1),
      )

      ok(await character.drawCharacter(ED, { note: null }))
      const drawn = await character.characterOf()
      expect(drawn?.sheetAssetId).toEqual(expect.any(String))
      expect(drawn?.sheetNote).toBeNull()
      expect(drawn?.approvedAssetId).toBeNull()
      const [asset] = await db
        .select({ mime: schema.contentAsset.mime })
        .from(schema.contentAsset)
        .where(orm.eq(schema.contentAsset.id, drawn?.sheetAssetId ?? ''))
      expect(asset).toEqual({ mime: 'image/png' })
      // One square image, drawn from every view and the description, in the default comic style.
      expect(images).toHaveLength(1)
      expect(images[0].aspectRatio).toBe('1:1')
      expect(images[0].prompt).toContain('Walking: In profile, mid stride, a yellow raincoat.')
      expect(images[0].prompt).toContain(DESCRIPTION)
      expect(images[0].prompt).toContain(`Style: ${comicStyle}`)

      ok(await character.approveCharacter(ED))
      const approved = await character.characterOf()
      expect(approved).toMatchObject({
        approvedAssetId: drawn?.sheetAssetId,
        approvedBy: ED.id,
        approvedAt: expect.any(String),
      })
    },
    SLOW,
  )

  test(
    'a redraw with a note makes a new sheet and keeps the approved one until approved again; a new plan keeps it too',
    async () => {
      ok(await character.planCharacter(ED, { description: DESCRIPTION }))
      ok(await character.drawCharacter(ED, { note: null }))
      ok(await character.approveCharacter(ED))
      const first = (await character.characterOf())?.sheetAssetId

      ok(await character.drawCharacter(ED, { note: ' Make the hoodie blue ' }))
      const redrawn = await character.characterOf()
      expect(redrawn?.sheetAssetId).not.toBe(first)
      expect(redrawn?.sheetNote).toBe('Make the hoodie blue')
      expect(redrawn?.approvedAssetId).toBe(first)
      expect(images[1].prompt).toContain('Make the hoodie blue')

      // The same note again is drawn again, not served from the cache.
      ok(await character.drawCharacter(ED, { note: 'Make the hoodie blue' }))
      const again = await character.characterOf()
      expect(images).toHaveLength(3)
      expect(again?.sheetAssetId).not.toBe(redrawn?.sheetAssetId)

      ok(await character.approveCharacter(ED))
      expect((await character.characterOf())?.approvedAssetId).toBe(again?.sheetAssetId)

      ok(await character.planCharacter(ED, { description: 'A student with round glasses' }))
      expect(await character.characterOf()).toMatchObject({
        description: 'A student with round glasses',
        sheetAssetId: null,
        approvedAssetId: again?.sheetAssetId,
      })
    },
    SLOW,
  )

  test(
    "draws in the Comics page's art style with its reference images when it has a design language",
    async () => {
      const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
      const { putAsset } = await import('./store')
      const ref = await putAsset(null, PNG, 'image/png')
      await db.insert(schema.pageStyle).values({
        brandId: 'comics',
        artStyle: 'Thick brush ink on cream paper',
        copyStyle: 'Short lines.',
        closestTemplateId: 'comic',
        referenceAssetIds: [ref],
      })
      ok(await character.planCharacter(ED, { description: DESCRIPTION }))
      ok(await character.drawCharacter(ED, { note: null }))
      expect(images[0].prompt).toContain('Style: Thick brush ink on cream paper')
      expect(images[0].references).toBe(1)
    },
    SLOW,
  )

  test(
    'approving or drawing before there is anything to approve or draw is refused',
    async () => {
      expect(await character.drawCharacter(ED, { note: null })).toEqual({
        ok: false,
        error: 'Plan the character first.',
      })
      expect(await character.approveCharacter(ED)).toEqual({
        ok: false,
        error: 'Draw the character first.',
      })
      ok(await character.planCharacter(ED, { description: DESCRIPTION }))
      expect(await character.approveCharacter(ED)).toEqual({
        ok: false,
        error: 'Draw the character first.',
      })
      expect((await character.characterOf())?.approvedAssetId).toBeNull()
      expect(images).toHaveLength(0)
    },
    SLOW,
  )

  test(
    'a description, view or note that is empty, too long or refused by the art prompt guard changes nothing',
    async () => {
      for (const description of ['  ', 'x'.repeat(201), 'A student aged 22', 'A "cool" student']) {
        const res = await character.planCharacter(ED, { description })
        expect(res.ok, description).toBe(false)
      }
      expect(await character.planCharacter(ED, { description: 'A student aged 22' })).toEqual({
        ok: false,
        error: artPromptError,
      })
      expect(await row()).toBeNull()

      ok(await character.planCharacter(ED, { description: DESCRIPTION }))
      const before = await row()
      for (const edit of [
        { index: 5, label: 'Front', scene: 'Standing.' },
        { index: -1, label: 'Front', scene: 'Standing.' },
        { index: 0, label: ' ', scene: 'Standing.' },
        { index: 0, label: 'Front', scene: 'x'.repeat(201) },
        { index: 0, label: 'Front', scene: 'Holding 3 books.' },
        { index: 0, label: 'View 1', scene: 'Standing.' },
      ]) {
        const res = await character.editCharacterView(ED, edit)
        expect(res.ok, JSON.stringify(edit)).toBe(false)
      }
      for (const note of ['x'.repeat(81), 'Add 2 cats']) {
        const res = await character.drawCharacter(ED, { note })
        expect(res.ok, note).toBe(false)
      }
      expect(await character.drawCharacter(ED, { note: 'x'.repeat(81) })).toEqual({
        ok: false,
        error: 'Keep the note to 80 characters.',
      })
      expect(await row()).toEqual(before)
      expect(images).toHaveLength(0)
    },
    SLOW,
  )

  test(
    'a Nepali, Hindi or Thai description, view and note at their limits in characters as a reader sees them are taken, and one over is refused (GD37)',
    async () => {
      const { nativeOf } = await import('../text/native-fixtures')
      for (const id of ['ne', 'hi', 'th'] as const) {
        expect((await character.planCharacter(ED, { description: nativeOf(id, 201) })).ok, id).toBe(
          false,
        )
        ok(await character.planCharacter(ED, { description: nativeOf(id, 200) }))
        ok(
          await character.editCharacterView(ED, {
            index: 0,
            label: nativeOf(id, 40),
            scene: nativeOf(id, 200),
          }),
        )
        expect(await character.drawCharacter(ED, { note: nativeOf(id, 81) }), id).toEqual({
          ok: false,
          error: 'Keep the note to 80 characters.',
        })
        ok(await character.drawCharacter(ED, { note: nativeOf(id, 80) }))
        const saved = await row()
        expect(saved?.description, id).toBe(nativeOf(id, 200))
        expect(saved?.sheetNote, id).toBe(nativeOf(id, 80))
      }
    },
    SLOW,
  )

  test(
    'a reviewer or an admin without the editor capability is refused each command',
    async () => {
      ok(await character.planCharacter(ED, { description: DESCRIPTION }))
      ok(await character.drawCharacter(ED, { note: null }))
      const before = await row()
      images.length = 0
      for (const actor of [REV, ADMIN]) {
        const refused = { ok: false, error: NOT_AUTHORISED }
        expect(await character.planCharacter(actor, { description: DESCRIPTION })).toEqual(refused)
        expect(
          await character.editCharacterView(actor, {
            index: 0,
            label: 'Front',
            scene: 'Standing.',
          }),
        ).toEqual(refused)
        expect(await character.drawCharacter(actor, { note: null })).toEqual(refused)
        expect(await character.approveCharacter(actor)).toEqual(refused)
      }
      expect(await row()).toEqual(before)
      expect(images).toHaveLength(0)
    },
    SLOW,
  )

  test(
    'a capped image day says so and keeps the sheet',
    async () => {
      ok(await character.planCharacter(ED, { description: DESCRIPTION }))
      active = makeActive('0')
      expect(await character.drawCharacter(ED, { note: null })).toEqual({
        ok: false,
        error: 'Daily image limit reached',
      })
      expect((await character.characterOf())?.sheetAssetId).toBeNull()
      expect(images).toHaveLength(0)
    },
    SLOW,
  )
})
