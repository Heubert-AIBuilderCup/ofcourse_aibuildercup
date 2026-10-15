import { describe, expect, it } from 'bun:test'
import {
  ACCESS_ERRORS,
  type AccountAction,
  accountActionError,
  canActOn,
  canEdit,
  canManageRoles,
  canReview,
  canSeeBoard,
  canUseAdmin,
  canUseStudentApp,
  contentRolesError,
  INVITE_ROLES,
  isRole,
  isStudent,
  isSurface,
  ROLES,
  resolveSignupRole,
  roleChangeError,
  settleFirstAccountRole,
  surfaceSessionError,
  surfaceSignup,
} from './access'

describe('ROLES and INVITE_ROLES', () => {
  it('lists the roles in ascending privilege order', () => {
    expect(ROLES).toEqual(['user', 'admin', 'superadmin'])
  })

  it('lets an address be given admin or superadmin before it signs in, never user', () => {
    expect(INVITE_ROLES).toEqual(['admin', 'superadmin'])
  })
})

describe('isRole', () => {
  it('accepts the three roles', () => {
    for (const role of ['user', 'admin', 'superadmin']) {
      expect(isRole(role)).toBe(true)
    }
  })

  it('rejects the retired role names, other spellings and anything that is not a string', () => {
    for (const value of [
      'student',
      'internal',
      'Admin',
      ' admin',
      '',
      null,
      undefined,
      1,
      {},
      ['admin'],
    ]) {
      expect(isRole(value)).toBe(false)
    }
  })
})

describe('canUseAdmin', () => {
  it('is true for an admin and a superadmin', () => {
    expect(canUseAdmin('admin')).toBe(true)
    expect(canUseAdmin('superadmin')).toBe(true)
  })

  it('is false for a user, a missing role and the retired role names', () => {
    for (const role of ['user', 'internal', 'student', '', null, undefined]) {
      expect(canUseAdmin(role)).toBe(false)
    }
  })
})

describe('canManageRoles', () => {
  it('is for a superadmin only', () => {
    expect(canManageRoles('superadmin')).toBe(true)
    for (const role of ['admin', 'user', '', null, undefined]) {
      expect(canManageRoles(role)).toBe(false)
    }
  })
})

describe('canActOn', () => {
  it('lets a superadmin act on anyone', () => {
    expect(canActOn('superadmin', 'superadmin')).toBe(true)
    expect(canActOn('superadmin', 'admin')).toBe(true)
    expect(canActOn('superadmin', 'user')).toBe(true)
  })

  it('lets an admin act on users only', () => {
    expect(canActOn('admin', 'user')).toBe(true)
    expect(canActOn('admin', 'admin')).toBe(false)
    expect(canActOn('admin', 'superadmin')).toBe(false)
  })

  it('lets a user act on nobody', () => {
    expect(canActOn('user', 'user')).toBe(false)
    expect(canActOn(undefined, 'user')).toBe(false)
  })

  it('does not let an admin act on an account whose role is missing or unknown', () => {
    for (const targetRole of [null, undefined, '', 'internal', 'student']) {
      expect(canActOn('admin', targetRole)).toBe(false)
    }
  })
})

describe('resolveSignupRole', () => {
  it('makes the first account ever a superadmin, whatever is waiting for it', () => {
    expect(resolveSignupRole(true, null)).toBe('superadmin')
    expect(resolveSignupRole(true, 'admin')).toBe('superadmin')
    expect(resolveSignupRole(true, 'superadmin')).toBe('superadmin')
  })

  it('gives a later account its waiting role', () => {
    expect(resolveSignupRole(false, 'admin')).toBe('admin')
    expect(resolveSignupRole(false, 'superadmin')).toBe('superadmin')
  })

  it('makes a later account with nothing waiting a user', () => {
    expect(resolveSignupRole(false, null)).toBe('user')
  })
})

