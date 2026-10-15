import { describe, expect, it } from 'bun:test'
import type { Staff } from './access'
import {
  ADMIN_SIGNIN_PATH,
  adminHome,
  adminSigninErrorTarget,
  appPageRedirect,
  BLOG_PATH,
  BOARD_PATH,
  FEED_PATH,
  HOME_PATH,
  isAdminPath,
  isAdminSignInPath,
  isAppPath,
  POSTS_PATH,
  SIGNIN_MESSAGES,
  safeNextPath,
  signinErrorTarget,
  USERS_PATH,
  welcomeUrl,
} from './gate'

describe('HOME_PATH', () => {
  it('is /start, where a signed-in student lands', () => {
    expect(HOME_PATH).toBe('/start')
  })
})

describe('isAppPath', () => {
  it('covers the student pages and their sub-pages', () => {
    for (const path of [
      '/start',
      '/onboarding',
      '/onboarding/character',
      '/onboarding/facts/who-pays',
      '/onboarding/study',
      '/roadmaps',
      '/roadmaps/abc/learn/masters-years',
      '/road',
    ]) {
      expect(isAppPath(path)).toBe(true)
    }
  })

  it('covers the student feed and its post pages', () => {
    expect(FEED_PATH).toBe('/feed')
    expect(isAppPath('/feed')).toBe(true)
    expect(isAppPath('/feed/abc')).toBe(true)
    expect(isAppPath('/feedx')).toBe(false)
  })

  it('leaves the public pages alone, the sign-in page at / included', () => {
    for (const path of ['/', '/suspended', '/signin-error']) {
      expect(isAppPath(path)).toBe(false)
    }
  })

  it('no longer covers the retired onboarding paths, which next.config redirects first', () => {
    for (const path of ['/picture', '/opening/facts', '/opening/study', '/futures', '/attention']) {
      expect(isAppPath(path)).toBe(false)
    }
  })

  it('leaves the public pages alone, the sign-in pages included', () => {
    for (const path of ['/', '/dashboard', '/suspended', '/signin-error', '/admin/sign-in']) {
      expect(isAppPath(path)).toBe(false)
    }
  })

  it('matches whole segments only', () => {
    expect(isAppPath('/startx')).toBe(false)
  })
})

describe('POSTS_PATH', () => {
  it("is /posts: a live post's public page, outside every signed-in path (107, ADR-131)", () => {
    expect(POSTS_PATH).toBe('/posts')
    for (const path of ['/posts', '/posts/paid-work-in-the-feed', '/posts/assets/abc']) {
      expect(isAppPath(path)).toBe(false)
      expect(isAdminPath(path)).toBe(false)
    }
  })
})

describe('BLOG_PATH', () => {
  it("is /blog: a live blog's public page, outside every signed-in path (BR9)", () => {
    expect(BLOG_PATH).toBe('/blog')
    for (const path of ['/blog', '/blog/how-many-hours', '/blog/assets/abc']) {
      expect(isAppPath(path)).toBe(false)
      expect(isAdminPath(path)).toBe(false)
    }
  })
})

