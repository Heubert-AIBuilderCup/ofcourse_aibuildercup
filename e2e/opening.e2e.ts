import { expect, type Page, test } from '@playwright/test'
import { deleteUsers, profileOf } from './helpers/db'
import { newStudent, tap } from './helpers/student'

// The picture question and opening screens 1–4, on a phone and on desktop: the character is
// never set from the account, screen 1 opens fast, every tap has its impact line at once, "Not
// sure" becomes an assumption, Back keeps answers, the relative's form, and on to the futures.

const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true })
const option = (page: Page, question: string, name: string) =>
  group(page, question).getByRole('button', { name, exact: true })

for (const size of SIZES) {
  test(`a new student answers the opening at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    const email = await newStudent(page, 'opening')
    try {
      // A new student lands on the picture question; the character is not set from the account.
      await page.goto('/')
      await expect(page).toHaveURL(/\/picture$/)
      await expect(page.getByRole('heading', { name: 'How should we picture you?' })).toBeVisible()
      expect((await profileOf(email))?.persona ?? null).toBeNull()

      // Start opens screen 1 within 3 s.
      await page.getByRole('button', { name: 'Female' }).click()
      const t0 = Date.now()
      await page.getByRole('button', { name: 'Start' }).click()
      await expect(page.getByRole('heading', { name: 'Facts about you' })).toBeVisible()
      expect(Date.now() - t0).toBeLessThan(3000)
      expect((await profileOf(email))?.persona).toBe('female')
      await expect(page.getByLabel('Step 1 of 6')).toBeVisible()

      // An impact line within 300 ms of a tap.
      await option(page, 'Amount', 'AUD 36k').click()
      await expect(
        page.getByText("About AUD 36k a year. Tell me if it's a hard limit."),
      ).toBeVisible({ timeout: 300 })

      // Onshore and offshore read differently.
      const where = page.getByRole('combobox', { name: 'Where are you right now?' })
      await where.selectOption({ label: 'Australia (on a visa)' })
      await expect(page.getByText(/^In Australia: you may apply onshore/)).toBeVisible({
        timeout: 300,
      })
      await where.selectOption({ label: 'Nepal' })
      await expect(page.getByText('Nepal: visa required · study fees apply')).toBeVisible({
        timeout: 300,
      })
      await expect(page.getByText(/^In Australia:/)).toHaveCount(0)

      // "Not sure" stores the default, assumed, and the line says so.
      await option(page, 'Amount', 'Not sure').click()
      await expect(
        page.getByText("Not sure: I'll assume “AUD 30k” and show it as a chip you can change."),
      ).toBeVisible({ timeout: 300 })
      await expect
        .poll(async () => (await profileOf(email))?.answers.amount)
        .toEqual({ value: 30, state: 'assumed' })

      // Partner: saved, no follow-up form, and family isn't covered yet.
      await option(page, 'Anyone coming with you?', 'Partner').click()
      await expect(
        page.getByText(
          "Family isn't covered in this preview yet, so every route shows costs for you alone.",
        ),
      ).toBeVisible({ timeout: 300 })
      await expect(page.getByRole('textbox')).toHaveCount(0)
      await expect
        .poll(async () => (await profileOf(email))?.answers.dep)
        .toEqual({ value: 'Partner', state: 'stated' })

      // Back keeps answers.
      await page.getByRole('link', { name: "Next: what you'd study" }).click()
      await expect(page.getByRole('heading', { name: "What you'd study" })).toBeVisible()
      await expect(page.getByLabel('Step 2 of 6')).toBeVisible()
      await tap(page, ['Do you know what you want to study?', 'Suggest me'])
      await page.getByRole('link', { name: 'Back', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Facts about you' })).toBeVisible()
      await expect(option(page, 'Amount', 'Not sure')).toHaveAttribute('aria-pressed', 'true')
      await expect(option(page, 'Anyone coming with you?', 'Partner')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(where).toHaveValue('Nepal')
      await page.getByRole('link', { name: "Next: what you'd study" }).click()
      await expect(
        option(page, 'Do you know what you want to study?', 'Suggest me'),
      ).toHaveAttribute('aria-pressed', 'true')

      // Screen 3: "Do you know anyone…" only after community, and not with "No".
      await page.getByRole('link', { name: "Next: where and how you'd live" }).click()
      await expect(page.getByRole('heading', { name: "Where and how you'd live" })).toBeVisible()
      const community = 'Does a community of similar culture, or relatives nearby, matter?'
      const knows = group(page, 'Do you know anyone who lives in Australia?')
      await expect(knows).toHaveCount(0)
      await tap(page, [community, 'No'])
      await expect(knows).toHaveCount(0)
      await tap(page, [community, 'A little'])
      await expect(knows).toBeVisible()

      // Yes opens the relative form; the line gives her two nearest campuses.
      await tap(page, ['Do you know anyone who lives in Australia?', 'Yes'])
      await expect(page.getByRole('heading', { name: 'Who, and where?' })).toBeVisible()
      await tap(page, ['City or suburb', 'Cannington, Perth'])
      await tap(page, ["They're your…", 'Cousin'])
      await tap(page, ['Name (optional)', 'Anjali'])
      await expect(
        page.getByText(
          /^Anjali in Cannington, Perth: (TAFE Perth|Curtin Bentley) is about \d+ min away, (TAFE Perth|Curtin Bentley) about \d+ min · estimate\. Every route shows its distance from Anjali\.$/,
        ),
      ).toBeVisible()
      await expect
        .poll(async () => (await profileOf(email))?.relative)
        .toEqual({
          placeId: 'cannington',
          place: 'Cannington',
          relationship: 'Cousin',
          name: 'Anjali',
        })

      // Open to others: only Australia is covered.
      await tap(page, ['Destination', 'Open to others'])
      await expect(
        page.getByText(
          'Only Australia is covered in this preview, so your futures will be Australian.',
        ),
      ).toBeVisible({ timeout: 300 })

      // Screen 4 offers Yes / Not sure / No for staying.
      await page.getByRole('link', { name: 'Next: after you graduate' }).click()
      await expect(page.getByRole('heading', { name: 'After you graduate' })).toBeVisible()
      await expect(group(page, 'Would you want to stay after?').getByRole('button')).toHaveText([
        'Yes',
        'Not sure',
        'No',
      ])

      // On to the futures: Australian, with the assumed budget as a chip.
      await page.getByRole('link', { name: 'Show me three futures' }).click()
      await expect(page).toHaveURL(/\/futures$/)
      await expect(
        page.getByText(
          'Only Australia is covered in this preview, so these futures are Australian.',
        ),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Assumed: Budget about AUD 30k a year' }).first(),
      ).toBeVisible()
    } finally {
      await deleteUsers([email])
    }
  })
}
