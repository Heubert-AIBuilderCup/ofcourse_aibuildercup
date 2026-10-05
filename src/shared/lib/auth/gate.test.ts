import { describe, expect, it } from 'bun:test'
import { isAdminPath, isAppPath, safeNextPath, signinErrorTarget, welcomeUrl } from './gate'

describe('isAppPath', () => {
  it('covers the dashboard and its sub-pages', () => {
    expect(isAppPath('/dashboard')).toBe(true)
    expect(isAppPath('/dashboard/settings')).toBe(true)
  })

  it('leaves the public pages alone, the sign-in page at / included', () => {
    for (const path of ['/', '/suspended', '/signin-error']) {
      expect(isAppPath(path)).toBe(false)
    }
  })

  it('matches whole segments only', () => {
    expect(isAppPath('/dashboardx')).toBe(false)
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

describe('welcomeUrl', () => {
  const at = (path: string) => new URL(path, 'http://localhost:3000')

  it('sends a signed-out visitor to the sign-in page at /, remembering the page', () => {
    const url = welcomeUrl(at('/admin/users'))
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('?next=%2Fadmin%2Fusers')
  })

  it('does not remember home as the page asked for', () => {
    const url = welcomeUrl(at('/dashboard'))
    expect(url.pathname).toBe('/')
    expect(url.search).toBe('')
  })

  it('remembers the page asked for, without its query', () => {
    expect(welcomeUrl(at('/admin/users?q=x')).searchParams.get('next')).toBe('/admin/users')
  })
})

describe('safeNextPath', () => {
  it('accepts an app or admin path', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard')
    expect(safeNextPath('/admin/users')).toBe('/admin/users')
  })

  it('keeps / as itself and gives null for nothing, so callers pick the default', () => {
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath(null)).toBeNull()
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

  it('sends every other failed sign-in back to the sign-in page with its message', () => {
    expect(signinErrorTarget('unable_to_create_user')).toBe('/?error=signin')
    expect(signinErrorTarget(null)).toBe('/?error=signin')
  })
})
