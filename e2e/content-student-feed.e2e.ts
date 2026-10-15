import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test'
import { freshEmail } from './helpers/accounts'
import {
  approvePublish,
  feedSettings,
  markNotFoundAsOpinion,
  onStep,
  openStep,
  PAID_WORK,
  requireFakeProvider,
  type Source,
  sendToReview,
  settingsPost,
} from './helpers/content'
import { deletePostsBy, deleteUsers, setCapabilities, setRole, sql } from './helpers/db'
import { devLogin, signInUser, type User } from './helpers/login'
import { skipSplash } from './helpers/student'

// The student feed in the browser, against the fake model provider: an editor-reviewer publishes
// a General post and a Personal post with a Nepal version through the admin's step screens
// (/admin/posts/<id>/<step>: drawn on Images, set on Settings), and a student with
// no capabilities meets them at phone width (71, 79), opens a card to the slides (75), turns the
// home-country switch to Nepal (76), asks the image route for a draft's slide (77), finds a post
// in review "not found" (73); signed out, anyone reads a live post on its public page and finds it
// in the sitemap (107), and a feed page sends her to sign in and back (78). Then the targeted
// feed: the General post is tagged Australia · Work and study life and the Personal one United
// Kingdom · Books and movies, so they share nothing; a third post, tagged Australia · Books and
// movies with an India version, shares one tag with each. The student narrows by chip (81), sees
// the India version under home=IN (82, 85), searches (83), meets the General post's Instagram
// links once an editor has exported it there and recorded the URL (89, 90), and finds each page's
// Related with why each post is there (91). The posts move through their steps, so the tests run
// in order.
//   er: an editor and a reviewer · st: a student

test.describe.configure({ mode: 'serial', timeout: 180_000 })

const WIDE = { width: 1280, height: 800 }
const PHONE = { width: 360, height: 780 }
const WHY = 'Because you plan to work while you study'
const PARAGRAPHS = PAID_WORK.text.split('\n\n')

/** Paid work as rehearsed: the General post. */
const GENERAL: Source = { title: 'Paid work, in the feed', text: PAID_WORK.text }
/** Paid work with its money paragraph first, so the Nepal version's slide 2 carries NPR. */
const MONEY: Source = {
  title: 'Paid work, money first, for you',
  text: [4, 1, 2, 0, 3].map((i) => PARAGRAPHS[i]).join('\n\n'),
}
/** Paid work left drawn: never in the feed. */
const PENDING: Source = { title: 'Paid work, left before review', text: PAID_WORK.text }
/**
 * Paid work, money first again, under a title with a word no other post carries: the third post,
 * whose India version's slide 2 carries INR and which shares one tag with each of the others.
 */
const RUPEES: Source = { title: 'Paid work, rupees first', text: MONEY.text }
/** Where the General post's Instagram version "went out" (criterion 89). */
const IG_URL = 'https://www.instagram.com/p/test123/'
/** The Main page's account, from src/features/content/brands/main.json (criterion 90). */
const MAIN_PAGE = { handle: 'ofcourse_ai', url: 'https://www.instagram.com/ofcourse_ai/' }

type Person = User & { context: BrowserContext; page: Page }
let er: Person
let st: Person
const contexts: BrowserContext[] = []
const emails: string[] = []

/** The posts the steps share; `social` is the General post's Instagram version. */
const posts = { general: '', money: '', pending: '', rupees: '', social: '' }

test.beforeAll(async ({ browser }) => {
  const people: Person[] = []
  for (const [label, caps] of [
    ['feed-er', { editor: true, reviewer: true }],
    ['feed-st', { editor: false, reviewer: false }],
  ] as const) {
    const context = await browser.newContext({
      viewport: label === 'feed-st' ? PHONE : WIDE,
      acceptDownloads: true,
    })
    contexts.push(context)
    const page = await context.newPage()
    const user = await signInUser(page, { label })
    emails.push(user.email)
    // On an empty table the first account becomes a superadmin, who may do everything.
    await setRole(user.email, 'user')
    await setCapabilities(user.email, caps)
    people.push({ ...user, context, page })
  }
  ;[er, st] = people
  await requireFakeProvider(er.page)
})

