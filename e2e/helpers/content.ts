// The content specs' sources and steps: the demo sources as the app knows them, a way to make
// any of them not a demo, the guard that keeps e2e off the real models, and one helper per step
// screen (/admin/posts/<id>/<step>): Make post, idea cards, text versions, images, settings, and
// a post from before the looks, which no screen makes any more.

import { expect, type Locator, type Page } from '@playwright/test'
import { DEMO_SOURCES } from '../../src/features/content/demo-sources'
import { makeLegacy } from './db'
import { DEV_LOGIN_HEADER } from './login'

export type Source = { title: string; text: string }

function demo(key: string): Source {
  const found = DEMO_SOURCES.find((s) => s.key === key)
  if (!found) throw new Error(`No demo source ${key}`)
  return { title: found.title, text: found.text }
}

/** "Paid work and grades", exactly as rehearsed: a demo source, so a failed step may replay. */
export const PAID_WORK = demo('paid-work')
/** Its twin, whose title carries the planted claim (11 points where ¶3 says 9). */
export const TWIN = demo('paid-work-twin')

/**
 * The text made not a demo: a closing sentence on its last paragraph, so no replay applies and
 * the facts the fake extracts (each paragraph's first sentence) stay the same. No digit, so no
 * number check changes.
 */
export function nonDemo(text: string): string {
  return `${text} This copy is for an end-to-end test.`
}

/** The text with `marker` (a `[fake:…]` test marker) at the end of paragraph `n` (1-based). */
export function withMarker(text: string, n: number, marker: string): string {
  return text
    .split('\n\n')
    .map((p, i) => (i === n - 1 ? `${p} ${marker}` : p))
    .join('\n\n')
}

/**
 * Stop unless the server runs the fake provider. A reused server keeps its own environment
 * (playwright.config.ts), so the spec asks it (src/app/api/ai-provider) instead of trusting it.
 */
export async function requireFakeProvider(page: Page): Promise<void> {
  const res = await page.request.get('/api/ai-provider', {
    headers: { [DEV_LOGIN_HEADER]: process.env.DEV_LOGIN_SECRET ?? '' },
  })
  const provider = res.ok() ? ((await res.json()) as { provider?: string }).provider : undefined
  if (provider !== 'fake') {
    throw new Error('Start the dev server with AI_PROVIDER=fake, or stop it')
  }
}

/**
 * Open "New feed post", open "Paste text instead", paste the source and press "Make post".
 * Returns the form, which stays on the page when the step fails.
 */
export async function pasteSource(page: Page, source: Source): Promise<Locator> {
  await page.goto('/admin/posts/new')
  const form = page.getByRole('form', { name: 'New feed post' })
  await form.getByRole('button', { name: 'Paste text instead' }).click()
  await form.getByLabel('Title', { exact: true }).fill(source.title)
  await form.getByLabel('Source', { exact: true }).fill(source.text)
  await form.getByRole('button', { name: 'Make post' }).click()
  return form
}

const POST_URL = /\/admin\/posts\/([0-9a-f-]{36})/

/** The id of the post the page opened, once it is there. */
export async function openedPostId(page: Page): Promise<string> {
  await expect(page).toHaveURL(POST_URL, { timeout: 60_000 })
  const id = POST_URL.exec(page.url())?.[1]
  if (!id) throw new Error(`Not a post: ${page.url()}`)
  return id
}

export type Step =
  | 'source'
  | 'ideas'
  | 'outline'
  | 'text'
  | 'images'
  | 'settings'
  | 'review'
  | 'live'

/** Open one step's screen of a post (`/admin/posts/<id>` alone opens the step it is at). */
export async function openStep(page: Page, id: string, step: Step): Promise<void> {
  await page.goto(`/admin/posts/${id}/${step}`)
}

