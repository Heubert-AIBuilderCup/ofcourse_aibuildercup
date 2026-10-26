import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'
import { SEARCH_LINE } from '../src/features/content/layout/engine'
import { canonicalJson, sha256Hex } from '../src/features/content/server/hash'
import { sourceSentences } from '../src/features/content/text/sentences'
import {
  approvePublish,
  approveText,
  CLEAN,
  checked,
  checkResults,
  drawImages,
  makePost,
  nonDemo,
  onStep,
  openOtherVersions,
  openSourceCheck,
  openStep,
  openTab,
  PAID_WORK,
  pickIdea,
  pickVersion,
  renderedLegacyPost,
  requireFakeProvider,
  type Source,
  selectSlide,
  sendToReview,
  settingsPanel,
  slotField,
  stage,
  stageSlides,
  yourVersion,
} from './helpers/content'
import {
  cacheArt,
  deletePostsBy,
  deleteUsers,
  forgetCachedArt,
  postSlug,
  renderedArtPrompt,
  setCapabilities,
  setRole,
  sql,
} from './helpers/db'
import { signInUser, type User } from './helpers/login'

// Story 13 in the browser, against the fake model provider, on the step screens
// (/admin/posts/<id>/<step>): "Make post" on the paid-work source stops at the idea cards, and
// "Use this idea" runs to three versions over facts that are source sentences (93, 95, 97); the
// chosen version is edited on its slide and checked by itself, and a sentence the source does not
// hold takes the source's wording (98, 99, 104); approved and drawn, the last slide ends with the
// search line (106); "Make covers" runs on a post from before the looks (102); and once published,
// the post's public page and the sitemap are there for a signed-out visitor (107). One post moves
// through the steps, so the tests run in order and stop at the first failure.
//   er: an editor and a reviewer, who makes the post and approves it (self-reviewed)

test.describe.configure({ mode: 'serial', timeout: 180_000 })

const WIDE = { width: 1280, height: 800 }
/** The look of the first idea card the fake offers, which its versions are drawn in. */
const LOOK = 'Field Notes'
const ANGLES = ['The surprising number', 'The practical advice', 'The question to ask']
/** The paid-work demo source's text under a title of its own, so its public slug is this spec's. */
const SOURCE: Source = { title: 'Paid work, made in one press', text: PAID_WORK.text }
const SEARCH = SEARCH_LINE(SOURCE.title)
/** The source's sentences by id (¶2.1 is paragraph 2's first), as the source pane numbers them. */
const SENTENCES = new Map(
  SOURCE.text
    .split('\n\n')
    .flatMap((text, i) => sourceSentences({ ref: `¶${i + 1}`, text }))
    .map((s) => [s.id, s.text]),
)
const sentence = (id: string): string => {
  const text = SENTENCES.get(id)
  if (!text) throw new Error(`No source sentence ${id}`)
  return text
}
/** A sentence no paragraph says, with no figure in it, so only the reading can flag it. */
const UNSUPPORTED = 'Working part-time makes students happier and richer.'
/**
 * Slide 3's body as the editor types it: the unsupported sentence alone. A look's body holds 15–25
 * words, and the source's wording for it (¶2.1, 17 words) must fit for the images to be drawn.
 */
const EDITED = UNSUPPORTED
// A 1 × 1 PNG: the image the model gives for one cover option, unlike the fake's grey square.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

type Person = User & { context: BrowserContext; page: Page }
let er: Person
const contexts: BrowserContext[] = []
const cachedArt: { key: string; assetId: string }[] = []
let postId = ''

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: WIDE })
  contexts.push(context)
  const page = await context.newPage()
  const user = await signInUser(page, { label: 'mp-er' })
  // On an empty table the first account becomes a superadmin, who may do everything.
  await setRole(user.email, 'user')
  await setCapabilities(user.email, { editor: true, reviewer: true })
  er = { ...user, context, page }
  await requireFakeProvider(page)
})

test.afterAll(async () => {
  for (const c of contexts) await c.close()
  for (const { key, assetId } of cachedArt) await forgetCachedArt(key, assetId)
  if (er) {
    await deletePostsBy([er.email])
    await deleteUsers([er.email])
  }
})

const post = (page: Page, id: string) => page.goto(`/admin/posts/${id}`)
const section = (page: Page, name: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) })
const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text })
const version = (page: Page, angle: string) =>
  page.getByRole('article', { name: `${LOOK} · ${angle}`, exact: true })

