// The finder's vector table against a Postgres with pgvector; off by default so the suite runs
// without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/finder/server/course-doc.db.test.ts
// The search's ordering by meaning is tested through the real query in search.db.test.ts.

import { beforeAll, describe, expect, mock, test } from 'bun:test'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'

describe.skipIf(!enabled)('course_doc against the database', () => {
  let db: typeof import('@/shared/lib/db').db
  let orm: typeof import('drizzle-orm')

  beforeAll(async () => {
    ;({ db } = await import('@/shared/lib/db'))
    orm = await import('drizzle-orm')
  })

  test('the vector extension is installed', async () => {
    const r = await db.execute(orm.sql`select extname from pg_extension where extname = 'vector'`)
    expect(r.length).toBe(1)
  })
})
