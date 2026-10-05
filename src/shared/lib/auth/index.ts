import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { asc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/shared/lib/db'
import { type InviteRole, resolveSignupRole, settleFirstAccountRole } from './access'
import { ACCOUNT_SUSPENDED } from './gate'

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

/** The role a superadmin left waiting for this address's first sign-in, or null. */
async function waitingRole(email: string): Promise<InviteRole | null> {
  const rows = await db
    .select({ role: schema.roleInvite.role })
    .from(schema.roleInvite)
    .where(eq(schema.roleInvite.email, inviteKey(email)))
    .limit(1)
  return rows[0]?.role ?? null
}

async function isSuspended(userId: string): Promise<boolean> {
  const rows = await db
    .select({ suspendedAt: schema.user.suspendedAt })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)
  return rows[0]?.suspendedAt != null
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
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
  databaseHooks: {
    user: {
      create: {
        // Registration is open to every Google account. The first account ever is the
        // superadmin; after that a role waiting on the address decides the role, else user.
        before: async (newUser) => {
          const [first, invited] = await Promise.all([noAccountsYet(), waitingRole(newUser.email)])
          return { data: { ...newUser, role: resolveSignupRole(first, invited) } }
        },
        // The waiting role is used up only once the account exists (after the commit, on a
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
          const invited = await waitingRole(created.email)
          const settled = settleFirstAccountRole({
            createdId: created.id,
            createdRole,
            invitedRole: invited,
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
        // A suspended account is never given a session, by Google or the dev sign-in. A Google
        // sign-in refused here ends on SIGNIN_ERROR_PATH with `?error=ACCOUNT_SUSPENDED`.
        before: async (newSession) => {
          if (await isSuspended(newSession.userId)) {
            throw APIError.from('FORBIDDEN', {
              code: ACCOUNT_SUSPENDED,
              message: 'This account is suspended.',
            })
          }
        },
      },
    },
  },
  // Lets server actions that call auth.api set the session cookie.
  plugins: [nextCookies()],
})
