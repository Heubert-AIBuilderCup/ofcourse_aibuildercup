import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, addOAuthServerContext, createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { asc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/shared/lib/db'
import { SIGN_IN_CODE_TTL_SECONDS, sendSignInCode } from '@/shared/lib/email/sign-in-code'
import {
  type InviteRole,
  isSurface,
  resolveSignupRole,
  SURFACE_ERRORS,
  settleFirstAccountRole,
  surfaceSessionError,
  surfaceSignup,
} from './access'
import { ACCOUNT_SUSPENDED } from './gate'
import { CODE_RECENTLY_SENT, currentSurface } from './surface'

/** A new code may be asked for this long after the last one to the same address. */
const CODE_RESEND_AFTER_MS = 30_000

const SURFACE_MESSAGES: Record<string, string> = {
  [SURFACE_ERRORS.studentPageOnly]: 'This page is for students.',
  [SURFACE_ERRORS.notAdmin]: "This account doesn't have admin access.",
}

// A sign-in refused by its page. During a Google callback Better Auth sends it to the page's
// errorCallbackURL with `?error=<code>`, as it does ACCOUNT_SUSPENDED.
const surfaceRefusal = (code: string) =>
  APIError.from('FORBIDDEN', { code, message: SURFACE_MESSAGES[code] })

// Role invites are stored trimmed and lowercased (schema.ts, roleInvite), so look them up that way.
const inviteKey = (email: string) => email.trim().toLowerCase()

/** Whether no account exists yet: the first person to sign up becomes the superadmin. */
async function noAccountsYet(): Promise<boolean> {
  // An existence check, not a count: the cost must not grow with the number of accounts.
  const rows = await db.select({ one: sql`1` }).from(schema.user).limit(1)
  return rows.length === 0
}

/** The id of the superadmin that comes first by (created_at, id), or null when there is none. */
async function firstSuperadminId(): Promise<string | null> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, 'superadmin'))
    .orderBy(asc(schema.user.createdAt), asc(schema.user.id))
    .limit(1)
  return rows[0]?.id ?? null
}

type WaitingInvite = { role: InviteRole | null; editor: boolean; reviewer: boolean }

/** The role and capabilities a superadmin left waiting for this address's first sign-in, or null. */
async function waitingInvite(email: string): Promise<WaitingInvite | null> {
  const rows = await db
    .select({
      role: schema.roleInvite.role,
      editor: schema.roleInvite.editor,
      reviewer: schema.roleInvite.reviewer,
    })
    .from(schema.roleInvite)
    .where(eq(schema.roleInvite.email, inviteKey(email)))
    .limit(1)
  return rows[0] ?? null
}

