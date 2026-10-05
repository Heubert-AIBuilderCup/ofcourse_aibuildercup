import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test'
import { freshEmail, SUPERADMINS } from './helpers/accounts'
import { accountState, countUsers, deleteRoleInvites, deleteUsers, setRole } from './helpers/db'
import { DEV_LOGIN_HEADER, devLogin, signInUser, type User } from './helpers/login'

// User management: the admin is for admins, roles are for superadmins, a role can wait on an
// address, and suspension and sign-out everywhere end sessions.

const SUPERADMIN = SUPERADMINS.users

// The tests share this spec's superadmin, so they run one after another in one worker; a failure
// restarts the worker and the rest still run.
test.describe.configure({ mode: 'default' })

const made: string[] = []

test.beforeAll(async ({ browser }) => {
  // A run that stopped half way may have left the fixed superadmin behind.
  await deleteUsers([SUPERADMIN])
  // The app makes only the first account ever a superadmin, so this spec's superadmin is given
  // the role straight in the database; the spec proves the first-account rule only through the
  // assertion below, when its account happens to be the first. Another spec (welcome.e2e.ts) may
  // create the first account from a parallel worker, which is harmless: setRole fixes this
  // spec's superadmin either way.
  const context = await browser.newContext()
  try {
    await devLogin(await context.newPage(), SUPERADMIN, 'E2E Users Superadmin')
    // The account went into an otherwise empty table: the app itself must have made it superadmin.
    if ((await countUsers()) === 1) {
      expect((await accountState(SUPERADMIN))?.role, 'the first account is a superadmin').toBe(
        'superadmin',
      )
    }
    await setRole(SUPERADMIN, 'superadmin')
  } finally {
    await context.close()
  }
})

test.afterAll(async () => {
  await deleteRoleInvites(made)
  await deleteUsers([SUPERADMIN, ...made])
})

type Person = User & { context: BrowserContext; page: Page }

/** A fresh user in a browser of their own. */
async function person(browser: Browser, label: string): Promise<Person> {
  const context = await browser.newContext()
  const page = await context.newPage()
  const user = await signInUser(page, { label })
  made.push(user.email)
  return { ...user, context, page }
}

/** A fresh account with the admin role, signed in. */
async function admin(browser: Browser, label = 'um-admin'): Promise<Person> {
  const p = await person(browser, label)
  await setRole(p.email, 'admin')
  return p
}

/** The spec's superadmin, signed in on `page`. */
async function superadmin(page: Page): Promise<void> {
  await devLogin(page, SUPERADMIN, 'E2E Users Superadmin')
}

/** The dev sign-in's status for `email`, without asserting it. */
async function devLoginStatus(page: Page, email: string): Promise<number> {
  const res = await page.request.post('/api/dev-login', {
    headers: { [DEV_LOGIN_HEADER]: process.env.DEV_LOGIN_SECRET ?? '' },
    data: { email },
  })
  return res.status()
}

