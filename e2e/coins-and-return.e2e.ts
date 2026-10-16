import { type Browser, expect, type Page, test } from '@playwright/test'
import { deleteUsers, profileOf } from './helpers/db'
import { devLogin } from './helpers/login'
import { answerFact, card, newStudent, skipSplash, startOnboarding } from './helpers/student'

// Coming back: on her first unanswered question, with her answers, and Back from step 02 to
// find an answer, the same on a second device.

/** The same student on another device: a new browser context, signed in on the student page. */
async function secondDevice(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await skipSplash(page)
  await devLogin(page, email, 'E2E Student', { surface: 'student' })
  return page
}

test('coming back partway opens her first unanswered question, with her answers', async ({
  page,
  browser,
}) => {
  const email = await newStudent(page, 'return-partway')
  try {
    await startOnboarding(page)
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await answerFact(page, ['Amount', 'AUD 36k'])
    await answerFact(page, ['Who pays', 'Savings'])
    await expect.poll(async () => (await profileOf(email))?.lastStep).toBe('facts')

    const again = await secondDevice(browser, email)
    try {
      await again.goto('/')
      await expect(again).toHaveURL(/\/onboarding\/facts\/where$/)
      await expect(
        again.getByRole('heading', { level: 1, name: 'Where are you right now?' }),
      ).toBeVisible()
      await again.goto('/onboarding/facts/amount')
      await expect(card(again, 'Amount', 'AUD 36k')).toHaveAttribute('aria-checked', 'true')
      await again.goto('/onboarding/facts/who-pays')
      await expect(card(again, 'Who pays', 'Savings')).toHaveAttribute('aria-checked', 'true')
    } finally {
      await again.context().close()
    }
  } finally {
    await deleteUsers([email])
  }
})

test('coming back after leaving step 01 early opens step 02, and Back finds her answer', async ({
  page,
  browser,
}) => {
  const email = await newStudent(page, 'return-study')
  try {
    await startOnboarding(page)
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await answerFact(page, ['Amount', 'AUD 36k'])
    await page.getByRole('link', { name: "Leave the rest for now: go to What you'd study" }).click()
    await expect(page).toHaveURL(/\/onboarding\/study\/know$/)
    await expect.poll(async () => (await profileOf(email))?.lastStep).toBe('study')

    const again = await secondDevice(browser, email)
    try {
      await again.goto('/')
      await expect(again).toHaveURL(/\/onboarding\/study\/know$/)
      await expect(
        again.getByRole('heading', { level: 1, name: 'Do you know what you want to study?' }),
      ).toBeVisible()
      await again.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(again).toHaveURL(/\/onboarding\/facts\/english$/)
      await expect(again.getByRole('heading', { level: 1, name: 'English test' })).toBeVisible()
      await again.goto('/onboarding/facts/amount')
      await expect(card(again, 'Amount', 'AUD 36k')).toHaveAttribute('aria-checked', 'true')
    } finally {
      await again.context().close()
    }
  } finally {
    await deleteUsers([email])
  }
})