/** Press a workbench button and wait for the line that confirms it. */
async function press(page: Page, name: string, confirms: string | RegExp, scope?: Locator) {
  await (scope ?? page).getByRole('button', { name, exact: true }).click()
  await expect(toast(page, confirms).first()).toBeVisible({ timeout: 60_000 })
}

/** The bytes of each slide on the stage in `scope`, fetched with the page's session. */
async function slideBytes(page: Page, scope: Page | Locator): Promise<Buffer[]> {
  const srcs = await stageSlides(scope).evaluateAll((els) =>
    els.map((el) => (el as HTMLImageElement).src),
  )
  expect(srcs.length).toBeGreaterThan(0)
  const out: Buffer[] = []
  for (const src of srcs) {
    const res = await page.request.get(src)
    expect(res.status(), src).toBe(200)
    out.push(await res.body())
  }
  return out
}

/** Wait for every slide image in `scope` to have loaded and drawn something. */
async function slidesLoaded(scope: Locator, count: number): Promise<void> {
  const images = scope.getByRole('img', { name: /^Slide \d+\b/ })
  await expect(images).toHaveCount(count)
  await expect
    .poll(() =>
      images.evaluateAll((els) =>
        els.every((el) => {
          el.scrollIntoView({ block: 'nearest' })
          const img = el as HTMLImageElement
          return img.complete && img.naturalWidth > 0
        }),
      ),
    )
    .toBe(true)
}

const XML = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as const