test.afterAll(async () => {
  for (const c of contexts) await c.close()
  await deletePostsBy(emails)
  await deleteUsers(emails)
})

const post = (page: Page, id: string) => page.goto(`/admin/posts/${id}`)
const section = (page: Page, name: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) })
const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text })

/** Press a workbench button and wait for the line that confirms it. */
async function press(page: Page, name: string, confirms: string | RegExp, scope?: Locator) {
  await (scope ?? page).getByRole('button', { name, exact: true }).click()
  // A press runs a server step (extract, render, check) on the dev server, which compiles the
  // route on first use and draws slides in-process; one worker (playwright.config.ts). How much
  // of the wait is compiling and how much is drawing has not been measured.
  await expect(toast(page, confirms).first()).toBeVisible({ timeout: 60_000 })
}

/** The stored asset each slide image in `scope` shows, in order; a layout preview shows as its path. */
function slideIds(scope: Locator, prefix: string): Promise<string[]> {
  return scope.getByRole('img', { name: /^Slide \d+\b/ }).evaluateAll(
    (els, p) =>
      els.map((el) => {
        const path = decodeURIComponent(new URL((el as HTMLImageElement).src).pathname)
        return path.startsWith(p) ? path.slice(p.length) : path
      }),
    prefix,
  )
}

/** The alt text of each slide image in `scope`, in order. */
const slideAlts = (scope: Locator) =>
  scope
    .getByRole('img', { name: /^Slide \d+\b/ })
    .evaluateAll((els) => els.map((el) => el.getAttribute('alt')))

/** The Live step's region of a published post. */
const live = (page: Page) => page.getByRole('region', { name: 'Live in feed', exact: true })

/**
 * Make a market version from a post's Images step (criterion 85): its "For market" select and
 * "Make market version".
 */
async function makeMarketVersion(page: Page, id: string, market: string) {
  await openStep(page, id, 'images')
  const images = page.getByRole('region', { name: 'Images', exact: true })
  await images.getByRole('combobox', { name: 'For market' }).selectOption({ label: market })
  await images.getByRole('button', { name: 'Make market version' }).click()
}

