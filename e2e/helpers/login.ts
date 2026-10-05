// Sign in through the development-only login (src/app/api/dev-login), so every spec starts from
// an account the way a Google sign-up leaves one.

import { expect, type Page } from '@playwright/test'
import { freshEmail } from './accounts'

export const DEV_LOGIN_HEADER = 'x-dev-login-secret'

function secret(): string {
  const value = process.env.DEV_LOGIN_SECRET
  if (!value) throw new Error('DEV_LOGIN_SECRET is not set: playwright.config.ts sets it.')
  return value
}

/** Sign the page's browser context in as `email` (the user is created on first use). */
export async function devLogin(page: Page, email: string, name = 'E2E User'): Promise<string> {
  const res = await page.request.post('/api/dev-login', {
    headers: { [DEV_LOGIN_HEADER]: secret() },
    data: { email, name },
  })
  expect(res.status(), 'the dev login answers 200').toBe(200)
  const body = (await res.json()) as { userId: string }
  return body.userId
}

export type User = { email: string; userId: string; name: string }

/** A fresh user, signed in. Delete them with db.deleteUsers([user.email]). */
export async function signInUser(
  page: Page,
  opts: { label?: string; email?: string } = {},
): Promise<User> {
  const email = opts.email ?? freshEmail(opts.label ?? 'user')
  const name = `E2E ${email.split('@')[0].slice(-10)}`
  const userId = await devLogin(page, email, name)
  return { email, userId, name }
}
