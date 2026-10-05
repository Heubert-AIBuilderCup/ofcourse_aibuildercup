import { describe, expect, it } from 'bun:test'
import {
  ACCESS_ERRORS,
  type AccountAction,
  accountActionError,
  canActOn,
  canManageRoles,
  canUseAdmin,
  INVITE_ROLES,
  isRole,
  ROLES,
  resolveSignupRole,
  roleChangeError,
  settleFirstAccountRole,
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
