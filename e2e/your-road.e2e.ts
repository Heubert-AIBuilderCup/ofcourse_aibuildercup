import { expect, type Page, test } from '@playwright/test'
import { deleteUsers, sql, userIdByEmail } from './helpers/db'
import { newStudent } from './helpers/student'

// "Your road" (/road), the board a finished student lands on: the zoom stops by their buttons and
// by the wheel, a swap and its Undo, the stack's list (Back closes it), the lesson opening and
// closing, and the phone's Road / Map switch.

/**
 * A student who has finished onboarding: signed in, her profile made by a visit to /onboarding,
 * then given a picture, her coins kept for later and "Go to your road" pressed, straight in the
 * database (the onboarding specs cover those screens). Returns her email; delete her with
 * deleteUsers([email]).
 */
async function finishedStudent(page: Page, label: string): Promise<string> {
  // Her first arrival (the duck at Australia, the hint on Perth) shows once per browser; these
  // checks start where she is, on the course.
  await page.addInitScript(() => localStorage.setItem('ofcourse:road-arrived', '1'))
  const email = await newStudent(page, label)
  await page.goto('/onboarding')
  await expect(page).toHaveURL(/\/onboarding\/welcome$/)
  const id = await userIdByEmail(email)
  if (!id) throw new Error(`No account for ${email}`)
  await sql`update student_profile set persona = 'neutral', coins = '{"state":"later"}'::jsonb,
    onboarded_at = now() where user_id = ${id}`
  return email
}

const zoom = (page: Page) => page.getByRole('group', { name: 'Zoom' })
const stop = (page: Page, name: string) => zoom(page).getByRole('button', { name, exact: true })
const card = (page: Page) => page.getByRole('complementary')

