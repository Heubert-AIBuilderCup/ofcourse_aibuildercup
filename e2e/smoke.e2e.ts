import { expect, test } from '@playwright/test'

test('signed out, / is the sign-in page and /start sends the visitor to it', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

  await page.goto('/start')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
})
