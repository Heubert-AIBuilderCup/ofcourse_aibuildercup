// Counting the paths students are shown (RC12). `courseIdsShown` runs always; the counting runs
// against a database (Docker, port 5433) and is off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/insights/server/views.test.ts
// Every call here is dated in 2001, so its rows sit far behind any real count, and the run deletes
// only 2001's rows, before each test and after the last.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { PATHS } from '@/features/content/lib/path-facts'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const views = await import('./views')

describe('courseIdsShown', () => {
  test('a futures result shows the distinct courses of its futures', () => {
    const result = {
      kind: 'futures' as const,
      futures: [{ courseId: 'a' }, { courseId: 'b' }, { courseId: 'a' }],
    }
    expect(views.courseIdsShown(result)).toEqual(['a', 'b'])
  })

  test('a sealed result shows the distinct courses of its nearest routes', () => {
    const result = {
      kind: 'sealed' as const,
      nearest: [{ courseId: 'c' }, { courseId: 'c' }, { courseId: 'd' }],
    }
    expect(views.courseIdsShown(result)).toEqual(['c', 'd'])
  })
})

describe.skipIf(!enabled)('counting the paths shown, against the database', () => {
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db').schema
  let orm: typeof import('drizzle-orm')

  const NOW = new Date('2001-03-15T12:00:00Z')
  const NEXT_DAY = new Date('2001-03-16T09:00:00Z')
  const [ONE, TWO] = PATHS.map((path) => path.id)
  const SAVED_KEY = process.env.BETTER_AUTH_SECRET
  const TEST_KEY = randomUUID()
  /** Sets the server's secret for recordPathViews, or unsets it. */
  const setKey = (key: string | undefined) => {
    if (key === undefined) delete process.env.BETTER_AUTH_SECRET
    else process.env.BETTER_AUTH_SECRET = key
  }

  const ours = () => orm.lt(schema.pathView.day, '2002-01-01')
  const rows = () => db.select().from(schema.pathView).where(ours())
  const oursShown = () => orm.lt(schema.pathShowing.day, '2002-01-01')
  const shown = () =>
    db
      .select()
      .from(schema.pathShowing)
      .where(oursShown())
      .orderBy(schema.pathShowing.futureId, schema.pathShowing.courseId)

  async function cleanUp() {
    await db.delete(schema.pathView).where(ours())
    await db.delete(schema.pathShowing).where(oursShown())
  }

  beforeAll(async () => {
    ;({ db, schema } = await import('@/shared/lib/db'))
    orm = await import('drizzle-orm')
  })

  beforeEach(async () => {
    setKey(TEST_KEY)
    await cleanUp()
  })

  afterAll(async () => {
    setKey(SAVED_KEY)
    await cleanUp()
  })

  test('two calls the same day for the same student and path count once', async () => {
    await views.recordPathViews('vw-student-1', [ONE], NOW)
    await views.recordPathViews('vw-student-1', [ONE, ONE], NOW)
    expect((await views.pathViewCounts(30, NOW)).get(ONE)).toBe(1)
  })

  test('another student counts again', async () => {
    await views.recordPathViews('vw-student-1', [ONE], NOW)
    await views.recordPathViews('vw-student-2', [ONE, TWO], NOW)
    const counts = await views.pathViewCounts(30, NOW)
    expect(counts.get(ONE)).toBe(2)
    expect(counts.get(TWO)).toBe(1)
  })

  test('the next day gives a new row', async () => {
    await views.recordPathViews('vw-student-1', [ONE], NOW)
    await views.recordPathViews('vw-student-1', [ONE], NEXT_DAY)
    expect(await rows()).toHaveLength(2)
    expect((await views.pathViewCounts(30, NEXT_DAY)).get(ONE)).toBe(2)
  })

  test('an unknown course id is ignored', async () => {
    await views.recordPathViews('vw-student-1', ['vw-no-such-course', ONE], NOW)
    const stored = await rows()
    expect(stored.map((row) => row.courseId)).toEqual([ONE])
  })

  test('a row 40 days old is deleted on the next call and not counted', async () => {
    await db
      .insert(schema.pathView)
      .values({ day: '2001-02-03', courseId: ONE, viewerKey: 'vw-old-key' })
    await views.recordPathViews('vw-student-1', [TWO], NOW)
    const stored = await rows()
    expect(stored.map((row) => row.day)).toEqual(['2001-03-15'])
    const counts = await views.pathViewCounts(30, NOW)
    expect(counts.has(ONE)).toBe(false)
    expect(counts.get(TWO)).toBe(1)
  })

  test('no column holds the user id', async () => {
    const userId = 'vw-student-identifiable'
    await views.recordPathViews(userId, [ONE], NOW)
    const [row] = await rows()
    expect(Object.keys(row).sort()).toEqual(['courseId', 'day', 'viewerKey'])
    for (const value of Object.values(row)) expect(String(value)).not.toContain(userId)
  })

  test('with no secret the call resolves, writes nothing and logs once', async () => {
    setKey(undefined)
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await views.recordPathViews('vw-student-1', [ONE], NOW)
      await views.recordPathViews('vw-student-1', [TWO], NOW)
      expect(await rows()).toHaveLength(0)
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  describe('recording how each path was shown (RC17)', () => {
    const THREE = PATHS.slice(0, 3).map((path) => path.id)
    const futures = {
      kind: 'futures' as const,
      futures: [
        { id: 'cost' as const, courseId: THREE[0], strongOn: ['cost'], costsOn: ['pr', 'career'] },
        { id: 'staying' as const, courseId: THREE[1], strongOn: ['pr', 'time'], costsOn: [] },
        { id: 'career' as const, courseId: THREE[2], strongOn: ['career'], costsOn: ['cost'] },
      ],
    }
    const sealed = {
      kind: 'sealed' as const,
      nearest: [
        { courseId: THREE[0], overByK: 4 },
        { courseId: THREE[1], overByK: 11 },
      ],
    }

    test('three futures write three rows with the future, strengths and costs shown', async () => {
      await views.recordFuturesShown('vw-student-1', futures, { redraw: false }, NOW)
      const stored = await shown()
      expect(stored.map((row) => [row.futureId, row.courseId, row.strongOn, row.costsOn])).toEqual([
        ['career', THREE[2], ['career'], ['cost']],
        ['cost', THREE[0], ['cost'], ['pr', 'career']],
        ['staying', THREE[1], ['pr', 'time'], []],
      ])
      for (const row of stored) {
        expect(row.day).toBe('2001-03-15')
        expect(row.outOfReach).toBe(false)
        expect(row.overByK).toBeNull()
        expect(row.redraw).toBe(false)
      }
    })

    test('the first draw also counts each path for the day', async () => {
      await views.recordFuturesShown('vw-student-1', futures, { redraw: false }, NOW)
      const counts = await views.pathViewCounts(30, NOW)
      expect(THREE.map((id) => counts.get(id))).toEqual([1, 1, 1])
    })

    test('a sealed result writes out-of-reach rows with how far over budget', async () => {
      await views.recordFuturesShown('vw-student-1', sealed, { redraw: false }, NOW)
      const stored = (await shown()).sort((a, b) => (a.overByK ?? 0) - (b.overByK ?? 0))
      expect(
        stored.map((row) => [row.courseId, row.futureId, row.outOfReach, row.overByK]),
      ).toEqual([
        [THREE[0], null, true, 4],
        [THREE[1], null, true, 11],
      ])
      for (const row of stored) expect([row.strongOn, row.costsOn]).toEqual([[], []])
    })

    test('a redraw adds rows marked as a redraw but leaves the daily totals', async () => {
      await views.recordFuturesShown('vw-student-1', futures, { redraw: false }, NOW)
      const before = await views.pathViewCounts(30, NOW)
      await views.recordFuturesShown('vw-student-1', futures, { redraw: true }, NOW)
      const stored = await shown()
      expect(stored).toHaveLength(6)
      expect(stored.filter((row) => row.redraw)).toHaveLength(3)
      expect(new Set(stored.map((row) => row.viewerKey)).size).toBe(1)
      expect(await views.pathViewCounts(30, NOW)).toEqual(before)
    })

    test('redraws stop being recorded at 30 showings per student a day; first draws do not', async () => {
      for (let i = 0; i < 10; i++) {
        await views.recordFuturesShown('vw-student-1', futures, { redraw: true }, NOW)
      }
      expect(await shown()).toHaveLength(30)
      await views.recordFuturesShown('vw-student-1', futures, { redraw: true }, NOW)
      await views.recordFuturesShown('vw-student-1', sealed, { redraw: true }, NOW)
      expect(await shown()).toHaveLength(30)
      await views.recordFuturesShown('vw-student-1', futures, { redraw: false }, NOW)
      await views.recordFuturesShown('vw-student-2', futures, { redraw: true }, NOW)
      await views.recordFuturesShown('vw-student-1', futures, { redraw: true }, NEXT_DAY)
      expect(await shown()).toHaveLength(39)
    })

    test('no column holds the user id', async () => {
      const userId = 'vw-student-identifiable'
      await views.recordFuturesShown(userId, futures, { redraw: false }, NOW)
      const [row] = await shown()
      expect(Object.keys(row).sort()).toEqual([
        'costsOn',
        'courseId',
        'createdAt',
        'day',
        'futureId',
        'id',
        'outOfReach',
        'overByK',
        'redraw',
        'strongOn',
        'viewerKey',
      ])
      for (const value of Object.values(row)) expect(String(value)).not.toContain(userId)
    })

    test('an unknown course is ignored', async () => {
      const withUnknown = {
        kind: 'futures' as const,
        futures: [
          { id: 'cost' as const, courseId: 'vw-no-such-course', strongOn: ['cost'], costsOn: [] },
          futures.futures[1],
        ],
      }
      await views.recordFuturesShown('vw-student-1', withUnknown, { redraw: false }, NOW)
      expect((await shown()).map((row) => row.courseId)).toEqual([THREE[1]])
    })

    test('a showing 40 days old is deleted on the next call', async () => {
      await db.insert(schema.pathShowing).values({
        day: '2001-02-03',
        courseId: THREE[0],
        viewerKey: 'vw-old-key',
        futureId: 'cost',
      })
      await views.recordFuturesShown('vw-student-1', sealed, { redraw: false }, NOW)
      expect(new Set((await shown()).map((row) => row.day))).toEqual(new Set(['2001-03-15']))
    })

    test('with no secret it resolves and writes nothing', async () => {
      setKey(undefined)
      const warn = spyOn(console, 'warn').mockImplementation(() => {})
      try {
        await views.recordFuturesShown('vw-student-1', futures, { redraw: false }, NOW)
        expect(await shown()).toHaveLength(0)
        expect(await rows()).toHaveLength(0)
      } finally {
        warn.mockRestore()
      }
    })

    test('the stats give each path its showings, shares as whole percentages and out of reach', async () => {
      const row = (
        courseId: string,
        over: Partial<typeof schema.pathShowing.$inferInsert> = {},
      ): typeof schema.pathShowing.$inferInsert => ({
        day: '2001-03-15',
        courseId,
        viewerKey: 'vw-stats-key',
        ...over,
      })
      const [A, B] = THREE
      await db.insert(schema.pathShowing).values([
        row(A, { futureId: 'cost', strongOn: ['cost'], costsOn: ['pr', 'career'] }),
        row(A, { futureId: 'cost', strongOn: ['cost', 'time'], costsOn: ['pr'], redraw: true }),
        row(A, { futureId: 'staying', strongOn: ['time'], day: '2001-02-14' }),
        row(A, { outOfReach: true, overByK: 4 }),
        row(A, { outOfReach: true, overByK: 9 }),
        row(B, { futureId: 'career', strongOn: ['career'] }),
        row(B, { futureId: 'career', strongOn: ['career', 'pr'] }),
        row(B, { futureId: 'cost' }),
        // Outside the 30 days to 15 March: the day before the window and the day after.
        row(A, { futureId: 'career', strongOn: ['work'], day: '2001-02-13' }),
        row(B, { futureId: 'staying', day: '2001-03-16' }),
      ])
      const zero = { cost: 0, time: 0, work: 0, pr: 0, location: 0, career: 0 }
      const stats = await views.pathShowingStats(30, NOW)
      expect([...stats.keys()].sort()).toEqual([A, B].sort())
      expect(stats.get(A)).toEqual({
        showings: 5,
        byFuture: { cost: 2, staying: 1, career: 0 },
        strongOn: { ...zero, cost: 67, time: 67 },
        costsOn: { ...zero, pr: 67, career: 33 },
        outOfReach: { count: 2, avgOverK: 7 },
      })
      expect(stats.get(B)).toEqual({
        showings: 3,
        byFuture: { cost: 1, staying: 0, career: 2 },
        strongOn: { ...zero, career: 67, pr: 33 },
        costsOn: zero,
        outOfReach: { count: 0, avgOverK: 0 },
      })
    })

    test('strength and cost shares count only the showings where the path was a future', async () => {
      const [A] = THREE
      const base = { day: '2001-03-15', courseId: A, viewerKey: 'vw-share-key' }
      await db.insert(schema.pathShowing).values([
        { ...base, futureId: 'cost', strongOn: ['cost'], costsOn: [] },
        { ...base, futureId: 'cost', strongOn: ['cost'], costsOn: [] },
        { ...base, outOfReach: true, overByK: 3 },
        { ...base, outOfReach: true, overByK: 5 },
      ])
      const stat = (await views.pathShowingStats(30, NOW)).get(A)
      expect(stat?.showings).toBe(4)
      expect(stat?.strongOn.cost).toBe(100)
      expect(stat?.outOfReach.count).toBe(2)
    })

    test('a failed write is logged, not thrown', async () => {
      const error = spyOn(console, 'error').mockImplementation(() => {})
      const insert = spyOn(db, 'insert').mockImplementation(() => {
        throw new Error('vw-db-down')
      })
      try {
        expect(
          await views.recordFuturesShown('vw-student-1', futures, { redraw: false }, NOW),
        ).toBeUndefined()
        expect(error).toHaveBeenCalled()
      } finally {
        insert.mockRestore()
        error.mockRestore()
      }
    })
  })
})
