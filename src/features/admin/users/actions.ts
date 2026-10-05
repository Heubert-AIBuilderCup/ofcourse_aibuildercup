'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ACCESS_ERRORS } from '@/shared/lib/auth/access'
import { getSession } from '@/shared/lib/auth/session'
import type { ActionResult } from '@/shared/types/action-result'
import {
  type Actor,
  addRoleInviteAs,
  reactivateAs,
  removeRoleInviteAs,
  setRoleAs,
  signOutEverywhereAs,
  suspendAs,
} from './commands'

// The account actions the admin's users pages call. Each one reads the actor from the session
// (the proxy and the layout only hide the pages), checks the browser's input with zod, hands
// both to its command in ./commands.ts, which applies every access rule, and on success
// refreshes the users pages.

const SIGN_IN = 'Please sign in again.'
const UNKNOWN = 'Unknown account.'
const INVALID_EMAIL = 'Enter a valid email address.'

const userId = z.string().min(1).max(64)
const role = z.string().max(32)
const email = z.string().max(1_000)
// A reason of any length is cut to well past the 200 the command allows, so it still refuses it;
// anything that is not text reads as no reason.
const reason = z
  .string()
  .transform((s) => s.slice(0, 1_000))
  .catch('')

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

async function asActor<T extends object>(
  run: (actor: Actor) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const s = await getSession()
  if (!s) return fail(SIGN_IN)
  return run({ id: s.user.id, role: s.user.role ?? '' })
}

/** The users list and the account's page. */
function accountChanged(id: string) {
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${id}`)
}

/** Change an account's role (superadmins only); its sessions end at once. */
export async function setRole(target: unknown, newRole: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const id = userId.safeParse(target)
    if (!id.success) return fail(UNKNOWN)
    const r = role.safeParse(newRole)
    if (!r.success) return fail(ACCESS_ERRORS.invalidRole)
    const result = await setRoleAs(actor, id.data, r.data)
    if (result.ok) accountChanged(id.data)
    return result
  })
}

/** Give an address a role before its first sign-in, or an existing account the role at once. */
export async function addRoleInvite(
  address: unknown,
  inviteRole: unknown,
): Promise<ActionResult<{ applied: 'invite' | 'account' }>> {
  return asActor(async (actor) => {
    const e = email.safeParse(address)
    if (!e.success) return fail(INVALID_EMAIL)
    const r = role.safeParse(inviteRole)
    if (!r.success) return fail(ACCESS_ERRORS.invalidRole)
    const result = await addRoleInviteAs(actor, e.data, r.data)
    if (result.ok) {
      // An existing account's role changed: its page (under this layout) too.
      revalidatePath('/admin/users', result.applied === 'account' ? 'layout' : undefined)
    }
    return result
  })
}

/** Stop an address waiting with a role (superadmins only). */
export async function removeRoleInvite(address: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const e = email.safeParse(address)
    if (!e.success) return fail(INVALID_EMAIL)
    const result = await removeRoleInviteAs(actor, e.data)
    if (result.ok) revalidatePath('/admin/users')
    return result
  })
}

/** Suspend an account with a reason; its sessions end at once. */
export async function suspendAccount(target: unknown, why: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const id = userId.safeParse(target)
    if (!id.success) return fail(UNKNOWN)
    const result = await suspendAs(actor, id.data, reason.parse(why))
    if (result.ok) accountChanged(id.data)
    return result
  })
}

/** Lift a suspension. */
export async function reactivateAccount(target: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const id = userId.safeParse(target)
    if (!id.success) return fail(UNKNOWN)
    const result = await reactivateAs(actor, id.data)
    if (result.ok) accountChanged(id.data)
    return result
  })
}

/** End every session of an account; it stays active. */
export async function signOutEverywhere(target: unknown): Promise<ActionResult> {
  return asActor(async (actor) => {
    const id = userId.safeParse(target)
    if (!id.success) return fail(UNKNOWN)
    const result = await signOutEverywhereAs(actor, id.data)
    if (result.ok) accountChanged(id.data)
    return result
  })
}
