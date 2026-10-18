// loadStudentProfile (ADR-126) against the database; off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/content/server/student-profile.test.ts
// Every account here is the test's own (its id starts `sp-t-`) and is deleted after, with its
// roadmaps. Each has at most one unfinished roadmap, the rest finished (a second draft is refused).

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { StoredAnswers } from '@/shared/types/student'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'sp-t-'

describe.skipIf(!enabled)('loadStudentProfile against the database', () => {
  let load: typeof import('./student-profile').loadStudentProfile
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  const cleanUp = () => db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))

  const answers = (where: string, dest: string): StoredAnswers => ({
    where: { value: where, state: 'stated' },
    dest: { value: dest, state: 'stated' },
  })

  const add = (userId: string, a: StoredAnswers, opts: { finished: boolean; opened?: string }) =>
    db.insert(schema.roadmap).values({
      userId,
      answers: a,
      finishedAt: opts.finished ? new Date('2026-01-01') : null,
      lastOpenedAt: opts.opened ? new Date(opts.opened) : null,
    })

  beforeAll(async () => {
    ;({ loadStudentProfile: load } = await import('./student-profile'))
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
    const base = (k: string) => ({ id: `${P}${k}`, name: `SP ${k}`, email: `${P}${k}@sp.e2e.test` })
    await db.insert(schema.user).values([base('a'), base('b'), base('c'), base('d')])
  })

  afterAll(async () => {
    await cleanUp()
  })

  test('takes the home country from the roadmap opened last, destinations from them all', async () => {
    const uid = `${P}a`
    await add(uid, answers('Nepal', 'Australia'), { finished: true, opened: '2026-03-01' })
    await add(uid, answers('India', 'Open to others'), { finished: true, opened: '2026-05-01' })
    expect(await load(uid)).toEqual({ homeMarket: 'IN', destinations: ['AU'], ageBand: null })
  })

  test('comes from the draft when it is all she has', async () => {
    const uid = `${P}b`
    await add(uid, answers('Nepal', 'Australia'), { finished: false })
    expect(await load(uid)).toEqual({ homeMarket: 'NP', destinations: ['AU'], ageBand: null })
  })

  test('is null when she has no roadmap', async () => {
    expect(await load(`${P}c`)).toBeNull()
  })

  test("never counts another student's roadmaps", async () => {
    await add(`${P}d`, answers('Nepal', 'Australia'), { finished: true, opened: '2026-06-01' })
    expect(await load(`${P}c`)).toBeNull()
  })
})
