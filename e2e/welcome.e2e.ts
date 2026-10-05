import { expect, test } from '@playwright/test'
import { freshEmail } from './helpers/accounts'
import { deleteUsers } from './helpers/db'
import { DEV_LOGIN_HEADER, devLogin } from './helpers/login'

// The sign-in page and the gate: signed out, the app sends visitors to / and remembers the page;
// signed in, / moves on to the dashboard.

test('signed out, the admin goes to the sign-in page, which keeps the page asked for', async ({
  page,
}) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/\?next=%2Fadmin$/)
})

test('a failed Google sign-in says so on the sign-in page', async ({ page }) => {
  await page.goto('/signin-error?error=unable_to_create_user')
  await expect(page).toHaveURL(/\/\?error=signin$/)
  await expect(page.getByText('Google sign-in did not finish. Try again.')).toBeVisible()
})

test('the dev login refuses a request without the secret', async ({ request }) => {
  const none = await request.post('/api/dev-login', { data: { email: 'x@example.test' } })
  expect(none.status()).toBe(404)
  const wrong = await request.post('/api/dev-login', {
    headers: { [DEV_LOGIN_HEADER]: 'not-the-secret' },
    data: { email: 'x@example.test' },
  })
  expect(wrong.status()).toBe(404)
})

test('signed in, / moves on to the dashboard, which greets the user', async ({ page }) => {
  const email = freshEmail('gate')
  try {
    await devLogin(page, email, 'E2E Gate')
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Hello, E2E Gate' })).toBeVisible()
  } finally {
    await deleteUsers([email])
  }
})