describe('settleFirstAccountRole', () => {
  // A just-created superadmin with nothing waiting for its address: the first-account rule gave
  // it the role, so it keeps it only if it is the superadmin that comes first.
  const first = { createdId: 'a', createdRole: 'superadmin', invitedRole: null }

  it('keeps the role when the account is the first superadmin', () => {
    expect(settleFirstAccountRole({ ...first, firstSuperadminId: 'a' })).toBeNull()
  })

  it('keeps the role when no superadmin is found at all', () => {
    expect(settleFirstAccountRole({ ...first, firstSuperadminId: null })).toBeNull()
  })

  it('demotes to user an account that lost the race for the first superadmin', () => {
    expect(settleFirstAccountRole({ ...first, firstSuperadminId: 'earlier' })).toBe('user')
  })

  it('gives a loser the role that was waiting for it instead of user', () => {
    expect(
      settleFirstAccountRole({ ...first, invitedRole: 'admin', firstSuperadminId: 'earlier' }),
    ).toBe('admin')
  })

  it('leaves alone a superadmin whose role was waiting for the address', () => {
    expect(
      settleFirstAccountRole({ ...first, invitedRole: 'superadmin', firstSuperadminId: 'earlier' }),
    ).toBeNull()
  })

  it('leaves alone an account that is not a superadmin', () => {
    for (const createdRole of ['user', 'admin']) {
      expect(
        settleFirstAccountRole({ ...first, createdRole, firstSuperadminId: 'earlier' }),
      ).toBeNull()
    }
  })
})

describe('surfaceSignup', () => {
  it('makes a student-page sign-up a user, even the first account ever', () => {
    expect(surfaceSignup({ surface: 'student', firstAccount: true, invitedRole: null })).toEqual({
      role: 'user',
    })
    expect(surfaceSignup({ surface: 'student', firstAccount: false, invitedRole: null })).toEqual({
      role: 'user',
    })
  })

  it('refuses a student-page sign-up for an address with a role waiting', () => {
    expect(
      surfaceSignup({ surface: 'student', firstAccount: false, invitedRole: 'admin' }),
    ).toEqual({ refuse: 'STUDENT_PAGE_ONLY' })
  })

  it('makes the first admin-page sign-up ever a superadmin', () => {
    expect(surfaceSignup({ surface: 'admin', firstAccount: true, invitedRole: null })).toEqual({
      role: 'superadmin',
    })
  })

  it('gives an admin-page sign-up the role waiting for its address', () => {
    expect(surfaceSignup({ surface: 'admin', firstAccount: false, invitedRole: 'admin' })).toEqual({
      role: 'admin',
    })
    expect(
      surfaceSignup({ surface: 'admin', firstAccount: false, invitedRole: 'superadmin' }),
    ).toEqual({ role: 'superadmin' })
  })

  it('refuses an admin-page sign-up with no role waiting', () => {
    expect(surfaceSignup({ surface: 'admin', firstAccount: false, invitedRole: null })).toEqual({
      refuse: 'NOT_ADMIN',
    })
  })

  it('makes an admin-page sign-up with only a content capability waiting a user (ADR-108)', () => {
    expect(
      surfaceSignup({
        surface: 'admin',
        firstAccount: false,
        invitedRole: null,
        invitedCapability: true,
      }),
    ).toEqual({ role: 'user' })
  })

  it('refuses a student-page sign-up for an address with a content capability waiting', () => {
    expect(
      surfaceSignup({
        surface: 'student',
        firstAccount: false,
        invitedRole: null,
        invitedCapability: true,
      }),
    ).toEqual({ refuse: 'STUDENT_PAGE_ONLY' })
  })
})

describe('surfaceSessionError', () => {
  it('lets a user open a session on the student page, and refuses an admin or superadmin', () => {
    expect(surfaceSessionError('student', 'user')).toBeNull()
    expect(surfaceSessionError('student', 'admin')).toBe('STUDENT_PAGE_ONLY')
    expect(surfaceSessionError('student', 'superadmin')).toBe('STUDENT_PAGE_ONLY')
  })

  it('refuses a missing or unknown role on the student page', () => {
    for (const role of [null, undefined, '', 'student', 'internal']) {
      expect(surfaceSessionError('student', role)).toBe('STUDENT_PAGE_ONLY')
    }
  })

  it('lets an admin or superadmin open a session on the admin page, and refuses everyone else', () => {
    expect(surfaceSessionError('admin', 'admin')).toBeNull()
    expect(surfaceSessionError('admin', 'superadmin')).toBeNull()
    expect(surfaceSessionError('admin', 'user')).toBe('NOT_ADMIN')
    expect(surfaceSessionError('admin', undefined)).toBe('NOT_ADMIN')
    expect(surfaceSessionError('admin', null)).toBe('NOT_ADMIN')
  })

  it('sends a user with a content capability to the admin page, never the student page (ADR-108)', () => {
    for (const caps of [{ editor: true }, { reviewer: true }, { editor: true, reviewer: true }]) {
      expect(surfaceSessionError('student', 'user', caps)).toBe('STUDENT_PAGE_ONLY')
      expect(surfaceSessionError('admin', 'user', caps)).toBeNull()
    }
    expect(surfaceSessionError('student', 'user', { editor: false, reviewer: false })).toBeNull()
    expect(surfaceSessionError('admin', 'user', { editor: false, reviewer: false })).toBe(
      'NOT_ADMIN',
    )
  })
})

