// Who may see which page: the pure rules behind src/proxy.ts and the (app) layout.
// The proxy is an optimistic cookie check; every page and server action still reads the
// session itself (getSession / requireSession / requireAdmin in ./session).

/** Public: the sign-in page. Signed in, it moves on to HOME_PATH. */
export const WELCOME_PATH = '/'
/** The signed-in home. */
export const HOME_PATH = '/dashboard'
/** Public: "This account is suspended", where a suspended account is sent instead of the app. */
export const SUSPENDED_PATH = '/suspended'
/** Public: where Better Auth sends a failed Google sign-in, appending `?error=<code>`. */
export const SIGNIN_ERROR_PATH = '/signin-error'

/** The code of a sign-in refused because the account is suspended (the session hook in ./index). */
export const ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED'

/** The signed-in app. Keep in step with the proxy matcher in src/proxy.ts. */
export const APP_PATHS = [HOME_PATH] as const

const ADMIN_PATH = '/admin'
// Pages a sign-in may return to.
const RETURN_PATHS = [...APP_PATHS, ADMIN_PATH] as const

const underPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

export function isAppPath(pathname: string): boolean {
  return APP_PATHS.some((prefix) => underPrefix(pathname, prefix))
}

export function isAdminPath(pathname: string): boolean {
  return underPrefix(pathname, ADMIN_PATH)
}

/** Where a signed-out visitor goes: the sign-in page at /, keeping the page they asked for. */
export function welcomeUrl(requested: URL): URL {
  const url = new URL(WELCOME_PATH, requested)
  if (requested.pathname !== HOME_PATH) url.searchParams.set('next', requested.pathname)
  return url
}

const SAFE_PATH = /^\/[A-Za-z0-9/_-]*$/

/** A `next` value that is a page of this app, or null: never another origin, never a scheme. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !SAFE_PATH.test(value) || value.startsWith('//')) return null
  if (value === '/' || RETURN_PATHS.some((prefix) => underPrefix(value, prefix))) return value
  return null
}

/**
 * Where a failed sign-in leads, from Better Auth's error code: the suspended page for a suspended
 * account, else the sign-in page with its "did not finish" message. Only these two fixed paths,
 * so the code in the URL is never echoed and can never send anyone elsewhere.
 */
export function signinErrorTarget(code: string | null): string {
  return code === ACCOUNT_SUSPENDED ? SUSPENDED_PATH : `${WELCOME_PATH}?error=signin`
}
