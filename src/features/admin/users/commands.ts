import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  ACCESS_ERRORS,
  type AccountAction,
  accountActionError,
  canManageRoles,
  canUseAdmin,
  contentRolesError,
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

type RoleChange = { ok: true; current: Role; role: Role } | { ok: false; error: string }

/** The access.ts rule for changing the account's role to `role`, its current role read fresh. */
async function checkRoleChange(actor: Actor, userId: string, role: string): Promise<RoleChange> {
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
  return { ok: true, current, role }
}

/** The role update inside a transaction, as long as the role is still the one checked. */
async function writeRole(tx: Tx, userId: string, change: { current: Role; role: Role }) {
  const demotion = change.current === 'superadmin' && change.role !== 'superadmin'
  if (demotion) await lockActiveSuperadmins(tx)
  const rows = await tx
    .update(user)
    .set({ role: change.role, updatedAt: new Date() })
    .where(and(eq(user.id, userId), eq(user.role, change.current)))
    .returning({ id: user.id })
  if (rows.length === 0) throw new Refused(CHANGED)
  // Re-checked inside the transaction: two demotions racing cannot remove the last superadmin.
  if (demotion && (await activeSuperadminsIn(tx)) === 0) {
    throw new Refused(ACCESS_ERRORS.lastSuperadminRole)
  }
}

/** Change a role (superadmins only) and end every session, so the new role applies at once. */
export async function setRoleAs(actor: Actor, userId: string, role: string): Promise<ActionResult> {
  const change = await checkRoleChange(actor, userId, role)
  if (!change.ok) return change
  return attempt('setRole', () =>
    db.transaction(async (tx) => {
      await writeRole(tx, userId, change)
      await tx.delete(session).where(eq(session.userId, userId))
    }),
  )
}

/** The two content capabilities (ADR-108), as stored on an account or a waiting invite. */
export type Capabilities = { editor: boolean; reviewer: boolean }

const NO_CAPABILITIES: Capabilities = { editor: false, reviewer: false }

/**
 * Give or remove editor and reviewer (superadmins only), ending every session in the same
 * transaction so the change applies at once.
 */
export async function setCapabilitiesAs(
  actor: Actor,
  userId: string,
  caps: Capabilities,
): Promise<ActionResult> {
  const refused = contentRolesError({ actorRole: actor.role })
  if (refused) return fail(refused)
  return attempt('setCapabilities', () =>
    db.transaction(async (tx) => {
      await writeCapabilities(tx, userId, caps)
      await tx.delete(session).where(eq(session.userId, userId))
    }),
  )
}

/** The capability update inside a transaction. */
async function writeCapabilities(tx: Tx, userId: string, caps: Capabilities): Promise<void> {
  const rows = await tx
    .update(user)
    .set({ editor: caps.editor, reviewer: caps.reviewer, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ id: user.id })
  if (rows.length === 0) throw new Refused(UNKNOWN)
}

const isInviteRole = (role: string): role is InviteRole =>
  (INVITE_ROLES as readonly string[]).includes(role)

/** An address as role_invite stores it: trimmed and lowercased; null when it is not an email. */
function inviteAddress(email: string): string | null {
  const address = email.trim().toLowerCase()
  if (address.length > MAX_EMAIL || !z.email().safeParse(address).success) return null
  return address
}

const CAPABILITY_KEYS = ['editor', 'reviewer'] as const satisfies readonly (keyof Capabilities)[]

/** What an invite did: waits for a first sign-in, changed an account, or asks before removing ticks. */
export type InviteApplied =
  | { applied: 'invite' | 'account' }
  | { applied: 'confirm'; removes: (keyof Capabilities)[] }

/**
 * Give an address a role, the content capabilities or both before its first sign-in
 * (superadmins only); `role` is null when only capabilities are given. An address that already
 * has an account has that account's role (when one is given) and capabilities changed at once
 * instead, in one transaction, and nothing waits. The form is the truth: a capability the account
 * holds and the form leaves unticked is removed, but only once `confirmed`; until then nothing
 * changes and the answer names what would go. Nothing is sent to the address: the team tells the
 * person.
 */
export async function addRoleInviteAs(
  actor: Actor,
  email: string,
  role: string | null,
  caps: Capabilities = NO_CAPABILITIES,
  confirmed = false,
): Promise<ActionResult<InviteApplied>> {
  if (!canManageRoles(actor.role)) return fail(ACCESS_ERRORS.rolesSuperadminOnly)
  if (role !== null && !isInviteRole(role)) return fail(ACCESS_ERRORS.invalidRole)
  if (role === null && !caps.editor && !caps.reviewer) return fail(ACCESS_ERRORS.invalidRole)
  const address = inviteAddress(email)
  if (!address) return fail(INVALID_EMAIL)
  // Accounts are stored with their email lowercased (Better Auth), so the unique index finds it.
  const [existing] = await db
    .select({ id: user.id, editor: user.editor, reviewer: user.reviewer })
    .from(user)
    .where(eq(user.email, address))
    .limit(1)
  if (existing) return applyToAccount(actor, existing, role, caps, confirmed)
  const access = { role, editor: caps.editor, reviewer: caps.reviewer }
  const saved = await attempt('addRoleInvite', async () => {
    await db
      .insert(roleInvite)
      .values({ email: address, ...access, createdByUserId: actor.id })
      .onConflictDoUpdate({
        target: roleInvite.email,
        set: { ...access, createdByUserId: actor.id, createdAt: new Date() },
      })
  })
  return saved.ok ? { ok: true, applied: 'invite' } : saved
}

/** An invite to an address that has an account: its role and capabilities, in one transaction. */
async function applyToAccount(
  actor: Actor,
  account: { id: string } & Capabilities,
  role: string | null,
  caps: Capabilities,
  confirmed: boolean,
): Promise<ActionResult<InviteApplied>> {
  const change = role === null ? null : await checkRoleChange(actor, account.id, role)
  if (change && !change.ok) return change
  const removes = CAPABILITY_KEYS.filter((c) => account[c] && !caps[c])
  if (removes.length > 0 && !confirmed) return { ok: true, applied: 'confirm', removes }
  const saved = await attempt('addRoleInvite', () =>
    db.transaction(async (tx) => {
      if (change) await writeRole(tx, account.id, change)
      await writeCapabilities(tx, account.id, caps)
      await tx.delete(session).where(eq(session.userId, account.id))
    }),
  )
  return saved.ok ? { ok: true, applied: 'account' } : saved
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
