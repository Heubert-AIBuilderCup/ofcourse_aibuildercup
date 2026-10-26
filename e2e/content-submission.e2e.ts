import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test'
import { exportName } from '../src/features/content/layout/zip'
import { canonicalJson, sha256Hex } from '../src/features/content/server/hash'
import {
  approvePublish,
  lastSettingsPanel,
  markNotFoundAsOpinion,
  nonDemo,
  onStep,
  openStep,
  openTab,
  PAID_WORK,
  renderedLegacyPost,
  requireFakeProvider,
  type Source,
  sendToReview,
  settingsPanel,
  settingsPost,
  stageSlides,
} from './helpers/content'
import {
  cacheArt,
  deletePostsBy,
  deleteUsers,
  forgetCachedArt,
  setCapabilities,
  setRole,
  sql,
} from './helpers/db'
import { signInUser, type User } from './helpers/login'

// The by-submission criteria in the browser, against the fake model provider, on the step screens
// (/admin/posts/<id>/<step>): review and publish with no slide vision check (103, amending 39), a
// social version from adapt to export (62–67), light edits (40; the cover phrase on a post from
// before the looks), cover options and a new cover (41, 102; on a post from before the looks), the
// preview in context (55) and the Nepal version
// (56–58, 60, 61). Criterion 59 (a Nepal number no fact has) is reachable only through the model's
// reworded slots, so it is proven by the unit tests. The posts move through their steps, so the
// tests run in order.
//   ed: an editor · rv: a reviewer

test.describe.configure({ mode: 'serial', timeout: 180_000 })

const WIDE = { width: 1280, height: 800 }
const PARAGRAPHS = PAID_WORK.text.split('\n\n')
const MONEY_LINE = 'AUD 499 (≈ NPR 43,900)'
const RATE_LINE = 'NPR at 88 per AUD · mock rate · 1 Oct 2026'
const WHY = 'Because you plan to work while you study'
// A 1 × 1 PNG: the image the model gives for one cover option, unlike the fake's grey square.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Paid work with its money paragraph first, so the first body slide carries AUD 499. */
const MONEY: Source = {
  title: 'Paid work, money first',
  text: [4, 1, 2, 0, 3].map((i) => PARAGRAPHS[i]).join('\n\n'),
}
/** Paid work without its money paragraph: nothing to convert. */
const NO_MONEY: Source = {
  title: 'Paid work, no money',
  text: nonDemo(PARAGRAPHS.slice(0, 4).join('\n\n')),
}
/** Paid work under a title of its own, as a post from before the looks, for its covers. */
const LEGACY_SOURCE: Source = {
  title: 'Paid work, covers before the looks',
  text: nonDemo(PAID_WORK.text),
}
/** Paid work under a title of its own, as a post from before the looks, for its cover phrase. */
const PHRASE_SOURCE: Source = {
  title: 'Paid work, a phrase before the looks',
  text: nonDemo(PAID_WORK.text),
}
/** Paid work under a title of its own, for the post that goes from its images straight to review. */
const PLAIN: Source = {
  title: 'Paid work, straight to review',
  text: nonDemo(PAID_WORK.text),
}

type Person = User & { context: BrowserContext; page: Page }
let ed: Person
let rv: Person
const contexts: BrowserContext[] = []
const cachedArt: { key: string; assetId: string }[] = []

/** The posts the steps share. */
const posts = { plain: '', money: '', noMoney: '', social: '', legacy: '', phrase: '' }

test.beforeAll(async ({ browser }) => {
  const people: Person[] = []
  for (const [label, caps] of [
    ['sub-ed', { editor: true, reviewer: false }],
    ['sub-rv', { editor: false, reviewer: true }],
  ] as const) {
    const context = await browser.newContext({ viewport: WIDE, acceptDownloads: true })
    contexts.push(context)
    const page = await context.newPage()
    const user = await signInUser(page, { label })
    // On an empty table the first account becomes a superadmin, who may do everything.
    await setRole(user.email, 'user')
    await setCapabilities(user.email, caps)
    people.push({ ...user, context, page })
  }
  ;[ed, rv] = people
  await requireFakeProvider(ed.page)
})

test.afterAll(async () => {
  for (const c of contexts) await c.close()
  for (const { key, assetId } of cachedArt) await forgetCachedArt(key, assetId)
  const emails = [ed, rv].filter(Boolean).map((p) => p.email)
  await deletePostsBy(emails)
  await deleteUsers(emails)
})