test.describe('on a laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('zooms by its stops, by − and +, and by the wheel', async ({ page }) => {
    const email = await finishedStudent(page, 'road-zoom')
    try {
      await page.goto('/road')
      await expect(stop(page, 'Level')).toHaveAttribute('aria-pressed', 'true')

      await stop(page, 'Tile').click()
      await expect(stop(page, 'Tile')).toHaveAttribute('aria-pressed', 'true')
      await expect(page).toHaveURL(/\/road\?zoom=tile$/)

      await zoom(page).getByRole('button', { name: 'Zoom out' }).click()
      await expect(stop(page, 'Level')).toHaveAttribute('aria-pressed', 'true')
      await expect(page).toHaveURL(/\/road$/)

      await stop(page, 'Whole road').click()
      await expect(
        page.getByRole('heading', { name: 'You’ve looked at 3 of 11 routes' }),
      ).toBeVisible()
      await card(page).getByRole('button', { name: 'Back to the walk' }).click()
      await expect(stop(page, 'Level')).toHaveAttribute('aria-pressed', 'true')

      // The wheel: one stop per gesture, out for a scroll down, in for a scroll up.
      const map = page.getByRole('region', { name: 'Your road, map' })
      const box = await map.boundingBox()
      if (!box) throw new Error('The map has no box')
      await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.2)
      await page.mouse.wheel(0, 240)
      await expect(stop(page, 'Whole road')).toHaveAttribute('aria-pressed', 'true')
      await expect(page).toHaveURL(/\/road\?zoom=whole$/)
      // A new gesture once the step's lock has passed.
      await page.waitForTimeout(700)
      await page.mouse.wheel(0, -240)
      await expect(stop(page, 'Level')).toHaveAttribute('aria-pressed', 'true')
    } finally {
      await deleteUsers([email])
    }
  })

  test('swaps the alternative onto her road, and Undo puts it back', async ({ page }) => {
    const email = await finishedStudent(page, 'road-swap')
    try {
      await page.goto('/road?tile=data-science-uwa-perth')
      await expect(card(page).getByText('Not visited · Course')).toBeVisible()

      await card(page).getByRole('button', { name: 'Swap onto your road' }).click()
      await expect(card(page).getByRole('heading', { level: 1 })).toHaveText('Data Science')
      await expect(card(page).getByText('You are here · Course')).toBeVisible()
      const toast = page.getByText(
        'Data Science is on your road now. The road ahead re-routed through it.',
      )
      await expect(toast).toBeVisible()
      await expect(page).toHaveURL(/\/road$/)

      await page.getByRole('button', { name: 'Undo' }).click()
      await expect(card(page).getByRole('heading', { level: 1 })).toHaveText('Cyber Security')
      await expect(toast).toBeHidden()
      await expect(
        page.getByRole('button', { name: 'Data Science, not visited. Open in the card' }),
      ).toBeAttached()
    } finally {
      await deleteUsers([email])
    }
  })

  test('opens the stack’s list from its card, and Back closes it', async ({ page }) => {
    const email = await finishedStudent(page, 'road-stack')
    try {
      await page.goto('/road?tile=more-courses-perth')
      await card(page).getByRole('button', { name: 'Show 13 more courses' }).click()
      await expect(page).toHaveURL(/\/road\?tile=more-courses-perth&open=list$/)
      await expect(page.getByRole('heading', { name: '13 more in Perth' })).toBeVisible()
      await expect(page.getByRole('group', { name: 'Filter' })).toBeVisible()

      await page.goBack()
      await expect(page).toHaveURL(/\/road\?tile=more-courses-perth$/)
      // The list is gone (its filters with it); the stack's card, also named "13 more in Perth", stays.
      await expect(page.getByRole('group', { name: 'Filter' })).toBeHidden()
      await expect(card(page).getByText('Stack · Course')).toBeVisible()
    } finally {
      await deleteUsers([email])
    }
  })

  test('opens the lesson from a step, Later closes it, Done reading marks the steps', async ({
    page,
  }) => {
    const email = await finishedStudent(page, 'road-lesson')
    const lesson = (p: Page) => p.getByRole('heading', { name: 'The Master’s years, in 3 minutes' })
    try {
      await page.goto('/road?tile=masters-cyber-security-ecu')
      const open = card(page).getByRole('link', { name: 'What happens here · 3-min lesson' })
      await open.click()
      await expect(page).toHaveURL(/\/road\/learn\/masters-years$/)
      await expect(lesson(page)).toBeVisible()

      await page.getByRole('button', { name: 'Later' }).click()
      await expect(page).toHaveURL(/\/road\?tile=masters-cyber-security-ecu$/)
      await expect(lesson(page)).toBeHidden()

      await open.click()
      await expect(lesson(page)).toBeVisible()
      await page.getByRole('button', { name: 'Done reading' }).click()
      await expect(
        page.getByText('Lesson read. The Master’s years now show as looked at.'),
      ).toBeVisible()
      await expect(lesson(page)).toBeHidden()
      await expect(
        page.getByRole('button', {
          name: 'Master’s · Cyber Security, looked at. Open in the card',
        }),
      ).toBeAttached()
    } finally {
      await deleteUsers([email])
    }
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('switches between the road as a list and the map', async ({ page }) => {
    const email = await finishedStudent(page, 'road-phone')
    try {
      await page.goto('/road')
      const views = page.getByRole('group', { name: 'Show your road as' })
      const list = page.getByRole('list', { name: 'Your road' })
      const map = page.getByRole('region', { name: 'Your road, map' })
      await expect(views.getByRole('button', { name: 'Road' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(list).toBeVisible()
      await expect(list.getByText('Late 2026 · Next · Route step')).toBeVisible()
      await expect(map).toHaveCount(0)

      await views.getByRole('button', { name: 'Map' }).click()
      await expect(page).toHaveURL(/\/road\?view=map$/)
      await expect(map).toBeVisible()
      await expect(page.getByRole('region', { name: 'Where you are' })).toBeVisible()
      await expect(list).toHaveCount(0)

      await views.getByRole('button', { name: 'Road' }).click()
      await expect(page).toHaveURL(/\/road$/)
      await expect(list).toBeVisible()

      // A pressed row opens its card in a sheet; Escape closes it.
      await list.getByRole('button', { name: 'Student visa · 500, next. Open' }).click()
      const sheet = page.getByRole('dialog', { name: 'Student visa · 500' })
      await expect(sheet).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
    } finally {
      await deleteUsers([email])
    }
  })
})
