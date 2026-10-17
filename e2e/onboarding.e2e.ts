import { expect, test } from '@playwright/test'
import { deleteUsers, profileOf } from './helpers/db'
import { devLogin } from './helpers/login'
import {
  answerFact,
  card,
  newStudent,
  signOutViaMenu,
  skipSplash,
  startOnboarding,
} from './helpers/student'

// The onboarding shell around step 01: its answer cards by keyboard alone, Sign out and coming
// back to her first unanswered question, the refusal of a signed-out visitor, the panel marking
// step 00 Done, and the 1440 design scaled up at 1920.

/** Step 02's first question, where a new student opens it. */
const STUDY_FIRST = 'Do you know what you want to study?'

test('step 01 answers by keyboard alone: arrows, Home and End pick as they move', async ({
  page,
}) => {
  const email = await newStudent(page, 'onboarding-keys')
  try {
    await page.goto('/onboarding/facts/covers')
    const heading = page.getByRole('heading', { level: 1, name: 'It covers' })
    await expect(heading).toBeVisible()
    await heading.focus()
    await page.keyboard.press('Tab')
    await expect(card(page, 'It covers', 'Fees only')).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await expect(card(page, 'It covers', 'Fees and living')).toBeFocused()
    await expect(card(page, 'It covers', 'Fees and living')).toHaveAttribute('aria-checked', 'true')
    await expect
      .poll(async () => (await profileOf(email))?.answers.covers)
      .toEqual({ value: 'Fees and living', state: 'stated' })

    await page.keyboard.press('End')
    await expect(card(page, 'It covers', 'Not sure')).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Home')
    await expect(card(page, 'It covers', 'Fees only')).toHaveAttribute('aria-checked', 'true')
    await expect(card(page, 'It covers', 'Not sure')).toHaveAttribute('aria-checked', 'false')
    await expect
      .poll(async () => (await profileOf(email))?.answers.covers)
      .toEqual({ value: 'Fees only', state: 'stated' })
  } finally {
    await deleteUsers([email])
  }
})

test('Sign out on step 01 leaves for the sign-in page; signing in again resumes her', async ({
  page,
}) => {
  const email = await newStudent(page, 'onboarding-signout')
  try {
    await startOnboarding(page)
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await answerFact(page, ['Where are you right now?', 'Nepal'])
    await answerFact(page, ['Amount', 'AUD 36k'])

    await signOutViaMenu(page)
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '')
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()

    await devLogin(page, email, 'E2E Student', { surface: 'student' })
    await page.goto('/')
    await expect(page).toHaveURL(/\/onboarding\/facts\/covers$/)
    await expect(page.getByRole('heading', { level: 1, name: 'It covers' })).toBeVisible()
    await page.goto('/onboarding/facts/where')
    await expect(card(page, 'Where are you right now?', 'Nepal')).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.goto('/onboarding/facts/amount')
    await expect(card(page, 'Amount', 'AUD 36k')).toHaveAttribute('aria-checked', 'true')
  } finally {
    await deleteUsers([email])
  }
})

test('a signed-out visit to step 01 gets the sign-in page instead', async ({ page }) => {
  await skipSplash(page)
  await page.goto('/onboarding/facts/where')
  await expect(page).toHaveURL((url) => url.pathname === '/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.getByRole('radiogroup')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Where are you right now?' })).toHaveCount(0)
})

test("step 00's Start opens step 01, the panel marking step 00 Done", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const email = await newStudent(page, 'onboarding-panel')
  try {
    await startOnboarding(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)

    const steps = page.getByRole('list', { name: 'Your steps' }).getByRole('listitem')
    await expect(steps).toHaveCount(6)
    await expect(steps.nth(0)).toContainText('Your comic character')
    await expect(steps.nth(0)).toContainText('Done')
    await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step')
    await expect(steps.nth(1)).toContainText('Now · 1/10')
  } finally {
    await deleteUsers([email])
  }
})