/** How many slides a post's current render has. */
async function renderSlideCount(postId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select jsonb_array_length(a.body->'slides')::int as n from content_post p
    join content_artifact a on a.id = p.pointers->>'renderId'
    where p.id = ${postId}`
  if (!row) throw new Error(`No render on ${postId}`)
  return row.n
}

/** The PNG asset of a post's current render's cover. */
async function renderCoverId(postId: string): Promise<string> {
  const [row] = await sql<{ id: string | null }[]>`
    select a.body->'slides'->0->>'pngAssetId' as id from content_post p
    join content_artifact a on a.id = p.pointers->>'renderId'
    where p.id = ${postId}`
  if (!row?.id) throw new Error(`No render on ${postId}`)
  return row.id
}

/**
 * The PNG asset of the slide in a post's current render that draws its source line. Asset ids
 * are hashes of the bytes, so a cover drawn from the same text, template, theme and fake art is
 * the same asset on every post; the source line names the post's title, so this slide is its own.
 */
async function renderSourceSlideId(postId: string): Promise<string> {
  const [row] = await sql<{ id: string | null }[]>`
    select s.slide->>'pngAssetId' as id from content_post p
    join content_artifact r on r.id = p.pointers->>'renderId'
    join content_artifact l on l.id = r.body->>'layoutId'
    cross join lateral jsonb_array_elements(r.body->'slides') with ordinality as s(slide, ord)
    where p.id = ${postId}
      and l.body->'slides'->(s.ord::int - 1)->>'sourceLine' is not null
    order by s.ord limit 1`
  if (!row?.id) throw new Error(`No slide with a source line on ${postId}`)
  return row.id
}

/** A post's page in the feed, with the filters' query string ("home=NP") when there is one. */
const feedHref = (id: string, query?: string) => `/feed/${id}${query ? `?${query}` : ''}`
/** The feed's card for a post: the list item whose title links to the post's page. */
const card = (page: Page, id: string, query?: string) =>
  page.getByRole('listitem').filter({ has: page.locator(`a[href="${feedHref(id, query)}"]`) })
/** One row of chips (a fieldset named by its legend): Destination, Home country, Theme or Age. */
const chipRow = (page: Page, name: string) => page.getByRole('group', { name, exact: true })
const homeSwitch = (page: Page) => chipRow(page, 'Home country')
/** Tick a tag in the feed settings (criterion 80). */
const tick = (settings: Locator, label: string) =>
  settings.getByRole('checkbox', { name: label, exact: true }).check()

test('er publishes the General post: paid work, Everyone, no expiry, for Australia and Work and study life', async () => {
  const { page } = er
  posts.general = await settingsPost(page, GENERAL)
  await markNotFoundAsOpinion(page)
  const settings = feedSettings(page)
  await settings.getByRole('radio', { name: 'General' }).check()
  await settings.getByRole('radio', { name: /^Everyone/ }).check()
  await settings.getByRole('radio', { name: 'No expiry' }).check()
  await tick(settings, 'Australia')
  await tick(settings, 'Work and study life')
  await sendToReview(page)
  await approvePublish(page)
  await expect(live(page).getByText('General · Everyone · No expiry')).toBeVisible()
  await expect(
    live(page).getByText('Australia · Work and study life', { exact: true }),
  ).toBeVisible()
})

test('er publishes the Personal post with its why line and a Nepal version, for the United Kingdom and Books and movies', async () => {
  const { page } = er
  posts.money = await settingsPost(page, MONEY)
  await markNotFoundAsOpinion(page)
  const settings = feedSettings(page)
  await settings.getByRole('radio', { name: 'Personal' }).check()
  await settings.getByLabel('Why line').fill(WHY)
  await settings.getByRole('radio', { name: '90 days' }).check()
  await tick(settings, 'United Kingdom')
  await tick(settings, 'Books and movies')
  await press(page, 'Save settings', 'Settings saved', settings)

  await makeMarketVersion(page, posts.money, 'Nepal')
  await expect(toast(page, 'Nepal version made · linked card on the board')).toBeVisible()
  await expect(page).toHaveURL(/[?&]market=NP/)

  await openStep(page, posts.money, 'settings')
  await sendToReview(page)
  await approvePublish(page)
})

test('a student sees both posts as cards, newest first: For you on the Personal one, no tag on the General one (71, 79)', async () => {
  const { page } = st
  await page.goto('/feed')
  await expect(page.getByRole('heading', { level: 1, name: 'Feed' })).toBeVisible()

  const personal = card(page, posts.money)
  await expect(personal).toHaveCount(1)
  await expect(personal.getByRole('link', { name: MONEY.title })).toBeVisible()
  await expect(personal.getByRole('img', { name: `Cover of ${MONEY.title}` })).toBeVisible()
  await expect(personal.getByText('For you', { exact: true })).toBeVisible()
  await expect(personal.getByText(WHY, { exact: true })).toBeVisible()
  await expect(personal.getByText(new RegExp(`^Source: ${MONEY.title} · ¶\\d`))).toBeVisible()

  const general = card(page, posts.general)
  await expect(general).toHaveCount(1)
  await expect(general.getByRole('link', { name: GENERAL.title })).toBeVisible()
  await expect(general.getByRole('img', { name: `Cover of ${GENERAL.title}` })).toBeVisible()
  await expect(general.getByText('For you', { exact: true })).toHaveCount(0)
  await expect(general.getByText('Featured', { exact: true })).toHaveCount(0)

  // Newest approval first: the Personal post was published after the General one.
  const hrefs = await page
    .locator('a[href^="/feed/"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
  expect(hrefs.indexOf(feedHref(posts.money))).toBeLessThan(hrefs.indexOf(feedHref(posts.general)))
})

test('the editor-reviewer opens the feed too and sees both published posts: staff are not sent away (71)', async () => {
  const { page } = er
  await page.goto('/feed')
  await expect(page).toHaveURL(/\/feed$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Feed' })).toBeVisible()
  await expect(card(page, posts.money).getByRole('link', { name: MONEY.title })).toBeVisible()
  await expect(card(page, posts.general).getByRole('link', { name: GENERAL.title })).toBeVisible()
})

test('opening a card shows every slide of the approved render in order, each with its alt (75)', async () => {
  const { page } = st
  await page.goto('/feed')
  await card(page, posts.general).getByRole('link', { name: GENERAL.title }).click()
  await expect(page).toHaveURL(new RegExp(`/feed/${posts.general}$`))
  await expect(page.getByRole('heading', { level: 1, name: GENERAL.title })).toBeVisible()

  const count = await renderSlideCount(posts.general)
  expect(count).toBe(5)
  const strip = page
    .getByRole('list')
    .filter({ has: page.getByRole('img', { name: /^Slide 1\b/ }) })
  await expect(strip.getByRole('listitem')).toHaveCount(count)
  const alts = await slideAlts(strip)
  expect(alts).toHaveLength(count)
  alts.forEach((alt, i) => {
    expect(alt, `slide ${i + 1}`).toMatch(new RegExp(`^Slide ${i + 1}: \\S`))
  })
  await expect(page.getByText(new RegExp(`^Source: ${GENERAL.title} · ¶\\d`))).toBeVisible()
  await expect(page.getByText('For you', { exact: true })).toHaveCount(0)

  await page.getByRole('link', { name: 'Feed', exact: true }).click()
  await expect(page).toHaveURL(/\/feed$/)
})

test('home=NP shows the Nepal version with NPR and keeps the choice into the post page (76)', async () => {
  const { page } = st
  // The main version never says NPR.
  await page.goto(feedHref(posts.money))
  const main = await slideAlts(page.getByRole('main'))
  expect(main).toHaveLength(5)
  expect(main.join(' ')).not.toContain('NPR')

  await page.goto('/feed?home=NP')
  await expect(homeSwitch(page).getByRole('link', { name: 'Nepal' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(card(page, posts.money, 'home=NP')).toHaveCount(1)
  await expect(card(page, posts.general, 'home=NP')).toHaveCount(1)
  await card(page, posts.money, 'home=NP').getByRole('link', { name: MONEY.title }).click()
  await expect(page).toHaveURL(new RegExp(`/feed/${posts.money}\\?home=NP$`))

  const nepal = await slideAlts(page.getByRole('main'))
  expect(nepal).toHaveLength(5)
  const withNpr = nepal.flatMap((alt, i) => (alt?.includes('NPR') ? [i + 1] : []))
  expect(withNpr, 'one slide carries the money figure in NPR').toEqual([2])
  expect(nepal[1]).toContain('AUD 499 (≈ NPR 43,900)')
  await expect(page.getByText('For you', { exact: true })).toBeVisible()
  await expect(page.getByText(WHY, { exact: true })).toBeVisible()

  // The chips and the way back keep the choice; Clear drops it, and the emptied URL still names
  // its filters, so a profile would not fill the chip again (84).
  await expect(homeSwitch(page).getByRole('link', { name: 'Nepal' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(homeSwitch(page).getByRole('link', { name: 'Clear' })).toHaveAttribute(
    'href',
    `${feedHref(posts.money)}?q=`,
  )
  await expect(page.getByRole('link', { name: 'Feed', exact: true })).toHaveAttribute(
    'href',
    '/feed?home=NP',
  )

  // A post with no Nepal version shows its main version under home=NP.
  await page.goto(feedHref(posts.general))
  const generalMain = await slideAlts(page.getByRole('main'))
  await page.goto(feedHref(posts.general, 'home=NP'))
  expect(await slideAlts(page.getByRole('main'))).toEqual(generalMain)
})

test("the image route serves a live post's slide as a PNG and refuses a draft render's (77)", async () => {
  posts.pending = await settingsPost(er.page, PENDING)
  const { page } = st
  await page.goto(feedHref(posts.general))
  const [liveId] = await slideIds(page.getByRole('main'), '/feed/assets/')
  expect(liveId).toBe(await renderCoverId(posts.general))

  const live = await page.request.get(`/feed/assets/${encodeURIComponent(liveId)}`)
  expect(live.status()).toBe(200)
  expect(live.headers()['content-type']).toBe('image/png')
  expect(live.headers()['cache-control']).toContain('immutable')

  const draftId = await renderSourceSlideId(posts.pending)
  const draft = await page.request.get(`/feed/assets/${encodeURIComponent(draftId)}`)
  expect(draft.status()).toBe(404)
  const unknown = await page.request.get('/feed/assets/not-an-asset')
  expect(unknown.status()).toBe(404)
})

test('a post in review is not in the feed and its page answers not found (73)', async () => {
  await openStep(er.page, posts.pending, 'settings')
  await markNotFoundAsOpinion(er.page)
  await feedSettings(er.page).getByRole('radio', { name: '90 days' }).check()
  await sendToReview(er.page)

  const { page } = st
  await page.goto('/feed')
  await expect(card(page, posts.general)).toHaveCount(1)
  await expect(page.locator(`a[href^="/feed/${posts.pending}"]`)).toHaveCount(0)
  const res = await page.goto(feedHref(posts.pending))
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: PENDING.title })).toHaveCount(0)
})

/** The slug a post got when it went live, or null. */
async function slugOf(postId: string): Promise<string | null> {
  const [row] = await sql<{ slug: string | null }[]>`
    select slug from content_post where id = ${postId}`
  return row?.slug ?? null
}

test('signed out, a live post has a public page: title, slides, source and search lines and Join OfCourse under "<title> | OfCourse", the cover as its share image; one in review is not found; the sitemap lists the live ones (107)', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: PHONE })
  contexts.push(context)
  const page = await context.newPage()
  await skipSplash(page)

  const slug = await slugOf(posts.general)
  // Other runs on this database may have published a post with the same title first.
  expect(slug).toMatch(/^paid-work-in-the-feed(-\d+)?$/)
  const res = await page.goto(`/posts/${slug}`)
  expect(res?.status()).toBe(200)
  await expect(page).toHaveTitle(`${GENERAL.title} | OfCourse`)
  await expect(page.getByRole('heading', { level: 1, name: GENERAL.title })).toBeVisible()

  const strip = page
    .getByRole('list')
    .filter({ has: page.getByRole('img', { name: /^Slide 1\b/ }) })
  await expect(strip.getByRole('listitem')).toHaveCount(5)
  const cover = await renderCoverId(posts.general)
  expect((await slideIds(strip, '/posts/assets/'))[0]).toBe(cover)
  await expect(page.getByText(new RegExp(`^Source: ${GENERAL.title} · ¶\\d`))).toBeVisible()
  await expect(
    page.getByText(`To find this again, search “OfCourse ${GENERAL.title}”`, { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Join OfCourse' })).toHaveAttribute('href', '/')

  // The share image is the cover, served to anyone through the public image route.
  const shared = `/posts/assets/${encodeURIComponent(cover)}`
  // Next may stream the metadata into the body as well as the head: the same tag twice.
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
    'content',
    new RegExp(`${shared.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
  )
  const image = await page.request.get(shared)
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toBe('image/png')

  // The Personal post's page shows neither its layer nor its why line.
  await page.goto(`/posts/${await slugOf(posts.money)}`)
  await expect(page.getByRole('heading', { level: 1, name: MONEY.title })).toBeVisible()
  await expect(page.getByText(WHY, { exact: true })).toHaveCount(0)
  await expect(page.getByText('For you', { exact: true })).toHaveCount(0)

  // The post in review has no page and its slides stay private.
  expect(await slugOf(posts.pending)).toBeNull()
  const review = await page.goto('/posts/paid-work-left-before-review')
  expect(review?.status()).toBe(404)
  const draftId = await renderSourceSlideId(posts.pending)
  expect((await page.request.get(`/posts/assets/${encodeURIComponent(draftId)}`)).status()).toBe(
    404,
  )

  const sitemap = await page.request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const xml = await sitemap.text()
  expect(xml).toContain(`/posts/${slug}</loc>`)
  expect(xml).not.toContain('/posts/paid-work-left-before-review<')
})

