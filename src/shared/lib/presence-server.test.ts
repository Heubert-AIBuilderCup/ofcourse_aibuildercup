// recordLastSeen, the throttled last-seen write both layouts call. Against the development database
// (Docker, port 5433), like src/shared/lib/auth/hooks.test.ts; off by default so the suite runs
// without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/shared/lib/presence-server.test.ts
// The one account here is the test's own (its id is `presence-user`) and is deleted after.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { LAST_SEEN_THROTTLE_MS } from './presence'

// presence-server.ts is 'server-only', which throws outside Next's server build.
mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const ID = 'presence-user'
const THROTTLE_SECONDS = LAST_SEEN_THROTTLE_MS / 1000

describe.skipIf(!enabled)('recordLastSeen against the database', () => {
  let recordLastSeen: typeof import('./presence-server').recordLastSeen
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  beforeAll(async () => {
    ;({ recordLastSeen } = await import('./presence-server'))
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await db.delete(schema.user).where(orm.eq(schema.user.id, ID))
    await db.insert(schema.user).values({
      id: ID,
      name: 'Presence test',
      email: `${ID}@example.test`,
    })
  })

  afterAll(async () => {
    await db.delete(schema.user).where(orm.eq(schema.user.id, ID))
  })

  // Every test starts from a user who has never been seen.
  beforeEach(async () => {
    await db.update(schema.user).set({ lastSeenAt: null }).where(orm.eq(schema.user.id, ID))
  })

  // last_seen_at as epoch seconds, to the microsecond Postgres keeps. A Date keeps only
  // milliseconds, so two writes a moment apart could read as the same time.
  async function seenAt(): Promise<number | null> {
    const rows = await db.execute<{ at: number | null }>(
      orm.sql`select extract(epoch from last_seen_at)::float8 as at from "user" where id = ${ID}`,
    )
    return rows[0].at
  }

  // Sets the last-seen time back, by the database's own clock, as if the user was last seen then.
  async function lastSeenSecondsAgo(seconds: number) {
    await db.execute(
      orm.sql`update "user" set last_seen_at = now() - make_interval(secs => ${seconds}) where id = ${ID}`,
    )
  }

  test('gives a user who has never been seen a last-seen time of now', async () => {
    expect(await seenAt()).toBeNull()
    await recordLastSeen(ID)
    const at = await seenAt()
    expect(at).not.toBeNull()
    expect(Math.abs(Date.now() / 1000 - at!)).toBeLessThan(60)
  })

  test('leaves it unchanged on a second call straight away', async () => {
    await recordLastSeen(ID)
    const first = await seenAt()
    await recordLastSeen(ID)
    expect(await seenAt()).toBe(first)
  })

  test('leaves it unchanged a second short of the throttle', async () => {
    await lastSeenSecondsAgo(THROTTLE_SECONDS - 1)
    const before = await seenAt()
    await recordLastSeen(ID)
    expect(await seenAt()).toBe(before)
  })

  test('moves it once the throttle and a second have passed', async () => {
    await lastSeenSecondsAgo(THROTTLE_SECONDS + 1)
    const before = await seenAt()
    await recordLastSeen(ID)
    const after = await seenAt()
    expect(after! - before!).toBeGreaterThan(THROTTLE_SECONDS)
  })

  test('touches no account but the one it is given', async () => {
    await recordLastSeen('presence-nobody')
    expect(await seenAt()).toBeNull()
  })
})
