// The student profile's repository against the development database (Docker, port 5433); off by
// default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/opening/server/profile.test.ts
// Every account here is the test's own (its id starts `sp-t-`, its email ends @sp.e2e.test) and
// is deleted after, with its profile.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { Relative, Reminder } from '@/shared/types/student'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'sp-t-'

const r1: Reminder = {
  futureId: 'career',
  courseId: 'ecu-cyber',
  text: 'Check the February intake',
  at: '2026-10-05T09:00:00.000Z',
}
const rel: Relative = { placeId: 'perth', place: 'Perth', relationship: 'Cousin', name: 'Asha' }

describe.skipIf(!enabled)('the student profile against the database', () => {
  let server: typeof import('./profile')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  const profileRows = (uid: string) =>
    db.select().from(schema.studentProfile).where(orm.eq(schema.studentProfile.userId, uid))

  beforeAll(async () => {
    server = await import('./profile')
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
    const base = (k: string) => ({ id: `${P}${k}`, name: `SP ${k}`, email: `${P}${k}@sp.e2e.test` })
    await db.insert(schema.user).values([base('a'), base('b'), base('c')])
  })

  afterAll(async () => {
    await cleanUp()
  })

  test('is created on first read, then keeps every answer, step and choice', async () => {
    const uid = `${P}a`
    const p = await server.getProfile(uid)
    expect(p).toMatchObject({
      userId: uid,
      persona: null,
      answers: {},
      relative: null,
      coins: null,
      reminders: [],
      lastStep: 'picture',
      seenFutures: false,
    })

    await server.saveAnswers(uid, { amount: { value: 36, state: 'stated' } })
    await server.saveAnswers(uid, { hard: { value: 'Roughly', state: 'assumed' } })
    expect((await server.getProfile(uid)).answers).toEqual({
      amount: { value: 36, state: 'stated' },
      hard: { value: 'Roughly', state: 'assumed' },
    })
    await server.saveAnswers(uid, { amount: { value: 30, state: 'stated' } })
    expect((await server.getProfile(uid)).answers.amount?.value).toBe(30)

    await server.markStep(uid, 'living')
    expect((await server.getProfile(uid)).lastStep).toBe('living')
    await server.markStep(uid, 'futures')
    await server.markStep(uid, 'attention')
    expect(await server.getProfile(uid)).toMatchObject({ lastStep: 'attention', seenFutures: true })
    await server.markStep(uid, 'study')
    expect(await server.getProfile(uid)).toMatchObject({ lastStep: 'study', seenFutures: true })

    await server.addReminder(uid, r1)
    await server.addReminder(uid, { ...r1, text: 'again' })
    expect((await server.getProfile(uid)).reminders).toEqual([{ ...r1, text: 'again' }])
    await server.addReminder(uid, { ...r1, futureId: 'cost' })
    expect((await server.getProfile(uid)).reminders).toHaveLength(2)

    await server.saveCoins(uid, { state: 'later' })
    await server.savePersona(uid, 'neutral')
    await server.saveRelative(uid, { ...rel, place: '  Perth ' })
    expect(await server.getProfile(uid)).toMatchObject({
      coins: { state: 'later' },
      persona: 'neutral',
      relative: rel,
    })
    await server.saveRelative(uid, null)
    expect((await server.getProfile(uid)).relative).toBeNull()
    // Gone from the column, not stored as a JSON null.
    const [row] = await db
      .select({ empty: orm.sql<boolean>`${schema.studentProfile.relative} is null` })
      .from(schema.studentProfile)
      .where(orm.eq(schema.studentProfile.userId, uid))
    expect(row?.empty).toBe(true)
  })

  test('keeps at most REMINDERS_MAX reminders, dropping the oldest', async () => {
    const uid = `${P}c`
    const at = (i: number) => new Date(Date.UTC(2026, 9, 5, 0, i)).toISOString()
    const many = Array.from({ length: server.REMINDERS_MAX + 2 }, (_, i) => ({
      ...r1,
      courseId: `course-${i}`,
      at: at(i),
    }))
    for (const reminder of many) await server.addReminder(uid, reminder)
    const kept = (await server.getProfile(uid)).reminders
    expect(kept).toHaveLength(server.REMINDERS_MAX)
    expect(kept[0]).toEqual(many[2])
    expect(kept.at(-1)).toEqual(many.at(-1))
    // Setting one again moves it to the end and keeps the count.
    await server.addReminder(uid, many[5])
    const again = (await server.getProfile(uid)).reminders
    expect(again).toHaveLength(server.REMINDERS_MAX)
    expect(again.at(-1)).toEqual(many[5])
  })

  test('drops what does not match the contract when it is read back', async () => {
    const uid = `${P}c`
    await server.getProfile(uid)
    await db
      .update(schema.studentProfile)
      .set({
        answers: orm.sql`${JSON.stringify({
          amount: { value: 36, state: 'stated' },
          nonsense: { value: 'x', state: 'stated' },
          hard: { value: 'Roughly', state: 'maybe' },
        })}::jsonb`,
        coins: orm.sql`${JSON.stringify({ state: 'spent', piles: [6], assumed: false })}::jsonb`,
      })
      .where(orm.eq(schema.studentProfile.userId, uid))
    expect(await server.getProfile(uid)).toMatchObject({
      answers: { amount: { value: 36, state: 'stated' } },
      coins: null,
    })
  })

  test('a write before any read creates the row; deleting the account deletes the profile', async () => {
    const uid = `${P}b`
    await server.saveAnswers(uid, { where: { value: 'Australia', state: 'stated' } })
    const [row] = await profileRows(uid)
    expect(row?.answers).toEqual({ where: { value: 'Australia', state: 'stated' } })
    await db.delete(schema.user).where(orm.eq(schema.user.id, uid))
    expect(await profileRows(uid)).toEqual([])
  })
})