describe('appPageRedirect', () => {
  const student = { role: 'user', editor: false, reviewer: false }
  const staff = {
    editor: { role: 'user', editor: true, reviewer: false },
    reviewer: { role: 'user', editor: false, reviewer: true },
    admin: { role: 'admin', editor: false, reviewer: false },
    superadmin: { role: 'superadmin', editor: false, reviewer: false },
  }
  const suspended = (account: Staff) => ({ ...account, suspendedAt: new Date('2026-10-01') })

  it('lets a student and every staff account open the feed and its post pages (71, ADR-121)', () => {
    for (const account of [student, ...Object.values(staff)]) {
      expect(appPageRedirect('/feed', account)).toBeNull()
      expect(appPageRedirect('/feed/abc', account)).toBeNull()
    }
  })

  it('sends a suspended account to the suspended page, the feed included', () => {
    for (const account of [student, staff.editor, staff.admin]) {
      expect(appPageRedirect('/feed', suspended(account))).toBe('/suspended')
      expect(appPageRedirect('/feed/abc', suspended(account))).toBe('/suspended')
      expect(appPageRedirect('/onboarding/welcome', suspended(account))).toBe('/suspended')
    }
  })

  it('keeps the student pages for students: staff go straight to their admin home, in one hop', () => {
    expect(appPageRedirect('/onboarding/welcome', student)).toBeNull()
    expect(appPageRedirect('/start', student)).toBeNull()
    expect(appPageRedirect('/roadmaps', student)).toBeNull()
    for (const account of Object.values(staff)) {
      expect(appPageRedirect('/onboarding/welcome', account)).toBe(adminHome(account))
      expect(appPageRedirect('/start', account)).toBe(adminHome(account))
      expect(appPageRedirect('/roadmaps', account)).toBe(adminHome(account))
    }
    expect(appPageRedirect('/start', staff.admin)).toBe('/admin/users')
    expect(appPageRedirect('/start', staff.editor)).toBe('/admin/board')
  })

  it('opens only the feed to staff, not a path that merely starts like it', () => {
    expect(appPageRedirect('/feedx', staff.editor)).toBe(BOARD_PATH)
  })
})

describe('isAdminPath', () => {
  it('covers /admin and everything under it', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/users')).toBe(true)
    expect(isAdminPath('/administrator')).toBe(false)
    expect(isAdminPath('/')).toBe(false)
  })
})

describe('admin paths', () => {
  it('puts the Board and the admin sign-in page under /admin', () => {
    expect(BOARD_PATH).toBe('/admin/board')
    expect(ADMIN_SIGNIN_PATH).toBe('/admin/sign-in')
  })
})

describe('isAdminSignInPath', () => {
  it('covers the admin sign-in page only', () => {
    expect(isAdminSignInPath('/admin/sign-in')).toBe(true)
    expect(isAdminSignInPath('/admin/users')).toBe(false)
    expect(isAdminSignInPath('/admin')).toBe(false)
  })

  it('is false for anything under it, beside it or elsewhere in the admin', () => {
    for (const path of ['/admin/sign-in/x', '/admin/sign-inx', '/admin/board', '/admin', '/']) {
      expect(isAdminSignInPath(path)).toBe(false)
    }
  })
})

describe('welcomeUrl', () => {
  const at = (path: string) => new URL(path, 'http://localhost:3000')

  it('sends a signed-out visitor to an admin page to the admin sign-in page, remembering the page', () => {
    const url = welcomeUrl(at('/admin/users'))
    expect(url.pathname).toBe('/admin/sign-in')
    expect(url.searchParams.get('next')).toBe('/admin/users')
  })

  it('sends a signed-out visitor to a student page to the sign-in page at /, remembering the page', () => {
    const url = welcomeUrl(at('/onboarding/study'))
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('?next=%2Fonboarding%2Fstudy')
  })

  it('sends a signed-out visitor to the feed or a post to the sign-in page, remembering it (78)', () => {
    expect(welcomeUrl(at('/feed')).toString()).toBe('http://localhost:3000/?next=%2Ffeed')
    expect(welcomeUrl(at('/feed/abc')).toString()).toBe('http://localhost:3000/?next=%2Ffeed%2Fabc')
  })

  it('does not remember home as the page asked for', () => {
    const url = welcomeUrl(at('/start'))
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('')
  })

  it('does not remember the admin home either', () => {
    const url = welcomeUrl(at('/admin'))
    expect(url.pathname).toBe('/admin/sign-in')
    expect(url.search).toBe('')
  })

  it('remembers the page asked for, without its query', () => {
    expect(welcomeUrl(at('/admin/users?q=x')).searchParams.get('next')).toBe('/admin/users')
  })
})

