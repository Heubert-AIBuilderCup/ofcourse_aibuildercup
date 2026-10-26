// The student app's pages (APP_PATHS in src/shared/lib/auth/gate.ts): where a signed-in user
// account may land, wherever she left off. And the walk through them a spec repeats: a new
// student, and steps 01 and 02 answered one question per screen by the options' visible names.

import { expect, type Locator, type Page } from '@playwright/test'
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

// Step 01's questions as the screen asks them (who pays is hidden since 16 Oct 2026), to their
// slugs as PRODUCT.md lists them: each has its own screen at /onboarding/facts/<slug>. Written
// out, not imported, so a slug renamed in the product breaks these tests instead of being
// followed by them.
const FACT_SLUGS: Readonly<Record<string, string>> = {
  'Where are you right now?': 'where',
  Amount: 'amount',
  'It covers': 'covers',
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
 * Tap a single-choice card not chosen yet, and wait for both things the tap does: its save comes
 * back (a server action's POST), and the screen moves on by itself, to the next question or out
 * of the step from its last (QuestionScreen's `choose`), so the URL leaves `path`.
 */
async function chooseAndMoveOn(page: Page, chosen: Locator, path: string): Promise<void> {
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.request().headers()['next-action'] !== undefined,
  )
  await chosen.click()
  await saved
  await page.waitForURL((url) => url.pathname !== path)
}

/**
 * Tap a single-choice card on the question on screen and see that question again as she left
 * it: the tap saves and moves on by itself, then Back returns to it with the card checked. Within
 * a step the screen keeps its saves, so the question still says it is saved; from a step's last
 * question Back opens it afresh from what was stored. For a check of the tapped screen that the
 * move on would otherwise race.
 */
export async function chooseAndComeBack(page: Page, chosen: Locator): Promise<void> {
  const path = new URL(page.url()).pathname
  await chooseAndMoveOn(page, chosen, path)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.waitForURL((url) => url.pathname === path)
  await expect(chosen).toHaveAttribute('aria-checked', 'true')
}

/**
 * Answer a step 01 question on its own screen: open it by URL, tap the option's card in the
 * question's radiogroup, and wait until the answer is saved and the screen has moved on.
 */
export async function answerFact(page: Page, [question, option]: Tap): Promise<void> {
  await page.goto(factUrl(question))
  await chooseAndMoveOn(page, card(page, question, option), factUrl(question))
}

// Step 02's questions as the screen asks them, to their slugs as PRODUCT.md lists them: written
// out, as FACT_SLUGS is, so a renamed slug breaks these tests.
const STUDY_SLUGS: Readonly<Record<string, string>> = {
  'Do you know what you want to study?': 'know',
  'Which field?': 'field',
  'Pick up to three': 'areas',
  'Study level': 'level',
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
 * Answer a step 02 question on its own screen: open it by URL and tap the option. The areas (a
 * multi-select, its checkbox) stay on screen until it says the answer is saved; a card is
 * waited on as `answerFact`'s is, saved and moved on.
 */
export async function answerStudy(page: Page, [question, option]: Tap): Promise<void> {
  await page.goto(studyUrl(question))
  if (question !== AREAS) {
    await chooseAndMoveOn(page, card(page, question, option), studyUrl(question))
    return
  }
  const chosen = areaCheck(page, option)
  await chosen.click()
  await expect(chosen).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Saved. Tap an area again to remove it.')).toBeVisible()
}