const post = (page: Page, id: string) => page.goto(`/admin/posts/${id}`)
const section = (page: Page, name: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) })
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text })
const column = (page: Page, name: string) => page.getByRole('region', { name, exact: true })

/** Press a workbench button and wait for the line that confirms it. */
async function press(page: Page, name: string, confirms: string | RegExp, scope?: Locator) {
  await (scope ?? page).getByRole('button', { name, exact: true }).click()
  // A press runs a server step (extract, render, check) on the dev server, which compiles the
  // route on first use and draws slides in-process; one worker (playwright.config.ts). How much
  // of the wait is compiling and how much is drawing has not been measured.
  await expect(toast(page, confirms).first()).toBeVisible({ timeout: 60_000 })
}

const ASSETS = '/admin/assets/'

/**
 * The stored asset each slide on the stage in `scope` shows, in order (its filmstrip); a layout
 * preview shows as its path.
 */
function slideIds(scope: Locator): Promise<string[]> {
  return stageSlides(scope).evaluateAll(
    (els, prefix) =>
      els.map((el) => {
        const path = decodeURIComponent(new URL((el as HTMLImageElement).src).pathname)
        return path.startsWith(prefix) ? path.slice(prefix.length) : path
      }),
    ASSETS,
  )
}

/** Wait until the slides in `scope` show other assets than `before`, and return them. */
async function changedIds(scope: Locator, before: string[]): Promise<string[]> {
  await expect.poll(() => slideIds(scope)).not.toEqual(before)
  return slideIds(scope)
}

/** A post's Images step, where its drawn slides are. */
async function images(page: Page, id: string): Promise<Locator> {
  await openStep(page, id, 'images')
  return region(page, 'Images')
}

/**
 * A post's Settings step, where its preview and its market versions are: the page's main area,
 * its "Market versions" panel open.
 */
async function settingsScreen(page: Page, id: string): Promise<Locator> {
  await openStep(page, id, 'settings')
  await settingsPanel(page, 'Market versions')
  return page.getByRole('main')
}

/** Each slide's fact ids per slot, from the post's current revision, and the facts it rests on. */
async function bindings(postId: string) {
  const [row] = await sql<{ factsId: string; slides: unknown }[]>`
    select a.body->>'factsId' as "factsId", a.body->'structure'->'slides' as slides
    from content_post p join content_artifact a on a.id = p.pointers->>'revisionId'
    where p.id = ${postId}`
  if (!row) throw new Error(`No revision on ${postId}`)
  const slides = (typeof row.slides === 'string' ? JSON.parse(row.slides) : row.slides) as {
    slots: Record<string, { factIds: string[] }>
  }[]
  return {
    factsId: row.factsId,
    slides: slides.map((s) =>
      Object.fromEntries(Object.entries(s.slots).map(([k, v]) => [k, v.factIds])),
    ),
  }
}

/** The SVG and PNG asset ids of the post's Nepal version, slide by slide. */
async function nepalSlides(postId: string) {
  const [row] = await sql<{ slides: unknown }[]>`
    select a.body->'slides' as slides from content_post p
    join content_artifact a on a.id = p.pointers->>'marketId'
    where p.id = ${postId}`
  if (!row) throw new Error(`No Nepal version on ${postId}`)
  return (typeof row.slides === 'string' ? JSON.parse(row.slides) : row.slides) as {
    svgAssetId: string
    pngAssetId: string
  }[]
}

const XML = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as const

/** The words a slide draws: its stored SVG's <text> lines, fetched with the page's session. */
async function slideText(page: Page, svgAssetId: string): Promise<string> {
  const res = await page.request.get(`/admin/assets/${encodeURIComponent(svgAssetId)}`)
  expect(res.status(), svgAssetId).toBe(200)
  const svg = await res.text()
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m) => m[1].replace(/&(amp|lt|gt|quot|apos);/g, (_, e: keyof typeof XML) => XML[e]))
    .join(' ')
}

/** Picks the market in the Settings step's select and presses "Make market version" (criterion 85). */
const makeMarketVersion = async (scope: Locator, name: string) => {
  await scope.getByRole('combobox', { name: 'For market' }).selectOption({ label: name })
  await scope.getByRole('button', { name: 'Make market version' }).click()
}

