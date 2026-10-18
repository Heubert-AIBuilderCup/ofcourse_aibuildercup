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

const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A step's tab by its name (ActionTabs, src/features/content/components/stage.tsx): a badge adds
 * " · 2 to fix", " · needs attention" or a count to the name a screen reader hears.
 */
export const tab = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole('tab', { name: new RegExp(`^${escaped(name)}( · .+)?$`) })

/** Open a step's tab; only the open tab's panel is in the page. */
export async function openTab(scope: Page | Locator, name: string): Promise<void> {
  const t = tab(scope, name)
  await t.click()
  await expect(t).toHaveAttribute('aria-selected', 'true')
}

/** A slide step's stage (SlideStage): the selected slide large over the filmstrip. */
export const stage = (scope: Page | Locator): Locator =>
  scope.getByRole('group', { name: 'Slides, one at a time', exact: true })

/**
 * Every slide's picture on a stage, in order: the filmstrip's thumbnails, hidden from screen
 * readers (each is heard by its button's name), so they are looked up with the hidden ones.
 */
export const stageSlides = (scope: Page | Locator): Locator =>
  scope
    .getByRole('list', { name: 'All slides', exact: true })
    .getByRole('img', { name: /^Slide \d+\b/, includeHidden: true })

/** The "!" beside an unavailable control, whose description is the reason (parts.tsx Control). */
export const whyUnavailable = (scope: Page | Locator): Locator =>
  scope.getByRole('button', { name: 'Why this is unavailable', exact: true })

/** The workbench's step bar, where a step's own action ("Send to review", "Approve") sits. */
export const stepActions = (page: Page): Locator =>
  page.getByRole('region', { name: 'Step actions', exact: true })

/**
 * Wait on the Text step until the version is drafted (criterion 93): a draft writes one and picks
 * it for the editor itself when Ready (GD29), so "Your version" is a tab; "Versions" counts it, and
 * holds the others "Draft again" adds.
 */
export async function versionsDrafted(page: Page): Promise<void> {
  await expect(tab(page, 'Your version')).toBeVisible({ timeout: 90_000 })
  await expect(tab(page, 'Versions')).toBeVisible()
}

/** Open "Versions" on the Text step, where the versions not picked wait ("Draft again" adds them). */
export async function openOtherVersions(page: Page): Promise<void> {
  await openTab(page, 'Versions')
}

/** On the Outline step, once the idea's outline is there, "Write the slides". */
export async function writeSlides(page: Page): Promise<void> {
  await onStep(page, 'outline')
  await page.getByRole('button', { name: 'Write the slides' }).click({ timeout: 90_000 })
}

/**
 * On the Ideas step, "Use this idea" on card `n` (0-based): it opens the idea's Outline, and
 * "Write the slides" there drafts its version on Text.
 */
export async function pickIdea(page: Page, n = 0): Promise<void> {
  await page.getByRole('button', { name: 'Use this idea' }).nth(n).click()
  await writeSlides(page)
  await onStep(page, 'text')
  await versionsDrafted(page)
}

/** Make the post and use its first idea: the post is on Text with its one version drafted. */

export async function draftedPost(page: Page, source: Source): Promise<string> {
  const id = await makePost(page, source)
  await pickIdea(page)
  return id
}

/** The chosen version on the Text step, in its "Your version" tab (see yourVersion). */
export const chosenVersion = (page: Page): Locator =>
  page.getByRole('region', { name: 'Your version', exact: true })

/** Open "Your version" on the Text step and return the chosen version. */
export async function yourVersion(page: Page): Promise<Locator> {
  await openTab(page, 'Your version')
  const card = chosenVersion(page)
  await expect(card).toBeVisible({ timeout: 60_000 })
  return card
}

/**
 * Version `n` (0-based) of the Text step as the chosen one. The drafting picks the first for the
 * editor itself (GD29: the first Ready one; every fake version is Ready), so `n` = 0 waits for
 * it, and any other is used from "Versions".
 */
export async function pickVersion(page: Page, n = 0): Promise<void> {
  if (n === 0) {
    await yourVersion(page)
    return
  }
  await openOtherVersions(page)
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('button', { name: 'Use this version' }) })
    .nth(n - 1)
  const angle = await card.getByRole('heading', { level: 4 }).innerText()
  await card.getByRole('button', { name: 'Use this version' }).click()
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: 'Version picked' }).first(),
  ).toBeVisible({ timeout: 60_000 })
  await expect(await yourVersion(page)).toContainText(angle)
}

/**
 * "Approve text → Images" on the Pop colours, which the drafting chose for the editor (no press
 * before Approve), and wait for the Images step.
 */
