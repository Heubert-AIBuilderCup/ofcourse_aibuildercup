import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  ACCESS_ERRORS,
  type AccountAction,
  accountActionError,
  canManageRoles,
  canUseAdmin,
  INVITE_ROLES,
  type InviteRole,
  isRole,
  type Role,
  roleChangeError,
} from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import { roleInvite, session, user } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import { parseReason } from '../lib/reason'
import { countActiveSuperadmins } from './server'

// Every change to an account. Each takes the acting account explicitly (./actions.ts reads it
// from the session), applies the auth/access.ts guards to the target's role read fresh from the
// database, and returns a result instead of throwing. Every write names the role it was checked
// against, so an account whose role changed in between is left alone rather than acted on under
// the old rule. Nothing here sends a message or writes a notification.

/** The account acting: the session's id and role, never a value from the request. */
export type Actor = { id: string; role: string }

const UNKNOWN = 'Unknown account.'
const CHANGED = 'This account changed just now. Reload the page and try again.'
const DB_ERROR = 'Could not save. Please try again.'
const INVALID_EMAIL = 'Enter a valid email address.'
const MAX_EMAIL = 254

const OK: ActionResult = { ok: true }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

// Thrown inside a transaction to roll it back, then turned into a result.
class Refused extends Error {}

async function roleOf(userId: string): Promise<Role | null> {
  const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
  return row?.role ?? null
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Locks the active superadmins' rows until the transaction ends, so two changes racing to remove
 * superadmins run one after the other and the second sees the first's result.
 */
async function lockActiveSuperadmins(tx: Tx): Promise<void> {
  await tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, 'superadmin'), isNull(user.suspendedAt)))
    .for('update')
}

async function activeSuperadminsIn(tx: Tx): Promise<number> {
  const [row] = await tx
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(user)
    .where(and(eq(user.role, 'superadmin'), isNull(user.suspendedAt)))
  return row?.c ?? 0
}

/** Runs a change, turning a refusal into its message and any other failure into DB_ERROR. */
async function attempt(name: string, change: () => Promise<void>): Promise<ActionResult> {
  try {
    await change()
    return OK
  } catch (err) {
    if (err instanceof Refused) return fail(err.message)
    console.error(`[admin.users.${name}]`, err)
    return fail(DB_ERROR)
  }
}

type Guarded = { ok: true; targetRole: Role } | { ok: false; error: string }

/** The access.ts rule for `action` by `actor` on `userId`, with the target's role read fresh. */
async function guard(action: AccountAction, actor: Actor, userId: string): Promise<Guarded> {
  // Refused before anything is read: accountActionError would refuse it too, once it had the target.
  if (!canUseAdmin(actor.role)) return fail(ACCESS_ERRORS.notAuthorised)
  // Only a suspension is limited by how many superadmins are active, so only it counts them.
  const [targetRole, activeSuperadmins] = await Promise.all([
    roleOf(userId),
    action === 'suspend' ? countActiveSuperadmins() : Promise.resolve(0),
  ])
  if (!targetRole) return fail(UNKNOWN)
  const error = accountActionError({
    action,
    actorUserId: actor.id,
    actorRole: actor.role,
    targetUserId: userId,
    targetRole,
    activeSuperadmins,
  })
  return error ? fail(error) : { ok: true, targetRole }
}

/** One guarded update of the target's own row, as long as its role is still the one checked. */
async function guardedUpdate(
  action: AccountAction,
  actor: Actor,
  userId: string,
  set: Partial<typeof user.$inferInsert>,
): Promise<ActionResult> {
  const g = await guard(action, actor, userId)
  if (!g.ok) return g
  return attempt(action, async () => {
    const rows = await db
      .update(user)
      .set({ ...set, updatedAt: new Date() })
      .where(and(eq(user.id, userId), eq(user.role, g.targetRole)))
      .returning({ id: user.id })
    if (rows.length === 0) throw new Refused(CHANGED)
  })
}

// ── Roles ───────────────────────────────────────────────────────────────────────────────────

/** Change a role (superadmins only) and end every session, so the new role applies at once. */
export async function setRoleAs(actor: Actor, userId: string, role: string): Promise<ActionResult> {
  // Refused before anything is read: roleChangeError would refuse it too, once it had the target.
  if (!canManageRoles(actor.role)) return fail(ACCESS_ERRORS.rolesSuperadminOnly)
  const [current, activeSuperadmins] = await Promise.all([roleOf(userId), countActiveSuperadmins()])
  if (!current) return fail(UNKNOWN)
  const error = roleChangeError({
    actorUserId: actor.id,
    actorRole: actor.role,
    targetUserId: userId,
    targetRole: current,
    newRole: role,
    activeSuperadmins,
  })
  if (error) return fail(error)
  if (!isRole(role)) return fail(ACCESS_ERRORS.invalidRole)
  const demotion = current === 'superadmin' && role !== 'superadmin'
  return attempt('setRole', () =>
    db.transaction(async (tx) => {
      if (demotion) await lockActiveSuperadmins(tx)
      const rows = await tx
        .update(user)
        .set({ role, updatedAt: new Date() })
        .where(and(eq(user.id, userId), eq(user.role, current)))
        .returning({ id: user.id })
      if (rows.length === 0) throw new Refused(CHANGED)
      // Re-checked inside the transaction: two demotions racing cannot remove the last superadmin.
      if (demotion && (await activeSuperadminsIn(tx)) === 0) {
        throw new Refused(ACCESS_ERRORS.lastSuperadminRole)
      }
      await tx.delete(session).where(eq(session.userId, userId))
    }),
  )
}

