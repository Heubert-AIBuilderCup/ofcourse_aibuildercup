// The Ask log and its daily cap against the test database; off by default so the suite runs
// without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/roads/server/asks.test.ts
// Every account here is the test's own (its id starts `ask-t-`) and is deleted after, with its
// roadmaps and asks. Nothing here breaks a constraint: each row's user and roadmap exist first.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'ask-t-'

describe.skipIf(!enabled)('the Ask log against the database', () => {
  let server: typeof import('./asks')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')
  let ASK_FAILED: string

  const today = () => new Date().toISOString().slice(0, 10)

  async function cleanUp() {
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  async function roadmapFor(userId: string) {
    const id = `${P}rm-${userId}-${crypto.randomUUID()}`
    await db.insert(schema.roadmap).values({ id, userId, finishedAt: new Date() })
    return id
  }

  const asksOf = (userId: string) =>
    db.select().from(schema.studentAsk).where(orm.eq(schema.studentAsk.userId, userId))

  const question = (userId: string, roadmapId: string) => ({
    userId,
    roadmapId,
    tileId: 'tile-1',
    question: 'What does this cost?',
  })

  beforeAll(async () => {
    server = await import('./asks')
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    ;({ ASK_FAILED } = await import('../model/ask-words'))
    await cleanUp()
    const base = (k: string) => ({
      id: `${P}${k}`,
      name: `Ask ${k}`,
      email: `${P}${k}@ask.e2e.test`,
    })
    await db.insert(schema.user).values(['a', 'b', 'c', 'd', 'e'].map(base))
  })

  afterAll(async () => {
    await cleanUp()
  })

  test('reserveAsk stores her question for today (UTC), read as failed until settleAsk writes how it ended', async () => {
    const rm = await roadmapFor(`${P}c`)
    const id = await server.reserveAsk(question(`${P}c`, rm), 20)
    expect(id).not.toBeNull()
    expect(await asksOf(`${P}c`)).toMatchObject([
      {
        id,
        roadmapId: rm,
        tileId: 'tile-1',
        question: 'What does this cost?',
        reply: ASK_FAILED,
        outcome: 'failed',
        day: today(),
      },
    ])
    await server.settleAsk(id as string, { reply: 'About that much.', outcome: 'answered' })
    expect(await asksOf(`${P}c`)).toMatchObject([
      { id, reply: 'About that much.', outcome: 'answered' },
    ])
  })

  test('at the cap she gets no slot and nothing is stored, whatever her questions ended as', async () => {
    const rm = await roadmapFor(`${P}a`)
    for (const outcome of ['answered', 'refused', 'failed'] as const) {
      const id = await server.reserveAsk(question(`${P}a`, rm), 3)
      await server.settleAsk(id as string, { reply: 'x', outcome })
    }
    expect(await server.reserveAsk(question(`${P}a`, rm), 3)).toBeNull()
    expect(await asksOf(`${P}a`)).toHaveLength(3)
  })

  test("another student's rows and yesterday's rows do not count against her", async () => {
    const rmB = await roadmapFor(`${P}b`)
    const rmD = await roadmapFor(`${P}d`)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await db.insert(schema.studentAsk).values({
      ...question(`${P}b`, rmB),
      reply: 'x',
      outcome: 'answered',
      day: yesterday,
    })
    await server.reserveAsk(question(`${P}d`, rmD), 1)
    expect(await server.reserveAsk(question(`${P}b`, rmB), 1)).not.toBeNull()
  })

  test('questions sent at once still stop at the cap: one slot each, in turn', async () => {
    const rm = await roadmapFor(`${P}e`)
    const cap = 3
    const ids = await Promise.all(
      Array.from({ length: cap + 5 }, () => server.reserveAsk(question(`${P}e`, rm), cap)),
    )
    expect(ids.filter((id) => id !== null)).toHaveLength(cap)
    expect(await asksOf(`${P}e`)).toHaveLength(cap)
  })

  test('deleting the roadmap deletes its rows', async () => {
    const rm = await roadmapFor(`${P}b`)
    await server.reserveAsk(question(`${P}b`, rm), 20)
    const rowsOf = () =>
      db.select().from(schema.studentAsk).where(orm.eq(schema.studentAsk.roadmapId, rm))
    expect(await rowsOf()).toHaveLength(1)
    await db.delete(schema.roadmap).where(orm.eq(schema.roadmap.id, rm))
    expect(await rowsOf()).toHaveLength(0)
  })
})
