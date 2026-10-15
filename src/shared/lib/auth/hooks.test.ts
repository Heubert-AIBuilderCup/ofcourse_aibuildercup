// The sign-up and sign-in hooks in auth/index.ts: the first account ever is a superadmin, a role
// and the content capabilities waiting on an address apply, anyone else is a user, and no session
// for a suspended account.
// Then the two sign-in pages: the student page makes only users and refuses staff accounts (an
// admin, a superadmin, an editor or a reviewer), the admin page makes only the first account or an
// invited one and refuses students; and the email codes, with their 30-second resend guard, their
// five tries and their ten minutes.
// Each account case goes through Better Auth's own internal adapter, as Google and the dev sign-in
// do, so the hooks run exactly as they do there; the code cases go through the server API, so the
// hooks see the code paths.
// Against the development database (Docker, port 5433);
// off by default so the suite runs without one:
//   DB_TESTS=1 DATABASE_URL=postgres://… bun test src/shared/lib/auth/hooks.test.ts
// or, on a database just wiped so the first-account rule runs too: `bun run test:db`.
// Every address here ends @hooks.e2e.test; those accounts, waiting roles and codes are deleted after.

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { desc, eq, like, sql } from 'drizzle-orm'
import * as schema from '@/shared/lib/db/schema'
import type { Surface } from './access'
import { runWithSurface } from './surface'

// auth/index.ts sends codes through email/sign-in-code.ts, which is 'server-only' (it throws
// outside Next's server build).
mock.module('server-only', () => ({}))

const enabled = process.env.DB_TESTS === '1'
const DOMAIN = 'hooks.e2e.test'
const at = (local: string) => `${local}@${DOMAIN}`

// What a call that should be refused threw, or null when it went through. Bun 1.3's
// `expect(…).rejects` never settles on a sign-up refused inside the adapter's transaction, so the
// file hangs; awaiting the promise in a try/catch does settle (the content DB tests do the same).
async function failureOf(work: PromiseLike<unknown>): Promise<unknown> {
  try {
    await work
    return null
  } catch (error) {
    return error
  }
}

let db: typeof import('@/shared/lib/db').db

