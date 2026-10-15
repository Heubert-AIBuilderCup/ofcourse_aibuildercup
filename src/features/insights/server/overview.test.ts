// The Insights overview's real figures against the development database (Docker, port 5433); off
// by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/insights/server/overview.test.ts
// Every row here is dated in 2001, so it sits far behind any real count; the post's id starts
// `io-`, and the run deletes its own rows before and after.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { emptyPointers } from '@/features/content/model/artifacts'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'io-'
const NOW = new Date('2001-03-15T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(NOW.getTime() - days * DAY)

describe.skipIf(!enabled)('the overview figures against the database', () => {
  let overview: typeof import('./overview')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db').schema
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db.delete(schema.contentPost).where(orm.like(schema.contentPost.id, `${P}%`))
    await db.delete(schema.aiCall).where(orm.like(schema.aiCall.id, `${P}%`))
  }

  beforeAll(async () => {
    overview = await import('./overview')
    ;({ db, schema } = await import('@/shared/lib/db'))
    orm = await import('drizzle-orm')
    await cleanUp()
    await db.insert(schema.contentPost).values({
      id: `${P}post`,
      kind: 'feed',
      title: 'Overview test',
      stage: 'live',
      pointers: emptyPointers(),
    })
    const render = (id: string, at: Date, kind = 'render') => ({
      id: `${P}${id}`,
      postId: `${P}post`,
      kind,
      body: {},
      createdAt: at,
    })
    await db
      .insert(schema.contentArtifact)
      .values([
        render('r1', ago(1)),
        render('r2', ago(6.9)),
        render('old', ago(7.5)),
        render('src', ago(1), 'source'),
      ])
    const call = (id: string, day: Date, cached: boolean) => ({
      id: `${P}${id}`,
      day: day.toISOString().slice(0, 10),
      useCase: 'extract',
      tier: 'flash',
      model: `${P}model`,
      promptVersion: 'v1',
      ok: true,
      cached,
      ms: 10,
    })
    await db
      .insert(schema.aiCall)
      .values([
        call('c1', NOW, true),
        call('c2', ago(6), false),
        call('c3', ago(6), true),
        call('old', ago(7), true),
      ])
  })

  afterAll(async () => {
    await cleanUp()
  })

  test("counts the last seven days' renders and AI calls, and the calls the cache answered", async () => {
    expect(await overview.weekFigures(NOW)).toEqual({ renders: 2, calls: 3, cached: 2 })
  })
})
