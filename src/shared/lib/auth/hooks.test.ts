// The sign-up and sign-in hooks in auth/index.ts: the first account ever is a superadmin, a role
// waiting on an address applies, anyone else is a user, and no session for a suspended account.
// Each case goes through Better Auth's own internal adapter, as Google and the dev sign-in do,
// so the hooks run exactly as they do there.
// Against the development database (Docker, port 5433);
// off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/shared/lib/auth/hooks.test.ts
// or, on a database just wiped so the first-account rule runs too: `bun run test:db`.
// Every address here ends @hooks.e2e.test; those accounts and waiting roles are deleted after.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq, like } from 'drizzle-orm'
import * as schema from '@/shared/lib/db/schema'

const enabled = process.env.DB_TESTS === '1'
const DOMAIN = 'hooks.e2e.test'
const at = (local: string) => `${local}@${DOMAIN}`

let db: typeof import('@/shared/lib/db').db

// This file's accounts (their sessions go with them) and waiting roles, from any earlier run too.
async function cleanUp() {
  await db.delete(schema.user).where(like(schema.user.email, `%@${DOMAIN}`))
  await db.delete(schema.roleInvite).where(like(schema.roleInvite.email, `%@${DOMAIN}`))
}

/** Whether any account exists: an existence check, so the cost does not grow with the table. */
async function hasAccounts(): Promise<boolean> {
  const rows = await db.select({ id: schema.user.id }).from(schema.user).limit(1)
  return rows.length > 0
}

// Whether the database already held accounts when this file started: the first-account rule can
// be proven only on an empty one. Read before the tests are declared, so the test that needs an
// empty table is reported as skipped (not passed) on a database that has accounts.
let hadAccounts = true
if (enabled) {
  ;({ db } = await import('@/shared/lib/db'))
  await cleanUp()
  hadAccounts = await hasAccounts()
}

describe.skipIf(!enabled)('sign-up and sign-in hooks against the database', () => {
  const savedBaseUrl = process.env.BETTER_AUTH_URL
  let auth: typeof import('@/shared/lib/auth').auth

  beforeAll(async () => {
    // Better Auth needs a base URL to build its context, read when the module loads. The app's
    // is in .env, which an agent's sandbox may not read; nothing here makes a request.
    process.env.BETTER_AUTH_URL ||= 'http://localhost:3000'
    ;({ auth } = await import('@/shared/lib/auth'))
  })

  afterAll(async () => {
    await cleanUp()
    if (savedBaseUrl === undefined) delete process.env.BETTER_AUTH_URL
    else process.env.BETTER_AUTH_URL = savedBaseUrl
  })

  // A first sign-in for an address that has no account yet.
  async function signUp(email: string) {
    const ctx = await auth.$context
    return ctx.internalAdapter.createUser(
      { email, name: 'Hooks test', emailVerified: true },
      { method: 'test' },
    )
  }

  const waitWithRole = (email: string, role: 'admin' | 'superadmin') =>
    db.insert(schema.roleInvite).values({ email, role })

  // The role stored for an account.
  async function roleOf(email: string) {
    const [row] = await db
      .select({ role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.email, email))
    return row?.role
  }

  async function isWaiting(email: string): Promise<boolean> {
    const rows = await db
      .select({ email: schema.roleInvite.email })
      .from(schema.roleInvite)
      .where(eq(schema.roleInvite.email, email))
    return rows.length > 0
  }

  async function sessionsOf(userId: string): Promise<number> {
    const rows = await db
      .select({ id: schema.session.id })
      .from(schema.session)
      .where(eq(schema.session.userId, userId))
    return rows.length
  }

  // Runs first, while the table is still empty. Skipped, visibly, on a database that already has
  // accounts: `bun run test:db` wipes the database first so it runs there every time.
  test.skipIf(hadAccounts)('on an empty database the first account is a superadmin', async () => {
    await signUp(at('first'))
    expect(await roleOf(at('first'))).toBe('superadmin')
  })

  test('a waiting role applies at the first sign-in and is used up', async () => {
    // Make sure this is not the first account ever.
    if (!(await hasAccounts())) await signUp(at('someone'))
    await waitWithRole(at('invited'), 'admin')
    await signUp(at('invited'))
    expect(await roleOf(at('invited'))).toBe('admin')
    expect(await isWaiting(at('invited'))).toBe(false)
  })

  test('a waiting role applies whatever the letter case of the address signing in', async () => {
    await waitWithRole(at('case'), 'superadmin')
    await signUp('Case@Hooks.E2E.test')
    expect(await roleOf(at('case'))).toBe('superadmin')
    expect(await isWaiting(at('case'))).toBe(false)
  })

  test('with no waiting role, a later account is a user', async () => {
    await signUp(at('user'))
    expect(await roleOf(at('user'))).toBe('user')
  })

  test('a suspended account gets no session', async () => {
    const user = await signUp(at('suspended'))
    await db
      .update(schema.user)
      .set({ suspendedAt: new Date(), suspendReason: 'Hooks test' })
      .where(eq(schema.user.id, user.id))
    const ctx = await auth.$context
    await expect(ctx.internalAdapter.createSession(user.id, false)).rejects.toMatchObject({
      body: { code: 'ACCOUNT_SUSPENDED' },
    })
    expect(await sessionsOf(user.id)).toBe(0)
  })

  test('an active account gets its session', async () => {
    const user = await signUp(at('active'))
    const ctx = await auth.$context
    const session = await ctx.internalAdapter.createSession(user.id, false)
    expect(session.userId).toBe(user.id)
    expect(await sessionsOf(user.id)).toBe(1)
  })
})