describe('canUseStudentApp', () => {
  it('is for a user only', () => {
    expect(canUseStudentApp('user')).toBe(true)
    for (const role of ['admin', 'superadmin', '', null, undefined]) {
      expect(canUseStudentApp(role)).toBe(false)
    }
  })
})

describe('isSurface', () => {
  it('accepts the two surfaces and nothing else', () => {
    expect(isSurface('student')).toBe(true)
    expect(isSurface('admin')).toBe(true)
    for (const value of ['Admin', ' admin', '', null, undefined, 1, {}, ['admin']]) {
      expect(isSurface(value)).toBe(false)
    }
  })
})

describe('ACCESS_ERRORS', () => {
  it('holds the exact messages the admin shows', () => {
    expect(ACCESS_ERRORS).toEqual({
      notAuthorised: 'Not authorised.',
      rolesSuperadminOnly: 'Only a superadmin can change roles.',
      invalidRole: 'Invalid role.',
      ownRole: "You can't change your own role.",
      lastSuperadminRole: "You can't remove the last superadmin.",
      lastSuperadminSuspend: "You can't suspend the last superadmin.",
      ownAccount: "You can't do that to your own account.",
      hierarchy: 'Only a superadmin can act on admins and superadmins.',
    })
  })
})

describe('roleChangeError', () => {
  const base = {
    actorUserId: 'actor',
    actorRole: 'superadmin',
    targetUserId: 'target',
    targetRole: 'user',
    newRole: 'admin',
    activeSuperadmins: 2,
  }

  it('lets a superadmin promote a user to admin', () => {
    expect(roleChangeError(base)).toBeNull()
  })

  it('lets a superadmin demote another superadmin while two are active', () => {
    expect(roleChangeError({ ...base, targetRole: 'superadmin', newRole: 'admin' })).toBeNull()
  })

  it('refuses anyone who is not a superadmin', () => {
    for (const actorRole of ['admin', 'user', '']) {
      expect(roleChangeError({ ...base, actorRole })).toBe(ACCESS_ERRORS.rolesSuperadminOnly)
    }
  })

  it('refuses a role that does not exist, including the retired names', () => {
    for (const newRole of ['wizard', 'internal', 'student', 'Admin', '']) {
      expect(roleChangeError({ ...base, newRole })).toBe(ACCESS_ERRORS.invalidRole)
    }
  })

  it('refuses a superadmin changing their own role', () => {
    expect(roleChangeError({ ...base, targetUserId: 'actor', targetRole: 'superadmin' })).toBe(
      ACCESS_ERRORS.ownRole,
    )
  })

  it('refuses to remove the last superadmin', () => {
    const demote = { ...base, targetRole: 'superadmin', newRole: 'admin' }
    expect(roleChangeError({ ...demote, activeSuperadmins: 1 })).toBe(
      ACCESS_ERRORS.lastSuperadminRole,
    )
    expect(roleChangeError({ ...demote, activeSuperadmins: 0 })).toBe(
      ACCESS_ERRORS.lastSuperadminRole,
    )
  })

  it('does not count keeping the superadmin role as removing it', () => {
    expect(
      roleChangeError({
        ...base,
        targetRole: 'superadmin',
        newRole: 'superadmin',
        activeSuperadmins: 1,
      }),
    ).toBeNull()
  })

  it('does not apply the last-superadmin rule to anyone who is not a superadmin', () => {
    expect(
      roleChangeError({ ...base, targetRole: 'admin', newRole: 'user', activeSuperadmins: 1 }),
    ).toBeNull()
  })

  describe('when more than one rule applies, the first in this order wins', () => {
    it('checks the actor before the new role', () => {
      expect(roleChangeError({ ...base, actorRole: 'admin', newRole: 'wizard' })).toBe(
        ACCESS_ERRORS.rolesSuperadminOnly,
      )
    })

    it('checks the new role before who the target is', () => {
      expect(roleChangeError({ ...base, targetUserId: 'actor', newRole: 'wizard' })).toBe(
        ACCESS_ERRORS.invalidRole,
      )
    })

    it('checks the target is not the actor before the last superadmin', () => {
      expect(
        roleChangeError({
          ...base,
          targetUserId: 'actor',
          targetRole: 'superadmin',
          newRole: 'user',
          activeSuperadmins: 1,
        }),
      ).toBe(ACCESS_ERRORS.ownRole)
    })
  })
})

