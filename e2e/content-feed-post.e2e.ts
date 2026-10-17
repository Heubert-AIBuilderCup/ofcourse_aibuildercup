import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test'
import { REPLAYS } from '../src/features/content/ai/replays/index'
import { canonicalJson, sha256Hex } from '../src/features/content/server/hash'
import {
  allCheckedSentences,
  approveLegacyText,
  approveText,
  CLEAN,
  checked,
  checkResults,
  drawImages,
  ideasOffered,
  LEGACY_TEMPLATES,
  lastSettingsPanel,
  legacyPost,
  makePost,
  markNotFoundAsOpinion,
  nonDemo,
  onStep,
  openedPostId,
  openOtherVersions,
  openSourceCheck,
  openStep,
  openTab,
  PAID_WORK,
  pasteSource,
  pickIdea,
  pickVersion,
  requireFakeProvider,
  selectSlide,
  sendToReview,
  settingsPanel,
  settingsPost,
  slotField,
  stage,
  stageSlides,
  stepActions,
  TWIN,
  toSettings,
  whyUnavailable,
  withMarker,
  writeSlides,
  yourVersion,
} from './helpers/content'
import {
  cacheArt,
  countPostsBy,
  deletePostsBy,
  deleteUsers,
  forgetCachedArt,
  renderedArtPrompt,
  renderHasArt,
  setCapabilities,
  setRole,
} from './helpers/db'
import { signInUser, type User } from './helpers/login'

// A pasted source to a live feed post, against the fake model provider, on the step screens
// (/admin/posts/<id>/<step>): facts tied to their paragraphs and the planted claim caught on
// Source, idea cards, versions drafted, edited and checked on Text, approved and drawn on Images,
// the source check and feed settings on Settings, review and publish. The legacy templates' render
// gate, render and art run on a post from before the looks made by the database helper
// (helpers/content.ts legacyPost); their structures screen test is skipped until it is rewritten
// for the step screens. One post moves through the steps, so the tests run in order and stop at
// the first failure; the tests that make their own post from a failing source come last.
//   ed: an editor · er: an editor and a reviewer · rv: a reviewer

test.describe.configure({ mode: 'serial', timeout: 180_000 })

const WIDE = { width: 1280, height: 800 }
const LINE = 'Article carousel · The line'
const QUESTION = 'Article carousel · The question'
const LONG_READ = 'Article carousel · The long read'
const SKETCH = 'Sketch insight'
const LONG_READ_FIT = 'Slide 2 · 121 words (30–70) · Over'
const LIVE_LINE = 'General · Everyone · Leaves the feed in 90 days'
const FAILED = 'This step failed. Your work so far is kept.'
/** The legacy structures screen as it was before the step screens: "Gate locked" (gone, GD25) and a picked card left in its row (now the chosen version's editor, GD24). */
const LEGACY_STRUCTURES =
  'Written for the legacy structures screen before GD24 and GD25; to be rewritten on legacyPost'
/** The rehearsed source as a post from before the looks: not a demo, so nothing replays. */
const LEGACY_SOURCE = { title: 'Paid work, the line', text: nonDemo(PAID_WORK.text) }
/** A sentence no paragraph says, with no figure in it, so only the reading can flag it. */
const UNSUPPORTED = 'Working part-time makes students happier and richer.'
/** Paragraph 3's second sentence, word for word (10 words). */
const SOURCE_SENTENCE = 'The drop was largest in the first year of study.'
// A 1 × 1 PNG: the image the model gives when "Try again" finally reaches it.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

type Person = User & { context: BrowserContext; page: Page }
let ed: Person
let er: Person
let rv: Person
const contexts: BrowserContext[] = []
const cachedArt: { key: string; assetId: string }[] = []

/** The posts the steps share: the rehearsed source, its twin, and a source whose art fails. */
const posts = { paidWork: '', twin: '', artFails: '', legacy: '' }

