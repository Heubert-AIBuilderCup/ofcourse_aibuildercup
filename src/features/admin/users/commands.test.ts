// Every account change, called with its actor directly, so nothing here mocks the session.
// Against the development database (Docker, port 5433);
// off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/features/admin/users
// Every account here is the test's own (its id starts `um-c-`, its email ends @um.e2e.test) and
// is deleted after, with its sessions; so are the addresses it leaves waiting. The last-superadmin
// rules are proven in src/shared/lib/auth/access.test.ts: a shared database cannot promise a
// single superadmin.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { ACCESS_ERRORS } from '@/shared/lib/auth/access'

mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const P = 'um-c-'
const email = (k: string) => `${P}${k}@um.e2e.test`
const NEW_ADDRESS = 'new@um.e2e.test'

const SUPER = { id: `${P}super`, role: 'superadmin' }
const ADMIN = { id: `${P}admin`, role: 'admin' }

describe.skipIf(!enabled)('the account commands against the database', () => {
  let commands: typeof import('./commands')
  let db: typeof import('@/shared/lib/db').db
  let schema: typeof import('@/shared/lib/db/schema')
  let orm: typeof import('drizzle-orm')

  async function cleanUp() {
    await db
      .delete(schema.roleInvite)
      .where(
        orm.or(
          orm.eq(schema.roleInvite.email, NEW_ADDRESS),
          orm.like(schema.roleInvite.email, `${P}%`),
        ),
      )
    await db.delete(schema.user).where(orm.like(schema.user.id, `${P}%`))
  }

  // A fresh account of this test's own, with two open sessions.
  async function account(k: string, role: 'user' | 'admin' | 'superadmin' = 'user') {
    const id = `${P}${k}`
    await db.insert(schema.user).values({ id, name: `UM ${k}`, email: email(k), role })
    await db.insert(schema.session).values(
      ['1', '2'].map((n) => ({
        id: `${id}-s${n}`,
        token: `${id}-s${n}`,
        userId: id,
        expiresAt: new Date(Date.now() + 86_400_000),
      })),
    )
    return id
  }

  async function row(id: string) {
    const [r] = await db.select().from(schema.user).where(orm.eq(schema.user.id, id))
    return r
  }

  async function sessionsOf(id: string): Promise<number> {
    const rows = await db
      .select({ id: schema.session.id })
      .from(schema.session)
      .where(orm.eq(schema.session.userId, id))
    return rows.length
  }

  async function waiting(address: string) {
    const [r] = await db
      .select({ email: schema.roleInvite.email, role: schema.roleInvite.role })
      .from(schema.roleInvite)
      .where(orm.eq(schema.roleInvite.email, address))
    return r ?? null
  }

  beforeAll(async () => {
    commands = await import('./commands')
    ;({ db } = await import('@/shared/lib/db'))
    schema = await import('@/shared/lib/db/schema')
    orm = await import('drizzle-orm')
    await cleanUp()
    await account('super', 'superadmin')
    await account('admin', 'admin')
  })

  afterAll(async () => {
    await cleanUp()
  })

  describe('roles', () => {
    test("a superadmin makes a user an admin and ends the user's sessions", async () => {
      const id = await account('role')
      expect(await commands.setRoleAs(SUPER, id, 'admin')).toEqual({ ok: true })
      expect((await row(id)).role).toBe('admin')
      expect(await sessionsOf(id)).toBe(0)
    })

    test('an admin is refused and nothing changes', async () => {
      const id = await account('role-admin-try')
      expect(await commands.setRoleAs(ADMIN, id, 'admin')).toEqual({
        ok: false,
        error: ACCESS_ERRORS.rolesSuperadminOnly,
      })
      expect((await row(id)).role).toBe('user')
      expect(await sessionsOf(id)).toBe(2)
    })

    test('an unknown role and an unknown account are refused', async () => {
      const id = await account('role-bad')
      expect(await commands.setRoleAs(SUPER, id, 'owner')).toEqual({
        ok: false,
        error: ACCESS_ERRORS.invalidRole,
      })
      expect((await commands.setRoleAs(SUPER, `${P}nobody`, 'admin')).ok).toBe(false)
    })
  })

  describe('waiting roles', () => {
    test('an address is stored trimmed and lowercased with its role', async () => {
      expect(await commands.addRoleInviteAs(SUPER, '  New@UM.e2e.test ', 'admin')).toEqual({
        ok: true,
        applied: 'invite',
      })
      expect(await waiting(NEW_ADDRESS)).toEqual({ email: NEW_ADDRESS, role: 'admin' })
    })

    test('adding the address again changes its waiting role', async () => {
      await commands.addRoleInviteAs(SUPER, NEW_ADDRESS, 'superadmin')
      expect(await waiting(NEW_ADDRESS)).toEqual({ email: NEW_ADDRESS, role: 'superadmin' })
    })

    test("an existing account's address changes that account's role at once and waits for nothing", async () => {
      const id = await account('existing')
      expect(await commands.addRoleInviteAs(SUPER, email('EXISTING'), 'admin')).toEqual({
        ok: true,
        applied: 'account',
      })
      expect((await row(id)).role).toBe('admin')
      expect(await sessionsOf(id)).toBe(0)
      expect(await waiting(email('existing'))).toBeNull()
    })

    test('the user role is refused', async () => {
      expect(await commands.addRoleInviteAs(SUPER, email('p-invite'), 'user')).toEqual({
        ok: false,
        error: ACCESS_ERRORS.invalidRole,
      })
      expect(await waiting(email('p-invite'))).toBeNull()
    })

    test('an address that is not an email is refused', async () => {
      for (const bad of ['', 'not-an-email', `${'x'.repeat(250)}@um.e2e.test`]) {
        expect(await commands.addRoleInviteAs(SUPER, bad, 'admin')).toEqual({
          ok: false,
          error: 'Enter a valid email address.',
        })
      }
    })

    test('an admin can neither add nor remove an address', async () => {
      expect(await commands.addRoleInviteAs(ADMIN, email('a-invite'), 'admin')).toEqual({
        ok: false,
        error: ACCESS_ERRORS.rolesSuperadminOnly,
      })
      expect(await waiting(email('a-invite'))).toBeNull()
      expect(await commands.removeRoleInviteAs(ADMIN, NEW_ADDRESS)).toEqual({
        ok: false,
        error: ACCESS_ERRORS.rolesSuperadminOnly,
      })
      expect(await waiting(NEW_ADDRESS)).not.toBeNull()
    })

    test('a superadmin removes a waiting address, in any letter case', async () => {
      expect(await commands.removeRoleInviteAs(SUPER, ' NEW@um.e2e.test')).toEqual({ ok: true })
      expect(await waiting(NEW_ADDRESS)).toBeNull()
    })
  })

  describe('suspend and reactivate', () => {
    test("an admin suspends a user with a reason, ending the user's sessions", async () => {
      const id = await account('suspend')
      expect(await commands.suspendAs(ADMIN, id, '  Two accounts ')).toEqual({ ok: true })
      const r = await row(id)
      expect(r.suspendedAt).toBeInstanceOf(Date)
      expect(r.suspendReason).toBe('Two accounts')
      expect(await sessionsOf(id)).toBe(0)
    })

    test('reactivating clears the suspension and its reason', async () => {
      const id = `${P}suspend`
      expect(await commands.reactivateAs(ADMIN, id)).toEqual({ ok: true })
      const r = await row(id)
      expect(r.suspendedAt).toBeNull()
      expect(r.suspendReason).toBeNull()
    })

    test('an empty reason is refused', async () => {
      const id = await account('suspend-empty')
      expect(await commands.suspendAs(ADMIN, id, '   ')).toEqual({
        ok: false,
        error: 'Give a reason.',
      })
      expect((await row(id)).suspendedAt).toBeNull()
    })

    test('an admin cannot suspend an admin, nor reactivate or sign one out', async () => {
      const id = await account('suspend-admin', 'admin')
      const refused = { ok: false, error: ACCESS_ERRORS.hierarchy }
      expect(await commands.suspendAs(ADMIN, id, 'Two accounts')).toEqual(refused)
      expect(await commands.reactivateAs(ADMIN, id)).toEqual(refused)
      expect(await commands.signOutEverywhereAs(ADMIN, id)).toEqual(refused)
      expect((await row(id)).suspendedAt).toBeNull()
      expect(await sessionsOf(id)).toBe(2)
    })

    test('a superadmin may suspend an admin', async () => {
      const id = await account('suspend-by-super', 'admin')
      expect(await commands.suspendAs(SUPER, id, 'Left the company')).toEqual({ ok: true })
      expect(await sessionsOf(id)).toBe(0)
    })

    test('nobody can suspend themselves', async () => {
      expect(await commands.suspendAs(ADMIN, ADMIN.id, 'Two accounts')).toEqual({
        ok: false,
        error: ACCESS_ERRORS.ownAccount,
      })
      expect((await row(ADMIN.id)).suspendedAt).toBeNull()
    })
  })

  describe('sign out everywhere', () => {
    test('ends every session and leaves the account active', async () => {
      const id = await account('signout')
      expect(await commands.signOutEverywhereAs(ADMIN, id)).toEqual({ ok: true })
      expect(await sessionsOf(id)).toBe(0)
      expect((await row(id)).suspendedAt).toBeNull()
    })

    test('an admin may sign themselves out everywhere', async () => {
      expect(await commands.signOutEverywhereAs(ADMIN, ADMIN.id)).toEqual({ ok: true })
      expect(await sessionsOf(ADMIN.id)).toBe(0)
    })
  })

  describe('a user acting', () => {
    test('is refused', async () => {
      const id = await account('by-user')
      expect(await commands.suspendAs({ id, role: 'user' }, `${P}admin`, 'Test')).toEqual({
        ok: false,
        error: ACCESS_ERRORS.notAuthorised,
      })
    })
  })
})
