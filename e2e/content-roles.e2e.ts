import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test'
import { freshEmail, SUPERADMINS } from './helpers/accounts'
import { makePost, nonDemo, PAID_WORK, requireFakeProvider } from './helpers/content'
import {
  accountOf,
  deletePostsBy,
  deleteRoleInvites,
  deleteUsers,
  setCapabilities,
  setRole,
} from './helpers/db'
import { devLogin, signInUser, type User } from './helpers/login'

// Content roles in the admin: a superadmin gives Editor and Reviewer, now or waiting on an
// address; an admin cannot; editors see only the Board; an admin without a capability sees posts
// and changes none. Every admin screen fits a 1280-wide window.

const SUPERADMIN = SUPERADMINS.content
const WIDE = { width: 1280, height: 800 }

// The tests share this spec's superadmin, so they run one after another in one worker; a failure
// restarts the worker and the rest still run.
test.describe.configure({ mode: 'default' })
test.use({ viewport: WIDE })

const made: string[] = []

test.beforeAll(async ({ browser }) => {
  // A run that stopped half way may have left the fixed superadmin and its posts behind.
  await deletePostsBy([SUPERADMIN])
  await deleteUsers([SUPERADMIN])
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await requireFakeProvider(page)
    await devLogin(page, SUPERADMIN, 'E2E Content Superadmin')
    await setRole(SUPERADMIN, 'superadmin')
  } finally {
    await context.close()
  }
})

test.afterAll(async () => {
  await deletePostsBy([SUPERADMIN, ...made])
  await deleteRoleInvites(made)
  await deleteUsers([SUPERADMIN, ...made])
})

type Person = User & { context: BrowserContext; page: Page }

/** A fresh account in a 1280-wide browser of its own, with a role and capabilities. */
async function person(
  browser: Browser,
  label: string,
  access: { role?: 'admin'; editor?: boolean; reviewer?: boolean } = {},
): Promise<Person> {
  const context = await browser.newContext({ viewport: WIDE })
  const page = await context.newPage()
  const user = await signInUser(page, { label })
  made.push(user.email)
  if (access.role) await setRole(user.email, access.role)
  if (access.editor || access.reviewer) {
    await setCapabilities(user.email, {
      editor: access.editor === true,
      reviewer: access.reviewer === true,
    })
  }
  return { ...user, context, page }
}

