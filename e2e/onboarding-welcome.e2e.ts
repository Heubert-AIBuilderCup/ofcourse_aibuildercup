import { expect, type Page, test } from '@playwright/test'
import { freshEmail } from './helpers/accounts'
import { deleteSignInCodes, deleteUsers, latestSignInCode, setRole } from './helpers/db'
import { devLogin } from './helpers/login'
import { newStudent, skipSplash } from './helpers/student'

// The welcome before step 00 (docs/onboarding-welcome/intent.md, criteria 1, 2, 3, 4, 5, 6 and
// 9): where a new student lands, what it says, its Start, the panel's welcome state, the keyboard,
// and that once step 00 is answered she never sees it again.

const heading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'About 6 minutes of short questions' })

test('a new student lands on the welcome, and its Start opens step 00', async ({ page }) => {
  const email = await newStudent(page, 'welcome-land')
  try {
    await page.goto('/')
    await expect(page).toHaveURL(/\/onboarding\/welcome$/)
    await expect(page.getByText('Welcome, E2E.', { exact: true })).toBeVisible()
    await expect(heading(page)).toBeVisible()
    await expect(
      page.getByText(
        "Your answers shape what OfCourse shows you: what you'd study, where you'd live, and what could come after.",
      ),
    ).toBeVisible()
    const points = page.getByRole('list', { name: 'How it works' })
    for (const title of [
      'Five short steps, one question at a time',
      'Each question says why it asks',
      'Nothing ranked or recommended',
    ])
      await expect(points.getByRole('heading', { level: 2, name: title })).toBeVisible()
    await expect(page.getByText('First · optional')).toBeVisible()
    await expect(
      page.getByText(
        'How your comic character is drawn. It only sets the drawing in the comics, and you can skip it.',
      ),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Start' }).click()
    await expect(page).toHaveURL(/\/onboarding\/character$/)
    await expect(
      page.getByRole('heading', { name: 'How would you like your comic character drawn?' }),
    ).toBeVisible()
  } finally {
    await deleteUsers([email])
  }
})

test('/onboarding opens the welcome for a new student too', async ({ page }) => {
  const email = await newStudent(page, 'welcome-resume')
  try {
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/onboarding\/welcome$/)
    await expect(heading(page)).toBeVisible()
  } finally {
    await deleteUsers([email])
  }
})

// Email codes are off on the page (src/app/page.tsx, `codes`) until an email provider is set up.
test.skip('an account with no name (an email-code sign-in) is greeted "Welcome."', async ({
  page,
}) => {
  const email = freshEmail('welcome-noname')
  try {
    await skipSplash(page)
    await page.goto('/')
    await page.getByLabel('Your email').fill(email)
    await page.getByRole('button', { name: 'Send me a code' }).click()
    await expect(page.getByText(`The code we sent to ${email}`)).toBeVisible()
    await page.getByLabel('Six-digit code').fill(await latestSignInCode(email))
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/onboarding\/welcome$/)
    await expect(heading(page)).toBeVisible()
    await expect(page.getByText('Welcome.', { exact: true })).toBeVisible()
    await expect(page.getByText(/^Welcome, /)).toHaveCount(0)
  } finally {
    await deleteSignInCodes([email])
    await deleteUsers([email])
  }
})

test('once step 00 is skipped, the welcome and / send her on, never back to it', async ({
  page,
}) => {
  const email = await newStudent(page, 'welcome-after')
  try {
    await page.goto('/onboarding/character')
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)

    await page.goto('/onboarding/welcome')
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Where are you right now?' }),
    ).toBeVisible()
    await page.goto('/')
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await expect(heading(page)).toHaveCount(0)
  } finally {
    await deleteUsers([email])
  }
})

test('on a phone the panel band says she has not started, and what comes first', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const email = await newStudent(page, 'welcome-band')
  try {
    await page.goto('/onboarding/welcome')
    const panel = page.getByRole('complementary', { name: 'Getting started' })
    await expect(panel.getByText('Not started yet · about 6 min')).toBeVisible()
    await expect(panel.getByText('First: Your comic character')).toBeVisible()
    await expect(panel.locator('[data-lit="true"]')).toHaveCount(0)
  } finally {
    await deleteUsers([email])
  }
})

test('side by side the step list has none current, step 00 tagged Optional', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const email = await newStudent(page, 'welcome-list')
  try {
    await page.goto('/onboarding/welcome')
    const panel = page.getByRole('complementary', { name: 'Getting started' })
    await expect(panel.getByRole('heading', { name: 'Before we start' })).toBeVisible()
    await expect(
      panel.getByText("Here's the whole way through. Each step says why it asks."),
    ).toBeVisible()
    const list = page.getByRole('list', { name: 'Your steps' })
    const steps = list.getByRole('listitem')
    await expect(steps).toHaveCount(6)
    await expect(steps.nth(0)).toContainText('Your comic character')
    await expect(steps.nth(0)).toContainText('Optional')
    await expect(list.locator('[aria-current]')).toHaveCount(0)
    await expect(list).not.toContainText('Done')
    await expect(list).not.toContainText('Now')
  } finally {
    await deleteUsers([email])
  }
})

test('the heading has focus on load, and Tab reaches the menu button and Start', async ({
  page,
}) => {
  const email = await newStudent(page, 'welcome-keys')
  try {
    await page.goto('/onboarding/welcome')
    await expect(heading(page)).toBeFocused()

    // From the heading Tab goes on to Start; the header menu is the stop before it, so from the
    // top of the page Tab reaches the menu button, then Start.
    const start = page.getByRole('link', { name: 'Start' })
    const menu = page.getByRole('button', { name: 'Menu: theme and sign out' })
    await page.keyboard.press('Tab')
    await expect(start).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(menu).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(start).toBeFocused()
  } finally {
    await deleteUsers([email])
  }
})

test('a signed-out visit to the welcome gets the sign-in page instead', async ({ page }) => {
  await skipSplash(page)
  await page.goto('/onboarding/welcome')
  await expect(page).toHaveURL((url) => url.pathname === '/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(heading(page)).toHaveCount(0)
})

test('an admin session visiting the welcome is sent to the admin, never shown it', async ({
  page,
}) => {
  const adm = freshEmail('welcome-admin')
  try {
    await devLogin(page, adm)
    await setRole(adm, 'admin')
    await page.goto('/onboarding/welcome')
    await expect(page).toHaveURL(/\/admin\/users$/)
    await expect(heading(page)).toHaveCount(0)
  } finally {
    await deleteUsers([adm])
  }
})