const marketRadio = (scope: Locator, name: string) =>
  scope.getByRole('group', { name: 'Market' }).getByRole('radio', { name, exact: true })

test('a drawn post goes to review and publishes with no vision check to run or override (61, 62, 103)', async () => {
  posts.plain = await settingsPost(ed.page, PLAIN)
  // Not live: nothing to adapt yet (62).
  await expect(ed.page.getByRole('heading', { name: 'Adapt' })).toHaveCount(0)
  await expect(ed.page.getByRole('button', { name: 'Create social version' })).toHaveCount(0)
  await markNotFoundAsOpinion(ed.page)
  let settings = await settingsPanel(ed.page, 'Expiry')
  await settings.getByRole('radio', { name: '90 days' }).check()
  // A tag: the social version's caption makes its hashtag from it (109).
  settings = await settingsPanel(ed.page, 'Tags')
  await settings.getByRole('checkbox', { name: 'New Zealand', exact: true }).check()
  settings = await lastSettingsPanel(ed.page)
  await press(ed.page, 'Save settings', 'Settings saved', settings)
  await sendToReview(ed.page)

  const drawn = await images(ed.page, posts.plain)
  await expect(drawn.getByText(/vision check|Not checked/i)).toHaveCount(0)
  await expect(drawn.getByRole('button', { name: /vision check/i })).toHaveCount(0)

  const { page } = rv
  await post(page, posts.plain)
  await onStep(page, 'review')
  const review = region(page, 'Review')
  await expect(review.getByText(/vision check|Not checked/i)).toHaveCount(0)
  await expect(review.getByRole('button', { name: /^Override/ })).toHaveCount(0)
  await expect(review.getByRole('button', { name: 'Approve and publish' })).toBeEnabled()
  await approvePublish(page)

  // Live without a Nepal version: the Market shows the default only, and nothing adds one (61).
  const live = region(page, 'Live in feed')
  await expect(marketRadio(live, 'Default')).toBeChecked()
  await expect(marketRadio(live, 'Nepal')).toHaveCount(0)
})