test('signed out, a post page leads to the sign-in page and, once signed in, back to the post (78)', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: PHONE })
  contexts.push(context)
  const page = await context.newPage()
  const email = freshEmail('feed-return')
  emails.push(email)

  await page.goto('/feed')
  await expect(page).toHaveURL(/\/\?next=%2Ffeed$/)
  await page.goto(feedHref(posts.general))
  await expect(page).toHaveURL(new RegExp(`/\\?next=%2Ffeed%2F${posts.general}$`))
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

  await devLogin(page, email, 'E2E Feed Return')
  await setRole(email, 'user')
  await page.goto(page.url())
  await expect(page).toHaveURL(new RegExp(`/feed/${posts.general}$`))
  await expect(page.getByRole('heading', { level: 1, name: GENERAL.title })).toBeVisible()
})

test('two posts that share no tag show no Related section, and every page ends with the Instagram pages (88, 91)', async () => {
  const { page } = st
  for (const [id, title] of [
    [posts.general, GENERAL.title],
    [posts.money, MONEY.title],
  ]) {
    await page.goto(feedHref(id))
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Related' })).toHaveCount(0)
    await expect(page.getByText('Follow OfCourse on Instagram', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: `@${MAIN_PAGE.handle}` })).toHaveAttribute(
      'href',
      MAIN_PAGE.url,
    )
    // Nothing went out on Instagram yet: no post link, no page to follow for it.
    await expect(page.getByRole('link', { name: 'See this post on Instagram' })).toHaveCount(0)
  }
})