describe('accountActionError', () => {
  type ActionInput = Parameters<typeof accountActionError>[0]

  const ACTIONS: AccountAction[] = ['suspend', 'reactivate', 'signOut']
  const notSuspend = ACTIONS.filter((action) => action !== 'suspend')
  const notSignOut = ACTIONS.filter((action) => action !== 'signOut')

  // An admin suspending a user, with two superadmins active.
  const base: ActionInput = {
    action: 'suspend',
    actorUserId: 'actor',
    actorRole: 'admin',
    targetUserId: 'target',
    targetRole: 'user',
    activeSuperadmins: 2,
  }
  // A superadmin acting on their own account.
  const ownSuperadmin: ActionInput = {
    ...base,
    actorUserId: 'me',
    actorRole: 'superadmin',
    targetUserId: 'me',
    targetRole: 'superadmin',
  }

  it('lets an admin suspend a user', () => {
    expect(accountActionError(base)).toBeNull()
  })

  it('lets an admin use every action on a user', () => {
    for (const action of ACTIONS) {
      expect(accountActionError({ ...base, action })).toBeNull()
    }
  })

  it('refuses an admin acting on an admin or a superadmin', () => {
    for (const targetRole of ['admin', 'superadmin']) {
      for (const action of ACTIONS) {
        expect(accountActionError({ ...base, targetRole, action })).toBe(ACCESS_ERRORS.hierarchy)
      }
    }
  })

  it('lets a superadmin suspend an admin', () => {
    expect(accountActionError({ ...base, actorRole: 'superadmin', targetRole: 'admin' })).toBeNull()
  })

  it('lets a superadmin use every action on an admin or another superadmin', () => {
    for (const targetRole of ['admin', 'superadmin']) {
      for (const action of ACTIONS) {
        expect(
          accountActionError({ ...base, actorRole: 'superadmin', targetRole, action }),
        ).toBeNull()
      }
    }
  })

  it('refuses anyone suspending themselves', () => {
    expect(accountActionError({ ...base, actorUserId: 'me', targetUserId: 'me' })).toBe(
      ACCESS_ERRORS.ownAccount,
    )
    expect(accountActionError(ownSuperadmin)).toBe(ACCESS_ERRORS.ownAccount)
  })

  it('refuses every action on your own account except signing out', () => {
    for (const action of notSignOut) {
      expect(accountActionError({ ...ownSuperadmin, action })).toBe(ACCESS_ERRORS.ownAccount)
    }
  })

  it('lets a superadmin sign themselves out everywhere', () => {
    expect(accountActionError({ ...ownSuperadmin, action: 'signOut' })).toBeNull()
  })

  it('lets an admin sign themselves out everywhere, but not another admin', () => {
    const signOutAdmin: ActionInput = { ...base, action: 'signOut', targetRole: 'admin' }
    expect(
      accountActionError({ ...signOutAdmin, actorUserId: 'me', targetUserId: 'me' }),
    ).toBeNull()
    expect(accountActionError(signOutAdmin)).toBe(ACCESS_ERRORS.hierarchy)
  })

  it('lets an admin do nothing else to their own account', () => {
    const ownAdmin: ActionInput = {
      ...base,
      actorUserId: 'me',
      targetUserId: 'me',
      targetRole: 'admin',
    }
    for (const action of notSignOut) {
      expect(accountActionError({ ...ownAdmin, action })).toBe(ACCESS_ERRORS.ownAccount)
    }
  })

  it('refuses to suspend the only active superadmin', () => {
    // The actor is a different superadmin from the target.
    const target = { ...base, actorRole: 'superadmin', targetRole: 'superadmin' }
    expect(accountActionError({ ...target, activeSuperadmins: 1 })).toBe(
      ACCESS_ERRORS.lastSuperadminSuspend,
    )
    expect(accountActionError({ ...target, activeSuperadmins: 0 })).toBe(
      ACCESS_ERRORS.lastSuperadminSuspend,
    )
  })

  it('lets a superadmin suspend another superadmin while two are active', () => {
    expect(
      accountActionError({ ...base, actorRole: 'superadmin', targetRole: 'superadmin' }),
    ).toBeNull()
  })

  it('keeps the last-superadmin rule to suspending a superadmin', () => {
    for (const action of notSuspend) {
      expect(
        accountActionError({
          ...base,
          action,
          actorRole: 'superadmin',
          targetRole: 'superadmin',
          activeSuperadmins: 1,
        }),
      ).toBeNull()
    }
    expect(
      accountActionError({
        ...base,
        actorRole: 'superadmin',
        targetRole: 'admin',
        activeSuperadmins: 1,
      }),
    ).toBeNull()
  })

  it('refuses a user, or a role it does not know, before anything else', () => {
    for (const actorRole of ['user', 'internal', '']) {
      for (const action of ACTIONS) {
        expect(accountActionError({ ...base, actorRole, action })).toBe(ACCESS_ERRORS.notAuthorised)
      }
    }
  })

  describe('when more than one rule applies, the first in this order wins', () => {
    it('checks that the actor can use the admin before letting them sign themselves out', () => {
      expect(
        accountActionError({
          ...base,
          actorRole: 'user',
          action: 'signOut',
          actorUserId: 'me',
          targetUserId: 'me',
        }),
      ).toBe(ACCESS_ERRORS.notAuthorised)
    })

    it('checks your own account before who may act on whom', () => {
      expect(
        accountActionError({ ...base, targetRole: 'admin', actorUserId: 'me', targetUserId: 'me' }),
      ).toBe(ACCESS_ERRORS.ownAccount)
    })

    it('checks who may act on whom before the last superadmin', () => {
      expect(accountActionError({ ...base, targetRole: 'superadmin', activeSuperadmins: 1 })).toBe(
        ACCESS_ERRORS.hierarchy,
      )
    })
  })
})

