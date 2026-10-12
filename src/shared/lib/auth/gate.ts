// Who may see which page: the pure rules behind src/proxy.ts and the (app) layout.
// The proxy is an optimistic cookie check; every page and server action still reads the
// session itself (getSession / requireSession / requireAdmin in ./session).

import { SURFACE_ERRORS } from './access'

/** Public: the sign-in page. Signed in, it moves on to HOME_PATH. */
export const SIGNIN_PATH = '/'
/** The signed-in home: where a student lands, and from where she resumes. */
export const HOME_PATH = '/start'
/** Public: "This account is suspended", where a suspended account is sent instead of the app. */
export const SUSPENDED_PATH = '/suspended'
/** Public: where Better Auth sends a failed Google sign-in, appending `?error=<code>`. */
export const SIGNIN_ERROR_PATH = '/signin-error'

/** The code of a sign-in refused because the account is suspended (the session hook in ./index). */
export const ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED'

/** The admin console, and the admin sign-in page, which sits outside its admin-only layout. */
export const ADMIN_PATH = '/admin'
export const ADMIN_SIGNIN_PATH = '/admin/sign-in'
/** Public: where Better Auth sends a failed admin Google sign-in, appending `?error=<code>`. */
export const ADMIN_SIGNIN_ERROR_PATH = '/signin-error/admin'

/** The student app. Keep in step with the proxy matcher in src/proxy.ts. */
export const APP_PATHS = ['/start', '/onboarding'] as const

// Pages a sign-in may return to.
const RETURN_PATHS = [...APP_PATHS, ADMIN_PATH] as const

const underPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

export function isAdminPath(pathname: string): boolean {
  return underPrefix(pathname, ADMIN_PATH)
}

export function isAdminSignInPath(pathname: string): boolean {
  return underPrefix(pathname, ADMIN_SIGNIN_PATH)
}

/**
 * Where a signed-out visitor goes, keeping the page they asked for: the admin sign-in page for an
 * admin page, the sign-in page at / for everything else. Neither home is remembered.
 */
export function welcomeUrl(requested: URL): URL {
  const admin = isAdminPath(requested.pathname)
  const url = new URL(admin ? ADMIN_SIGNIN_PATH : SIGNIN_PATH, requested)
  const home = admin ? ADMIN_PATH : HOME_PATH
  if (requested.pathname !== home) url.searchParams.set('next', requested.pathname)
  return url
}

const SAFE_PATH = /^\/[A-Za-z0-9/_-]*$/

/** A `next` value that is a page of this app, or null: never another origin, never a scheme. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !SAFE_PATH.test(value) || value.startsWith('//')) return null
  if (underPrefix(value, ADMIN_SIGNIN_PATH)) return null
  if (value === '/' || RETURN_PATHS.some((prefix) => underPrefix(value, prefix))) return value
  return null
}

/** The `?error=` values the two sign-in pages understand, and what each says. */
export const SIGNIN_MESSAGES = {
  signin: 'Google sign-in did not finish. Try again.',
  'student-only': 'This page is for students. This account signs in on the admin page.',
  'not-admin': "This account doesn't have admin access.",
} as const

/**
 * Where a failed student-page sign-in leads, from Better Auth's error code: the suspended page for
 * a suspended account, the sign-in page with its "students only" message for an account that
 * belongs on the admin page, else the sign-in page with its "did not finish" message. Only these
 * fixed paths, so the code in the URL is never echoed and can never send anyone elsewhere.
 */
export function signinErrorTarget(code: string | null): string {
  if (code === ACCOUNT_SUSPENDED) return SUSPENDED_PATH
  if (code === SURFACE_ERRORS.studentPageOnly) return `${SIGNIN_PATH}?error=student-only`
  return `${SIGNIN_PATH}?error=signin`
}

/** The same for the admin page: its own fixed paths, the code in the URL never echoed. */
export function adminSigninErrorTarget(code: string | null): string {
  if (code === ACCOUNT_SUSPENDED) return SUSPENDED_PATH
  if (code === SURFACE_ERRORS.notAdmin) return `${ADMIN_SIGNIN_PATH}?error=not-admin`
  return `${ADMIN_SIGNIN_PATH}?error=signin`
}
