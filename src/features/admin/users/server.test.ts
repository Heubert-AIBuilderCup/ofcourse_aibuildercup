// The users server's reads: the list with its search and filters, one account's detail, the
// waiting addresses and the superadmin count. Against the development database (Docker, port
// 5433); off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/admin/users
// Every account here is the test's own (its id starts `um-s-`, its email ends @um.e2e.test) and
// is deleted after, with its sessions; so is its waiting address.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { UsersParams } from '../lib/params'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'um-s-'
const WAITING = 'waiting-s@um.e2e.test'
const MINUTE = 60_000

const params = (p: Partial<UsersParams> = {}): UsersParams => ({
  q: '',
  role: 'all',
  status: 'all',
  online: false,
  page: 0,
  ...p,
})

describe.skipIf(!enabled)('the users server against the database', () => {
  let server: typeof import('./server')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db.delete(schema.roleInvite).where(orm.eq(schema.roleInvite.email, WAITING))
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  // The list is global; keep only this test's own rows.
  const own = (rows: { id: string }[]) =>
    rows
      .map((r) => r.id)
      .filter((id) => id.startsWith(P))
      .map((id) => id.slice(P.length))
      .sort()

  beforeAll(async () => {
    server = await import('./server')
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
    const now = Date.now()
    const base = (k: string) => ({ id: `${P}${k}`, name: `UM ${k}`, email: `${P}${k}@um.e2e.test` })
    await db.insert(schema.user).values([
      // An online user, found by part of the name.
      { ...base('a'), name: 'Asha Zqname', lastSeenAt: new Date(now - MINUTE) },
      // An admin, seen an hour ago.
      { ...base('b'), role: 'admin', lastSeenAt: new Date(now - 60 * MINUTE) },
      // A suspended user who never loaded a page.
      { ...base('c'), suspendedAt: new Date(now), suspendReason: 'Test' },
      // A superadmin.
      { ...base('d'), role: 'superadmin' },
    ])
    await db.insert(schema.session).values({
      id: `${P}a-s1`,
      token: `${P}a-s1`,
      userId: `${P}a`,
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/128.0 Mobile',
      expiresAt: new Date(now + 86_400_000),
    })
    await db
      .insert(schema.roleInvite)
      .values({ email: WAITING, role: 'admin', createdByUserId: `${P}d` })
  })

  afterAll(async () => {
    await cleanUp()
  })

  describe('search', () => {
    test('finds part of a name or an email, in any letter case', async () => {
      expect(own((await server.getUsers(params({ q: 'zqNAME' }))).rows)).toEqual(['a'])
      expect(own((await server.getUsers(params({ q: `${P}b@` }))).rows)).toEqual(['b'])
    })

    test('takes % and _ literally', async () => {
      expect(own((await server.getUsers(params({ q: '%' }))).rows)).toEqual([])
    })
  })

  describe('filters', () => {
    const cases: [string, Partial<UsersParams>, string[]][] = [
      ['role user', { role: 'user' }, ['a', 'c']],
      ['role admin', { role: 'admin' }, ['b']],
      ['active', { status: 'active' }, ['a', 'b', 'd']],
      ['suspended', { status: 'suspended' }, ['c']],
      ['online now', { online: true }, ['a']],
    ]
    for (const [name, p, expected] of cases) {
      test(name, async () => {
        expect(own((await server.getUsers(params({ q: P, ...p }))).rows)).toEqual(expected)
      })
    }

    test('combine with each other and the search', async () => {
      const list = await server.getUsers(params({ role: 'user', online: true, q: 'zq' }))
      expect(list.rows).toEqual([
        {
          id: `${P}a`,
          name: 'Asha Zqname',
          email: `${P}a@um.e2e.test`,
          role: 'user',
          editor: false,
          reviewer: false,
          suspended: false,
          lastSeenMs: expect.any(Number),
          createdAt: expect.any(Date),
        },
      ])
      expect(list.total).toBe(1)
    })
  })

  test('counts who is online across every account, whatever the filters', async () => {
    const list = await server.getUsers(params({ q: 'no such user' }))
    expect(list.rows).toEqual([])
    expect(list.onlineNow).toBeGreaterThanOrEqual(1)
  })

  test('counts every account and the admins and superadmins among them, whatever the filters', async () => {
    const before = await server.getUsers(params({ q: 'no such user' }))
    // This test's own: a, b (admin), c, d (superadmin).
    expect(before.accounts).toBeGreaterThanOrEqual(4)
    expect(before.staff).toBeGreaterThanOrEqual(2)
    await db.insert(schema.user).values([
      { id: `${P}e`, name: 'UM e', email: `${P}e@um.e2e.test`, role: 'admin' },
      // A capability makes no one staff.
      { id: `${P}f`, name: 'UM f', email: `${P}f@um.e2e.test`, editor: true, reviewer: true },
    ])
    try {
      const after = await server.getUsers(params({ role: 'user', status: 'suspended', q: 'zz' }))
      expect(after.accounts - before.accounts).toBe(2)
      expect(after.staff - before.staff).toBe(1)
    } finally {
      await db.delete(schema.user).where(orm.inArray(schema.user.id, [`${P}e`, `${P}f`]))
    }
  })

  describe('one account', () => {
    test('is null for an unknown id', async () => {
      expect(await server.getUserDetail(`${P}missing`)).toBeNull()
    })

    test('has its access, suspension, open sessions and last visit', async () => {
      const a = await server.getUserDetail(`${P}a`)
      expect(a).toMatchObject({ role: 'user', editor: false, reviewer: false, suspendedAt: null })
      expect(a?.sessions.map((s) => s.id)).toEqual([`${P}a-s1`])
      expect(a?.lastSeenMs).toEqual(expect.any(Number))
      const c = await server.getUserDetail(`${P}c`)
      expect(c?.suspendedAt).toBeInstanceOf(Date)
      expect(c?.suspendReason).toBe('Test')
      expect(c?.lastSeenMs).toBeNull()
    })
  })

  test('lists a waiting address with its role and who added it', async () => {
    const waiting = await server.getWaitingInvites()
    expect(waiting.find((w) => w.email === WAITING)).toMatchObject({
      role: 'admin',
      editor: false,
      reviewer: false,
      createdByName: 'UM d',
    })
  })

  test('counts only superadmins who are not suspended', async () => {
    const before = await server.countActiveSuperadmins()
    await db
      .update(schema.user)
      .set({ suspendedAt: new Date() })
      .where(orm.eq(schema.user.id, `${P}d`))
    expect(await server.countActiveSuperadmins()).toBe(before - 1)
  })
})