describe('content capabilities', () => {
  const s = (role: string, editor = false, reviewer = false) => ({ role, editor, reviewer })
  it('lets editors and superadmins edit, nobody else', () => {
    expect([s('user', true), s('admin', true), s('superadmin')].map(canEdit)).toEqual([
      true,
      true,
      true,
    ])
    expect([s('user'), s('user', false, true), s('admin'), { role: null }].map(canEdit)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })
  it('lets reviewers and superadmins review, nobody else', () => {
    expect(
      [s('user', false, true), s('admin', false, true), s('superadmin')].map(canReview),
    ).toEqual([true, true, true])
    expect([s('user'), s('user', true), s('admin')].map(canReview)).toEqual([false, false, false])
  })
  it('shows the board to every staff account, never to a student', () => {
    expect(
      [s('user', true), s('user', false, true), s('admin'), s('superadmin')].map(canSeeBoard),
    ).toEqual([true, true, true, true])
    expect([s('user'), { role: undefined }].map(canSeeBoard)).toEqual([false, false])
  })
  it('keeps the users admin to admins and superadmins', () => {
    expect(canUseAdmin(s('user', true, true).role)).toBe(false)
  })
  it('treats only a user with no capability as a student', () => {
    expect(isStudent(s('user'))).toBe(true)
    for (const x of [s('user', true), s('user', false, true), s('admin'), s('superadmin')])
      expect(isStudent(x)).toBe(false)
  })
  it('lets only a superadmin change capabilities', () => {
    expect(contentRolesError({ actorRole: 'admin' })).toBe(ACCESS_ERRORS.rolesSuperadminOnly)
    expect(contentRolesError({ actorRole: 'superadmin' })).toBeNull()
  })
})
