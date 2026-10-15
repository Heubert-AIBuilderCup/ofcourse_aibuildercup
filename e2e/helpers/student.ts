// The student app's pages (APP_PATHS in src/shared/lib/auth/gate.ts): where a signed-in user
// account may land, wherever she left off. And the walk through them a spec repeats: a new
// student, and steps 01 and 02 answered one question per screen by the options' visible names.

import { expect, type Page } from '@playwright/test'
import { freshEmail } from './accounts'
import { devLogin } from './login'

export const STUDENT_APP_URL = /\/(start|roadmaps(\/[a-z0-9-]+)*|onboarding(\/[a-z-]+)*)$/

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

/**
 * From / to step 00 as a new student goes: / lands on the welcome, and its Start opens step 00
 * (Your comic character).
 */
export async function startOnboarding(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding\/welcome$/)
  await expect(page.getByRole('heading', { level: 1, name: /About \d+ minutes/ })).toBeVisible()
  await page.getByRole('link', { name: 'Start' }).click()
  await expect(page).toHaveURL(/\/onboarding\/character$/)
}

/** Sign out from an onboarding screen: open the header menu and pick Sign out. */
export async function signOutViaMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menu: theme and sign out' }).click()
  await page.getByRole('menu', { name: 'Menu' }).getByRole('menuitem', { name: 'Sign out' }).click()
}

/** A question (or a relative-form field) by its visible name, and the option to give it. */
export type Tap = readonly [question: string, option: string]

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

// Step 02's questions as the screen asks them, to their slugs as PRODUCT.md lists them: written
// out, as FACT_SLUGS is, so a renamed slug breaks these tests.
const STUDY_SLUGS: Readonly<Record<string, string>> = {
  'Do you know what you want to study?': 'know',
  'Which field?': 'field',
  'Pick up to three': 'areas',
  'Study level': 'level',
  'How you like to learn': 'learning',
  "Course length you'd prefer": 'length',
}

/** The URL of a step 02 question's screen, by the question it asks. */
export function studyUrl(question: string): string {
  const slug = STUDY_SLUGS[question]
  if (!slug) throw new Error(`Not a step 02 question: ${question}`)
  return `/onboarding/study/${slug}`
}

/** Step 02's one multi-select: the areas, checkboxes in the group its h1 names. */
export const AREAS = 'Pick up to three'

/** An area's checkbox: its name starts with the area (some add "Nearest field used for now"). */
export const areaCheck = (page: Page, area: string) =>
  page
    .getByRole('group', { name: AREAS, exact: true })
    .getByRole('checkbox', { name: new RegExp(`^${area}`) })

/**
 * Answer a step 02 question on its own screen: open it by URL, tap the option (its card, or for
 * the areas its checkbox), and wait until the screen says the answer is saved.
 */
export async function answerStudy(page: Page, [question, option]: Tap): Promise<void> {
  await page.goto(studyUrl(question))
  const areas = question === AREAS
  const chosen = areas ? areaCheck(page, option) : card(page, question, option)
  await chosen.click()
  await expect(chosen).toHaveAttribute('aria-checked', 'true')
  await expect(
    page.getByText(
      areas ? 'Saved. Tap an area again to remove it.' : 'Saved. Tap another answer to change it.',
    ),
  ).toBeVisible()
}