test('er publishes a third post for Australia and Books and movies with an India version (85)', async () => {
  const { page } = er
  posts.rupees = await settingsPost(page, RUPEES)
  await markNotFoundAsOpinion(page)
  const settings = feedSettings(page)
  await settings.getByRole('radio', { name: 'No expiry' }).check()
  await tick(settings, 'Australia')
  await tick(settings, 'Books and movies')
  await press(page, 'Save settings', 'Settings saved', settings)

  await makeMarketVersion(page, posts.rupees, 'India')
  await expect(toast(page, 'India version made · linked card on the board')).toBeVisible()
  await expect(page).toHaveURL(/[?&]market=IN/)

  await openStep(page, posts.rupees, 'settings')
  await sendToReview(page)
  await approvePublish(page)
  await expect(live(page).getByText('Australia · Books and movies', { exact: true })).toBeVisible()
})

test('home=IN shows the India version with INR on the post that has one, and the main version on the others (82, 85)', async () => {
  const { page } = st
  // The main version never says INR.
  await page.goto(feedHref(posts.rupees))
  const main = await slideAlts(page.getByRole('main'))
  expect(main).toHaveLength(5)
  expect(main.join(' ')).not.toContain('INR')

  await page.goto('/feed?home=IN')
  await expect(homeSwitch(page).getByRole('link', { name: 'India' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  for (const id of [posts.rupees, posts.money, posts.general]) {
    await expect(card(page, id, 'home=IN')).toHaveCount(1)
  }
  await card(page, posts.rupees, 'home=IN').getByRole('link', { name: RUPEES.title }).click()
  await expect(page).toHaveURL(new RegExp(`/feed/${posts.rupees}\\?home=IN$`))

  // 499 AUD at the rate file's 55 INR per AUD, to the nearest hundred.
  const india = await slideAlts(page.getByRole('main'))
  expect(india).toHaveLength(5)
  const withInr = india.flatMap((alt, i) => (alt?.includes('INR') ? [i + 1] : []))
  expect(withInr, 'one slide carries the money figure in INR').toEqual([2])
  expect(india[1]).toContain('AUD 499 (≈ INR 27,400)')
  expect(india.join(' ')).not.toContain('NPR')

  // The Personal post's market version is Nepal's: under home=IN it shows its main version.
  await page.goto(feedHref(posts.money))
  const moneyMain = await slideAlts(page.getByRole('main'))
  expect(moneyMain.join(' ')).not.toContain('NPR')
  await page.goto(feedHref(posts.money, 'home=IN'))
  expect(await slideAlts(page.getByRole('main'))).toEqual(moneyMain)
})

test('the chips keep the posts tagged or untagged for the pick, combine across rows, Clear drops one, and the picks ride into a post page (81)', async () => {
  const { page } = st
  const absent = (id: string) => expect(page.locator(`a[href^="/feed/${id}"]`)).toHaveCount(0)
  await page.goto('/feed')
  await chipRow(page, 'Destination').getByRole('link', { name: 'Australia', exact: true }).click()
  await expect(page).toHaveURL(/\/feed\?destination=AU$/)
  await expect(
    chipRow(page, 'Destination').getByRole('link', { name: 'Australia', exact: true }),
  ).toHaveAttribute('aria-current', 'true')
  await expect(card(page, posts.general, 'destination=AU')).toHaveCount(1)
  await expect(card(page, posts.rupees, 'destination=AU')).toHaveCount(1)
  await absent(posts.money)

  // A second row narrows further: only the post tagged with both stays.
  await chipRow(page, 'Theme').getByRole('link', { name: 'Books and movies', exact: true }).click()
  await expect(page).toHaveURL(/\/feed\?destination=AU&theme=books-movies$/)
  await expect(card(page, posts.rupees, 'destination=AU&theme=books-movies')).toHaveCount(1)
  await absent(posts.general)
  await absent(posts.money)

  // Clear on one row keeps the other row's pick.
  await chipRow(page, 'Destination').getByRole('link', { name: 'Clear', exact: true }).click()
  await expect(page).toHaveURL(/\/feed\?theme=books-movies$/)
  await expect(chipRow(page, 'Destination').getByRole('link', { name: 'Clear' })).toHaveCount(0)
  await expect(card(page, posts.money, 'theme=books-movies')).toHaveCount(1)
  await expect(card(page, posts.rupees, 'theme=books-movies')).toHaveCount(1)
  await absent(posts.general)

  // Into a post page and back, the pick stays in the URL.
  await card(page, posts.money, 'theme=books-movies')
    .getByRole('link', { name: MONEY.title })
    .click()
  await expect(page).toHaveURL(new RegExp(`/feed/${posts.money}\\?theme=books-movies$`))
  await expect(
    chipRow(page, 'Theme').getByRole('link', { name: 'Books and movies', exact: true }),
  ).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('link', { name: 'Feed', exact: true })).toHaveAttribute(
    'href',
    '/feed?theme=books-movies',
  )
})

test('search keeps the posts with every word in any case, combines with the chips, and reads "No posts match." (83)', async () => {
  const { page } = st
  const absent = (id: string) => expect(page.locator(`a[href^="/feed/${id}"]`)).toHaveCount(0)
  const search = page.getByRole('search')
  const box = search.getByPlaceholder('Search posts')
  const go = () => search.getByRole('button', { name: 'Search', exact: true }).click()

  await page.goto('/feed')
  await box.fill('rupees')
  await go()
  await expect(page).toHaveURL(/\/feed\?q=rupees$/)
  await expect(box).toHaveValue('rupees')
  await expect(card(page, posts.rupees, 'q=rupees')).toHaveCount(1)
  await absent(posts.general)
  await absent(posts.money)

  // Every word, whatever its case: "first" is in other posts' slides, "RUPEES" in one title only.
  await box.fill('RUPEES first')
  await go()
  await expect(page).toHaveURL(/\/feed\?q=RUPEES\+first$/)
  await expect(card(page, posts.rupees, 'q=RUPEES+first')).toHaveCount(1)
  await absent(posts.general)
  await absent(posts.money)

  // A chip picked while searching keeps the words; the rupees post is for Australia, so none is left.
  await chipRow(page, 'Destination')
    .getByRole('link', { name: 'United Kingdom', exact: true })
    .click()
  await expect(page).toHaveURL(/\/feed\?destination=UK&q=RUPEES\+first$/)
  await expect(page.getByText('No posts match.', { exact: true })).toBeVisible()
  await absent(posts.rupees)

  // A search made with a chip active keeps the chip: the Personal post is the only one for the UK.
  await box.fill('money')
  await go()
  await expect(page).toHaveURL(/[?&]q=money(&|$)/)
  await expect(page).toHaveURL(/[?&]destination=UK(&|$)/)
  await expect(card(page, posts.money, 'destination=UK&q=money')).toHaveCount(1)
  await absent(posts.general)
  await absent(posts.rupees)
})

test('er adapts the General post for Instagram under the page the theme rule picks, exports it and records its link; another host is refused (88, 89)', async () => {
  const { page } = er
  await post(page, posts.general)
  await onStep(page, 'live')
  const adapt = live(page)
  // Work and study life → Main (src/features/content/pages/pages.json); the editor keeps it.
  await expect(adapt.getByLabel('Page brand')).toHaveValue('main')
  await adapt.getByLabel('Platform').selectOption({ label: 'Instagram carousel' })
  await press(
    page,
    'Create social version',
    'Social version created · linked card on the board',
    adapt,
  )

  await page.goto('/admin/board')
  const boardCard = page
    .getByRole('listitem')
    .filter({ hasText: 'Instagram · Main' })
    .filter({ hasText: `↳ from feed post ${GENERAL.title}` })
  await expect(boardCard).toHaveCount(1)
  await boardCard.getByRole('link', { name: 'Instagram · Main' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}/)
  posts.social = /\/admin\/posts\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? ''
  expect(posts.social).not.toBe(posts.general)

  // Not exported yet: nowhere to record a link.
  await expect(page.getByLabel('Instagram link')).toHaveCount(0)
  await press(page, 'Quick approve layout', 'Layout approved')
  await press(page, 'Render', /Rendered · \d+ slides/)
  const caption = section(page, 'Caption and hashtags')
  const download = page.waitForEvent('download')
  await caption.getByRole('button', { name: 'Export', exact: true }).click()
  await download

  await post(page, posts.social)
  const link = page.getByLabel('Instagram link')
  await link.fill('https://example.com/p/test123/')
  await caption.getByRole('button', { name: 'Save link', exact: true }).click()
  await expect(toast(page, "Paste the post's instagram.com link.")).toBeVisible()
  await expect(caption.getByText(/^Posted:/)).toHaveCount(0)

  await link.fill(IG_URL)
  await press(page, 'Save link', 'Link saved', caption)
  await expect(caption.getByText(`Posted: ${IG_URL} · by ${er.name}`)).toBeVisible()
  await expect(caption.getByRole('link', { name: IG_URL })).toHaveAttribute('href', IG_URL)
})

test("a post's page links to its Instagram post and page, and Related says why each post is there, strongest first (90, 91)", async () => {
  const { page } = st
  const related = () => section(page, 'Related')
  const items = () => related().getByRole('listitem')

  await page.goto(feedHref(posts.general))
  await expect(page.getByRole('link', { name: 'See this post on Instagram' })).toHaveAttribute(
    'href',
    IG_URL,
  )
  await expect(page.getByRole('link', { name: `Follow @${MAIN_PAGE.handle}` })).toHaveAttribute(
    'href',
    MAIN_PAGE.url,
  )
  await expect(items()).toHaveCount(1)
  await expect(items().getByRole('link')).toHaveText(RUPEES.title)
  await expect(items().getByRole('link')).toHaveAttribute('href', feedHref(posts.rupees))
  await expect(items().getByText('also for Australia', { exact: true })).toBeVisible()

  // The Personal post never went out on Instagram; it shares only its theme, with the third post.
  await page.goto(feedHref(posts.money))
  await expect(page.getByRole('link', { name: 'See this post on Instagram' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Follow @/ })).toHaveCount(0)
  await expect(items()).toHaveCount(1)
  await expect(items().getByRole('link')).toHaveText(RUPEES.title)
  await expect(items().getByText('also about Books and movies', { exact: true })).toBeVisible()

  // The third post shares a theme with one and a destination with the other: the theme first.
  // Its links keep the chips picked.
  await page.goto(feedHref(posts.rupees, 'theme=books-movies'))
  await expect(items()).toHaveCount(2)
  await expect(items().nth(0).getByRole('link')).toHaveText(MONEY.title)
  await expect(
    items().nth(0).getByText('also about Books and movies', { exact: true }),
  ).toBeVisible()
  await expect(items().nth(0).getByRole('link')).toHaveAttribute(
    'href',
    feedHref(posts.money, 'theme=books-movies'),
  )
  await expect(items().nth(1).getByRole('link')).toHaveText(GENERAL.title)
  await expect(items().nth(1).getByText('also for Australia', { exact: true })).toBeVisible()
})
