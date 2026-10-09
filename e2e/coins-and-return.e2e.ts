import { type Browser, expect, type Page, test } from '@playwright/test'
import { deleteUsers, profileOf } from './helpers/db'
import { devLogin } from './helpers/login'
import {
  answerFact,
  answerOpening,
  card,
  newStudent,
  skipSplash,
  startOnboarding,
} from './helpers/student'

// The coins (ten over eight piles, five a pile, Done only at ten, "Not sure", "Spend them
// later"), which never change the futures; and coming back: on her first unanswered question,
// on her futures once seen, Back from them to change an answer, and the same on a second device.

const add = (page: Page, value: string) =>
  page.getByRole('button', { name: `Add a coin to ${value}` })
const cards = (page: Page) => page.getByRole('article')

/** The same student on another device: a new browser context, signed in on the student page. */
async function secondDevice(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await skipSplash(page)
  await devLogin(page, email, 'E2E Student', { surface: 'student' })
  return page
}

test('ten coins, five a pile, Done at ten; the futures stay as they were', async ({ page }) => {
  const email = await newStudent(page, 'coins')
  try {
    await answerOpening(page, {})
    await expect(cards(page)).toHaveCount(3)
    const futures = await cards(page).allInnerTexts()

    await page.getByRole('link', { name: 'Next: your attention · optional' }).click()
    await expect(page).toHaveURL(/\/attention$/)
    await expect(page.getByText('10 coins left to place')).toBeVisible()

    await add(page, 'Health').click()
    await expect(
      page.getByText('Health at 1: sleep and exercise get a mention on busy weeks.'),
    ).toBeVisible()
    for (let i = 0; i < 4; i++) await add(page, 'Health').click()
    // A sixth coin on one pile is refused.
    await expect(add(page, 'Health')).toBeDisabled()
    await expect(page.getByText('5 coins left to place')).toBeVisible()

    // Done needs exactly ten.
    for (let i = 0; i < 4; i++) await add(page, 'Social life').click()
    await expect(page.getByRole('button', { name: 'Place all ten to finish' })).toBeDisabled()
    await add(page, 'Social life').click()
    await expect(page.getByText('All 10 placed')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()

    await expect(page).toHaveURL(/\/futures$/)
    await expect
      .poll(async () => (await profileOf(email))?.coins)
      .toEqual({ state: 'spent', piles: [5, 5, 0, 0, 0, 0, 0, 0], assumed: false })
    await expect(cards(page)).toHaveCount(3)
    expect(await cards(page).allInnerTexts()).toEqual(futures)
    await expect(page.getByRole('link', { name: /your attention|ten coins/ })).toHaveCount(0)
  } finally {
    await deleteUsers([email])
  }
})

test('"Not sure" spreads the coins; "Spend them later" leaves them for later', async ({ page }) => {
  const email = await newStudent(page, 'coins-later')
  try {
    await answerOpening(page, {})
    await page.getByRole('link', { name: 'Next: your attention · optional' }).click()

    await page.getByRole('button', { name: 'Not sure · spread them for me' }).click()
    await expect(
      page.getByText('Assumed: an even spread. You can change it any time.'),
    ).toBeVisible()
    await expect(page.getByText('All 10 placed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Done' })).toBeEnabled()

    await page.getByRole('button', { name: 'Spend them later' }).click()
    await expect(page).toHaveURL(/\/futures$/)
    await expect.poll(async () => (await profileOf(email))?.coins).toEqual({ state: 'later' })
    await page.getByRole('link', { name: 'Spend your ten coins' }).click()
    await expect(page).toHaveURL(/\/attention$/)
    await expect(page.getByText('10 coins left to place')).toBeVisible()

    // Back from the coins returns to the futures.
    await page.getByRole('link', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/futures$/)
    await expect(cards(page)).toHaveCount(3)
  } finally {
    await deleteUsers([email])
  }
})

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
    await expect(page).toHaveURL(/\/onboarding\/study$/)
    await expect.poll(async () => (await profileOf(email))?.lastStep).toBe('study')

    const again = await secondDevice(browser, email)
    try {
      await again.goto('/')
      await expect(again).toHaveURL(/\/onboarding\/study$/)
      await expect(again.getByRole('heading', { level: 1, name: "What you'd study" })).toBeVisible()
      await again.getByRole('link', { name: 'Back', exact: true }).click()
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

test('after the futures, she comes back to them, on any device, and Back lets her change them', async ({
  page,
  browser,
}) => {
  const email = await newStudent(page, 'return-futures')
  try {
    await startOnboarding(page)
    await page.getByRole('button', { name: 'Skip' }).click()
    await answerOpening(page, { facts: [['Amount', 'AUD 36k']] })
    await expect(cards(page)).toHaveCount(3)
    const futures = await cards(page).allInnerTexts()

    // A second device: the same answers and the same futures, as her home.
    const again = await secondDevice(browser, email)
    try {
      await again.goto('/')
      await expect(again).toHaveURL(/\/futures$/)
      await expect(again.getByText('Your three futures · nothing ranked')).toBeVisible()
      await expect(cards(again)).toHaveCount(3)
      expect(await cards(again).allInnerTexts()).toEqual(futures)

      // Back to step 01, change the budget, return: the futures show the new budget.
      for (const title of [
        'After you graduate',
        "Where and how you'd live",
        "What you'd study",
        'English test',
      ]) {
        await again.getByRole('link', { name: 'Back', exact: true }).click()
        await expect(again.getByRole('heading', { level: 1, name: title })).toBeVisible()
      }
      await again.goto('/onboarding/facts/amount')
      await expect(card(again, 'Amount', 'AUD 36k')).toHaveAttribute('aria-checked', 'true')
      await answerFact(again, ['Amount', 'AUD 42k'])
      for (const next of [
        "Leave the rest for now: go to What you'd study",
        "Next: where and how you'd live",
        'Next: after you graduate',
        'Show me three futures',
      ]) {
        await again.getByRole('link', { name: next }).click()
      }
      await expect(again).toHaveURL(/\/futures$/)
      await expect(
        again.getByRole('button', { name: 'Budget about AUD 42k a year' }).first(),
      ).toBeVisible()
    } finally {
      await again.context().close()
    }
  } finally {
    await deleteUsers([email])
  }
})