test('adapting the live post for Cerebral on Instagram gives a linked card with its facts locked (63, 64)', async () => {
  const { page } = ed
  await post(page, posts.plain)
  await onStep(page, 'live')
  const live = region(page, 'Live in feed')
  await openTab(live, 'Social versions')
  await live.getByLabel('Page brand').selectOption({ label: 'Cerebral' })
  await live.getByLabel('Platform').selectOption({ label: 'Instagram carousel' })
  await press(
    page,
    'Create social version',
    'Social version created · linked card on the board',
    live,
  )

  await page.goto('/admin/board')
  const card = page.getByRole('listitem').filter({ hasText: 'Instagram · Cerebral' })
  await expect(card).toHaveCount(1)
  await card.getByRole('link', { name: 'Instagram · Cerebral' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}/)
  posts.social = /\/admin\/posts\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? ''
  expect(posts.social).not.toBe(posts.plain)

  await expect(page.getByText(`Facts locked · from feed post ${PLAIN.title}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quick approve layout' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Run source check' })).toHaveCount(0)
})

test('quick approve and render give a caption with hashtags; an edit disables Export and Reset enables it (65, 66, 109)', async () => {
  const { page } = ed
  await post(page, posts.social)
  await press(page, 'Quick approve layout', 'Layout approved')
  await press(page, 'Render', 'Rendered · 5 slides')

  const caption = section(page, 'Caption and hashtags')
  const text = caption.getByLabel('Caption', { exact: true })
  const tags = caption.getByLabel('Hashtags', { exact: true })
  await expect(text).not.toHaveValue('')
  const approved = await text.inputValue()
  expect(approved.split(/\s+/).length).toBeLessThanOrEqual(150)
  // The post's own lines close with the search line; the hashtag is the post's tag (106, 109).
  expect(approved.endsWith(`To find this again, search “OfCourse ${PLAIN.title}”`)).toBe(true)
  await expect(tags).toHaveValue('#NewZealand')

  const exportButton = caption.getByRole('button', { name: 'Export', exact: true })
  await expect(exportButton).toBeEnabled({ timeout: 60_000 })
  await text.fill(`${approved} Edited by hand.`)
  await expect(exportButton).toBeDisabled()
  await press(page, 'Save caption', 'Caption saved', caption)
  await expect(exportButton).toBeDisabled()
  await expect(
    caption.getByText('Run the source check on the new wording before exporting.'),
  ).toBeVisible()

  await press(page, 'Reset to approved wording', 'Approved wording restored', caption)
  await expect(text).toHaveValue(approved)
  await expect(exportButton).toBeEnabled({ timeout: 60_000 })
})

test('Export downloads the page_post_platform zip, and the card moves to Live (67)', async () => {
  const { page } = ed
  await post(page, posts.social)
  const caption = section(page, 'Caption and hashtags')
  const download = page.waitForEvent('download')
  await caption.getByRole('button', { name: 'Export', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^cerebral_[a-z0-9-]+_instagram\.zip$/)
  expect(file.suggestedFilename()).toBe(exportName('Cerebral', PLAIN.title, 'instagram'))

  await page.goto('/admin/board')
  await expect(column(page, 'Live').locator(`a[href^="/admin/posts/${posts.social}"]`)).toHaveText(
    'Instagram · Cerebral',
  )
})

test('light edits: a new cover phrase redraws the cover only, and a reorder swaps body slides (40)', async () => {
  // The cover phrase is a slot of the legacy templates' cover, edited under "This slide" once
  // rendered (RenderStep); a look's phrases are its slots, edited on Text. So the phrase is edited
  // on a post from before the looks, and the reorder on the look post the Nepal tests below use.
  test.setTimeout(300_000)
  const { page } = ed
  posts.phrase = await renderedLegacyPost(page, PHRASE_SOURCE)
  // Rendered, its Images step shows "This slide" open on the cover.
  const render = region(page, 'Images')
  const bound = await bindings(posts.phrase)
  const first = await slideIds(render)

  await render.getByLabel('Phrase', { exact: true }).fill('Hour limit')
  await press(page, 'Update phrase', 'Phrase updated', render)
  const phrased = await changedIds(render, first)
  expect(phrased[0], 'the cover is redrawn').not.toBe(first[0])
  expect(phrased.slice(1), 'the other slides stay').toEqual(first.slice(1))
  expect(await bindings(posts.phrase), 'no fact or binding changes').toEqual(bound)

  posts.money = await settingsPost(page, MONEY)
  const drawn = await images(page, posts.money)
  const placed = await bindings(posts.money)
  const before = await slideIds(drawn)
  await openTab(drawn, 'Order')
  await press(page, 'Move slide 2 down', 'Slides reordered', drawn)
  const reordered = await changedIds(drawn, before)
  expect(reordered, 'body slides 2 and 3 swap their images').toEqual([
    before[0],
    before[2],
    before[1],
    ...before.slice(3),
  ])
  const moved = await bindings(posts.money)
  expect(moved.factsId).toBe(placed.factsId)
  expect(moved.slides, 'the bindings move with their slides').toEqual([
    placed.slides[0],
    placed.slides[2],
    placed.slides[1],
    ...placed.slides.slice(3),
  ])
})

test('"Make covers" draws three options, "Another set" three more, and "Use this cover" changes the cover alone as Version 2 (41, 102)', async () => {
  // Legacy templates only: a look post has a picture per slide, drawn and nudged on Images
  // (GD12–GD14, which replace covers for feed posts), so this runs on a post from before the
  // looks, made by the database helper and rendered with its cover art.
  test.setTimeout(300_000)
  const { page } = ed
  posts.legacy = await renderedLegacyPost(page, LEGACY_SOURCE)
  const render = await images(page, posts.legacy)
  // The cover's version is under "This slide"; the covers in "Covers", which opens first.
  await openTab(render, 'This slide')
  await expect(render.getByText('Version 1', { exact: true })).toBeVisible()
  await expect(render.getByLabel('Art prompt')).toHaveCount(0)
  const before = await slideIds(render)
  expect(before).toHaveLength(5)

  await openTab(render, 'Covers')
  await expect(render.getByLabel('Art prompt')).toHaveCount(0)
  await press(page, 'Make covers', 'Covers made', render)
  const options = render.getByRole('list', { name: 'Cover options' }).getByRole('listitem')
  await expect(options).toHaveCount(3)

  // The image model's answer for one option of the next set waits in the art cache under that
  // option's key, computed as src/features/content/ai/art.ts computes it: the fake paints one grey
  // square for every prompt, the same as the cover in use, and a new cover must show another.
  const [row] = await sql<{ prompt: string }[]>`
    select a.body->'options'->0->>'prompt' as prompt from content_post p
    join content_artifact a on a.id = p.pointers->>'coversId'
    where p.id = ${posts.legacy}`
  if (!row) throw new Error('No covers on the post')
  const key = sha256Hex(
    canonicalJson({
      model: process.env.GEMINI_IMAGE_MODEL ?? '',
      prompt: row.prompt,
      aspectRatio: '4:5',
      set: 2,
      option: 2,
      attempt: 1,
    }),
  )
  const assetId = `e2e-art-submission-${posts.legacy}`
  await forgetCachedArt(key, assetId)
  cachedArt.push({ key, assetId })
  await cacheArt(key, assetId, PNG)

  await press(page, 'Another set', 'Covers made', render)
  await expect(options).toHaveCount(6)
  // Only the new picture is offered; every grey option is the cover in use.
  const use = render.getByRole('button', { name: 'Use this cover' })
  await expect(use).toHaveCount(1)
  await expect(options.nth(4).getByRole('button', { name: 'Use this cover' })).toBeVisible()
  await press(page, 'Use this cover', 'Cover changed', render)
  await openTab(render, 'This slide')
  await expect(render.getByText('Version 2', { exact: true })).toBeVisible()
  const after = await changedIds(render, before)
  expect(after[0], 'the cover has new art').not.toBe(before[0])
  expect(after.slice(1), 'every other slide stays').toEqual(before.slice(1))
  await openTab(render, 'Covers')
  await expect(options.nth(4).getByText('In use', { exact: true })).toBeVisible()
})

test('Preview in context shows the phone card with For you, the why line and the source line (55)', async () => {
  const { page } = ed
  await openStep(page, posts.money, 'settings')
  await markNotFoundAsOpinion(page)
  let settings = await settingsPanel(page, 'Who sees it')
  await settings.getByRole('radio', { name: 'Personal' }).check()
  await settings.getByLabel('Why line').fill(WHY)
  settings = await settingsPanel(page, 'Expiry')
  await settings.getByRole('radio', { name: '90 days' }).check()
  settings = await lastSettingsPanel(page)
  await press(page, 'Save settings', 'Settings saved', settings)

  // A save remounts the steps on the new version, so the view is chosen on a fresh load of the
  // Settings step, whose preview beside the panels shows the post as it goes out.
  await openStep(page, posts.money, 'settings')
  const drawn = region(page, 'Preview')
  await drawn.getByRole('radio', { name: 'Preview in context', exact: true }).check()
  const card = drawn.getByRole('img', { name: `Cover of ${MONEY.title}` })
  await expect(card).toBeVisible()
  await expect(drawn.getByRole('img', { name: /^Slide \d+\b/ })).toHaveCount(0)
  await expect(drawn.getByText('For you', { exact: true })).toBeVisible()
  await expect(drawn.getByText(WHY, { exact: true })).toBeVisible()
  await expect(drawn.getByText(new RegExp(`^Source: ${MONEY.title} · ¶\\d`))).toBeVisible()
  await expect(drawn.getByText(/^Personal · Everyone · Leaves the feed in 90 days$/)).toBeVisible()
})

test('Nepal: made at once with the money converted, a linked card on the board, and rewording as the optional extra (56, 57, 110)', async () => {
  const { page } = ed
  const drawn = await settingsScreen(page, posts.money)
  await makeMarketVersion(drawn, 'Nepal')
  await expect(toast(page, 'Nepal version made · linked card on the board')).toBeVisible()
  await expect(page).toHaveURL(/[?&]market=NP/)
  await expect(marketRadio(drawn, 'Nepal')).toBeChecked()
  await expect(drawn.getByText('Feed excerpt', { exact: true })).toBeVisible()
  // Made by code alone: the approved wording with the money converted (110).
  await expect(drawn.getByText('Approved wording, money converted', { exact: true })).toBeVisible()

  // The slide the page shows is the slide whose drawn words carry the conversion and the rate.
  const nepal = await nepalSlides(posts.money)
  expect(nepal).toHaveLength(5)
  await expect.poll(() => slideIds(drawn)).toEqual(nepal.map((s) => s.pngAssetId))
  const texts: string[] = []
  for (const slide of nepal) texts.push(await slideText(page, slide.svgAssetId))
  // The reorder above moved the money paragraph's body slide to slide 3; only it gains NPR.
  const withNpr = texts.flatMap((t, i) => (t.includes('NPR') ? [i + 1] : []))
  expect(withNpr, 'one slide carries the money figure').toEqual([3])
  expect(texts[2]).toContain(MONEY_LINE)
  expect(texts[2]).toContain(RATE_LINE)
  expect(texts[0]).not.toContain('With your family')

  // "Reword for Nepal" is the optional extra: the model frames the cover and the excerpt for a
  // family decision; the money figure and its rate line stay as code converted them (56, 110).
  await drawn.getByRole('button', { name: 'Reword for Nepal' }).click()
  await expect(toast(page, 'Nepal version reworded')).toBeVisible()
  await expect(marketRadio(drawn, 'Nepal')).toBeChecked()
  await expect(drawn.getByText('Reworded for Nepal', { exact: true })).toBeVisible()
  await expect(
    drawn.getByText("Deciding with your family how many hours you'll work?", { exact: true }),
  ).toBeVisible()
  await expect(drawn.getByRole('button', { name: 'Reword for Nepal' })).toHaveCount(0)
  const reworded = await nepalSlides(posts.money)
  expect(reworded.map((s) => s.pngAssetId)).not.toEqual(nepal.map((s) => s.pngAssetId))
  await expect.poll(() => slideIds(drawn)).toEqual(reworded.map((s) => s.pngAssetId))
  expect(await slideText(page, reworded[0].svgAssetId)).toContain('With your family')
  const money = await slideText(page, reworded[2].svgAssetId)
  expect(money).toContain(MONEY_LINE)
  expect(money).toContain(RATE_LINE)

  await page.goto('/admin/board')
  const card = column(page, 'Rendered')
    .getByRole('listitem')
    .filter({ has: page.locator(`a[href^="/admin/posts/${posts.money}?market=NP"]`) })
  await expect(card.getByRole('link')).toHaveText(`${MONEY.title} · Nepal`)
})

test('a source without money gets a Nepal version with no NPR anywhere (58)', async () => {
  const { page } = ed
  posts.noMoney = await settingsPost(page, NO_MONEY)
  const drawn = await settingsScreen(page, posts.noMoney)
  await makeMarketVersion(drawn, 'Nepal')
  await expect(toast(page, 'Nepal version made · linked card on the board')).toBeVisible()
  const nepal = await nepalSlides(posts.noMoney)
  await expect.poll(() => slideIds(drawn)).toEqual(nepal.map((s) => s.pngAssetId))
  for (const [i, slide] of nepal.entries()) {
    expect(await slideText(page, slide.svgAssetId), `slide ${i + 1}`).not.toContain('NPR')
  }
  await expect(page.getByRole('main').getByText(/NPR/)).toHaveCount(0)
})

test('after approval both versions are live, and the Market cannot add one (60, 61, 62)', async () => {
  await openStep(ed.page, posts.money, 'settings')
  await sendToReview(ed.page)
  // In review, the editor still has nothing to adapt (62).
  await expect(ed.page.getByRole('heading', { name: 'Adapt' })).toHaveCount(0)

  const { page } = rv
  await post(page, posts.money)
  await onStep(page, 'review')
  const review = region(page, 'Review')
  await expect(review.getByRole('heading', { level: 3, name: 'Nepal', exact: true })).toBeVisible()
  await approvePublish(page)

  const live = region(page, 'Live in feed')
  const radios = live.getByRole('group', { name: 'Market' }).getByRole('radio')
  await expect(radios).toHaveCount(2)
  await expect(marketRadio(live, 'Default')).toBeChecked()
  const defaults = await slideIds(live)
  await marketRadio(live, 'Nepal').check()
  const nepal = await nepalSlides(posts.money)
  await expect.poll(() => slideIds(live)).toEqual(nepal.map((s) => s.pngAssetId))
  expect(defaults).not.toEqual(nepal.map((s) => s.pngAssetId))
  // Switching only shows a version: nothing was made.
  expect(await nepalSlides(posts.money)).toEqual(nepal)

  await page.goto('/admin/board')
  const livePosts = column(page, 'Live')
  await expect(livePosts.locator(`a[href^="/admin/posts/${posts.money}?from"]`)).toBeVisible()
  await expect(livePosts.locator(`a[href^="/admin/posts/${posts.money}?market=NP"]`)).toHaveText(
    `${MONEY.title} · Nepal`,
  )
})
