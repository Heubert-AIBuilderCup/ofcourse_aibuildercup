import { expect, test } from '@playwright/test'
import { skipSplash } from './helpers/student'

// The student sign-in page itself: the callback failure line in the form's error block, the
// splash under reduced motion, and Google still offered at phone width.

test('a Google sign-in that did not finish says so on the page', async ({ page }) => {
  await skipSplash(page)
  await page.goto('/?error=signin')
  // Within the page's main: Next's route announcer is an (empty) alert too.
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Google sign-in did not finish. Try again.',
  )
})

test('under reduced motion the splash holds only the final wordmark, then cuts to the page', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const splash = page.getByTestId('splash')
  await expect(splash).toHaveAttribute('data-splash', 'still')
  await expect(splash).toContainText('From off course to “Of Course!”')
  // The duck only swims; in the final frame it is gone.
  await expect(splash.locator('img')).toBeHidden()
  await expect(splash).toHaveCount(0, { timeout: 4000 })
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
})

test('at phone width the page still offers Sign in with Google', async ({ page }) => {
  await skipSplash(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
})