/** An account's role, its content capabilities and whether it is suspended, in one read. */
async function accountStatus(userId: string): Promise<{
  role: string | null
  editor: boolean
  reviewer: boolean
  suspended: boolean
}> {
  const rows = await db
    .select({
      role: schema.user.role,
      editor: schema.user.editor,
      reviewer: schema.user.reviewer,
      suspendedAt: schema.user.suspendedAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)
  const row = rows[0]
  return {
    role: row?.role ?? null,
    editor: row?.editor ?? false,
    reviewer: row?.reviewer ?? false,
    suspended: row?.suspendedAt != null,
  }
}

/** The refusal of an email-code path other than sending and using a sign-in code. */
const EMAIL_CODE_SIGN_IN_ONLY = 'EMAIL_CODE_SIGN_IN_ONLY'

/**
 * Whether a stored sign-in code was sent less than 30 seconds ago. The send time comes from its
 * expiry, which a wrong try keeps; Better Auth rewrites the row on a wrong try, so its created
 * time moves.
 */
function sentRecently(code: { expiresAt: Date }): boolean {
  const sentAt = new Date(code.expiresAt).getTime() - SIGN_IN_CODE_TTL_SECONDS * 1000
  return sentAt > Date.now() - CODE_RESEND_AFTER_MS
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Development only: another device on the local network signs in at http://192.168.x.y:3000,
  // an origin that is not BETTER_AUTH_URL; without this every sign-in request from it is refused
  // as a cross-site request. Production trusts its own origin alone.
  trustedOrigins:
    process.env.NODE_ENV === 'production'
      ? []
      : ['http://192.168.*.*:3000', 'http://10.*.*.*:3000'],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  advanced: {
    // Secure cookies over HTTPS in production; off in development so http://localhost works.
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  account: { encryptOAuthTokens: true },
  user: {
    // Returned on the session; `input: false` means no client request can set them. They
    // change only through the create hook below and the admin's server actions.
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'user', input: false },
      // The content capabilities (ADR-108): from a waiting invite at sign-up, then only a superadmin.
      editor: { type: 'boolean', required: false, defaultValue: false, input: false },
      reviewer: { type: 'boolean', required: false, defaultValue: false, input: false },
      // Set while an admin has the account suspended. No new session is made then (the session
      // hook below), and auth/session.ts treats a session made before the suspension as signed out.
      suspendedAt: { type: 'date', required: false, input: false },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: 'select_account',
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // A Google sign-in carries the page it started on (`additionalData.surface`) into the OAuth
      // state's server part, which the callback reads back (./surface). The client chooses the
      // page, but each page only narrows what a sign-in may do (./access), so no choice grants
      // more; anything else counts as the student page.
      if (ctx.path === '/sign-in/social') {
        const requested = ctx.body?.additionalData?.surface
        await addOAuthServerContext({ surface: isSurface(requested) ? requested : 'student' })
        return
      }
      // Email codes are for signing in only: StudentSignIn sends one (type sign-in) and signs in
      // with it. The plugin's other code paths (password reset, email check and change) are
      // refused before they can send mail.
      const emailCodePath =
        ctx.path.startsWith('/email-otp/') || ctx.path === '/forget-password/email-otp'
      const signInCode =
        ctx.path === '/email-otp/send-verification-otp' && ctx.body?.type === 'sign-in'
      if (emailCodePath && !signInCode) {
        throw APIError.from('FORBIDDEN', {
          code: EMAIL_CODE_SIGN_IN_ONLY,
          message: 'Email codes are for signing in only.',
        })
      }
      // A new sign-in code at most every 30 seconds per address. The send replaces the stored
      // code, so the previous one stops working once a new one is sent.
      if (ctx.path === '/email-otp/send-verification-otp' && ctx.body?.type === 'sign-in') {
        const email = ctx.body?.email
        // Not an address: the endpoint itself refuses it.
        if (typeof email !== 'string') return
        // The email-code plugin's own key for an address's sign-in code.
        const stored = await ctx.context.internalAdapter.findVerificationValue(
          `sign-in-otp-${email.toLowerCase()}`,
        )
        if (stored && sentRecently(stored)) {
          throw APIError.from('TOO_MANY_REQUESTS', {
            code: CODE_RECENTLY_SENT,
            message: 'Wait 30 seconds before asking for a new code.',
          })
        }
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        // Registration is open. On the student page every new account is a user; on the admin
        // page only the first account ever (superadmin) or an address a role or a content
        // capability waits for may sign up (./access, surfaceSignup). The dev login without a page
        // keeps the starter's rule: the first account ever is the superadmin, then a waiting role,
        // else user. The capabilities waiting on the address are copied as they are.
        before: async (newUser, ctx) => {
          const [first, invite, surface] = await Promise.all([
            noAccountsYet(),
            waitingInvite(newUser.email),
            currentSurface(ctx),
          ])
          const invitedRole = invite?.role ?? null
          const capabilities = {
            editor: invite?.editor ?? false,
            reviewer: invite?.reviewer ?? false,
          }
          if (surface === 'any') {
            return {
              data: { ...newUser, role: resolveSignupRole(first, invitedRole), ...capabilities },
            }
          }
          const decision = surfaceSignup({
            surface,
            firstAccount: first,
            invitedRole,
            invitedCapability: capabilities.editor || capabilities.reviewer,
          })
          if ('refuse' in decision) throw surfaceRefusal(decision.refuse)
          return { data: { ...newUser, role: decision.role, ...capabilities } }
        },
        // The waiting invite is used up only once the account exists (after the commit, on a
        // Google sign-up), so a sign-up that fails keeps it for the next try.
        after: async (created) => {
          // The hook above decides from a read that nothing serialises: two sign-ups overlapping
          // on an empty table both see "no accounts" and both arrive here as superadmin. Now that
          // the row exists, a superadmin the first-account rule made (the invite, read before it
          // is deleted, did not give the role) keeps it only if it is the superadmin that comes
          // first by (created_at, id). Each racer demotes only itself and the order is the same
          // for all of them, so exactly one survives.
          // The hook's user type does not carry the additional fields, so read the role as text.
          const createdRole = typeof created.role === 'string' ? created.role : ''
          const invite = await waitingInvite(created.email)
          const settled = settleFirstAccountRole({
            createdId: created.id,
            createdRole,
            invitedRole: invite?.role ?? null,
            firstSuperadminId: createdRole === 'superadmin' ? await firstSuperadminId() : null,
          })
          if (settled !== null) {
            await db
              .update(schema.user)
              .set({ role: settled })
              .where(eq(schema.user.id, created.id))
          }
          await db
            .delete(schema.roleInvite)
            .where(eq(schema.roleInvite.email, inviteKey(created.email)))
        },
      },
    },
    session: {
      create: {
        // A suspended account is never given a session, by Google, a code or the dev sign-in. A
        // Google sign-in refused here ends on its page's error path with `?error=<code>`. Each
        // page then refuses the other kind of account: the student page opens sessions for
        // students only (role user, no content capability), the admin page for anyone who may see
        // the Board (an admin, a superadmin, an editor or a reviewer).
        before: async (newSession, ctx) => {
          const [account, surface] = await Promise.all([
            accountStatus(newSession.userId),
            currentSurface(ctx),
          ])
          if (account.suspended) {
            throw APIError.from('FORBIDDEN', {
              code: ACCOUNT_SUSPENDED,
              message: 'This account is suspended.',
            })
          }
          if (surface === 'any') return
          const refused = surfaceSessionError(surface, account.role, account)
          if (refused) throw surfaceRefusal(refused)
        },
      },
    },
  },
  plugins: [
    // Sign-in by a six-digit code sent to the address, on the student page. Five tries per code;
    // a wrong try keeps the code's ten-minute expiry. The 30-second resend guard is the
    // `hooks.before` above.
    emailOTP({
      otpLength: 6,
      expiresIn: SIGN_IN_CODE_TTL_SECONDS,
      allowedAttempts: 5,
      // The default of 3 a minute would refuse a fourth try before the fifth wrong one voids the code.
      rateLimit: { window: 60, max: 10 },
      sendVerificationOTP: ({ email, otp }) => sendSignInCode(email, otp),
    }),
    // Lets server actions that call auth.api set the session cookie. Stays last.
    nextCookies(),
  ],
})
