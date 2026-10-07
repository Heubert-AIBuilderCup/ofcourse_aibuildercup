import { expect, test } from '@playwright/test'
import { freshEmail } from './helpers/accounts'
import { deleteUsers, setRole, userIdByEmail } from './helpers/db'
import { devLogin, devLoginRaw } from './helpers/login'
import { STUDENT_APP_URL } from './helpers/student'

// The admin sign-in page: Google only, its own messages, and the rules each sign-in page applies
// (through the dev login's surface, which runs the same hooks a Google sign-in does).

test('the admin sign-in page offers Google only', async ({ page }) => {
  await page.goto('/admin/sign-in')
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByLabel(/email/i)).toHaveCount(0)
  await expect(page.getByRole('link', { name: /create an account/i })).toHaveCount(0)
  await expect(page.getByText('OfCourse Admin')).toBeVisible()
})

test('the admin sign-in page says why a sign-in was refused', async ({ page }) => {
  await page.goto('/admin/sign-in?error=not-admin')
  // Within the page's main: Next's route announcer is an (empty) alert too.
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    "This account doesn't have admin access.",
  )
  await page.goto('/signin-error/admin?error=NOT_ADMIN')
  await expect(page).toHaveURL(/\/admin\/sign-in\?error=not-admin$/)
  await page.goto('/signin-error?error=STUDENT_PAGE_ONLY')
  await expect(page).toHaveURL(/\/\?error=student-only$/)
})

test('each sign-in page refuses the other kind of account', async ({ page }) => {
  const user = freshEmail('as-user')
  const nobody = freshEmail('as-nobody')
  const adm = freshEmail('as-admin')
  try {
    // A user account (the student page makes one even on an empty database).
    await devLogin(page, user, 'E2E As User', { surface: 'student' })
    expect(await devLoginRaw(page, { email: user, surface: 'admin' })).toMatchObject({
      status: 403,
      body: { error: 'NOT_ADMIN' },
    })

    expect(await devLoginRaw(page, { email: nobody, surface: 'admin' })).toMatchObject({
      status: 403,
      body: { error: 'NOT_ADMIN' },
    })
    expect(await userIdByEmail(nobody)).toBeNull()

    await devLogin(page, adm)
    await setRole(adm, 'admin')
    expect(await devLoginRaw(page, { email: adm, surface: 'student' })).toMatchObject({
      status: 403,
      body: { error: 'STUDENT_PAGE_ONLY' },
    })
    expect((await devLoginRaw(page, { email: adm, surface: 'admin' })).status).toBe(200)
  } finally {
    await deleteUsers([user, nobody, adm])
  }
})

test('a user session is kept out of the admin and still sees the admin sign-in page', async ({
  page,
}) => {
  const user = freshEmail('as-user-session')
  try {
    await devLogin(page, user, 'E2E User Session', { surface: 'student' })
    await page.goto('/admin/users')
    await expect(page).toHaveURL(STUDENT_APP_URL)
    await page.goto('/admin/sign-in')
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  } finally {
    await deleteUsers([user])
  }
})

test('an admin session is kept out of the student app and signs out to the admin page', async ({
  page,
}) => {
  const adm = freshEmail('as-admin-session')
  try {
    await devLogin(page, adm)
    await setRole(adm, 'admin')
    await page.goto('/start')
    await expect(page).toHaveURL(/\/admin\/users$/)
    await page.goto('/admin/sign-in')
    await expect(page).toHaveURL(/\/admin\/users$/)

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/admin\/sign-in$/)
  } finally {
    await deleteUsers([adm])
  }
})
