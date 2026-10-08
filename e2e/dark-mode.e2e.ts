import { expect, type Page, test } from '@playwright/test'
import { deleteUsers, setRole } from './helpers/db'
import { signInUser } from './helpers/login'
import { newStudent, signOutViaMenu, skipSplash } from './helpers/student'

// Dark mode across the browser, the cookie and the server: the toggle stores the theme so the
// next page is served in it, the device is followed until she picks, and the onboarding menu
// holds the Dark theme switch and Sign out, and the admin pages carry the toggle too
// (docs/dark-mode/intent.md, criteria 4, 5, 6 and 11).

const html = (page: Page) => page.locator('html')

async function themeCookie(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies()
  return cookies.find((c) => c.name === 'theme')?.value
}

test('the toggle stores the theme and the next page paints in it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await skipSplash(page)
  const first = await page.goto('/')
  expect(await first?.text()).toMatch(/<html[^>]*data-theme="light"/)
  await expect(html(page)).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => themeCookie(page)).toBe('dark')

  // The HTML as served, before any script runs: no flash of the light theme.
  const response = await page.reload()
  expect(await response?.text()).toMatch(/<html[^>]*data-theme="dark"/)
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
})

test('with no choice the page follows the device', async ({ page }) => {
  await page.context().clearCookies()
  await page.emulateMedia({ colorScheme: 'dark' })
  await skipSplash(page)
  await page.goto('/')
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html(page)).toHaveAttribute('data-theme', 'light', { timeout: 500 })

  // Once she has picked, the device no longer moves the page.
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.waitForFunction(() => matchMedia('(prefers-color-scheme: light)').matches)
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')

  // Clearing the cookies returns her to following the device.
  await page.context().clearCookies()
  await page.reload()
  await expect(html(page)).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html(page)).toHaveAttribute('data-theme', 'dark', { timeout: 500 })
})

test('the onboarding menu: Dark theme, Escape back to the button, Sign out', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  const email = await newStudent(page, 'dark-menu')
  try {
    await page.goto('/onboarding/character')
    const button = page.getByRole('button', { name: 'Menu: theme and sign out' })
    await button.click()
    const menu = page.getByRole('menu', { name: 'Menu' })
    await expect(menu).toBeVisible()
    const dark = menu.getByRole('menuitemcheckbox', { name: 'Dark theme' })
    await expect(dark).toHaveAttribute('aria-checked', 'false')
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()

    await dark.click()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(dark).toHaveAttribute('aria-checked', 'true')

    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(button).toBeFocused()

    await signOutViaMenu(page)
    await expect(page).toHaveURL((url) => url.pathname === '/')
  } finally {
    await deleteUsers([email])
  }
})

test('step 01 has no separate Sign out', async ({ page }) => {
  const email = await newStudent(page, 'dark-no-signout')
  try {
    await page.goto('/onboarding/facts/where')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Where are you right now?' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Menu: theme and sign out' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0)
  } finally {
    await deleteUsers([email])
  }
})

test('the admin sign-in page and the admin bar carry the toggle', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/admin/sign-in')
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()

  const { email } = await signInUser(page, { label: 'dark-admin' })
  try {
    await setRole(email, 'admin')
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
    const toggle = page.getByRole('button', { name: 'Switch to dark theme' })
    await expect(toggle).toBeVisible()
    await toggle.click()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  } finally {
    await deleteUsers([email])
  }
})
