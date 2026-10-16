// The model settings and their change log (criteria 94–99) against a migrated database; off by
// default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/ai/settings.test.ts
// The one account here has an id starting `ms-` and is deleted after with its log rows. The
// settings saved before the run are put back after it, so a dev server's own are never lost.

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  spyOn,
  test,
} from 'bun:test'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'ms-'
const SU = { id: `${P}su`, name: 'MS su' }

// Runs without a database: the read is made to fail before it reaches one.
describe('model settings that cannot be read', () => {
  test('read as none, and the failure is remembered for 5 seconds, so a blip is not held for the full 30', async () => {
    const { db } = await import('@/shared/lib/db')
    const settings = await import('./settings')
    const ttl = settings.SETTINGS_TTL_MS
    const failedTtl = settings.FAILED_READ_TTL_MS
    expect(failedTtl).toBe(5_000)
    // Past anything an earlier read kept.
    const start = Date.now() + 100 * ttl
    setSystemTime(new Date(start))
    const select = spyOn(db, 'select').mockImplementation(() => {
      throw new Error('relation "ai_setting" does not exist')
    })
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const none = { tierModels: {}, useCaseTiers: {}, failing: {} }
      expect(await settings.readSettings()).toEqual(none)
      setSystemTime(new Date(start + failedTtl - 1))
      expect(await settings.readSettings()).toEqual(none)
      expect(select).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledTimes(1)

      setSystemTime(new Date(start + failedTtl + 1))
      expect(await settings.readSettings()).toEqual(none)
      expect(select).toHaveBeenCalledTimes(2)
    } finally {
      select.mockRestore()
      warn.mockRestore()
      setSystemTime()
    }
  })

  test('a read stamped after now (a clock stepped back) is stale, not fresh', async () => {
    const { db } = await import('@/shared/lib/db')
    const settings = await import('./settings')
    const start = Date.now() + 100 * settings.SETTINGS_TTL_MS
    setSystemTime(new Date(start))
    const select = spyOn(db, 'select').mockImplementation(() => {
      throw new Error('down')
    })
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await settings.readSettings()
      setSystemTime(new Date(start - 1))
      await settings.readSettings()
      expect(select).toHaveBeenCalledTimes(2)
    } finally {
      select.mockRestore()
      warn.mockRestore()
      setSystemTime()
    }
  })
})