test('Start on step 00 opens question 1 even after she has answered it and come back', async ({
  page,
}) => {
  const email = await newStudent(page, 'onboarding-restart')
  try {
    await startOnboarding(page)
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    // The tap moves on to the next question by itself.
    await answerFact(page, ['Where are you right now?', 'Nepal'])
    await expect(page).toHaveURL(/\/onboarding\/facts\/amount$/)

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/character$/)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await expect(page.getByText('Facts about you · 1 of 10', { exact: true })).toBeVisible()
  } finally {
    await deleteUsers([email])
  }
})

test('at 1920 wide the 1440 design scales up: the question is 56px', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  const email = await newStudent(page, 'onboarding-wide')
  try {
    await page.goto('/onboarding/facts/where')
    const heading = page.getByRole('heading', { level: 1, name: 'Where are you right now?' })
    await expect(heading).toBeVisible()
    // The fluid type role computes to 55.9999px here: 56px to the nearest half pixel.
    const size = await heading.evaluate((h) => Number.parseFloat(getComputedStyle(h).fontSize))
    expect(size).toBeCloseTo(56, 0)
  } finally {
    await deleteUsers([email])
  }
})

test('at 1920 wide icons keep their pixel size while the button around them scales', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  const size = (svg: Element) => {
    const { width, height } = svg.getBoundingClientRect()
    return { width, height }
  }
  await skipSplash(page)
  await page.goto('/')
  const toggle = page.getByRole('button', { name: /^Switch to (dark|light) theme$/ })
  await expect(toggle).toBeVisible()
  // The entrance animation zooms the icon in; measure it once it has settled.
  await page.waitForTimeout(1500)
  expect(await toggle.locator('svg').evaluate(size)).toEqual({ width: 16, height: 16 })
  expect((await toggle.boundingBox())?.width).toBeGreaterThanOrEqual(58)

  const email = await newStudent(page, 'onboarding-icons')
  try {
    await page.goto('/onboarding/character')
    await page.getByRole('button', { name: 'Menu: theme and sign out' }).click()
    const menu = page.getByRole('menu', { name: 'Menu' })
    await expect(menu).toBeVisible()
    await page.waitForTimeout(1500)
    for (const item of await menu
      .getByRole('menuitemcheckbox')
      .or(menu.getByRole('menuitem'))
      .all()) {
      expect(await item.locator('svg').first().evaluate(size)).toEqual({ width: 16, height: 16 })
    }
    await page.keyboard.press('Escape')
    const start = page.getByRole('button', { name: 'Continue' })
    await expect(start).toBeVisible()
    expect(await start.locator('svg').evaluate(size)).toEqual({ width: 14, height: 14 })
  } finally {
    await deleteUsers([email])
  }
})

test('at 2560 wide the header action stays inside the centred 1920 frame', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  const insideFrame = (el: Element) =>
    el.getBoundingClientRect().right <= (window.innerWidth + 1920) / 2
  await skipSplash(page)
  await page.goto('/')
  const toggle = page.getByRole('button', { name: /^Switch to (dark|light) theme$/ })
  await expect(toggle).toBeVisible()
  expect(await toggle.evaluate(insideFrame)).toBe(true)

  const email = await newStudent(page, 'onboarding-corner')
  try {
    await page.goto('/onboarding/facts/where')
    const menu = page.getByRole('button', { name: 'Menu: theme and sign out' })
    await expect(menu).toBeVisible()
    expect(await menu.evaluate(insideFrame)).toBe(true)
  } finally {
    await deleteUsers([email])
  }
})

test('in a window shorter than the panel, scrolling to the end reveals the panel bottom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  const email = await newStudent(page, 'onboarding-short')
  try {
    for (const path of ['/onboarding/facts/where', '/onboarding/character']) {
      await page.goto(path)
      await expect(page.getByRole('complementary', { name: 'Getting started' })).toBeVisible()
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expect(
        page
          .getByRole('complementary', { name: 'Getting started' })
          .getByText('From off course to “Of Course!”'),
      ).toBeInViewport({ ratio: 1 })
    }
  } finally {
    await deleteUsers([email])
  }
})