test.beforeAll(async ({ browser }) => {
  const people: Person[] = []
  for (const [label, caps] of [
    ['fp-ed', { editor: true, reviewer: false }],
    ['fp-er', { editor: true, reviewer: true }],
    ['fp-rv', { editor: false, reviewer: true }],
  ] as const) {
    const context = await browser.newContext({ viewport: WIDE })
    contexts.push(context)
    const page = await context.newPage()
    const user = await signInUser(page, { label })
    // On an empty table the first account becomes a superadmin, who may do everything.
    await setRole(user.email, 'user')
    await setCapabilities(user.email, caps)
    people.push({ ...user, context, page })
  }
  ;[ed, er, rv] = people
  await requireFakeProvider(er.page)
})

test.afterAll(async () => {
  for (const c of contexts) await c.close()
  for (const { key, assetId } of cachedArt) await forgetCachedArt(key, assetId)
  const emails = [ed, er, rv].filter(Boolean).map((p) => p.email)
  await deletePostsBy(emails)
  await deleteUsers(emails)
})

const post = (page: Page, id: string) => page.goto(`/admin/posts/${id}`)
const source = (page: Page) => page.getByRole('complementary', { name: 'Source' })
/** The first version of a template's drafts: the fake's three versions share its planted traits. */
const draftCard = (page: Page, name: string) => page.getByRole('article', { name }).first()
/**
 * "Use this version" on a template's version. The drafting picks the first Ready one for the
 * editor (GD29) and the rest wait in "Versions"; when the template's versions offer no Use button,
 * one of them is the picked one already.
 */
async function useVersion(page: Page, name: string) {
  await openOtherVersions(page)
  const card = draftCard(page, name)
  if ((await card.getByRole('button', { name: 'Use this version' }).count()) === 0) return
  await press(page, 'Use this version', 'Version picked', card)
}
const section = (page: Page, name: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) })
/**
 * The cover in a section of rendered slides: the stage, which opens on it, its picture and what
 * shows under it ("No art", "Replay").
 */
const cover = (scope: Locator) => stage(scope)
const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text })
const facts = (page: Page) => page.getByRole('region', { name: 'Facts', exact: true })

/** On the Source step, unfold the article ("Show article") when it is folded. */
async function showArticle(page: Page): Promise<void> {
  const show = source(page).getByRole('button', { name: 'Show article' })
  if (await show.isVisible()) await show.click()
  await expect(source(page).getByRole('button', { name: 'Hide article' })).toBeVisible()
}

/**
 * Wait for every slide on the stage in `scope` (its filmstrip) to have loaded and drawn something.
 * The slides load lazily, so each look scrolls them into view; it asks again from scratch, since a
 * refresh may redraw them.
 */