const isInviteRole = (role: string): role is InviteRole =>
  (INVITE_ROLES as readonly string[]).includes(role)

/** An address as role_invite stores it: trimmed and lowercased; null when it is not an email. */
function inviteAddress(email: string): string | null {
  const address = email.trim().toLowerCase()
  if (address.length > MAX_EMAIL || !z.email().safeParse(address).success) return null
  return address
}

/**
 * Give an address a role before its first sign-in (superadmins only). An address that already
 * has an account has that account's role changed at once instead, and nothing waits. Nothing is
 * sent to the address: the team tells the person.
 */
export async function addRoleInviteAs(
  actor: Actor,
  email: string,
  role: string,
): Promise<ActionResult<{ applied: 'invite' | 'account' }>> {
  if (!canManageRoles(actor.role)) return fail(ACCESS_ERRORS.rolesSuperadminOnly)
  if (!isInviteRole(role)) return fail(ACCESS_ERRORS.invalidRole)
  const address = inviteAddress(email)
  if (!address) return fail(INVALID_EMAIL)
  // Accounts are stored with their email lowercased (Better Auth), so the unique index finds it.
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, address))
    .limit(1)
  if (existing) {
    const changed = await setRoleAs(actor, existing.id, role)
    return changed.ok ? { ok: true, applied: 'account' } : changed
  }
  const saved = await attempt('addRoleInvite', async () => {
    await db
      .insert(roleInvite)
      .values({ email: address, role, createdByUserId: actor.id })
      .onConflictDoUpdate({
        target: roleInvite.email,
        set: { role, createdByUserId: actor.id, createdAt: new Date() },
      })
  })
  return saved.ok ? { ok: true, applied: 'invite' } : saved
}

/** Stop an address waiting with a role (superadmins only); its first sign-in follows the usual rules. */
export async function removeRoleInviteAs(actor: Actor, email: string): Promise<ActionResult> {
  if (!canManageRoles(actor.role)) return fail(ACCESS_ERRORS.rolesSuperadminOnly)
  const address = inviteAddress(email)
  if (!address) return fail(INVALID_EMAIL)
  return attempt('removeRoleInvite', async () => {
    await db.delete(roleInvite).where(eq(roleInvite.email, address))
  })
}

// ── Suspension and sessions ─────────────────────────────────────────────────────────────────

/** Suspend an account with a reason, ending every session in the same transaction. */
export async function suspendAs(
  actor: Actor,
  userId: string,
  reason: string,
): Promise<ActionResult> {
  if (!canUseAdmin(actor.role)) return fail(ACCESS_ERRORS.notAuthorised)
  const r = parseReason(reason)
  if (!r.ok) return r
  const g = await guard('suspend', actor, userId)
  if (!g.ok) return g
  const superadmin = g.targetRole === 'superadmin'
  return attempt('suspend', () =>
    db.transaction(async (tx) => {
      if (superadmin) await lockActiveSuperadmins(tx)
      const rows = await tx
        .update(user)
        .set({ suspendedAt: new Date(), suspendReason: r.reason, updatedAt: new Date() })
        .where(and(eq(user.id, userId), eq(user.role, g.targetRole)))
        .returning({ id: user.id })
      if (rows.length === 0) throw new Refused(CHANGED)
      // Re-checked inside the transaction: two suspensions racing cannot stop the last superadmin.
      if (superadmin && (await activeSuperadminsIn(tx)) === 0) {
        throw new Refused(ACCESS_ERRORS.lastSuperadminSuspend)
      }
      await tx.delete(session).where(eq(session.userId, userId))
    }),
  )
}

/** Lift a suspension: the person can sign in again. */
export async function reactivateAs(actor: Actor, userId: string): Promise<ActionResult> {
  return guardedUpdate('reactivate', actor, userId, { suspendedAt: null, suspendReason: null })
}

/** End every session of an account; it stays active, and its next page load asks to sign in. */
export async function signOutEverywhereAs(actor: Actor, userId: string): Promise<ActionResult> {
  const g = await guard('signOut', actor, userId)
  if (!g.ok) return g
  return attempt('signOutEverywhere', async () => {
    await db.delete(session).where(eq(session.userId, userId))
  })
}
