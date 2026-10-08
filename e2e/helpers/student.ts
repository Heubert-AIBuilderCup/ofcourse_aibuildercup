// The student app's pages (APP_PATHS in src/shared/lib/auth/gate.ts): where a signed-in user
// account may land, wherever she left off. And the walk through them a spec repeats: a new
// student, and opening screens 1–4 answered by the options' visible names.

import { expect, type Page } from '@playwright/test'
import { freshEmail } from './accounts'
import { devLogin } from './login'

export const STUDENT_APP_URL = /\/(start|onboarding(\/[a-z-]+)*|futures|attention)$/

/**
 * Mark the splash as already seen in this tab (SPLASH_SEEN_KEY in
 * src/features/opening/components/Splash.tsx), so the page removes it as soon as it hydrates and
 * it never covers the page a spec is testing. Call before the first goto.
 */
export async function skipSplash(page: Page): Promise<void> {
  await page.addInitScript(() => sessionStorage.setItem('ofcourse:splash', 'seen'))
}

/**
 * A fresh student, signed in on the student page with no splash; returns her email. Delete her
 * with db.deleteUsers([email]).
 */
export async function newStudent(page: Page, label: string): Promise<string> {
  const email = freshEmail(label)
  await skipSplash(page)
  await devLogin(page, email, 'E2E Student', { surface: 'student' })
  return email
}

/** A question (or a relative-form field) by its visible name, and the option to give it. */
export type Tap = readonly [question: string, option: string]
export type OpeningAnswers = Partial<Record<'facts' | 'study' | 'living' | 'after', readonly Tap[]>>

// Opening screens 2–4; step 01 asks one question per screen (answerFact).
const SCREENS = [
  { step: 'study', title: "What you'd study", next: "Next: where and how you'd live" },
  { step: 'living', title: "Where and how you'd live", next: 'Next: after you graduate' },
  { step: 'after', title: 'After you graduate', next: 'Show me three futures' },
] as const

/**
 * Answer one question as she would: a select by the option's label, a text field by typing (and
 * leaving it, which saves it), else the option's button in the question's group.
 */
export async function tap(page: Page, [question, option]: Tap): Promise<void> {
  const select = page.getByRole('combobox', { name: question, exact: true })
  if ((await select.count()) > 0) {
    await select.selectOption({ label: option })
    return
  }
  const field = page.getByRole('textbox', { name: question, exact: true })
  if ((await field.count()) > 0) {
    await field.fill(option)
    await field.blur()
    return
  }
  const button = page
    .getByRole('group', { name: question, exact: true })
    .getByRole('button', { name: option, exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}

// Step 01's questions as the screen asks them, to their slugs as PRODUCT.md lists them: each has
// its own screen at /onboarding/facts/<slug>. Written out, not imported, so a slug renamed in the
// product breaks these tests instead of being followed by them.
const FACT_SLUGS: Readonly<Record<string, string>> = {
  'Where are you right now?': 'where',
  Amount: 'amount',
  'It covers': 'covers',
  'Who pays': 'who-pays',
  'Is this a hard limit, or roughly?': 'limit',
  'Earliest start': 'earliest',
  "Latest you'd accept": 'latest',
  "Most years you'd give it": 'years',
  'Anyone coming with you?': 'coming',
  'Last qualification': 'qualification',
  'English test': 'english',
}

/** The URL of a step 01 question's screen, by the question it asks. */
export function factUrl(question: string): string {
  const slug = FACT_SLUGS[question]
  if (!slug) throw new Error(`Not a step 01 question: ${question}`)
  return `/onboarding/facts/${slug}`
}

/** A step 01 answer card, in the radiogroup its question's h1 names. */
export const card = (page: Page, question: string, name: string) =>
  page.getByRole('radiogroup', { name: question }).getByRole('radio', { name, exact: true })

/**
 * Answer a step 01 question on its own screen: open it by URL, tap the option's card in the
 * question's radiogroup, and wait until the screen says the answer is saved.
 */
export async function answerFact(page: Page, [question, option]: Tap): Promise<void> {
  await page.goto(factUrl(question))
  const chosen = card(page, question, option)
  await chosen.click()
  await expect(chosen).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Saved. Tap another answer to change it.')).toBeVisible()
}

/**
 * Answer step 01's listed questions one screen each, then walk screens 2–4 from the first, giving
 * each the taps listed for it, and open the futures.
 */
export async function answerOpening(page: Page, answers: OpeningAnswers): Promise<void> {
  for (const answer of answers.facts ?? []) await answerFact(page, answer)
  await page.goto('/onboarding/study')
  for (const screen of SCREENS) {
    await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible()
    for (const answer of answers[screen.step] ?? []) await tap(page, answer)
    await page.getByRole('link', { name: screen.next }).click()
  }
  await expect(page).toHaveURL(/\/futures$/)
}

/** Priya, the design's walkthrough student (src/features/engine/fixtures.ts), at AUD 36k. */
export const PRIYA: OpeningAnswers = {
  facts: [
    ['Where are you right now?', 'Nepal'],
    ['Amount', 'AUD 36k'],
    ['It covers', 'Fees only'],
    ['Is this a hard limit, or roughly?', 'Roughly'],
    ["Latest you'd accept", 'Jul 2027'],
  ],
  study: [
    ['Do you know what you want to study?', 'Something particular'],
    ['Which field?', 'Cyber security'],
    ['Study level', "Master's"],
    ['How you like to learn', 'Hands-on with placements'],
  ],
  living: [
    ['Kind of place', 'Regional'],
    ['Does a community of similar culture, or relatives nearby, matter?', 'A little'],
    ['Do you know anyone who lives in Australia?', 'Yes'],
    ['City or suburb', 'Cannington, Perth'],
    ["They're your…", 'Cousin'],
    ['Name (optional)', 'Anjali'],
  ],
  after: [
    ['Would you want to stay after?', 'Yes'],
    ['Career-focused or academic?', 'Career-focused'],
    ['Do you need to earn while studying?', 'Helpful'],
  ],
}
