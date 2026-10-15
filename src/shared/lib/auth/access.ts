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

/** Which sign-in page a request came from: the student page at / or the admin page. */
export const SURFACES = ['student', 'admin'] as const

export type Surface = (typeof SURFACES)[number]

export function isSurface(value: unknown): value is Surface {
  return typeof value === 'string' && (SURFACES as readonly string[]).includes(value)
}

/** The codes a sign-in refused by its page carries (Better Auth's APIError body.code). */
export const SURFACE_ERRORS = {
  studentPageOnly: 'STUDENT_PAGE_ONLY',
  notAdmin: 'NOT_ADMIN',
} as const

/**
 * A first sign-in on a page: the role the new account gets, or the code to refuse it with (no
 * account is created then). The student page always makes a user, even on an empty database, so
 * nobody becomes superadmin by signing up as a student; an address an admin role is waiting for
 * belongs on the admin page, as does one a content capability is waiting for (ADR-108). The admin
 * page makes the first account ever a superadmin, applies a waiting role, makes a user of an
 * address only a capability waits for (the capabilities are copied by the caller), and refuses
 * everyone else.
 */
export function surfaceSignup(i: {
  surface: Surface
  firstAccount: boolean
  invitedRole: InviteRole | null
  invitedCapability?: boolean
}): { role: Role } | { refuse: string } {
  if (i.surface === 'student') {
    return i.invitedRole || i.invitedCapability
      ? { refuse: SURFACE_ERRORS.studentPageOnly }
      : { role: 'user' }
  }
  if (i.firstAccount) return { role: 'superadmin' }
  if (i.invitedRole) return { role: i.invitedRole }
  return i.invitedCapability ? { role: 'user' } : { refuse: SURFACE_ERRORS.notAdmin }
}

/**
 * A session about to open on a page: the code to refuse it with, or null. The student page opens
 * sessions for students only (isStudent); the admin page for anyone who may see the Board.
 */
export function surfaceSessionError(
  surface: Surface,
  role: string | null | undefined,
  capabilities: { editor?: boolean | null; reviewer?: boolean | null } = {},
): string | null {
  const account = { role, ...capabilities }
  if (surface === 'student') return isStudent(account) ? null : SURFACE_ERRORS.studentPageOnly
  return canSeeBoard(account) ? null : SURFACE_ERRORS.notAdmin
}

/** The student app (onboarding): accounts with role user only. */
export function canUseStudentApp(role: string | null | undefined): boolean {
  return role === 'user'
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
 * An account for the content rules: its role plus the two content capabilities (ADR-108), read
 * from the session or the database, never from a request. Missing flags count as false.
 */
export type Staff = {
  role: string | null | undefined
  editor?: boolean | null
  reviewer?: boolean | null
}

/** Making posts on the board: an editor, or a superadmin. */
export function canEdit(s: Staff): boolean {
  return s.role === 'superadmin' || s.editor === true
}

/** Approving and publishing posts: a reviewer, or a superadmin. */
export function canReview(s: Staff): boolean {
  return s.role === 'superadmin' || s.reviewer === true
}

/** Opening the admin's board: anyone who can edit or review, and every admin (read-only without a capability). */
export function canSeeBoard(s: Staff): boolean {
  return canEdit(s) || canReview(s) || canUseAdmin(s.role)
}

/** A student account, for the student app's sign-in page: role user with no content capability. */
export function isStudent(s: Staff): boolean {
  return s.role === 'user' && s.editor !== true && s.reviewer !== true
}

/** Why a change to an account's content capabilities must be refused, or null: superadmins only. */
export function contentRolesError(i: { actorRole: string | null | undefined }): string | null {
  return canManageRoles(i.actorRole) ? null : ACCESS_ERRORS.rolesSuperadminOnly
}

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
