import { expect, test } from '@playwright/test'
import { freshEmail } from './helpers/accounts'
import { deleteUsers, setRole } from './helpers/db'
import { DEV_LOGIN_HEADER, devLogin } from './helpers/login'
import { STUDENT_APP_URL } from './helpers/student'

// The sign-in pages and the gate: signed out, the student app sends visitors to / and the admin
// to its own sign-in page, each remembering the page; signed in, / moves a student on to the app
// and an admin on to the admin.

test('signed out, the admin goes to the admin sign-in page', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/sign-in$/)
})

test('signed out, an admin page goes to the admin sign-in page, which keeps the page asked for', async ({
  page,
}) => {
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Fusers$/)
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

test('signed in, / moves a student on to the student app', async ({ page }) => {
  const email = freshEmail('gate')
  try {
    await devLogin(page, email, 'E2E Gate', { surface: 'student' })
    await page.goto('/')
    await expect(page).toHaveURL(STUDENT_APP_URL)
  } finally {
    await deleteUsers([email])
  }
})

test('signed in, / moves an admin on to the admin', async ({ page }) => {
  const email = freshEmail('gate-admin')
  try {
    await devLogin(page, email, 'E2E Gate Admin')
    await setRole(email, 'admin')
    await page.goto('/')
    await expect(page).toHaveURL(/\/admin\/users$/)
  } finally {
    await deleteUsers([email])
  }
})