async function openAccount(page: Page, userId: string): Promise<void> {
  await page.goto(`/admin/users/${userId}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Access' })).toBeVisible()
}

test('a user is kept out of the admin', async ({ browser }) => {
  const p = await person(browser, 'um-user')
  try {
    await p.page.goto('/admin')
    await expect(p.page).toHaveURL(/\/dashboard$/)
    await p.page.goto('/admin/users')
    await expect(p.page).toHaveURL(/\/dashboard$/)
  } finally {
    await p.context.close()
  }
})

test('an admin uses the admin, without the role controls', async ({ browser }) => {
  const a = await admin(browser)
  const p = await person(browser, 'um-target')
  try {
    await a.page.goto('/admin/users')
    await expect(a.page).toHaveURL(/\/admin\/users$/)
    await expect(a.page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
    // Admins cannot name addresses with a role.
    await expect(a.page.getByRole('heading', { name: 'Add by email' })).toHaveCount(0)

    await openAccount(a.page, p.userId)
    await expect(a.page.getByRole('combobox', { name: 'Role' })).toHaveCount(0)
    await expect(a.page.getByRole('button', { name: 'Suspend…' })).toBeVisible()
  } finally {
    await a.context.close()
    await p.context.close()
  }
})

test('a role change applies at once', async ({ page, browser }) => {
  const p = await person(browser, 'um-promoted')
  try {
    await superadmin(page)
    await openAccount(page, p.userId)
    await page.getByRole('combobox', { name: 'Role' }).click()
    await page.getByRole('option', { name: 'Admin', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Change role' })
    await dialog.getByRole('button', { name: 'Change role' }).click()
    await expect(dialog).toBeHidden()
    expect((await accountState(p.email))?.role).toBe('admin')

    // Their sessions ended with the change.
    await p.page.goto('/dashboard')
    await expect(p.page).toHaveURL(/\/$/)
    await devLogin(p.page, p.email)
    await p.page.goto('/admin')
    await expect(p.page).toHaveURL(/\/admin\/users$/)
    await expect(p.page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
  } finally {
    await p.context.close()
  }
})

test('a waiting role applies at the first sign-in', async ({ page, browser }) => {
  const email = freshEmail('um-invited')
  made.push(email)
  await superadmin(page)
  await page.goto('/admin/users')
  const add = page.getByRole('form', { name: 'Add by email' })
  await add.getByLabel('Email').fill(email)
  await expect(add.getByRole('combobox', { name: 'Role' })).toHaveText('Admin')
  await add.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText(`${email} becomes Admin at their first sign-in.`)).toBeVisible()
  const waiting = page.getByRole('region', { name: 'Waiting for first sign-in' })
  await expect(waiting).toContainText(email)

  const context = await browser.newContext()
  try {
    const first = await context.newPage()
    await devLogin(first, email, 'E2E Invited')
    await first.goto('/admin')
    await expect(first).toHaveURL(/\/admin\/users$/)
    expect((await accountState(email))?.role).toBe('admin')
  } finally {
    await context.close()
  }

  await page.reload()
  await expect(page.getByRole('region', { name: 'Waiting for first sign-in' })).not.toContainText(
    email,
  )
})

test('an admin suspends a user and reactivates them', async ({ browser }) => {
  const a = await admin(browser)
  const p = await person(browser, 'um-suspended')
  try {
    await openAccount(a.page, p.userId)
    await a.page.getByRole('button', { name: 'Suspend…' }).click()
    const dialog = a.page.getByRole('dialog', { name: `Suspend ${p.name}` })
    await dialog.getByLabel('Reason').fill('E2E check')
    await dialog.getByRole('button', { name: 'Suspend', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(a.page.getByText(/^Suspended .*: E2E check$/)).toBeVisible()

    // Signed out at once, and refused a new session.
    await p.page.goto('/dashboard')
    await expect(p.page).toHaveURL(/\/$/)
    const refused = await p.page.request.post('/api/dev-login', {
      headers: { [DEV_LOGIN_HEADER]: process.env.DEV_LOGIN_SECRET ?? '' },
      data: { email: p.email },
    })
    expect(refused.status()).toBe(403)
    expect(await refused.json()).toEqual({ error: 'ACCOUNT_SUSPENDED' })
    await p.page.goto('/signin-error?error=ACCOUNT_SUSPENDED')
    await expect(p.page).toHaveURL(/\/suspended$/)
    await expect(
      p.page.getByRole('heading', { level: 1, name: 'This account is suspended' }),
    ).toBeVisible()

    await a.page.getByRole('button', { name: 'Reactivate' }).click()
    await expect(a.page.getByRole('button', { name: 'Suspend…' })).toBeVisible()
    expect(await devLoginStatus(p.page, p.email)).toBe(200)
  } finally {
    await a.context.close()
    await p.context.close()
  }
})

test('sign out everywhere ends every session and leaves the account active', async ({
  browser,
}) => {
  const a = await admin(browser)
  const p = await person(browser, 'um-signed-out')
  const second = await browser.newContext()
  try {
    const other = await second.newPage()
    await devLogin(other, p.email)
    await other.goto('/dashboard')
    await expect(other).toHaveURL(/\/dashboard$/)
    expect((await accountState(p.email))?.sessions).toBe(2)

    await openAccount(a.page, p.userId)
    await a.page.getByRole('button', { name: 'Sign out everywhere' }).click()
    const dialog = a.page.getByRole('dialog', { name: 'Sign out everywhere' })
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(dialog).toBeHidden()

    await p.page.goto('/dashboard')
    await expect(p.page).toHaveURL(/\/$/)
    await other.goto('/dashboard')
    await expect(other).toHaveURL(/\/$/)
    expect(await accountState(p.email)).toMatchObject({
      role: 'user',
      suspended: false,
      sessions: 0,
    })
  } finally {
    await a.context.close()
    await p.context.close()
    await second.close()
  }
})

test("the users list shows who's live", async ({ page, browser }) => {
  const p = await person(browser, 'um-live')
  try {
    await superadmin(page)
    await page.goto('/admin/users')
    await page.getByLabel('Search users').fill(p.email)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page).toHaveURL(/\?q=/)
    const row = page.getByRole('row').filter({ hasText: p.email })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Online')
    const count = page.getByText(/^\d+ online now$/)
    await expect(count).toBeVisible()
    expect(Number.parseInt((await count.textContent()) ?? '0', 10)).toBeGreaterThanOrEqual(1)
  } finally {
    await p.context.close()
  }
})