test('in a tall window the panel stays put at the top while the step scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const email = await newStudent(page, 'onboarding-sticky')
  try {
    await page.goto('/onboarding/facts/where')
    const panel = page.getByRole('complementary', { name: 'Getting started' })
    await expect(panel).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    // Within half a pixel: the layout's fractional sizes round (0.2 px seen at 1440 × 900).
    expect(await panel.evaluate((p) => p.getBoundingClientRect().top)).toBeCloseTo(0, 0)
  } finally {
    await deleteUsers([email])
  }
})

test('the retired paths redirect permanently to their /onboarding screens', async ({ request }) => {
  for (const [from, to] of [
    ['/picture', '/onboarding/character'],
    ['/opening/facts?q=hard', '/onboarding/facts?q=hard'],
    ['/opening/study', '/onboarding/study'],
    ['/opening/living', '/onboarding/living'],
    ['/opening/after', '/onboarding/after'],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 })
    expect(response.status(), from).toBe(308)
    expect(response.headers().location, from).toBe(to)
  }
})

test('a retired link lands on its screen; an unknown question is not a page', async ({ page }) => {
  const email = await newStudent(page, 'onboarding-retired')
  try {
    // The old ?q is dropped: /onboarding/facts resumes at her first unanswered question.
    await page.goto('/opening/facts?q=hard')
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Where are you right now?' }),
    ).toBeVisible()

    await page.goto('/opening/study')
    await expect(page).toHaveURL(/\/onboarding\/study\/know$/)
    await expect(page.getByRole('heading', { level: 1, name: STUDY_FIRST })).toBeVisible()

    // notFound(): Next's not-found screen, answered as a real 404 (no loading boundary streams it).
    for (const path of [
      '/onboarding/facts/nope',
      '/onboarding/facts/hard',
      '/onboarding/study/nope',
      '/onboarding/nope',
    ]) {
      await page.goto(path)
      await expect(page.getByText('This page could not be found.'), path).toBeVisible()
      await expect(page.getByRole('radiogroup'), path).toHaveCount(0)
    }
  } finally {
    await deleteUsers([email])
  }
})

test('/onboarding resumes: the welcome for a new student, then her first unanswered question', async ({
  page,
}) => {
  const email = await newStudent(page, 'onboarding-resume')
  try {
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/onboarding\/welcome$/)
    await page.getByRole('link', { name: 'Start' }).click()
    await expect(page).toHaveURL(/\/onboarding\/character$/)
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await answerFact(page, ['Where are you right now?', 'Nepal'])

    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/onboarding\/facts\/amount$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Amount' })).toBeVisible()
    await page.goto('/onboarding/facts')
    await expect(page).toHaveURL(/\/onboarding\/facts\/amount$/)
  } finally {
    await deleteUsers([email])
  }
})

test('/onboarding reopens step 02 when she left from there, as / does', async ({ page }) => {
  const email = await newStudent(page, 'onboarding-resume-study')
  try {
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/onboarding\/welcome$/)
    await page.getByRole('link', { name: 'Start' }).click()
    await expect(page).toHaveURL(/\/onboarding\/character$/)
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
    await page.getByRole('link', { name: 'Leave the rest for now' }).click()
    await expect(page).toHaveURL(/\/onboarding\/study\/know$/)
    await expect(page.getByRole('heading', { level: 1, name: STUDY_FIRST })).toBeVisible()

    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/onboarding\/study\/know$/)
    await expect(page.getByRole('heading', { level: 1, name: STUDY_FIRST })).toBeVisible()
  } finally {
    await deleteUsers([email])
  }
})