/** The words each slide of the post's current render draws: its stored SVG's <text> lines. */
async function renderedText(page: Page, id: string): Promise<string[]> {
  const [row] = await sql<{ slides: unknown }[]>`
    select a.body->'slides' as slides from content_post p
    join content_artifact a on a.id = p.pointers->>'renderId'
    where p.id = ${id}`
  if (!row) throw new Error(`No render on ${id}`)
  const slides = (typeof row.slides === 'string' ? JSON.parse(row.slides) : row.slides) as {
    svgAssetId: string
  }[]
  const out: string[] = []
  for (const { svgAssetId } of slides) {
    const res = await page.request.get(`/admin/assets/${encodeURIComponent(svgAssetId)}`)
    expect(res.status(), svgAssetId).toBe(200)
    const svg = await res.text()
    out.push(
      [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
        .map((m) => m[1].replace(/&(amp|lt|gt|quot|apos);/g, (_, e: keyof typeof XML) => XML[e]))
        .join(' '),
    )
  }
  return out
}

const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** An alt that ends with the search line. */
const ENDS_WITH_SEARCH = new RegExp(`${escaped(SEARCH)}$`)

test('"Make post" stops at the idea cards, and "Use this idea" runs to three versions side by side, labelled by their angles, over facts that are source sentences (93, 95, 97)', async () => {
  const { page } = er
  postId = await makePost(page, SOURCE)
  // One press on a card, and nothing after it: the helper waits until the versions are drafted.
  await pickIdea(page)

  // Three versions in the card's look, each labelled by its angle: the first is picked for the
  // editor (GD29) and the other two wait in "Versions" with "Use this version", each card showing
  // its first slide and listing its five in its "Details" drawer.
  await expect(await yourVersion(page)).toContainText(ANGLES[0])
  await expect(stageSlides(page)).toHaveCount(5)
  await openOtherVersions(page)
  for (const angle of ANGLES.slice(1)) {
    const card = version(page, angle)
    await expect(card.getByRole('heading', { level: 4, name: angle, exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Use this version' })).toBeEnabled()
    await slidesLoaded(card, 1)
    await card.getByRole('button', { name: 'Details', exact: true }).click()
    const details = page.getByRole('dialog', { name: new RegExp(` · ${angle}$`) })
    await expect(details.getByText(/^Slide \d+$/)).toHaveCount(5)
    await details.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(details).toBeHidden()
  }

  // Each paragraph's first sentence is a fact on the Source step, numbered and word for word.
  await openStep(page, postId, 'source')
  const facts = page.getByRole('region', { name: 'Facts', exact: true }).getByRole('listitem')
  const numbered = facts.filter({ hasText: /¶\d+\.\d+/ })
  await expect(numbered).toHaveCount(5)
  for (const id of ['¶1.1', '¶2.1', '¶3.1', '¶4.1', '¶5.1']) {
    await expect(facts.filter({ hasText: id })).toContainText(sentence(id))
  }
})

test('the chosen version is checked by itself, and a change to one slide changes only that slide (98, 99)', async () => {
  const { page } = er
  await openStep(page, postId, 'text')
  await pickVersion(page, 1)
  const card = await yourVersion(page)
  await expect(card.getByText(ANGLES[1], { exact: true })).toBeVisible()
  // The check lands with nothing pressed to start it.
  await checked(page, CLEAN)
  await expect(page.getByRole('button', { name: /source check|vision check/i })).toHaveCount(0)

  const before = await slideBytes(page, page)
  expect(before).toHaveLength(5)
  await selectSlide(page, 4)
  await (await yourVersion(page))
    .getByRole('button', { name: 'Shorter · Slide 4', exact: true })
    .click()
  await expect
    .poll(async () => (await slideBytes(page, page))[3].equals(before[3]), {
      timeout: 60_000,
    })
    .toBe(false)
  await checked(page, /^\d+ found · \d+ not found · \d+ opinion$/)
  const after = await slideBytes(page, page)
  expect(after).toHaveLength(5)
  after.forEach((bytes, i) => {
    expect(bytes.equals(before[i]), `slide ${i + 1} ${i === 3 ? 'changes' : 'stays'}`).toBe(i !== 3)
  })
})

test("a sentence typed on the slide that the source does not hold is flagged beside the source's sentence, and its wording makes the check clean (98, 104)", async () => {
  const { page } = er
  await openStep(page, postId, 'text')
  await selectSlide(page, 3)

  // Edited on the slide itself, on the stage.
  const slide = stage(page)
  await slide.getByRole('button', { name: 'Edit Slide 3 · Body' }).click()
  await slide.getByRole('textbox', { name: 'Slide 3 · Body', exact: true }).fill(EDITED)
  await slide.getByRole('button', { name: 'Save', exact: true }).click()

  // Checked by itself: the typed sentence is the one flag, beside the sentence its fact rests on.
  const body = slotField(await yourVersion(page), 3, 'Body')
  await expect(body).toHaveValue(EDITED, { timeout: 60_000 })
  await expect(body).toHaveAccessibleDescription(/Not in the source/, { timeout: 60_000 })
  await checked(page, /· 1 not found ·/)
  const results = await checkResults(page)
  const row = results
    .getByRole('list', { name: 'To fix', exact: true })
    .getByRole('listitem')
    .filter({ hasText: UNSUPPORTED })
  await expect(row).toContainText('Not found in the source')
  await expect(row.getByText(`Source ¶2: ${sentence('¶2.1')}`, { exact: true })).toBeVisible()
  const wording = results.getByRole('button', { name: "Use the source's wording" })
  await expect(wording).toHaveCount(1)

  await wording.click()
  await checked(page, CLEAN)
  await expect(wording).toHaveCount(0)
  const text = slotField(await yourVersion(page), 3, 'Body')
  await expect(text).toHaveValue(new RegExp(escaped(sentence('¶2.1'))))
  await expect(text).not.toHaveValue(new RegExp(escaped(UNSUPPORTED)))

  // Every change is a version in the history on the Source step, by its editor, and the older
  // ones can be restored.
  await openStep(page, postId, 'source')
  const history = section(page, 'History')
  for (const line of ['Source wording used on slide 3', 'Slide 3 edited', 'slide 4']) {
    const entry = history.getByRole('listitem').filter({ hasText: line })
    await expect(entry).toHaveCount(1)
    await expect(entry).toContainText(er.name)
  }
  await expect(
    history
      .getByRole('listitem')
      .filter({ hasText: 'Slide 3 edited' })
      .getByRole('button', { name: 'Restore' }),
  ).toBeEnabled()
})

test('approved and drawn, the last slide ends with the search line, drawn on the slide (106)', async () => {
  const { page } = er
  await openStep(page, postId, 'text')
  await approveText(page)
  await drawImages(page)

  // Drawn by code into the last slide's picture, and on no other slide. (The alt that ends with
  // the search line is read on the public page, the first screen after Text to show slide 5.)
  const drawn = await renderedText(page, postId)
  expect(drawn).toHaveLength(5)
  expect(drawn[4]).toContain(SEARCH)
  for (const text of drawn.slice(0, 4)) expect(text).not.toContain('To find this again')
})

test('"Make covers" offers three cover slides to choose from, and one is used (102)', async () => {
  // Legacy templates only: a look post has a picture per slide, drawn and nudged on Images
  // (GD12–GD14, which replace covers for feed posts), so this runs on a post from before the
  // looks, made by the database helper and rendered with its cover art.
  test.setTimeout(300_000)
  const { page } = er
  const legacyId = await renderedLegacyPost(page, {
    title: 'Paid work, its covers',
    text: nonDemo(PAID_WORK.text),
  })
  const render = section(page, 'Images')
  await expect(render.getByRole('button', { name: /vision check/i })).toHaveCount(0)

  // The image model's answer for the second option of the first set waits in the art cache under
  // that option's key, computed as src/features/content/ai/art.ts computes it: the fake paints one
  // grey square for every prompt, the same as the cover in use, and a cover to use must differ.
  const prompt = await renderedArtPrompt(legacyId)
  if (prompt === null) throw new Error('The render has no art prompt')
  const key = sha256Hex(
    canonicalJson({
      model: process.env.GEMINI_IMAGE_MODEL ?? '',
      prompt,
      aspectRatio: '4:5',
      set: 1,
      option: 2,
      attempt: 1,
    }),
  )
  const assetId = `e2e-art-make-post-${legacyId}`
  // A run before may have cached the grey square under this key.
  await forgetCachedArt(key, assetId)
  cachedArt.push({ key, assetId })
  await cacheArt(key, assetId, PNG)

  await openTab(render, 'Covers')
  await press(page, 'Make covers', 'Covers made', render)
  const options = render.getByRole('list', { name: 'Cover options' }).getByRole('listitem')
  await expect(options).toHaveCount(3)
  for (const [i, option] of (await options.all()).entries()) {
    await expect(option.getByRole('img', { name: `Cover option ${i + 1}` })).toBeVisible()
  }
  // The grey options are the cover in use; the new picture is offered.
  await expect(options.nth(0).getByText('In use', { exact: true })).toBeVisible()
  await expect(options.nth(2).getByText('In use', { exact: true })).toBeVisible()
  await press(page, 'Use this cover', 'Cover changed', options.nth(1))
  await expect(options.nth(1).getByText('In use', { exact: true })).toBeVisible()
  await expect(options.nth(0).getByRole('button', { name: 'Use this cover' })).toBeVisible()
})

test('reviewed and published, the post has a public page a signed-out visitor opens, and the sitemap lists it (107)', async ({
  browser,
}) => {
  const { page } = er
  // Drawn, the post is at Settings: the check and the settings.
  await post(page, postId)
  await onStep(page, 'settings')
  // Landed, the check sums itself up; a sentence not found would be listed under it.
  const check = await openSourceCheck(page)
  await expect(check.getByText(/^[1-9]\d* found in the article · 0 not found · /)).toBeVisible({
    timeout: 60_000,
  })
  await expect(check.getByText(/Not found$/)).toHaveCount(0)
  await (await settingsPanel(page, 'Expiry')).getByRole('radio', { name: '90 days' }).check()
  await sendToReview(page)
  await approvePublish(page)

  const slug = await postSlug(postId)
  if (!slug) throw new Error('The live post has no slug')
  await signedOut(browser, async (visitor) => {
    await visitor.goto(`/posts/${slug}`)
    await expect(visitor).toHaveURL(new RegExp(`/posts/${slug}$`))
    await expect(visitor).toHaveTitle(`${SOURCE.title} | OfCourse`)
    await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(SOURCE.title)
    const article = visitor.getByRole('article')
    await slidesLoaded(article, 5)
    await expect(article.getByRole('img', { name: /^Slide 5: / })).toHaveAttribute(
      'alt',
      ENDS_WITH_SEARCH,
    )
    await expect(article.getByText(SEARCH, { exact: true })).toBeVisible()
    await expect(visitor.getByRole('link', { name: 'Join OfCourse' })).toBeVisible()
    // Never its audience or how long it stays.
    await expect(visitor.getByText(/Everyone|Leaves the feed/)).toHaveCount(0)

    const sitemap = await visitor.request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    expect(await sitemap.text()).toContain(`/posts/${slug}</loc>`)
  })
})

/** A fresh browser with no session, closed after `use`. */
async function signedOut(browser: Browser, use: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ viewport: WIDE })
  try {
    await use(await context.newPage())
  } finally {
    await context.close()
  }
}