describe('safeNextPath', () => {
  it('accepts a student or admin path', () => {
    expect(safeNextPath('/start')).toBe('/start')
    expect(safeNextPath('/admin/users')).toBe('/admin/users')
    expect(safeNextPath('/feed/abc')).toBe('/feed/abc')
  })

  it('keeps / as itself and gives null for nothing, so callers pick the default', () => {
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath(null)).toBeNull()
  })

  it('never loops back to the admin sign-in page', () => {
    expect(safeNextPath('/admin/sign-in')).toBeNull()
  })

  it('accepts an onboarding screen', () => {
    expect(safeNextPath('/onboarding/facts/who-pays')).toBe('/onboarding/facts/who-pays')
  })

  it('accepts her roadmaps, one roadmap, a new one, and /road (a redirect)', () => {
    expect(safeNextPath('/roadmaps')).toBe('/roadmaps')
    expect(safeNextPath('/roadmaps/abc')).toBe('/roadmaps/abc')
    expect(safeNextPath('/roadmaps/new')).toBe('/roadmaps/new')
    expect(safeNextPath('/roadmaps/abc/learn/masters-years')).toBe(
      '/roadmaps/abc/learn/masters-years',
    )
    expect(safeNextPath('/road')).toBe('/road')
  })

  it('refuses the retired dashboard', () => {
    expect(safeNextPath('/dashboard')).toBeNull()
  })

  it('refuses the paths next.config redirects before the proxy runs', () => {
    expect(safeNextPath('/futures')).toBeNull()
    expect(safeNextPath('/attention')).toBeNull()
  })

  it('refuses anything that could leave the site or is not a page of the app', () => {
    for (const value of [
      'https://evil.example/',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '/api/auth/sign-out',
      'dashboard',
      '',
      null,
      undefined,
    ]) {
      expect(safeNextPath(value)).toBeNull()
    }
  })
})

describe('signinErrorTarget', () => {
  it('sends a sign-in refused for a suspended account to the suspended page', () => {
    expect(signinErrorTarget('ACCOUNT_SUSPENDED')).toBe('/suspended')
  })

  it('sends an admin account refused on the student page back with its message', () => {
    expect(signinErrorTarget('STUDENT_PAGE_ONLY')).toBe('/?error=student-only')
  })

  it('sends every other failed sign-in back to the sign-in page with its message', () => {
    expect(signinErrorTarget('unable_to_create_user')).toBe('/?error=signin')
    expect(signinErrorTarget(null)).toBe('/?error=signin')
  })
})

describe('adminSigninErrorTarget', () => {
  it('sends a sign-in refused for a suspended account to the suspended page', () => {
    expect(adminSigninErrorTarget('ACCOUNT_SUSPENDED')).toBe('/suspended')
  })

  it('sends an account without admin access back to the admin sign-in page with its message', () => {
    expect(adminSigninErrorTarget('NOT_ADMIN')).toBe('/admin/sign-in?error=not-admin')
  })

  it('sends every other failed sign-in back to the admin sign-in page with its message', () => {
    expect(adminSigninErrorTarget('unable_to_create_user')).toBe('/admin/sign-in?error=signin')
    expect(adminSigninErrorTarget(null)).toBe('/admin/sign-in?error=signin')
  })
})

describe('SIGNIN_MESSAGES', () => {
  it('holds the exact messages the two sign-in pages show', () => {
    expect(SIGNIN_MESSAGES.signin).toBe('Google sign-in did not finish. Try again.')
    expect(SIGNIN_MESSAGES['student-only']).toBe(
      'This page is for students. This account signs in on the admin page.',
    )
    expect(SIGNIN_MESSAGES['not-admin']).toBe("This account doesn't have admin access.")
  })
})

describe('adminHome', () => {
  // Editors and reviewers land on the Board (admin intent criterion 11); an admin who holds
  // neither keeps the users admin as home (admin intent, Users; Jenish's admin-session e2e).
  it('opens the Board for an editor, a reviewer or a superadmin', () => {
    expect(adminHome({ role: 'user', editor: true })).toBe(BOARD_PATH)
    expect(adminHome({ role: 'user', reviewer: true })).toBe(BOARD_PATH)
    expect(adminHome({ role: 'admin', editor: true })).toBe(BOARD_PATH)
    expect(adminHome({ role: 'superadmin' })).toBe(BOARD_PATH)
  })

  it('opens Users for an admin with neither capability', () => {
    expect(adminHome({ role: 'admin' })).toBe(USERS_PATH)
    expect(USERS_PATH).toBe('/admin/users')
  })
})
