// The student profile's repository against the development database (Docker, port 5433); off by
// default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/opening/server/profile.test.ts
// Every account here is the test's own (its id starts `sp-t-`, its email ends @sp.e2e.test) and
// is deleted after, with its profile and its roadmaps.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { Relative } from '@/shared/types/student'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'sp-t-'

const rel: Relative = { placeId: 'perth', place: 'Perth', relationship: 'Cousin', name: 'Asha' }

describe.skipIf(!enabled)('the student profile against the database', () => {
  let server: typeof import('./profile')
  let roadmaps: typeof import('@/features/roadmaps/server/roadmaps')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  const profileRows = (uid: string) =>
    db.select().from(schema.studentProfile).where(orm.eq(schema.studentProfile.userId, uid))
  const roadmapRows = (uid: string) =>
    db
      .select()
      .from(schema.roadmap)
      .where(orm.eq(schema.roadmap.userId, uid))
      .orderBy(schema.roadmap.createdAt)

  /** A finished roadmap holding these answers, made through the roadmaps module. */
  async function finishedWith(uid: string, where: string) {
    // Begun as Start from scratch begins one: once she has finished one, a write starts none.
    await roadmaps.ensureDraft(uid)
    await server.saveAnswers(uid, { where: { value: where, state: 'stated' } })
    await server.saveCoins(uid, { state: 'later' })
    const r = await roadmaps.finishRoadmap(uid)
    if (!r) throw new Error('nothing to finish')
    return r
  }

  beforeAll(async () => {
    server = await import('./profile')
    roadmaps = await import('@/features/roadmaps/server/roadmaps')
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
    const base = (k: string) => ({ id: `${P}${k}`, name: `SP ${k}`, email: `${P}${k}@sp.e2e.test` })
    await db
      .insert(schema.user)
      .values([base('a'), base('b'), base('c'), base('d'), base('e'), base('f')])
  })

  afterAll(async () => {
    await cleanUp()
  })

  test('is created on first read, answering nothing: no draft, none finished, empty mirrors', async () => {
    const uid = `${P}a`
    expect(await server.getProfile(uid)).toEqual({
      userId: uid,
      persona: null,
      reminders: [],
      seenFutures: false,
      draft: null,
      finished: 0,
      answers: {},
      relative: null,
      coins: null,
      lastStep: 'picture',
    })
    expect(await profileRows(uid)).toHaveLength(1)
    // A read makes no roadmap.
    expect(await roadmapRows(uid)).toEqual([])
  })

  test('every write lands on the roadmap she is answering, made by the first, and is mirrored', async () => {
    const uid = `${P}a`
    expect(await server.saveAnswers(uid, { amount: { value: 36, state: 'stated' } })).toBe(true)
    const [made] = await roadmapRows(uid)
    expect(made).toMatchObject({
      finishedAt: null,
      answers: { amount: { value: 36, state: 'stated' } },
    })

    await server.saveAnswers(uid, { hard: { value: 'Roughly', state: 'assumed' } })
    await server.saveAnswers(uid, { amount: { value: 30, state: 'stated' } })
    await server.markStep(uid, 'living')
    await server.saveCoins(uid, { state: 'later' })
    await server.saveRelative(uid, { ...rel, place: '  Perth ' })

    const p = await server.getProfile(uid)
    expect(p).toMatchObject({
      answers: {
        amount: { value: 30, state: 'stated' },
        hard: { value: 'Roughly', state: 'assumed' },
      },
      lastStep: 'living',
      coins: { state: 'later' },
      relative: rel,
      finished: 0,
    })
    expect(p.draft).toMatchObject({
      id: made.id,
      answers: p.answers,
      lastStep: 'living',
      coins: p.coins,
      relative: rel,
    })
    // Still the one roadmap.
    expect(await roadmapRows(uid)).toHaveLength(1)

    await server.saveRelative(uid, null)
    expect((await server.getProfile(uid)).relative).toBeNull()
    // Gone from the column, not stored as a JSON null.
    const [row] = await db
      .select({ empty: orm.sql<boolean>`${schema.roadmap.relative} is null` })
      .from(schema.roadmap)
      .where(orm.eq(schema.roadmap.id, made.id))
    expect(row?.empty).toBe(true)
  })

  test('the picture is the profile’s, not a roadmap’s', async () => {
    const uid = `${P}b`
    await server.savePersona(uid, 'neutral')
    expect((await server.getProfile(uid)).persona).toBe('neutral')
    expect((await profileRows(uid))[0]?.persona).toBe('neutral')
    expect(await roadmapRows(uid)).toEqual([])
  })

  test('counts her finished roadmaps, and never writes to one', async () => {
    const uid = `${P}c`
    const first = await finishedWith(uid, 'Nepal')
    expect(await server.getProfile(uid)).toMatchObject({
      draft: null,
      finished: 1,
      answers: {},
      coins: null,
      lastStep: 'picture',
    })
    await finishedWith(uid, 'India')
    expect((await server.getProfile(uid)).finished).toBe(2)

    // A deleted roadmap is not counted.
    await roadmaps.softDeleteRoadmap(uid, first.id)
    expect((await server.getProfile(uid)).finished).toBe(1)
  })

  test('once onboarding is closed, a write starts no roadmap and says it wrote nothing', async () => {
    // A stale onboarding tab, another device, or Back to a cached step.
    const uid = `${P}c`
    expect(await server.saveAnswers(uid, { amount: { value: 20, state: 'stated' } })).toBe(false)
    expect(await server.saveCoins(uid, { state: 'later' })).toBe(false)
    expect(await server.saveRelative(uid, rel)).toBe(false)
    expect(await server.getProfile(uid)).toMatchObject({ draft: null, finished: 1 })
    const rows = await roadmapRows(uid)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ answers: { where: { value: 'India', state: 'stated' } } })

    // Start from scratch opens a new one; her writes land on it.
    const scratch = await roadmaps.ensureDraft(uid)
    expect(await server.saveAnswers(uid, { amount: { value: 20, state: 'stated' } })).toBe(true)
    expect(await server.getProfile(uid)).toMatchObject({
      draft: { id: scratch.id },
      answers: { amount: { value: 20, state: 'stated' } },
    })
  })

  test('opening a step never starts a roadmap once onboarding is closed', async () => {
    // The step pages mark the step while their layout checks the lock, in parallel.
    const uid = `${P}b`
    await finishedWith(uid, 'Nepal')
    await server.markStep(uid, 'facts')
    expect(await server.getProfile(uid)).toMatchObject({ draft: null, finished: 1 })
    expect(await roadmapRows(uid)).toHaveLength(1)
  })

  test('clearing an answer removes that key and leaves the others', async () => {
    const uid = `${P}d`
    await server.saveAnswers(uid, {
      areas: { value: ['Data'], state: 'stated' },
      level: { value: "Master's", state: 'stated' },
    })
    await server.saveAnswers(uid, {}, ['areas'])
    expect((await server.getProfile(uid)).answers).toEqual({
      level: { value: "Master's", state: 'stated' },
    })
    // The key is gone from the stored JSON, not left behind as a null.
    const [row] = await roadmapRows(uid)
    expect(row?.answers).toEqual({ level: { value: "Master's", state: 'stated' } })

    // A key that is not stored leaves the answers as they are.
    await server.saveAnswers(uid, {}, ['areas'])
    expect((await server.getProfile(uid)).answers).toEqual({
      level: { value: "Master's", state: 'stated' },
    })
  })

  test('sets and clears in one save, and clears several keys at once', async () => {
    const uid = `${P}d`
    await server.saveAnswers(uid, { level: { value: "Master's", state: 'stated' } })
    await server.saveAnswers(uid, { amount: { value: 36, state: 'stated' } }, ['level', 'areas'])
    expect((await server.getProfile(uid)).answers).toEqual({
      amount: { value: 36, state: 'stated' },
    })
  })

  test('drops what does not match the contract when it is read back', async () => {
    const uid = `${P}e`
    await server.markStep(uid, 'facts')
    await db
      .update(schema.roadmap)
      .set({
        answers: orm.sql`${JSON.stringify({
          amount: { value: 36, state: 'stated' },
          nonsense: { value: 'x', state: 'stated' },
          hard: { value: 'Roughly', state: 'maybe' },
        })}::jsonb`,
        coins: orm.sql`${JSON.stringify({ state: 'spent', piles: [6], assumed: false })}::jsonb`,
      })
      .where(orm.eq(schema.roadmap.userId, uid))
    expect(await server.getProfile(uid)).toMatchObject({
      answers: { amount: { value: 36, state: 'stated' } },
      coins: null,
    })
  })

  test('deleting the account deletes the profile and the roadmaps', async () => {
    const uid = `${P}f`
    await server.saveAnswers(uid, { where: { value: 'Australia', state: 'stated' } })
    await server.savePersona(uid, 'female')
    expect(await profileRows(uid)).toHaveLength(1)
    expect(await roadmapRows(uid)).toHaveLength(1)
    await db.delete(schema.user).where(orm.eq(schema.user.id, uid))
    expect(await profileRows(uid)).toEqual([])
    expect(await roadmapRows(uid)).toEqual([])
  })
})