/** Wait until the page shows the step's screen. */
export async function onStep(page: Page, step: Step): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/admin/posts/[0-9a-f-]{36}/${step}(\\?|$)`), {
    timeout: 90_000,
  })
}

/** Wait on the Ideas step until "Make post" has offered its idea cards. */
export async function ideasOffered(page: Page): Promise<void> {
  await onStep(page, 'ideas')
  await expect(page.getByRole('button', { name: 'Use this idea' }).first()).toBeVisible({
    timeout: 90_000,
  })
}

/** Paste the source, make the post, and return its id once its idea cards are there. */
export async function makePost(page: Page, source: Source): Promise<string> {
  await pasteSource(page, source)
  const id = await openedPostId(page)
  await ideasOffered(page)
  return id
}

/**
 * Wait on the Text step until the versions are drafted (criterion 93): "Draft again" offers more,
 * and the first Ready version is picked for the editor (GD29), the others folded away.
 */
export async function versionsDrafted(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Draft again' })).toBeVisible({ timeout: 90_000 })
  await expect(chosenVersion(page)).toBeVisible({ timeout: 90_000 })
}

/** Unfold "Choose another version" on the Text step, where the versions not picked wait. */
export async function openOtherVersions(page: Page): Promise<void> {
  const others = page.getByRole('group', { name: 'Choose another version', exact: true })
  // Its own summary only: each version card inside it has a Details summary of its own.
  if ((await others.count()) === 0) return
  if ((await others.getAttribute('open')) === null) await others.locator(':scope > summary').click()
}

/** On the Outline step, once the idea's outline is there, "Write the slides". */
export async function writeSlides(page: Page): Promise<void> {
  await onStep(page, 'outline')
  await page.getByRole('button', { name: 'Write the slides' }).click({ timeout: 90_000 })
}

/**
 * On the Ideas step, "Use this idea" on card `n` (0-based): it opens the idea's Outline, and
 * "Write the slides" there drafts its versions on Text.
 */
export async function pickIdea(page: Page, n = 0): Promise<void> {
  await page.getByRole('button', { name: 'Use this idea' }).nth(n).click()
  await writeSlides(page)
  await onStep(page, 'text')
  await versionsDrafted(page)
}

/** Make the post and use its first idea: the post is on Text with three versions drafted. */
export async function draftedPost(page: Page, source: Source): Promise<string> {
  const id = await makePost(page, source)
  await pickIdea(page)
  return id
}

/** The chosen version on the Text step. */
export const chosenVersion = (page: Page): Locator =>
  page.getByRole('region', { name: 'Your version', exact: true })

/**
 * Version `n` (0-based) of the Text step as the chosen one. The first is picked for the editor
 * when the versions arrive (GD29: the first Ready one; every fake version is Ready), so `n` = 0
 * waits for it, and any other is used from under "Choose another version".
 */
export async function pickVersion(page: Page, n = 0): Promise<void> {
  await expect(chosenVersion(page)).toBeVisible({ timeout: 60_000 })
  if (n === 0) return
  await openOtherVersions(page)
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('button', { name: 'Use this version' }) })
    .nth(n - 1)
    .getByRole('button', { name: 'Use this version' })
    .click()
  await expect(chosenVersion(page)).toBeVisible({ timeout: 60_000 })
}

/** Choose the Pop colours and "Approve text → Images", and wait for the Images step. */
export async function approveText(page: Page): Promise<void> {
  const pop = page.getByRole('button', { name: 'Pop', exact: true })
  if ((await pop.getAttribute('aria-pressed')) !== 'true') {
    await pop.click()
    await expect(pop).toHaveAttribute('aria-pressed', 'true')
  }
  const approve = page.getByRole('button', { name: /^Approve text/ })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await approve.click()
  await onStep(page, 'images')
}

/** On the Images step, "Draw images" and wait until every picture is drawn ("Next: Settings →"). */
export async function drawImages(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Draw images/ }).click()
  await expect(page.getByRole('button', { name: 'Next: Settings →' })).toBeVisible({
    timeout: 120_000,
  })
}

/** From the drawn Images step, "Next: Settings →". */
export async function toSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Next: Settings →' }).click()
  await onStep(page, 'settings')
}

/**
 * The shortest real path from a source to the Settings step: make the post, use its first idea,
 * use its first version (after `edit`, when given), approve on Pop, draw the images, Settings.
 */
export async function settingsPost(
  page: Page,
  source: Source,
  edit?: (page: Page) => Promise<void>,
): Promise<string> {
  const id = await draftedPost(page, source)
  await pickVersion(page)
  if (edit) await edit(page)
  await approveText(page)
  await drawImages(page)
  await toSettings(page)
  return id
}

/** The legacy templates by id (GD8), the ones a post from before the looks ticks. */
export const LEGACY_TEMPLATES = {
  line: 'the-line',
  question: 'the-question',
  longRead: 'the-long-read',
  sketch: 'sketch-insight',
} as const

/**
 * A post from before the looks (GD8), which no screen makes any more: "Make post" runs to the
 * idea cards, the database helper (./db.ts makeLegacy) takes the cards away and ticks
 * `templates`, and the Text step's "Draft versions" drafts them. Returns the post's id, on Text
 * with the versions drafted.
 */
export async function legacyPost(
  page: Page,
  source: Source,
  templates: string[] = [LEGACY_TEMPLATES.line],
): Promise<string> {
  const id = await makePost(page, source)
  await makeLegacy(id, templates)
  await openStep(page, id, 'text')
  await page.getByRole('button', { name: 'Draft versions' }).click()
  await versionsDrafted(page)
  return id
}

/** On a legacy post's Text step, choose a theme and "Approve text → Images", and wait for Images. */
export async function approveLegacyText(page: Page, theme = 'Paper'): Promise<void> {
  const button = page.getByRole('button', { name: theme, exact: true })
  if ((await button.getAttribute('aria-pressed')) !== 'true') {
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  }
  const approve = page.getByRole('button', { name: /^Approve text/ })
  await expect(approve).toBeEnabled({ timeout: 60_000 })
  await approve.click()
  await onStep(page, 'images')
}

/**
 * A post from before the looks, its first The line version approved on Paper and rendered with
 * its cover art: on its Images step, with "Version 1" under the cover.
 */
export async function renderedLegacyPost(page: Page, source: Source): Promise<string> {
  const id = await legacyPost(page, source)
  await pickVersion(page)
  await approveLegacyText(page)
  const images = page.getByRole('region', { name: 'Images', exact: true })
  await images.getByRole('button', { name: 'Render', exact: true }).click()
  await expect(images.getByText('Version 1', { exact: true })).toBeVisible({ timeout: 60_000 })
  return id
}

/** The Settings step's source check: what each claim on the slides was found as. */
export const sourceCheck = (page: Page): Locator =>
  page.getByRole('region', { name: 'Source check', exact: true })

/** The Settings step's feed settings. */
export const feedSettings = (page: Page): Locator =>
  page.getByRole('region', { name: 'Feed settings', exact: true })

/**
 * On the Settings step, wait for the source check, which runs by itself after approval
 * (criterion 98), and mark each claim it could not find as editorial opinion.
 */
export async function markNotFoundAsOpinion(page: Page): Promise<void> {
  const check = sourceCheck(page)
  // Done, the check shows its summary line ("7 found in the article · 0 not found · 0 opinion");
  // its rows sit folded under "All checked sentences", the sentences not found outside it.
  await expect(check.getByText(/\d+ found in the article/).first()).toBeVisible({ timeout: 60_000 })
  const opinion = check.getByRole('button', { name: 'Mark as editorial opinion' })
  for (let left = await opinion.count(); left > 0; left--) {
    await opinion.first().click()
    await expect(opinion).toHaveCount(left - 1)
  }
}

/** On the Settings step, "Send to review → Review", and wait for the Review step. */
export async function sendToReview(page: Page): Promise<void> {
  await feedSettings(page).getByRole('button', { name: 'Send to review → Review' }).click()
  await onStep(page, 'review')
}

/** On the Review step, "Approve and publish", and wait for the Live step. */
export async function approvePublish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Approve and publish' }).click()
  await onStep(page, 'live')
  await expect(page.getByRole('region', { name: 'Live in feed', exact: true })).toBeVisible()
}

const CHECKING = 'Checking against the source…'
/** The chosen version's check, once every sentence on its slides is found in the source. */
export const CLEAN = 'Every sentence found in the source'

/** A version's strip of slides on the Text step. */
export const strip = (card: Locator): Locator =>
  card.getByRole('list', { name: 'Slides', exact: true })

/** A version's "Details" (closed by default): slot text, facts and every check row. */
const details = (card: Locator): Locator =>
  card
    .getByRole('group')
    .filter({ has: card.page().getByText('Details', { exact: true }) })
    .last()

/** Open a version's "Details" when they are closed, and return them. */
export async function openDetails(card: Locator): Promise<Locator> {
  const d = details(card)
  if (!(await d.getByRole('heading', { name: 'Fit checks' }).isVisible())) {
    await d.getByText('Details', { exact: true }).click()
  }
  return d
}

/** Select slide `n` of the chosen version in its strip. */
export async function selectSlide(card: Locator, n: number): Promise<void> {
  const button = strip(card).getByRole('button', { name: new RegExp(`^Slide ${n} · `) })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}

/**
 * Wait until the chosen version's check has landed (no button starts it) and shows `result` in
 * its Details. A change remounts the version, which closes its Details: they open on each look.
 */
export async function checked(card: Locator, result: string | RegExp): Promise<void> {
  await expect(async () => {
    const d = await openDetails(card)
    await expect(d.getByText(CHECKING)).toHaveCount(0, { timeout: 1_000 })
    await expect(d.getByText(result)).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 60_000 })
}