// This file's accounts (their sessions go with them), waiting roles and codes, from any earlier
// run too.
async function cleanUp() {
  await db.delete(schema.user).where(like(schema.user.email, `%@${DOMAIN}`))
  await db.delete(schema.roleInvite).where(like(schema.roleInvite.email, `%@${DOMAIN}`))
  await db.delete(schema.verification).where(like(schema.verification.identifier, `%@${DOMAIN}`))
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
  const env = process.env as Record<string, string | undefined>
  // The code sender's provider variables: unset here, so a code is logged and never emailed.
  const SAVED_KEYS = ['BETTER_AUTH_URL', 'RESEND_API_KEY', 'EMAIL_FROM'] as const
  const saved = Object.fromEntries(SAVED_KEYS.map((key) => [key, env[key]]))
  let auth: typeof import('@/shared/lib/auth').auth

  beforeAll(async () => {
    // Better Auth needs a base URL to build its context, read when the module loads. The app's
    // is in .env, which an agent's sandbox may not read; nothing here makes a request.
    env.BETTER_AUTH_URL ||= 'http://localhost:3000'
    delete env.RESEND_API_KEY
    delete env.EMAIL_FROM
    ;({ auth } = await import('@/shared/lib/auth'))
  })

  afterAll(async () => {
    await cleanUp()
    for (const key of SAVED_KEYS) {
      if (saved[key] === undefined) delete env[key]
      else env[key] = saved[key]
    }
  })

  async function createUser(email: string) {
    const ctx = await auth.$context
    return ctx.internalAdapter.createUser(
      { email, name: 'Hooks test', emailVerified: true },
      { method: 'test' },
    )
  }

  // A first sign-in for an address that has no account yet, under the starter's rules (no page).
  const signUp = (email: string) => runWithSurface('any', () => createUser(email))

  // The same first sign-in on one of the two sign-in pages, as Google's callback does there.
  const signUpOn = (surface: Surface, email: string) =>
    runWithSurface(surface, () => createUser(email))

  // A session opening on one of the two sign-in pages.
  const sessionOn = (surface: Surface, userId: string) =>
    runWithSurface(surface, async () => {
      const ctx = await auth.$context
      return ctx.internalAdapter.createSession(userId, false)
    })

  const waitWithRole = (email: string, role: 'admin' | 'superadmin') =>
    db.insert(schema.roleInvite).values({ email, role })

  // What a superadmin can leave waiting: a role, the capabilities, or both (ADR-108).
  const waitWith = (
    email: string,
    invite: { role: 'admin' | 'superadmin' | null; editor?: boolean; reviewer?: boolean },
  ) => db.insert(schema.roleInvite).values({ email, ...invite })

  // Make sure this is not the first account ever.
  async function notFirst() {
    if (!(await hasAccounts())) await signUp(at('someone'))
  }

  const sendCode = (email: string) =>
    auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })

  const signInWithCode = (email: string, otp: string) =>
    auth.api.signInEmailOTP({ body: { email, otp } })

  // The latest stored value of a verification row: `${code}:${attempts}` for a sign-in code.
  async function verificationValue(identifier: string): Promise<string> {
    const [row] = await db
      .select({ value: schema.verification.value })
      .from(schema.verification)
      .where(eq(schema.verification.identifier, identifier))
      .orderBy(desc(schema.verification.createdAt))
      .limit(1)
    if (!row) throw new Error(`No verification row for ${identifier}`)
    return row.value
  }

  const codeFor = async (email: string) =>
    (await verificationValue(`sign-in-otp-${email}`)).split(':')[0]

  // Moves an address's stored code expiry by `seconds` (negative: into the past).
  const shiftCodeExpiry = (email: string, seconds: number) =>
    db
      .update(schema.verification)
      .set({ expiresAt: sql`${schema.verification.expiresAt} + make_interval(secs => ${seconds})` })
      .where(eq(schema.verification.identifier, `sign-in-otp-${email}`))

  // The role stored for an account.
  async function roleOf(email: string) {
    const [row] = await db
      .select({ role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.email, email))
    return row?.role
  }

  // The role and the two capabilities stored for an account.
  async function accessOf(email: string) {
    const [row] = await db
      .select({
        role: schema.user.role,
        editor: schema.user.editor,
        reviewer: schema.user.reviewer,
      })
      .from(schema.user)
      .where(eq(schema.user.email, email))
    return row
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

  // Seconds from now until an address's stored code expires.
  async function codeExpiresIn(email: string): Promise<number> {
    const [row] = await db
      .select({ expiresAt: schema.verification.expiresAt })
      .from(schema.verification)
      .where(eq(schema.verification.identifier, `sign-in-otp-${email}`))
      .orderBy(desc(schema.verification.createdAt))
      .limit(1)
    if (!row) throw new Error(`No code for ${email}`)
    return (row.expiresAt.getTime() - Date.now()) / 1000
  }

  // These three run first, while the table is still empty; the first two leave it empty again.
  // Skipped, visibly, on a database that already has accounts: `bun run test:db` wipes the
  // database first so they run there every time.
  test.skipIf(hadAccounts)(
    'on an empty database a first sign-in on the student page is a user',
    async () => {
      try {
        await signUpOn('student', at('stu-first'))
        expect(await roleOf(at('stu-first'))).toBe('user')
      } finally {
        await cleanUp()
      }
    },
  )

  test.skipIf(hadAccounts)(
    'on an empty database a first sign-in on the admin page is a superadmin',
    async () => {
      try {
        await signUpOn('admin', at('adm-first'))
        expect(await roleOf(at('adm-first'))).toBe('superadmin')
      } finally {
        await cleanUp()
      }
    },
  )

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

  test('capabilities waiting without a role make a user who edits and reviews', async () => {
    if (!(await hasAccounts())) await signUp(at('someone'))
    await waitWith(at('caps'), { role: null, editor: true, reviewer: true })
    await signUp(at('caps'))
    expect(await accessOf(at('caps'))).toEqual({ role: 'user', editor: true, reviewer: true })
    expect(await isWaiting(at('caps'))).toBe(false)
  })

  test('a role and a capability waiting together both apply', async () => {
    if (!(await hasAccounts())) await signUp(at('someone'))
    await waitWith(at('admin-reviewer'), { role: 'admin', reviewer: true })
    await signUp(at('admin-reviewer'))
    expect(await accessOf(at('admin-reviewer'))).toEqual({
      role: 'admin',
      editor: false,
      reviewer: true,
    })
    expect(await isWaiting(at('admin-reviewer'))).toBe(false)
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
    expect(await failureOf(ctx.internalAdapter.createSession(user.id, false))).toMatchObject({
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

  // ── The two sign-in pages ─────────────────────────────────────────────────────────────────

  test('a first sign-in on the student page is a user', async () => {
    await signUpOn('student', at('stu'))
    expect(await roleOf(at('stu'))).toBe('user')
  })

  test('the student page refuses an address an admin role waits for, and keeps the role', async () => {
    await waitWithRole(at('stu-invited'), 'admin')
    expect(await failureOf(signUpOn('student', at('stu-invited')))).toMatchObject({
      body: { code: 'STUDENT_PAGE_ONLY' },
    })
    expect(await roleOf(at('stu-invited'))).toBeUndefined()
    expect(await isWaiting(at('stu-invited'))).toBe(true)
  })

  test('the admin page refuses an address with no account and no waiting role', async () => {
    await notFirst()
    expect(await failureOf(signUpOn('admin', at('adm-nobody')))).toMatchObject({
      body: { code: 'NOT_ADMIN' },
    })
    expect(await roleOf(at('adm-nobody'))).toBeUndefined()
  })

  test('the admin page applies a waiting admin role', async () => {
    await notFirst()
    await waitWithRole(at('adm-invited'), 'admin')
    await signUpOn('admin', at('adm-invited'))
    expect(await roleOf(at('adm-invited'))).toBe('admin')
    expect(await isWaiting(at('adm-invited'))).toBe(false)
  })

  test('the student page opens no session for an admin account', async () => {
    await notFirst()
    await waitWithRole(at('sess-admin'), 'admin')
    const admin = await signUp(at('sess-admin'))
    expect(await failureOf(sessionOn('student', admin.id))).toMatchObject({
      body: { code: 'STUDENT_PAGE_ONLY' },
    })
    expect(await sessionsOf(admin.id)).toBe(0)
  })

  test('the admin page opens no session for a user account and leaves it unchanged', async () => {
    await notFirst()
    const user = await signUp(at('sess-user'))
    expect(await failureOf(sessionOn('admin', user.id))).toMatchObject({
      body: { code: 'NOT_ADMIN' },
    })
    expect(await sessionsOf(user.id)).toBe(0)
    expect(await roleOf(at('sess-user'))).toBe('user')
  })

  test('each page opens a session for its own kind of account', async () => {
    await notFirst()
    const user = await signUp(at('sess-user-ok'))
    await waitWithRole(at('sess-admin-ok'), 'admin')
    const admin = await signUp(at('sess-admin-ok'))
    await sessionOn('student', user.id)
    await sessionOn('admin', admin.id)
    expect(await sessionsOf(user.id)).toBe(1)
    expect(await sessionsOf(admin.id)).toBe(1)
  })

  // ── The two sign-in pages and the content capabilities (ADR-108) ──────────────────────────

  test('the admin page makes a user who edits of an address only a capability waits for', async () => {
    await notFirst()
    await waitWith(at('adm-editor'), { role: null, editor: true })
    await signUpOn('admin', at('adm-editor'))
    expect(await accessOf(at('adm-editor'))).toEqual({
      role: 'user',
      editor: true,
      reviewer: false,
    })
    expect(await isWaiting(at('adm-editor'))).toBe(false)
  })

  test('the student page refuses an address a capability waits for, and keeps it waiting', async () => {
    await waitWith(at('stu-reviewer'), { role: null, reviewer: true })
    expect(await failureOf(signUpOn('student', at('stu-reviewer')))).toMatchObject({
      body: { code: 'STUDENT_PAGE_ONLY' },
    })
    expect(await roleOf(at('stu-reviewer'))).toBeUndefined()
    expect(await isWaiting(at('stu-reviewer'))).toBe(true)
  })

  test('a user with a capability gets a session on the admin page and none on the student page', async () => {
    await notFirst()
    await waitWith(at('sess-editor'), { role: null, editor: true })
    const editor = await signUp(at('sess-editor'))
    expect(await failureOf(sessionOn('student', editor.id))).toMatchObject({
      body: { code: 'STUDENT_PAGE_ONLY' },
    })
    expect(await sessionsOf(editor.id)).toBe(0)
    await sessionOn('admin', editor.id)
    expect(await sessionsOf(editor.id)).toBe(1)
  })

  // ── Email codes, through the server API ───────────────────────────────────────────────────

  test('a six-digit code signs a new address in as a user', async () => {
    await sendCode(at('code'))
    const code = await codeFor(at('code'))
    expect(code).toMatch(/^\d{6}$/)
    const res = await signInWithCode(at('code'), code)
    expect(res.user.email).toBe(at('code'))
    expect(await roleOf(at('code'))).toBe('user')
    expect(await sessionsOf(res.user.id)).toBe(1)
  })

  test('a second code within 30 seconds is refused', async () => {
    await sendCode(at('again'))
    expect(await failureOf(sendCode(at('again')))).toMatchObject({
      body: { code: 'CODE_RECENTLY_SENT' },
    })
  })

  test('after 30 seconds a new code is sent and the previous one no longer works', async () => {
    await sendCode(at('resend'))
    const previous = await codeFor(at('resend'))
    await shiftCodeExpiry(at('resend'), -31)
    await sendCode(at('resend'))
    const latest = await codeFor(at('resend'))
    // The new code repeats the old digits one time in a million; only then is there nothing to
    // refuse.
    if (latest !== previous) {
      expect(await failureOf(signInWithCode(at('resend'), previous))).toMatchObject({
        body: { code: 'INVALID_OTP' },
      })
    }
    const res = await signInWithCode(at('resend'), latest)
    expect(res.user.email).toBe(at('resend'))
  })

  test('after five wrong codes, the right code no longer works', async () => {
    await sendCode(at('tries'))
    const code = await codeFor(at('tries'))
    const wrong = code === '000000' ? '111111' : '000000'
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(await failureOf(signInWithCode(at('tries'), wrong))).toMatchObject({
        body: { code: 'INVALID_OTP' },
      })
    }
    expect(await failureOf(signInWithCode(at('tries'), code))).toMatchObject({
      body: { code: 'TOO_MANY_ATTEMPTS' },
    })
    expect(await roleOf(at('tries'))).toBeUndefined()
  })

  test('a code works for ten minutes, then it has expired', async () => {
    await sendCode(at('expired'))
    const code = await codeFor(at('expired'))
    const left = await codeExpiresIn(at('expired'))
    expect(left).toBeGreaterThan(590)
    expect(left).toBeLessThanOrEqual(600)
    await shiftCodeExpiry(at('expired'), -601)
    expect(await failureOf(signInWithCode(at('expired'), code))).toMatchObject({
      body: { code: 'OTP_EXPIRED' },
    })
    expect(await roleOf(at('expired'))).toBeUndefined()
  })

  test('an admin account signing in with a code gets no session', async () => {
    await notFirst()
    await waitWithRole(at('code-admin'), 'admin')
    const admin = await signUp(at('code-admin'))
    await sendCode(at('code-admin'))
    expect(
      await failureOf(signInWithCode(at('code-admin'), await codeFor(at('code-admin')))),
    ).toMatchObject({ body: { code: 'STUDENT_PAGE_ONLY' } })
    expect(await sessionsOf(admin.id)).toBe(0)
  })

  test('an address an admin role waits for cannot sign up with a code', async () => {
    await waitWithRole(at('code-invited'), 'admin')
    await sendCode(at('code-invited'))
    expect(
      await failureOf(signInWithCode(at('code-invited'), await codeFor(at('code-invited')))),
    ).toMatchObject({ body: { code: 'STUDENT_PAGE_ONLY' } })
    expect(await roleOf(at('code-invited'))).toBeUndefined()
    expect(await isWaiting(at('code-invited'))).toBe(true)
  })

  test('an email code is for signing in only: any other kind is refused and nothing is sent', async () => {
    const email = at('reset')
    await signUp(email)
    const refused = { body: { code: 'EMAIL_CODE_SIGN_IN_ONLY' } }
    for (const type of ['forget-password', 'email-verification', 'change-email'] as const) {
      expect(
        await failureOf(auth.api.sendVerificationOTP({ body: { email, type } })),
      ).toMatchObject(refused)
    }
    expect(await failureOf(auth.api.forgetPasswordEmailOTP({ body: { email } }))).toMatchObject(
      refused,
    )
    expect(
      await failureOf(auth.api.requestPasswordResetEmailOTP({ body: { email } })),
    ).toMatchObject(refused)
    expect(
      await failureOf(
        auth.api.checkVerificationOTP({ body: { email, type: 'sign-in', otp: '123456' } }),
      ),
    ).toMatchObject(refused)
    expect(
      await failureOf(auth.api.verifyEmailOTP({ body: { email, otp: '123456' } })),
    ).toMatchObject(refused)
    expect(
      await failureOf(
        auth.api.resetPasswordEmailOTP({ body: { email, otp: '123456', password: 'not-used-1' } }),
      ),
    ).toMatchObject(refused)
    const codes = await db
      .select({ id: schema.verification.id })
      .from(schema.verification)
      .where(like(schema.verification.identifier, `%-otp-${email}`))
    expect(codes).toEqual([])
  })

  test('a code reaches the account a Google sign-in made for the same address', async () => {
    const google = await signUpOn('student', at('same'))
    await sendCode(at('same'))
    const res = await signInWithCode(at('same'), await codeFor(at('same')))
    expect(res.user.id).toBe(google.id)
  })
})
