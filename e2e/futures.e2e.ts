import { expect, type Page, test } from '@playwright/test'
import { deleteUsers, profileOf } from './helpers/db'
import { answerOpening, newStudent, PRIYA, tap } from './helpers/student'

// The futures screen for Priya's answers at AUD 36k (helpers/student.ts): three unranked futures
// with their marked lines, distances from Anjali, claims and sources, the plaque and Remind me;
// then a chip redraws all three at once, saved as stated, and Undo puts it back; and the edge
// states: another field, a hard limit that keeps one route or none, not staying, an area the
// preview lacks, and the same futures on a reload.

const chip = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).first()
const routes = (page: Page) => page.getByRole('article').getByRole('heading', { level: 3 })

/** `heading`: the editor's question as it reads, with its own end mark. */
async function choose(page: Page, chipName: string, heading: string, value: string) {
  await chip(page, chipName).click()
  await expect(page.getByText(`${heading} All three futures redraw.`)).toBeVisible()
  await page.getByRole('button', { name: value, exact: true }).click()
}

test("Priya's three futures, and a chip that redraws them", async ({ page }) => {
  const email = await newStudent(page, 'futures')
  try {
    await answerOpening(page, PRIYA)

    for (const h of ['Built around cost', 'Built around staying', 'Built around career']) {
      await expect(page.getByText(h)).toBeVisible()
    }
    await expect(page.getByRole('article')).toHaveCount(3)
    await expect(
      page.getByText('Adelaide: a 3½-hour flight from Anjali in Perth · estimate'),
    ).toBeVisible()
    await expect(
      page.getByText(/^ECU Joondalup: about \d+ min from Anjali in Cannington · estimate$/),
    ).toBeVisible()
    await expect(page.getByText('▲ Gives you').first()).toBeVisible()
    await expect(page.getByText("We're not sure about this yet.").first()).toBeVisible()

    // How we know reveals a source.
    await page.getByRole('button', { name: 'How we know' }).first().click()
    await expect(page.getByText(/^Source: .+ · .+/).first()).toBeVisible()

    // PR shows as a band, never a percentage.
    const prLines = page.getByRole('listitem').filter({ hasText: /^PR · / })
    await expect(prLines).toHaveCount(3)
    for (const text of await prLines.allInnerTexts()) expect(text).not.toMatch(/%/)

    // The plaque lists each dimension with its reason; no Family.
    await page.getByRole('button', { name: 'Your weights' }).click()
    const plaque = page.getByRole('dialog', { name: 'Your weights' })
    await expect(plaque).toBeVisible()
    for (const dim of ['Cost', 'Time', 'Work', 'PR', 'Location', 'Career']) {
      await expect(plaque.getByText(dim, { exact: true })).toBeVisible()
    }
    await expect(plaque.getByText('A rough budget: 2')).toBeVisible()
    await expect(
      plaque.getByText('Stay after: yes · 3 · routes with no PR path seal'),
    ).toBeVisible()
    await expect(plaque.getByText(/family/i)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(plaque).toBeHidden()

    // Remind me stores one reminder.
    await page.getByRole('button', { name: 'Remind me' }).first().click()
    await expect(
      page.getByText("Reminder saved. You'll see it in your feed once it's ready."),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reminder set' })).toBeDisabled()
    await expect.poll(async () => (await profileOf(email))?.reminders.length).toBe(1)

    // No forbidden words and no internal names; the title says OfCourse; "mock" appears.
    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/ranked 1st|\bbest\b|recommended/i)
    expect(text).not.toMatch(/Heubert|Expert|\bEdge\b|\bCRM\b/)
    await expect(page).toHaveTitle(/OfCourse/)
    await expect(page.getByText(/\bmock\b/i).first()).toBeVisible()

    // The redraw: within 500 ms of choosing, changed rows marked, saved as stated.
    await chip(page, 'Budget about AUD 36k a year').click()
    await expect(page.getByText('Your budget per year. All three futures redraw.')).toBeVisible()
    await page.getByRole('button', { name: 'AUD 42k' }).click()
    await expect(page.getByText(/^Redrawn: budget about AUD 42k a year$/).first()).toBeVisible({
      timeout: 500,
    })
    await expect(page.getByText('Changed with your answer').first()).toBeVisible()
    await expect(chip(page, 'Budget about AUD 42k a year')).toBeVisible()
    await expect
      .poll(async () => (await profileOf(email))?.answers.amount)
      .toEqual({ value: 42, state: 'stated' })

    // Undo (the toast's button) brings the 36k lines back.
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(chip(page, 'Budget about AUD 36k a year')).toBeVisible()
    await expect(
      page.getByText('Fees about AUD 27k a year: within your budget, AUD 9k spare'),
    ).toBeVisible()
    await expect(page.getByText('Changed with your answer')).toHaveCount(0)
    await expect
      .poll(async () => (await profileOf(email))?.answers.amount)
      .toEqual({ value: 36, state: 'stated' })
  } finally {
    await deleteUsers([email])
  }
})

test('chips change the routes, and the edge states say why', async ({ page }) => {
  const email = await newStudent(page, 'futures-edges')
  try {
    await answerOpening(page, PRIYA)
    await expect(page.getByRole('article')).toHaveCount(3)

    // Another field: the routes change to courses that exist for it.
    await choose(page, 'Field: Cyber security', "What you'd study.", 'Data science')
    await expect(routes(page).first()).toContainText('Data Science')
    for (const route of await routes(page).allInnerTexts()) {
      expect(route).not.toContain('Cyber Security')
    }
    await choose(page, 'Field: Data science', "What you'd study.", 'Cyber security')
    await expect(routes(page)).toHaveCount(3)

    // A hard limit of 30k: one future, and the line that says why and names the chip.
    await choose(page, 'A rough budget', 'Is this a hard limit, or roughly?', 'Hard limit')
    await choose(page, 'Budget about AUD 36k a year', 'Your budget per year.', 'AUD 30k')
    await expect(page.getByText('Only one route fits a hard limit of AUD 30k')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(1)

    // A hard limit of 24k: sealed, never blank, each road with how far over it is.
    await choose(page, 'Budget about AUD 30k a year', 'Your budget per year.', 'AUD 24k')
    await expect(page.getByRole('heading', { name: 'Sealed at your hard limit' })).toBeVisible()
    await expect(page.getByText(/^AUD \d+k over your hard limit$/)).toHaveCount(3)
    await expect(chip(page, 'Budget about AUD 24k a year')).toBeVisible()
    await choose(page, 'Budget about AUD 24k a year', 'Your budget per year.', 'AUD 36k')
    await expect(page.getByRole('article')).toHaveCount(3)
    await choose(page, 'A hard limit', 'Is this a hard limit, or roughly?', 'Roughly')
    await expect(chip(page, 'A rough budget')).toBeVisible()

    // Not staying: PR counts for nothing.
    await choose(page, 'Wants to stay after', 'Would you want to stay after?', 'No')
    await expect(page.getByText("PR doesn't count here: you don't plan to stay")).toHaveCount(3)
    await expect
      .poll(async () => (await profileOf(email))?.answers.stay)
      .toEqual({ value: 'No', state: 'stated' })

    // An area the preview lacks: the nearest field, said on each card (criterion 44).
    await page.goto('/onboarding/study')
    await tap(page, ['Do you know what you want to study?', "A few areas I'm drawn to"])
    await tap(page, ['Pick up to three', 'Health'])
    await expect
      .poll(async () => (await profileOf(email))?.answers.areas)
      .toEqual({ value: ['Health'], state: 'stated' })
    await page.goto('/futures')
    await expect(page.getByRole('article').first()).toBeVisible()
    const note = 'No health courses in this preview, so these use psychology.'
    const cards = page.getByRole('article')
    await expect(page.getByText(note)).toHaveCount(await cards.count())
    for (const card of await cards.all()) await expect(card.getByText(note)).toBeVisible()

    // A reload draws the same futures with the same lines.
    const before = await page.getByRole('article').allInnerTexts()
    await page.reload()
    await expect(page.getByRole('article')).toHaveCount(before.length)
    expect(await page.getByRole('article').allInnerTexts()).toEqual(before)
  } finally {
    await deleteUsers([email])
  }
})