export async function approveText(page: Page): Promise<void> {
  await openTab(page, 'Style')
  await expect(page.getByRole('button', { name: 'Pop', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
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

/**
 * On a legacy post's Text step, choose a theme in "Style" (Paper, the drafting's own choice, needs
 * no press) and "Approve text → Images", and wait for Images.
 */
export async function approveLegacyText(page: Page, theme = 'Paper'): Promise<void> {
  await openTab(page, 'Style')
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
 * its cover art: on its Images step, "This slide" open on the cover, which shows "Version 1".
 */
export async function renderedLegacyPost(page: Page, source: Source): Promise<string> {
  const id = await legacyPost(page, source)
  await pickVersion(page)
  await approveLegacyText(page)
  const images = page.getByRole('region', { name: 'Images', exact: true })
  await images.getByRole('button', { name: 'Render', exact: true }).click()
  // Rendered, "Covers" opens first; the cover's version is under "This slide".
  await expect(tab(images, 'This slide')).toBeVisible({ timeout: 60_000 })
  await openTab(images, 'This slide')
  await expect(images.getByText('Version 1', { exact: true })).toBeVisible({ timeout: 60_000 })
  return id
}

/** The Settings step's source check, in its tab: what each claim on the slides was found as. */
export const sourceCheck = (page: Page): Locator =>
  page.getByRole('region', { name: 'Source check', exact: true })

/** The Settings step's feed settings: its panels, one tab at a time. */
export const feedSettings = (page: Page): Locator =>
  page.getByRole('region', { name: 'Feed settings', exact: true })

/** Open one of the Settings step's panels ("Who sees it", "Expiry"), and return the feed settings. */
export async function settingsPanel(page: Page, name: string): Promise<Locator> {
  await openTab(feedSettings(page), name)
  return feedSettings(page)
}

/** Open the Settings step's last panel, which ends with "Save settings", and return the feed settings. */
export async function lastSettingsPanel(page: Page): Promise<Locator> {
  const last = feedSettings(page)
    .getByRole('tablist', { name: 'Settings panels', exact: true })
    .getByRole('tab')
    .last()
  await last.click()
  await expect(last).toHaveAttribute('aria-selected', 'true')
  return feedSettings(page)
}

/** Open the Settings step's "Source check" panel and return the check. */
export async function openSourceCheck(page: Page): Promise<Locator> {
  await settingsPanel(page, 'Source check')
  return sourceCheck(page)
}

/**
 * Open the source check's "All checked sentences" drawer (every sentence but the ones not found),
 * and return it; Close shuts it.
 */
export async function allCheckedSentences(page: Page): Promise<Locator> {
  await sourceCheck(page).getByRole('button', { name: 'All checked sentences' }).click()
  const drawer = page.getByRole('dialog', { name: 'All checked sentences', exact: true })
  await expect(drawer).toBeVisible()
  return drawer
}

/**
 * On the Settings step, wait for the source check, which runs by itself after approval
 * (criterion 98), and mark each claim it could not find as editorial opinion.
 */
export async function markNotFoundAsOpinion(page: Page): Promise<void> {
  const check = await openSourceCheck(page)
  // Done, the check shows its summary line ("7 found in the article · 0 not found · 0 opinion");
  // the sentences not found are listed under it, the rest in the "All checked sentences" drawer.
  await expect(check.getByText(/\d+ found in the article/).first()).toBeVisible({ timeout: 60_000 })
  const opinion = check.getByRole('button', { name: 'Mark as editorial opinion' })
  for (let left = await opinion.count(); left > 0; left--) {
    await opinion.first().click()
    await expect(opinion).toHaveCount(left - 1)
  }
}

/** On the Settings step, "Send to review → Review" in the step bar, and wait for the Review step. */
export async function sendToReview(page: Page): Promise<void> {
  await stepActions(page).getByRole('button', { name: 'Send to review → Review' }).click()
  await onStep(page, 'review')
}

/** On the Review step, "Approve and publish", and wait for the Live step. */
export async function approvePublish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Approve and publish' }).click()
  await onStep(page, 'live')
  await expect(page.getByRole('region', { name: 'Live in feed', exact: true })).toBeVisible()
}

const CHECKING = 'Checking against the source…'
/** The chosen version's source check summary once nothing on its slides is left not found. */
export const CLEAN = /^\d+ found · 0 not found · \d+ opinion$/

/**
 * Open "Checks" on the Text step and return its panel: what is left to fix with its fixes
 * (the source's wording beside a sentence not found), the source check and every fit row.
 */
export async function checkResults(page: Page): Promise<Locator> {
  await openTab(page, 'Checks')
  return page.getByRole('tabpanel')
}

/** Select slide `n` in the Text step's filmstrip, under the slide shown large. */
export async function selectSlide(page: Page, n: number): Promise<void> {
  const button = stage(page)
    .getByRole('list', { name: 'All slides', exact: true })
    .getByRole('button', { name: `Slide ${n}`, exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-current', 'true')
}

/** The chosen version's field for slide `n`'s slot `label` ("Body"), in "Your version". */
export const slotField = (card: Locator, n: number, label: string): Locator =>
  card
    .getByRole('group', { name: `Slide ${n} text`, exact: true })
    .getByLabel(label, { exact: true })

/**
 * Wait until the chosen version's check has landed (no button starts it) and shows `result` in
 * "Checks", opened on each look.
 */
export async function checked(page: Page, result: string | RegExp): Promise<void> {
  await expect(async () => {
    const results = await checkResults(page)
    await expect(results.getByText(CHECKING)).toHaveCount(0, { timeout: 1_000 })
    await expect(results.getByText(result)).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 60_000 })
}
