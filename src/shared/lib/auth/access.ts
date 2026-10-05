// The one definition of roles and account rules. Pure on purpose: no database and no
// `server-only`, so a client component can import the same rules the server enforces.
// Callers pass roles read from the session or the database, never from a request.

/** The roles, in ascending privilege order (also drives the admin role select). */
export const ROLES = ['user', 'admin', 'superadmin'] as const

export type Role = (typeof ROLES)[number]

/** The roles an email address can hold before its owner first signs in. */
export const INVITE_ROLES = ['admin', 'superadmin'] as const

export type InviteRole = (typeof INVITE_ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** The admin pages and every admin action: admin and superadmin. */
export function canUseAdmin(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin'
}

/** Changing roles and naming email addresses with a role: superadmin only. */
export function canManageRoles(role: string | null | undefined): boolean {
  return role === 'superadmin'
}

/**
 * Whether an account with `actorRole` may act on an account with `targetRole`: a superadmin on
 * anyone, an admin on users only, a user on nobody. A target whose role is missing or unknown is
 * not a user, so an admin cannot act on it.
 */
export function canActOn(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
): boolean {
  if (actorRole === 'superadmin') return true
  return actorRole === 'admin' && targetRole === 'user'
}

/**
 * The role a new account starts with. The very first account on a fresh install is a superadmin,
 * so somebody can run the admin without any configuration; after that it is the role a
 * superadmin left waiting for the address, else user. Registration is open to everyone.
 */
export function resolveSignupRole(firstAccount: boolean, invitedRole: InviteRole | null): Role {
  if (firstAccount) return 'superadmin'
  return invitedRole ?? 'user'
}

/**
 * Two sign-ups overlapping on an empty database both see "no accounts" and both become
 * superadmin. Once the account exists, this settles it: a superadmin that owes the role to the
 * first-account rule (nothing waiting for its address gave it) keeps it only if it is the
 * superadmin that comes first; otherwise it takes the role a later account would have had.
 * Returns the role to set, or null to leave the account as it is. The caller decides who is
 * first by `(created_at, id)`, the same order for every racer, so exactly one survives.
 */
export function settleFirstAccountRole(i: {
  createdId: string
  createdRole: string
  invitedRole: InviteRole | null
  firstSuperadminId: string | null
}): Role | null {
  if (i.createdRole !== 'superadmin' || i.invitedRole === 'superadmin') return null
  if (i.firstSuperadminId === null || i.firstSuperadminId === i.createdId) return null
  return resolveSignupRole(false, i.invitedRole)
}

export type AccountAction = 'suspend' | 'reactivate' | 'signOut'

export const ACCESS_ERRORS = {
  notAuthorised: 'Not authorised.',
  rolesSuperadminOnly: 'Only a superadmin can change roles.',
  invalidRole: 'Invalid role.',
  ownRole: "You can't change your own role.",
  lastSuperadminRole: "You can't remove the last superadmin.",
  lastSuperadminSuspend: "You can't suspend the last superadmin.",
  ownAccount: "You can't do that to your own account.",
  hierarchy: 'Only a superadmin can act on admins and superadmins.',
} as const

/**
 * Why a role change must be refused, or null when it may go ahead. Checked in this order, the
 * first that applies wins. `activeSuperadmins` is the number of superadmins who are not
 * suspended; the caller counts them.
 */
export function roleChangeError(i: {
  actorUserId: string
  actorRole: string
  targetUserId: string
  targetRole: string
  newRole: string
  activeSuperadmins: number
}): string | null {
  if (!canManageRoles(i.actorRole)) return ACCESS_ERRORS.rolesSuperadminOnly
  if (!isRole(i.newRole)) return ACCESS_ERRORS.invalidRole
  if (i.actorUserId === i.targetUserId) return ACCESS_ERRORS.ownRole
  if (i.targetRole === 'superadmin' && i.newRole !== 'superadmin' && i.activeSuperadmins <= 1) {
    return ACCESS_ERRORS.lastSuperadminRole
  }
  return null
}

/**
 * Why an account action must be refused, or null when it may go ahead. Checked in this order,
 * the first that applies wins. On your own account the only action allowed is signing yourself
 * out, for any admin or superadmin; every other action there is refused. `activeSuperadmins` is
 * the number of superadmins who are not suspended; the caller counts them.
 */
export function accountActionError(i: {
  action: AccountAction
  actorUserId: string
  actorRole: string
  targetUserId: string
  targetRole: string
  activeSuperadmins: number
}): string | null {
  if (!canUseAdmin(i.actorRole)) return ACCESS_ERRORS.notAuthorised
  if (i.actorUserId === i.targetUserId) {
    return i.action === 'signOut' ? null : ACCESS_ERRORS.ownAccount
  }
  if (!canActOn(i.actorRole, i.targetRole)) return ACCESS_ERRORS.hierarchy
  if (i.action === 'suspend' && i.targetRole === 'superadmin' && i.activeSuperadmins <= 1) {
    return ACCESS_ERRORS.lastSuperadminSuspend
  }
  return null
}
