import { expect, test } from '@playwright/test'

// The sign-in page itself: the callback failure line, no motion when the visitor asked for none,
// and the one action still on the page at phone width.

test('a Google sign-in that did not finish says so on the page', async ({ page }) => {
  await page.goto('/?error=signin')
  await expect(page.getByRole('alert')).toHaveText('Google sign-in did not finish. Try again.')
})

test('under reduced motion the headline and the corner marks do not animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const animationName = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).animationName)
  expect(await animationName('h1 span span')).toBe('none')
  expect(await animationName('[data-frame-mark]')).toBe('none')
})

test('at phone width the page still offers Continue with Google', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
})
