import { expect, type Page, test } from '@playwright/test'
import { deleteUsers, profileOf } from './helpers/db'
import { answerFact, card, newStudent, startOnboarding, tap } from './helpers/student'

// The picture question, steps 01 and 02 one question per screen, and screens 3–4, on a phone
// and on desktop: the character is never set from the account, step 01 opens fast, every tap has
// its impact line at once, "Not sure" becomes an assumption, Back keeps answers, the relative's
// form, and on to the futures.

const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true })
const LEAVE = "Leave the rest for now: go to What you'd study"
const KNOW = 'Do you know what you want to study?'

for (const size of SIZES) {
  test(`a new student answers the opening at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    const email = await newStudent(page, 'opening')
    try {
      // A new student reaches the picture question through the welcome; the character is not set
      // from the account.
      await startOnboarding(page)
      await expect(
        page.getByRole('heading', { name: 'How would you like your comic character drawn?' }),
      ).toBeVisible()
      expect((await profileOf(email))?.persona ?? null).toBeNull()

      // Start opens step 01's first question within 3 s.
      await page.getByRole('button', { name: 'Female' }).click()
      const t0 = Date.now()
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Where are you right now?' }),
      ).toBeVisible()
      expect(Date.now() - t0).toBeLessThan(3000)
      expect((await profileOf(email))?.persona).toBe('female')
      await expect(page.getByText('Facts about you · 1 of 11', { exact: true })).toBeVisible()
      // The panel: the step list side by side (from 1024 wide), the band's "Step 1 of 6." below.
      if (size.width >= 1024) {
        await expect(
          page.getByRole('list', { name: 'Your steps' }).locator('[aria-current="step"]'),
        ).toContainText('Facts about you')
      } else {
        await expect(page.getByText('Step 1 of 6.', { exact: true })).toBeVisible()
      }

      // Back from the first question reopens the picture question with her choice; Start returns.
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(page).toHaveURL(/\/onboarding\/character$/)
      await expect(page.getByRole('button', { name: 'Female' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)

      // An impact line within 300 ms of a tap; onshore and offshore read differently.
      await card(page, 'Where are you right now?', 'Nepal').click()
      await expect(page.getByText('Nepal: visa required · study fees apply')).toBeVisible({
        timeout: 300,
      })
      await card(page, 'Where are you right now?', 'Australia (on a visa)').click()
      await expect(page.getByText(/^In Australia: you may apply onshore/)).toBeVisible({
        timeout: 300,
      })
      await expect(page.getByText('Nepal: visa required · study fees apply')).toHaveCount(0)

      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page).toHaveURL(/\/onboarding\/facts\/amount$/)
      await card(page, 'Amount', 'AUD 36k').click()
      await expect(
        page.getByText("About AUD 36k a year. Tell me if it's a hard limit."),
      ).toBeVisible({ timeout: 300 })

      // "Not sure" stores the default, assumed, and the line says so.
      await card(page, 'Amount', 'Not sure').click()
      await expect(
        page.getByText("Not sure: I'll assume “AUD 30k” and show it as a chip you can change."),
      ).toBeVisible({ timeout: 300 })
      await expect
        .poll(async () => (await profileOf(email))?.answers.amount)
        .toEqual({ value: 30, state: 'assumed' })

      // Partner: saved, no follow-up form, and family isn't covered yet.
      await answerFact(page, ['Anyone coming with you?', 'Partner'])
      await expect(
        page.getByText(
          "Family isn't covered in this preview yet, so every route shows costs for you alone.",
        ),
      ).toBeVisible()
      await expect(page.getByRole('textbox')).toHaveCount(0)
      await expect
        .poll(async () => (await profileOf(email))?.answers.dep)
        .toEqual({ value: 'Partner', state: 'stated' })

      // Back keeps answers: step 02's Back on its first question lands on step 01's last question.
      await page.getByRole('link', { name: LEAVE }).click()
      await expect(page).toHaveURL(/\/onboarding\/study\/know$/)
      await expect(page.getByRole('heading', { level: 1, name: KNOW })).toBeVisible()
      if (size.width >= 1024) {
        await expect(
          page.getByRole('list', { name: 'Your steps' }).locator('[aria-current="step"]'),
        ).toContainText("What you'd study")
      } else {
        await expect(page.getByText('Step 2 of 6.', { exact: true })).toBeVisible()
      }
      await card(page, KNOW, 'Suggest me').click()
      await expect(page.getByText('Saved. Tap another answer to change it.')).toBeVisible()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(page).toHaveURL(/\/onboarding\/facts\/english$/)
      await expect(page.getByRole('heading', { level: 1, name: 'English test' })).toBeVisible()
      await page.goto('/onboarding/facts/amount')
      await expect(card(page, 'Amount', 'Not sure')).toHaveAttribute('aria-checked', 'true')
      // Step 02 opens at her first open question; Back finds her answer.
      await page.getByRole('link', { name: LEAVE }).click()
      await expect(page).toHaveURL(/\/onboarding\/study\/level$/)
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(page).toHaveURL(/\/onboarding\/study\/know$/)
      await expect(card(page, KNOW, 'Suggest me')).toHaveAttribute('aria-checked', 'true')

      // Screen 3: "Do you know anyone…" only after community, and not with "No".
      await page
        .getByRole('link', { name: "Leave the rest for now: go to Where and how you'd live" })
        .click()
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