async function openAccount(page: Page, userId: string): Promise<void> {
  await page.goto(`/admin/users/${userId}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Access' })).toBeVisible()
}

/** The section tabs the admin shows, in order. */
async function navTabs(page: Page): Promise<string[]> {
  const nav = page.getByRole('navigation', { name: 'Admin sections' })
  await expect(nav).toBeVisible()
  return nav.getByRole('link').allInnerTexts()
}

/** Nothing on the page needs sideways scrolling (criterion 7). */
async function expectNoSideways(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(clientWidth)
}

test('a superadmin gives an account both Editor and Reviewer', async ({ page, browser }) => {
  const p = await person(browser, 'cr-both')
  try {
    await devLogin(page, SUPERADMIN, 'E2E Content Superadmin')
    await openAccount(page, p.userId)
    for (const name of ['Editor', 'Reviewer']) {
      const box = page.getByRole('checkbox', { name, exact: true })
      await expect(box).not.toBeChecked()
      await box.click()
      const dialog = page.getByRole('dialog', { name: 'Change access' })
      await dialog.getByRole('button', { name: 'Change access' }).click()
      await expect(dialog).toBeHidden()
      await expect(box).toBeChecked()
    }
    expect(await accountOf(p.email)).toEqual({ role: 'user', editor: true, reviewer: true })
  } finally {
    await p.context.close()
  }
})

test('an admin who is also an editor starts a feed post from the board', async ({ browser }) => {
  const a = await person(browser, 'cr-admin-editor', { role: 'admin', editor: true })
  try {
    await a.page.goto('/admin/board')
    await a.page.getByRole('link', { name: '+ New feed post' }).click()
    await expect(a.page).toHaveURL(/\/admin\/posts\/new$/)
    await makePost(a.page, {
      title: 'Paid work, started by an admin',
      text: nonDemo(PAID_WORK.text),
    })
    await expect(
      a.page.getByRole('heading', { level: 1, name: 'Paid work, started by an admin' }),
    ).toBeVisible()
  } finally {
    await a.context.close()
  }
})

test('Editor left waiting for an address applies at its first sign-in', async ({
  page,
  browser,
}) => {
  const email = freshEmail('cr-invited-editor')
  made.push(email)
  await devLogin(page, SUPERADMIN, 'E2E Content Superadmin')
  await page.goto('/admin/users')
  const add = page.getByRole('form', { name: 'Add by email' })
  await add.getByLabel('Email').fill(email)
  await add.getByRole('combobox', { name: 'Role' }).click()
  await page.getByRole('option', { name: 'No admin role' }).click()
  await add.getByRole('checkbox', { name: 'Editor', exact: true }).click()
  await add.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText(`${email} becomes Editor at their first sign-in.`)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Waiting for first sign-in' })).toContainText(email)

  const context = await browser.newContext({ viewport: WIDE })
  try {
    const first = await context.newPage()
    await devLogin(first, email, 'E2E Invited Editor')
    await first.goto('/admin')
    await expect(first).toHaveURL(/\/admin\/board$/)
    expect(await accountOf(email)).toEqual({ role: 'user', editor: true, reviewer: false })
  } finally {
    await context.close()
  }
})

test('an admin cannot give or remove content roles', async ({ browser }) => {
  const a = await person(browser, 'cr-admin', { role: 'admin' })
  const p = await person(browser, 'cr-target')
  try {
    await openAccount(a.page, p.userId)
    const access = a.page.getByRole('region', { name: 'Access' })
    await expect(access.getByText('Only a superadmin can change roles.')).toBeVisible()
    await expect(access.getByRole('checkbox')).toHaveCount(0)
    await expect(access.getByRole('combobox')).toHaveCount(0)
  } finally {
    await a.context.close()
    await p.context.close()
  }
})

test('an editor sees the content sections, not Users or Models, and the users admin sends them there', async ({
  browser,
}) => {
  const e = await person(browser, 'cr-editor', { editor: true })
  try {
    await e.page.goto('/admin')
    await expect(e.page).toHaveURL(/\/admin\/board$/)
    await expect(e.page.getByRole('link', { name: 'OfCourse Admin' })).toBeVisible()
    expect(await navTabs(e.page)).toEqual(['Board', 'Comic gaps', 'Updates', 'Ideas', 'Insights'])
    await expectNoSideways(e.page)

    await e.page.goto('/admin/users')
    await expect(e.page).toHaveURL(/\/admin\/board$/)
  } finally {
    await e.context.close()
  }
})

test("a superadmin's tabs are every section, Users and Models included", async ({ page }) => {
  await devLogin(page, SUPERADMIN, 'E2E Content Superadmin')
  await page.goto('/admin/board')
  expect(await navTabs(page)).toEqual([
    'Board',
    'Comic gaps',
    'Updates',
    'Ideas',
    'Insights',
    'Users',
    'Models',
  ])
})

test("an admin sees the board and an editor's post, and can change nothing", async ({
  browser,
}) => {
  const e = await person(browser, 'cr-post-editor', { editor: true })
  const a = await person(browser, 'cr-reader', { role: 'admin' })
  try {
    const title = 'Paid work, read by an admin'
    const id = await makePost(e.page, { title, text: nonDemo(PAID_WORK.text) })

    await a.page.goto('/admin/board')
    await expect(a.page.getByRole('link', { name: title })).toBeVisible()
    await expect(a.page.getByRole('link', { name: '+ New feed post' })).toHaveCount(0)
    await expectNoSideways(a.page)

    await a.page.goto(`/admin/posts/${id}`)
    await expect(a.page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(a.page.getByRole('heading', { level: 2, name: 'Ideas' })).toBeVisible()
    // Selecting an idea card only shows its details (aria-pressed); no button that acts is there.
    const main = a.page.getByRole('main')
    await expect(main.getByRole('button', { name: 'Use this idea' })).toHaveCount(0)
    await expect(main.locator('button:not([aria-pressed])')).toHaveCount(0)
    await expectNoSideways(a.page)
  } finally {
    await e.context.close()
    await a.context.close()
  }
})