async function expectImagesLoaded(scope: Locator, count?: number): Promise<void> {
  const images = stageSlides(scope)
  if (count === undefined) await expect(images.first()).toBeVisible()
  else await expect(images).toHaveCount(count)
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

/** The bytes of each slide on the stage in `scope`, fetched with the page's session. */
async function imageBytes(page: Page, scope: Locator): Promise<Buffer[]> {
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

/** Press a workbench button and wait for the line that confirms it (criterion 3). */
async function press(page: Page, name: string, confirms: string | RegExp, scope?: Locator) {
  await (scope ?? page).getByRole('button', { name, exact: true }).click()
  // A press runs a server step (extract, render, check) on the dev server, which compiles the
  // route on first use and draws slides in-process; one worker (playwright.config.ts). How much
  // of the wait is compiling and how much is drawing has not been measured.
  await expect(toast(page, confirms).first()).toBeVisible({ timeout: 60_000 })
}

async function tick(page: Page, names: string[]) {
  for (const name of names) {
    await page.getByRole('checkbox', { name, exact: true }).click()
  }
}

/** On the chosen version's slide `n`, on the stage, type `text` as its body and save it. */
async function editBody(page: Page, n: number, text: string): Promise<void> {
  await selectSlide(page, n)
  const slide = stage(page)
  await slide.getByRole('button', { name: `Edit Slide ${n} · Body` }).click()
  await slide.getByRole('textbox', { name: `Slide ${n} · Body`, exact: true }).fill(text)
  await slide.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(slotField(await yourVersion(page), n, 'Body')).toHaveValue(text, {
    timeout: 60_000,
  })
}

test('er extracts the rehearsed source: numbered paragraphs, three key ideas, facts, one post', async () => {
  const { page } = er
  expect(await countPostsBy(er.email)).toBe(0)
  await page.goto('/admin/posts/new')
  const form = page.getByRole('form', { name: 'New feed post' })
  await form.getByRole('button', { name: 'Paste text instead' }).click()
  await form.getByLabel('Title', { exact: true }).fill(PAID_WORK.title)
  await form.getByLabel('Source', { exact: true }).fill(PAID_WORK.text)
  await form.getByRole('button', { name: 'Make post' }).dblclick()
  posts.paidWork = await openedPostId(page)
  await ideasOffered(page)

  // The source, its key ideas and its facts live on the Source step.
  await openStep(page, posts.paidWork, 'source')
  await showArticle(page)
  const pane = source(page)
  for (const ref of ['¶1', '¶2', '¶3', '¶4', '¶5']) {
    await expect(pane.getByRole('listitem').filter({ hasText: ref }).first()).toBeVisible()
  }
  await expect(pane.getByText('¶6', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Key ideas', exact: true }).getByRole('listitem'),
  ).toHaveCount(3)
  await expect(facts(page).getByRole('listitem')).not.toHaveCount(0)
  await expect(page.getByText('Not supported')).toHaveCount(0)
  expect(await countPostsBy(er.email), 'a double click makes one post').toBe(1)
})

test("er extracts the twin: the title is a headline claim not in the article, the source's figure marked", async () => {
  const { page } = er
  posts.twin = await makePost(page, TWIN)
  await openStep(page, posts.twin, 'source')
  await showArticle(page)
  await expect(source(page).getByText('Headline claim not in the article')).toBeVisible()
  await expect(source(page).getByText('The paragraph gives 9, not 11.')).toBeVisible()
  await expect(source(page).locator('mark')).toHaveText(['9'])
})

test('er adds a selected sentence of the twin as a fact, word for word, and removes it (95)', async () => {
  const { page } = er
  const row = facts(page).getByRole('listitem').filter({ hasText: SOURCE_SENTENCE })
  await expect(row).toHaveCount(0)
  await source(page).getByRole('button', { name: SOURCE_SENTENCE, exact: true }).click()
  await press(page, 'Add as fact', 'Fact added')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('¶3.2')
  await press(page, 'Remove', 'Fact removed', row)
  await expect(row).toHaveCount(0)
})

test('the board shows the post in its first column with who changed it, and ← Board keeps the filter', async () => {
  const { page } = er
  await page.goto('/admin/board')
  expect(await page.getByRole('heading', { level: 2 }).allTextContents()).toEqual([
    'Structures',
    'Approved · to render',
    'Rendered · edit & check',
    'In review',
    'Ready · publish or export',
    'Live in feed · exported',
  ])
  const column = page.getByRole('region', { name: 'Structures', exact: true })
  const card = column.getByRole('listitem').filter({
    has: page.locator(`a[href^="/admin/posts/${posts.paidWork}"]`),
  })
  await expect(card).toContainText(`Changed by ${er.name}`)

  const filters = page.getByRole('navigation', { name: 'Board filters' })
  const count = async (name: string) => {
    const text = await filters.getByRole('link', { name: new RegExp(`^${name}`) }).innerText()
    const n = /(\d+)\s*$/.exec(text)?.[1]
    expect(n, `${name} shows a count`).toBeDefined()
    return Number(n)
  }
  const [all, feed, social] = [
    await count('All'),
    await count('Feed posts'),
    await count('Social versions'),
  ]
  expect(feed).toBeGreaterThanOrEqual(2)
  expect(all).toBe(feed + social)

  // `from` carries the board's own query, as its cards link (lib/board.ts boardFrom).
  await page.goto(`/admin/posts/${posts.paidWork}?from=${encodeURIComponent('filter=social')}`)
  await page.getByRole('link', { name: '← Board' }).click()
  await expect(page).toHaveURL(/\/admin\/board\?filter=social$/)
})

test('structures: one to three templates, drafted side by side with chips, fit rows and themes', async () => {
  test.skip(true, LEGACY_STRUCTURES)
  const { page } = er
  await post(page, posts.paidWork)
  await expect(page.getByText('Gate locked', { exact: true })).toBeVisible()
  // "Make post" drafted the first template, the line, on its own (criterion 93).
  await expect(page.getByRole('checkbox', { name: LINE, exact: true })).toBeChecked()
  await expect(draftCard(page, LINE)).toBeVisible()

  await tick(page, [SKETCH, QUESTION, LONG_READ])
  const draft = page.getByRole('button', { name: 'Draft versions' })
  await expect(draft).toBeDisabled()
  await expect(page.getByText('Tick one to three templates.')).toBeVisible()
  await tick(page, [SKETCH])
  await expect(draft).toBeEnabled()
  await press(page, 'Draft versions', 'Structures drafted')

  for (const name of [LINE, QUESTION, LONG_READ]) {
    await expectImagesLoaded(draftCard(page, name))
  }
  await expect(draftCard(page, SKETCH)).toHaveCount(0)

  // The question's first body claim has no fact behind it until it is fixed.
  const question = draftCard(page, QUESTION)
  await expect(question.getByText('No source', { exact: true })).toBeVisible()
  await press(page, 'Use this version', 'Version picked', question)
  await press(page, 'Paper', 'Theme chosen · Paper')
  await expect(page.getByRole('button', { name: 'Approve text' })).toBeDisabled()
  await expect(page.getByText('A claim has no source. Fix it before approving.')).toBeVisible()
  await press(page, 'Fix unbound claim', 'Claim bound to a supported fact', question)
  await expect(question.getByText('No source', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Approve text' })).toBeEnabled()
  await expect(draftCard(page, LONG_READ).getByText(LONG_READ_FIT)).toBeVisible()
})

test('approving opens the render gate; a failing fit keeps Render unavailable; reopening locks it', async () => {
  test.setTimeout(300_000)
  const { page } = er
  // A post from before the looks, its line and long read drafted (the long read's slide 2 over).
  posts.legacy = await legacyPost(page, LEGACY_SOURCE, [
    LEGACY_TEMPLATES.line,
    LEGACY_TEMPLATES.longRead,
  ])
  await useVersion(page, LONG_READ)
  // Nothing renders before the text is approved (AD-R1).
  await expect(page.getByRole('button', { name: 'Render', exact: true })).toHaveCount(0)

  await approveLegacyText(page)
  const render = section(page, 'Images')
  await expect(render.getByRole('button', { name: 'Render', exact: true })).toBeDisabled()
  await expect(render.getByText(LONG_READ_FIT)).toBeVisible()
  await expect(whyUnavailable(render)).toHaveAccessibleDescription(
    'Fix the failing fit checks before rendering.',
  )

  // Reopening: the step bar's Text link opens the passed text, edited in place, and using the line
  // there moves the post back by itself (GD28); Images, not reached again, opens the Text step.
  await page
    .getByRole('list', { name: 'Stages', exact: true })
    .getByRole('link', { name: 'Text', exact: true })
    .click()
  await onStep(page, 'text')
  await useVersion(page, LINE)
  await openStep(page, posts.legacy, 'images')
  await onStep(page, 'text')
  await expect(page.getByRole('button', { name: 'Render', exact: true })).toHaveCount(0)
})

test('the approved layout is the previewed draft, and the render lays it out with art', async () => {
  const { page } = er
  await openStep(page, posts.legacy, 'text')
  // The line, used when the text was reopened, is the picked version already.
  await useVersion(page, LINE)
  // Picked, the version is on the stage: its filmstrip shows the slides as they will be laid out.
  const line = stage(page)
  await expectImagesLoaded(line)
  const drafted = await imageBytes(page, line)

  await approveLegacyText(page)
  const render = section(page, 'Images')
  await expectImagesLoaded(render, drafted.length)
  const approved = await imageBytes(page, render)
  expect(approved.length).toBe(drafted.length)
  approved.forEach((bytes, i) => {
    expect(bytes.equals(drafted[i]), `slide ${i + 1} is the previewed slide`).toBe(true)
  })

  await press(page, 'Render', 'Rendered · 5 slides', render)
  await expectImagesLoaded(render, 5)
  await expect(cover(render).getByText('No art', { exact: true })).toHaveCount(0)
  await expect(render.getByText('Replay', { exact: true })).toHaveCount(0)
  expect(await renderHasArt(posts.legacy), 'the cover has art').toBe(true)
})

test('art that fails on another source gives a cover with No art, and Try again gives art', async () => {
  test.setTimeout(300_000)
  const { page } = er
  posts.artFails = await legacyPost(page, {
    title: 'Paid work, when the art fails',
    text: withMarker(nonDemo(PAID_WORK.text), 1, '[fake:fail-art]'),
  })
  await useVersion(page, LINE)
  await approveLegacyText(page)
  const render = section(page, 'Images')
  await press(page, 'Render', 'Rendered · 5 slides', render)
  await expect(cover(render).getByText('No art', { exact: true })).toBeVisible()
  expect(await renderHasArt(posts.artFails)).toBe(false)

  // The image model answers this time: its image waits in the art cache under the prompt's key,
  // computed as src/features/content/ai/art.ts computes it for the render's own cover (set 0,
  // option 0, first attempt).
  const prompt = await renderedArtPrompt(posts.artFails)
  if (prompt === null) throw new Error('The render has no art prompt')
  const key = sha256Hex(
    canonicalJson({
      model: process.env.GEMINI_IMAGE_MODEL ?? '',
      prompt,
      aspectRatio: '4:5',
      set: 0,
      option: 0,
      attempt: 1,
    }),
  )
  const assetId = `e2e-art-${posts.artFails}`
  cachedArt.push({ key, assetId })
  await cacheArt(key, assetId, PNG)

  await press(page, 'Try again', 'Rendered · 5 slides', render)
  await expect(cover(render).getByText('No art', { exact: true })).toHaveCount(0)
  expect(await renderHasArt(posts.artFails), 'the cover has art').toBe(true)
})

test("the chosen version is edited on its slide and checked as it goes; a flag takes the source's wording (98, 104)", async () => {
  const { page } = er
  await chosenOnText(page, {
    title: 'Paid work, edited on the slide',
    text: nonDemo(PAID_WORK.text),
  })
  // No button: choosing checks the version.
  await checked(page, CLEAN)
  await expect(page.getByRole('button', { name: 'Run source check' })).toHaveCount(0)

  // Edit slide 2's body in place: the preview is drawn again and the fit row reads the new text.
  const slide2 = stageSlides(page).nth(1)
  const drawnBefore = await slide2.getAttribute('src')
  // A sentence the source does not hold (the fake's check finds a shortened source sentence).
  const typed = UNSUPPORTED
  await editBody(page, 2, typed)
  await expect(
    (await checkResults(page)).getByText('Slide 2 · 7 words (15–25) · Under'),
  ).toBeVisible()
  await expect.poll(() => slide2.getAttribute('src')).not.toBe(drawnBefore)

  // The edited sentence is checked by itself; the flag stays until the source's wording is used.
  const wording = page
    .getByRole('tabpanel')
    .getByRole('button', { name: "Use the source's wording" })
  await checked(page, /· 1 not found ·/)
  await expect(wording).toHaveCount(1)
  await wording.click()
  await checked(page, CLEAN)
  await expect(wording).toHaveCount(0)
})

/** Make the post, use its first idea and its first version: the chosen version on Text. */
async function chosenOnText(page: Page, src: { title: string; text: string }) {
  await makePost(page, src)
  await pickIdea(page)
  await pickVersion(page)
}

test('the source check, then feed settings, gate Send to review', async () => {
  const { page } = er
  // The rehearsed post from its idea cards to Settings, with one sentence the source does not
  // hold typed on slide 3 (18 words, inside a look's 15–25) for the source check to catch.
  await openStep(page, posts.paidWork, 'ideas')
  await pickIdea(page)
  await pickVersion(page)
  await editBody(page, 3, `${SOURCE_SENTENCE} ${UNSUPPORTED}`)
  await approveText(page)
  await drawImages(page)
  await toSettings(page)

  const check = await openSourceCheck(page)
  // No button: the check ran by itself after approval, and the page shows it once it lands (98).
  await expect(check.getByText(/Not found$/)).toHaveCount(1, { timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Run source check' })).toHaveCount(0)
  // The sentences found wait in the "All checked sentences" drawer.
  let all = await allCheckedSentences(page)
  await expect(all.getByText(/Found ¶\d+$/).first()).toBeVisible()
  await all.getByRole('button', { name: 'Close', exact: true }).click()

  // "Send to review" waits in the step bar, its reason behind its "!".
  const send = stepActions(page).getByRole('button', { name: 'Send to review → Review' })
  const why = whyUnavailable(stepActions(page))
  // No expiry chosen: the missing setting is named.
  await expect(send).toBeDisabled()
  await expect(why).toHaveAccessibleDescription(/expiry before sending to review/)
  let settings = await settingsPanel(page, 'Expiry')
  await settings.getByRole('radio', { name: '90 days' }).check()
  await expect(send).toBeDisabled()
  await expect(why).toHaveAccessibleDescription(
    'Remove each claim the source check could not find, or mark it as editorial opinion.',
  )

  await openSourceCheck(page)
  await press(page, 'Mark as editorial opinion', 'Marked as editorial opinion', check)
  await expect(check.getByText(/Not found$/)).toHaveCount(0)
  all = await allCheckedSentences(page)
  await expect(all.getByText('Editorial opinion', { exact: true })).toBeVisible()
  await all.getByRole('button', { name: 'Close', exact: true }).click()

  settings = await settingsPanel(page, 'Expiry')
  await settings.getByRole('radio', { name: '90 days' }).check()
  settings = await settingsPanel(page, 'Who sees it')
  await settings.getByRole('radio', { name: 'Personal' }).check()
  await expect(settings.getByLabel('Why line')).toBeVisible()
  await expect(send).toBeDisabled()
  await expect(why).toHaveAccessibleDescription(/Personal and matched posts always say why/)

  await settings.getByRole('radio', { name: 'Featured' }).check()
  await expect(settings.getByRole('radio', { name: 'Matched group' })).toBeDisabled()
  await expect(settings.getByText('Featured posts go to everyone')).toBeVisible()
  await expect(settings.getByText('18,420 (mock)')).toBeVisible()

  await settings.getByRole('radio', { name: 'General' }).check()
  await settings.getByRole('radio', { name: /^Everyone/ }).check()
  await expect(settings.getByLabel('Why line')).toHaveCount(0)
  settings = await lastSettingsPanel(page)
  await press(page, 'Save settings', 'Settings saved', settings)
  await expect(send).toBeEnabled()
  await sendToReview(page)

  await page.goto('/admin/board')
  await expect(
    page
      .getByRole('region', { name: 'In review', exact: true })
      .locator(`a[href^="/admin/posts/${posts.paidWork}"]`),
  ).toBeVisible()
})

test('an editor who is not a reviewer is waiting for a reviewer', async () => {
  const { page } = ed
  await post(page, posts.paidWork)
  await onStep(page, 'review')
  await expect(page.getByRole('button', { name: 'Approve and publish' })).toBeDisabled()
  await expect(whyUnavailable(stepActions(page))).toHaveAccessibleDescription(
    'Waiting for a reviewer',
  )
})

test('a reviewer cannot edit, and requests changes with a step and a note', async () => {
  const { page } = rv
  await post(page, posts.paidWork)
  await onStep(page, 'review')
  await expect(page.getByRole('heading', { level: 2, name: 'Review' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('radio')).toHaveCount(0)
  // The slides, the facts behind them, the source check with the opinion mark, the settings, one
  // tab each, the facts first.
  const review = page.getByRole('region', { name: 'Review', exact: true })
  await expectImagesLoaded(review, 5)
  await expect(
    review.getByText(new RegExp(` · ¶\\d+ · ${PAID_WORK.title} · checked `)).first(),
  ).toBeVisible()
  await openTab(review, 'Source check')
  await expect(review.getByText('Editorial opinion')).toBeVisible()
  await openTab(review, 'Feed settings')
  await expect(review.getByText(LIVE_LINE)).toBeVisible()

  await page.getByRole('button', { name: 'Request changes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Request changes' })
  const confirm = dialog.getByRole('button', { name: 'Request changes' })
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('radio', { name: 'Settings' }).check()
  await dialog.getByLabel('Note').fill('   ')
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Note').fill('Slide 2 is too long')
  await confirm.click()
  await expect(dialog).toBeHidden()

  // The editor finds the post on the step the note names, with the note beside it.
  await post(er.page, posts.paidWork)
  await onStep(er.page, 'settings')
  await expect(er.page.getByText('Slide 2 is too long')).toBeVisible()
  await expect(er.page.getByText(rv.name)).toBeVisible()
  await sendToReview(er.page)
})

test('the reviewer approves and publishes: live, reviewed, and the slides they saw', async () => {
  const { page } = rv
  await post(page, posts.paidWork)
  await onStep(page, 'review')
  const review = page.getByRole('region', { name: 'Review', exact: true })
  await expectImagesLoaded(review, 5)
  const seen = await imageBytes(page, review)

  await press(page, 'Approve and publish', `Published · ${LIVE_LINE}`)
  await onStep(page, 'live')
  const live = page.getByRole('region', { name: 'Live in feed', exact: true })
  await expect(
    live.getByText(`Reviewed by ${rv.name} · facts locked`, { exact: true }),
  ).toBeVisible()
  await expect(live.getByText(LIVE_LINE)).toBeVisible()
  await expectImagesLoaded(live, 5)
  const published = await imageBytes(page, live)
  expect(published.length).toBe(seen.length)
  published.forEach((bytes, i) => {
    expect(bytes.equals(seen[i]), `live slide ${i + 1} is the reviewed slide`).toBe(true)
  })

  await page.goto('/admin/board')
  const card = page
    .getByRole('region', { name: 'Live in feed · exported', exact: true })
    .getByRole('listitem')
    .filter({ has: page.locator(`a[href^="/admin/posts/${posts.paidWork}"]`) })
  await expect(card).toContainText(LIVE_LINE)
  // A live post's settings cannot change.
  await post(page, posts.paidWork)
  await onStep(page, 'live')
  await expect(page.getByRole('heading', { level: 2, name: 'Feed settings' })).toHaveCount(0)
})

test('one account makes and approves a post: self-reviewed', async () => {
  const { page } = er
  await settingsPost(page, { title: 'Paid work, self-reviewed', text: nonDemo(PAID_WORK.text) })
  await markNotFoundAsOpinion(page)
  await (await settingsPanel(page, 'Expiry')).getByRole('radio', { name: '90 days' }).check()
  await sendToReview(page)

  await press(page, 'Approve and publish', `Published · ${LIVE_LINE}`)
  await onStep(page, 'live')
  await expect(
    page
      .getByRole('region', { name: 'Live in feed', exact: true })
      .getByText(`Reviewed by ${er.name} · facts locked · self-reviewed`, { exact: true }),
  ).toBeVisible()
})

test('a save on a version someone changed is refused, and the latest loads', async () => {
  const a = er.page
  await openStep(a, posts.twin, 'ideas')
  await pickIdea(a)

  const b = await er.context.newPage()
  try {
    await openStep(b, posts.twin, 'text')
    await openOtherVersions(b)
    const use = b.getByRole('button', { name: 'Use this version' }).first()
    await expect(use).toBeVisible()
    // The version b means to use, by its card's name.
    const tried = await b
      .getByRole('article')
      .filter({ has: b.getByRole('button', { name: 'Use this version' }) })
      .first()
      .getAttribute('aria-label')
    if (!tried) throw new Error('A version card has no name')
    await openTab(a, 'Style')
    await press(a, 'Subdued', 'Colours · Subdued')

    await use.click()
    await expect(toast(b, `Changed by ${er.name} just now`)).toBeVisible()
    await openTab(b, 'Style')
    await expect(b.getByRole('button', { name: 'Subdued', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await b.reload()
    await openTab(b, 'Style')
    await expect(b.getByRole('button', { name: 'Subdued', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // The refused pick changed nothing: that version still waits in "Versions" to be used.
    await openOtherVersions(b)
    await expect(
      b
        .getByRole('article', { name: tried, exact: true })
        .getByRole('button', { name: 'Use this version' }),
    ).toBeVisible()
  } finally {
    await b.close()
  }
})

test('a failed extraction on another source keeps the text and offers Try again', async () => {
  const { page } = er
  const failing = {
    title: 'Paid work, failing extraction',
    text: withMarker(nonDemo(PAID_WORK.text), 5, '[fake:fail-extract]'),
  }
  const before = await countPostsBy(er.email)
  const form = await pasteSource(page, failing)
  await expect(form.getByRole('alert')).toHaveText(FAILED)
  await expect(form.getByRole('button', { name: 'Try again' })).toBeEnabled()
  await expect(form.getByLabel('Title', { exact: true })).toHaveValue(failing.title)
  await expect(form.getByLabel('Source', { exact: true })).toHaveValue(failing.text)
  await expect(page).toHaveURL(/\/admin\/posts\/new$/)
  expect(await countPostsBy(er.email)).toBe(before)
})

test('a failed draft after "Use this idea" keeps the facts and offers Try again for that step (93)', async () => {
  const { page } = er
  await pasteSource(page, {
    title: 'Paid work, failing drafts',
    text: withMarker(nonDemo(PAID_WORK.text), 5, '[fake:fail-draft]'),
  })
  const id = await openedPostId(page)
  await ideasOffered(page)
  await page.getByRole('button', { name: 'Use this idea' }).first().click()
  await writeSlides(page)
  await expect(page.getByText('Drafting failed. Your outline is kept.')).toBeVisible({
    timeout: 90_000,
  })
  await expect(page.getByRole('button', { name: 'Use this version' })).toHaveCount(0)
  // Soft, so the facts are still looked at when it fails.
  await expect
    .soft(page.getByRole('button', { name: 'Try again', exact: true }))
    .toBeEnabled({ timeout: 5_000 })
  await openStep(page, id, 'source')
  await expect(facts(page).getByRole('listitem')).not.toHaveCount(0)
})

test('a failed extraction on the rehearsed source opens the recorded one, marked Replay', async () => {
  test.skip(
    REPLAYS['paid-work'] === undefined,
    'Run bun run ai:replays first (Task 21) — needs Google Cloud credentials',
  )
  const { page } = er
  const id = await makePost(page, {
    title: PAID_WORK.title,
    text: withMarker(PAID_WORK.text, 5, '[fake:fail-extract]'),
  })
  await openStep(page, id, 'source')
  await expect(facts(page).getByText('Replay')).toBeVisible()
})
