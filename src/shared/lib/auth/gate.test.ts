import { describe, expect, it } from 'bun:test'
import {
  adminSigninErrorTarget,
  HOME_PATH,
  isAdminPath,
  isAdminSignInPath,
  SIGNIN_MESSAGES,
  safeNextPath,
  signinErrorTarget,
  welcomeUrl,
} from './gate'

describe('HOME_PATH', () => {
  it('is /start, where a signed-in student lands', () => {
    expect(HOME_PATH).toBe('/start')
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

describe('isAdminSignInPath', () => {
  it('covers the admin sign-in page only', () => {
    expect(isAdminSignInPath('/admin/sign-in')).toBe(true)
    expect(isAdminSignInPath('/admin/users')).toBe(false)
    expect(isAdminSignInPath('/admin')).toBe(false)
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