describe.skipIf(!enabled)('model settings against the database', () => {
  let settings: typeof import('./settings')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let saved: typeof import('@/shared/lib/db/schema').aiSetting.$inferSelect[] = []

  /** The log rows this run wrote, oldest first. */
  async function log() {
    return db
      .select()
      .from(schema.aiSettingChange)
      .where(orm.eq(schema.aiSettingChange.userId, SU.id))
      .orderBy(schema.aiSettingChange.at)
  }

  async function clear() {
    await db.delete(schema.aiSetting)
    await db.delete(schema.aiSettingChange).where(orm.like(schema.aiSettingChange.userId, `${P}%`))
  }

  beforeAll(async () => {
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    settings = await import('./settings')
    saved = await db.select().from(schema.aiSetting)
    await clear()
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
    await db
      .insert(schema.user)
      .values({ id: SU.id, name: SU.name, email: `${SU.id}@ms.e2e.test`, role: 'superadmin' })
  })

  beforeEach(async () => {
    await clear()
    // A save empties the memory; the reset of the last test did, so each test reads afresh.
    await settings.resetAll(SU.id)
    await clear()
  })

  afterAll(async () => {
    setSystemTime()
    await clear()
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
    if (saved.length > 0) await db.insert(schema.aiSetting).values(saved)
  })

  test('readSettings is empty when nothing is saved', async () => {
    expect(await settings.readSettings()).toEqual({ tierModels: {}, useCaseTiers: {}, failing: {} })
  })

  test('saveTierModel writes tier:<tier> and logs who, the old and the new model', async () => {
    await settings.saveTierModel(SU.id, 'flash', 'gemini-3.8-flash')
    await settings.saveTierModel(SU.id, 'flash', 'gemini-3.5-flash-lite')

    const rows = await db.select().from(schema.aiSetting)
    expect(rows.map((r) => [r.key, r.value, r.updatedByUserId])).toEqual([
      ['tier:flash', 'gemini-3.5-flash-lite', SU.id],
    ])
    expect((await log()).map((r) => [r.key, r.oldValue, r.newValue, r.userId])).toEqual([
      ['tier:flash', null, 'gemini-3.8-flash', SU.id],
      ['tier:flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', SU.id],
    ])
    expect((await settings.readSettings()).tierModels).toEqual({ flash: 'gemini-3.5-flash-lite' })
  })

  test('saveUseCaseTier writes usecase:<id> and logs it', async () => {
    await settings.saveUseCaseTier(SU.id, 'student_why', 'flash')

    const rows = await db.select().from(schema.aiSetting)
    expect(rows.map((r) => [r.key, r.value])).toEqual([['usecase:student_why', 'flash']])
    expect((await log()).map((r) => [r.key, r.oldValue, r.newValue])).toEqual([
      ['usecase:student_why', null, 'flash'],
    ])
    expect((await settings.readSettings()).useCaseTiers).toEqual({ student_why: 'flash' })
  })

  test('resetAll clears every row and logs one reset with what it cleared', async () => {
    await settings.saveTierModel(SU.id, 'pro', 'gemini-3.1-pro-preview')
    await settings.saveUseCaseTier(SU.id, 'draft', 'lite')
    await settings.resetAll(SU.id)

    expect((await db.select().from(schema.aiSetting)).length).toBe(0)
    const rows = await log()
    expect(rows.length).toBe(3)
    expect([rows[2].key, rows[2].newValue]).toEqual(['reset', null])
    expect(rows[2].oldValue).toBe('tier:pro=gemini-3.1-pro-preview, usecase:draft=lite')
    expect(await settings.readSettings()).toEqual({ tierModels: {}, useCaseTiers: {}, failing: {} })
  })

  test('markFailing marks the tier, and the next save of that tier clears it', async () => {
    await settings.saveTierModel(SU.id, 'flash', 'gemini-3.8-flash')
    await settings.saveTierModel(SU.id, 'lite', 'gemini-3.5-flash-lite')
    await settings.markFailing(
      'flash',
      'gemini-3.8-flash',
      `404 model not found ${'x'.repeat(600)}`,
    )

    const failing = (await settings.readSettings()).failing
    expect(Object.keys(failing)).toEqual(['flash'])
    expect(failing.flash?.error.startsWith('404 model not found')).toBe(true)
    expect(failing.flash?.error.length).toBe(500)
    expect(typeof failing.flash?.at).toBe('string')
    expect((await log()).length).toBe(2)

    await settings.saveTierModel(SU.id, 'flash', 'gemini-3.5-flash-lite')
    expect((await settings.readSettings()).failing).toEqual({})
  })

  test('markFailing on a tier with no saved model changes nothing', async () => {
    await settings.markFailing('pro', 'gemini-3.1-pro-preview', 'denied')
    expect((await db.select().from(schema.aiSetting)).length).toBe(0)
  })

  test('markFailing marks only the model that failed: a call on the old model after a save leaves the new one unmarked', async () => {
    await settings.saveTierModel(SU.id, 'flash', 'gemini-3.8-flash')
    // A save here (or on another instance) while a call on the old model is in flight.
    await settings.saveTierModel(SU.id, 'flash', 'gemini-3.5-flash-lite')
    await settings.markFailing('flash', 'gemini-3.8-flash', '404 model not found')

    const [row] = await db.select().from(schema.aiSetting)
    expect([row?.value, row?.failing ?? null]).toEqual(['gemini-3.5-flash-lite', null])
    expect((await settings.readSettings()).failing).toEqual({})
  })

  test('lastChanges gives the newest first, with who made each, at most the limit', async () => {
    await settings.saveTierModel(SU.id, 'lite', 'gemini-3.5-flash-lite')
    await settings.saveUseCaseTier(SU.id, 'caption', 'flash')
    await settings.saveTierModel(SU.id, 'image', 'gemini-nano-banana-2.1')

    const changes = await settings.lastChanges(2)
    expect(changes.map((c) => [c.key, c.newValue, c.userName])).toEqual([
      ['tier:image', 'gemini-nano-banana-2.1', SU.name],
      ['usecase:caption', 'flash', SU.name],
    ])
    expect(typeof changes[0].at).toBe('string')
    expect((await settings.lastChanges(20)).length).toBe(3)
  })

  test('readSettings keeps what it read for 30 seconds; a save empties it at once', async () => {
    await settings.saveTierModel(SU.id, 'flash', 'gemini-3.8-flash')
    const now = Date.now()
    setSystemTime(new Date(now))
    expect((await settings.readSettings()).tierModels.flash).toBe('gemini-3.8-flash')

    // Another instance's save: this one keeps its copy until the time runs out.
    await db
      .update(schema.aiSetting)
      .set({ value: 'gemini-3.5-flash-lite' })
      .where(orm.eq(schema.aiSetting.key, 'tier:flash'))
    setSystemTime(new Date(now + settings.SETTINGS_TTL_MS - 1))
    expect((await settings.readSettings()).tierModels.flash).toBe('gemini-3.8-flash')
    setSystemTime(new Date(now + settings.SETTINGS_TTL_MS + 1))
    expect((await settings.readSettings()).tierModels.flash).toBe('gemini-3.5-flash-lite')

    // This instance's save is seen at once.
    await settings.saveUseCaseTier(SU.id, 'market', 'flash')
    expect((await settings.readSettings()).useCaseTiers).toEqual({ market: 'flash' })
    setSystemTime()
  })
})
