import { expect, type Page, test } from '@playwright/test'
import { deleteUsers, profileOf } from './helpers/db'
import { AREAS, answerStudy, areaCheck, card, newStudent, startOnboarding } from './helpers/student'

// Step 02 one question per screen (docs/onboarding-study/intent.md, criteria 1, 8, 9, 11, 12, 16
// and 17): each question at its own URL in the order her first answer sets, the moves in and out
// of the step, the areas' limit of three and clearing the last one, and where she lands coming back.

const KNOW = 'Do you know what you want to study?'
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/** A new student past step 00 (Skip), on step 01's first question. */
async function skipStep00(page: Page): Promise<void> {
  await startOnboarding(page)
  await button(page, 'Skip').click()
  await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
}

test('step 02 asks one question per screen, in the order her first answer sets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const email = await newStudent(page, 'study-order')
  try {
    await skipStep00(page)
    await page.goto('/onboarding/study')
    await expect(page).toHaveURL(/\/onboarding\/study\/know$/)
    await expect.poll(async () => (await profileOf(email))?.lastStep).toBe('study')
    await expect(heading(page, KNOW)).toBeVisible()
    await expect(page.getByText("What you'd study · 1 of 4", { exact: true })).toBeVisible()
    const current = page.getByRole('list', { name: 'Your steps' }).locator('[aria-current="step"]')
    await expect(current).toContainText("What you'd study")
    await expect(current).toContainText('Now · 1/4')

    // "Something particular" asks the field too: five questions.
    await card(page, KNOW, 'Something particular').click()
    await expect(page.getByText("What you'd study · 1 of 5", { exact: true })).toBeVisible()
    await button(page, 'Continue').click()
    await expect(page).toHaveURL(/\/onboarding\/study\/field$/)
    const group = page.getByText('Something particular', { exact: true })
    const field = heading(page, 'Which field?')
    await expect(field).toBeVisible()
    await expect(group).toBeVisible()
    const groupBox = await group.boundingBox()
    const fieldBox = await field.boundingBox()
    expect(groupBox && fieldBox && groupBox.y + groupBox.height <= fieldBox.y).toBe(true)
    await card(page, 'Which field?', 'Data science').click()

    // Back and forward between questions; her choice stays.
    await button(page, 'Continue').click()
    await expect(page).toHaveURL(/\/onboarding\/study\/level$/)
    await button(page, 'Back').click()
    await expect(page).toHaveURL(/\/onboarding\/study\/field$/)
    await expect(card(page, 'Which field?', 'Data science')).toHaveAttribute('aria-checked', 'true')
    await button(page, 'Continue').click()
    await expect(page).toHaveURL(/\/onboarding\/study\/level$/)
    await button(page, 'Skip').click()
    await expect(page).toHaveURL(/\/onboarding\/study\/learning$/)
    await button(page, 'Skip').click()
    await expect(page).toHaveURL(/\/onboarding\/study\/length$/)
    await expect(heading(page, "Course length you'd prefer")).toBeVisible()

    // Out of the step and back: step 03 follows the last question, and its Back returns to it.
    await button(page, "Next: Where and how you'd live").click()
    await expect(page).toHaveURL(/\/onboarding\/living$/)
    await page.getByRole('link', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/study\/length$/)
    await expect(heading(page, "Course length you'd prefer")).toBeVisible()

    // Back from the first question opens step 01's last.
    await page.goto('/onboarding/study/know')
    await button(page, 'Back').click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/english$/)
    await expect(heading(page, 'English test')).toBeVisible()
  } finally {
    await deleteUsers([email])
  }
})

test('the areas: up to three, a fourth refused, the last one removed clears her answer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const email = await newStudent(page, 'study-areas')
  try {
    // Step 02 as the browser's first page: storing its colour scheme (a cookie) refreshes the page,
    // which may land before her first answer is saved; the screen still asks the areas.
    await page.goto('/onboarding/study/know')
    await card(page, KNOW, "A few areas I'm drawn to").click()
    await button(page, 'Continue').click()
    await expect(page).toHaveURL(/\/onboarding\/study\/areas$/)
    await expect(heading(page, AREAS)).toBeVisible()

    const chosen = ['IT and computing', 'Data', 'Health']
    for (const area of chosen) await areaCheck(page, area).click()
    await expect(page.getByText('3 of 3 chosen', { exact: true })).toBeVisible()
    await expect
      .poll(async () => (await profileOf(email))?.answers.areas)
      .toEqual({ value: chosen, state: 'stated' })
    const saved = page.getByText('Saved. Tap an area again to remove it.')
    await expect(saved).toBeVisible()

    // A fourth is refused: nothing checked, nothing sent, nothing stored.
    await areaCheck(page, 'Business').click()
    await expect(
      page.getByText("Three is the most for now. Tap one you've chosen to make room."),
    ).toBeVisible()
    await expect(areaCheck(page, 'Business')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByText('3 of 3 chosen', { exact: true })).toBeVisible()
    await expect(saved).toBeVisible()
    await expect(page.getByText('Saving…')).toHaveCount(0)
    expect((await profileOf(email))?.answers.areas).toEqual({ value: chosen, state: 'stated' })

    // Removing all three clears the answer, as if never given.
    for (const area of chosen) await areaCheck(page, area).click()
    await expect(page.getByText('0 of 3 chosen', { exact: true })).toBeVisible()
    await expect.poll(async () => (await profileOf(email))?.answers.areas).toBeUndefined()
    await page.reload()
    await expect(page.getByText('0 of 3 chosen', { exact: true })).toBeVisible()
    await expect(button(page, 'Skip')).toBeVisible()
  } finally {
    await deleteUsers([email])
  }
})

test('coming back: the bare step, a question not asked, an unknown slug, and /', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const email = await newStudent(page, 'study-return')
  try {
    await skipStep00(page)
    await answerStudy(page, [KNOW, 'Suggest me'])

    await page.goto('/onboarding/study')
    await expect(page).toHaveURL(/\/onboarding\/study\/level$/)
    await expect(heading(page, 'Study level')).toBeVisible()
    // The field is asked only after "Something particular".
    await page.goto('/onboarding/study/field')
    await expect(page).toHaveURL(/\/onboarding\/study\/level$/)
    await expect(heading(page, 'Study level')).toBeVisible()

    await page.goto('/onboarding/study/nope')
    await expect(page.getByText('This page could not be found.')).toBeVisible()
    await expect(page.getByRole('radiogroup')).toHaveCount(0)

    await page.goto('/')
    await expect(page).toHaveURL(/\/onboarding\/study\/level$/)
    await expect(heading(page, 'Study level')).toBeVisible()
  } finally {
    await deleteUsers([email])
  }
})
