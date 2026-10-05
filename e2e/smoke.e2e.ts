import { expect, test } from '@playwright/test'

test('signed out, / is the sign-in page and /dashboard sends the visitor to it', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
})
