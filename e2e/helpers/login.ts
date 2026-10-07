// Sign in through the development-only login (src/app/api/dev-login), so every spec starts from
// an account the way a Google sign-up leaves one. With `surface` the login applies that sign-in
// page's rules (the same hooks Google runs); without it, the starter's.

import { expect, type Page } from '@playwright/test'
import { freshEmail } from './accounts'

export const DEV_LOGIN_HEADER = 'x-dev-login-secret'

type Surface = 'student' | 'admin'

function secret(): string {
  const value = process.env.DEV_LOGIN_SECRET
  if (!value) throw new Error('DEV_LOGIN_SECRET is not set: playwright.config.ts sets it.')
  return value
}

/** The dev login's answer for `body`, without asserting it. */
export async function devLoginRaw(
  page: Page,
  body: { email: string; name?: string; surface?: Surface },
): Promise<{ status: number; body: unknown }> {
  const res = await page.request.post('/api/dev-login', {
    headers: { [DEV_LOGIN_HEADER]: secret() },
    data: body,
  })
  return { status: res.status(), body: await res.json().catch(() => null) }
}

/** Sign the page's browser context in as `email` (the user is created on first use). */
export async function devLogin(
  page: Page,
  email: string,
  name = 'E2E User',
  opts: { surface?: Surface } = {},
): Promise<string> {
  const res = await devLoginRaw(page, { email, name, surface: opts.surface })
  expect(res.status, 'the dev login answers 200').toBe(200)
  return (res.body as { userId: string }).userId
}

export type User = { email: string; userId: string; name: string }

/**
 * A fresh user, signed in on the student page, which makes a user even when the account is the
 * first ever (so a spec running first never turns its user into the superadmin). Delete them with
 * db.deleteUsers([user.email]).
 */
export async function signInUser(
  page: Page,
  opts: { label?: string; email?: string } = {},
): Promise<User> {
  const email = opts.email ?? freshEmail(opts.label ?? 'user')
  const name = `E2E ${email.split('@')[0].slice(-10)}`
  const userId = await devLogin(page, email, name, { surface: 'student' })
  return { email, userId, name }
}
