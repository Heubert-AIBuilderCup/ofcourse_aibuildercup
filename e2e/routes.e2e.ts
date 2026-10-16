import { type APIRequestContext, expect, type Page, test } from '@playwright/test'
import { deleteUsers, setRole, sql, userIdByEmail } from './helpers/db'
import { newStudent } from './helpers/student'

// Where each kind of visitor lands from each entry point, and how: every move is an HTTP
// redirect answered before any page is painted (a page answered 200 first is drawn, then left),
// and one is enough. An unknown page is a real 404.

type Hop = { status: number; path: string }

/** The redirects from `start`, hop by hop, to the first answer that is not one. */
async function follow(
  req: APIRequestContext,
  start: string,
): Promise<{ hops: Hop[]; status: number }> {
  const hops: Hop[] = []
  let url = start
  for (let i = 0; i < 6; i++) {
    const res = await req.get(url, { maxRedirects: 0 })
    if (res.status() < 300 || res.status() >= 400) return { hops, status: res.status() }
    const to = new URL(res.headers().location, 'http://localhost')
    url = to.pathname + to.search
    hops.push({ status: res.status(), path: url })
  }
  throw new Error(`${start}: more than six redirects`)
}

/** `from` lands on `to` (path and query) in one redirect, with nothing painted before it. */
async function landsInOne(page: Page, from: string, to: string) {
  const { hops, status } = await follow(page.request, from)
  expect(
    hops.map((h) => h.path),
    `${from} redirects once`,
  ).toEqual([to])
  expect(hops[0].status, `${from} answers with a redirect`).toBe(307)
  expect(status, `${to} is a page`).toBe(200)
}

/** What a student has stored: her picture, the roadmap she is answering, her finished ones. */
type Stored = {
  persona?: 'female' | 'male' | 'neutral'
  /** The roadmap she is answering: where she left off, and her coins once stored. */
  draft?: { lastStep: string; coins?: { state: 'later' } }
  /** How many finished roadmaps she has. */
  finished?: number
}

/**
 * A fresh student, signed in, her profile made by a visit to /onboarding, then given what she has
 * stored straight in the database. Returns her email and her finished roadmaps' ids.
 */
async function student(
  page: Page,
  { persona, draft, finished = 0 }: Stored = {},
): Promise<{ email: string; finishedIds: string[] }> {
  const email = await newStudent(page, 'routes')
  await page.goto('/onboarding')
  const id = await userIdByEmail(email)
  if (!id) throw new Error(`No account for ${email}`)
  if (persona) await sql`update student_profile set persona = ${persona} where user_id = ${id}`
  if (draft) {
    await sql`insert into roadmap (id, user_id, last_step, coins)
      values (${crypto.randomUUID()}, ${id}, ${draft.lastStep}, ${draft.coins ? sql.json(draft.coins) : null})`
  }
  const finishedIds = Array.from({ length: finished }, () => crypto.randomUUID())
  for (const roadmapId of finishedIds) {
    await sql`insert into roadmap (id, user_id, last_step, coins, finished_at)
      values (${roadmapId}, ${id}, 'attention', ${sql.json({ state: 'later' })}, now())`
  }
  return { email, finishedIds }
}

test('signed out: a student page goes to sign-in, remembering it', async ({ page }) => {
  await landsInOne(page, '/road', '/?next=%2Froad')
  await landsInOne(page, '/roadmaps', '/?next=%2Froadmaps')
  await landsInOne(page, '/roadmaps/abc', '/?next=%2Froadmaps%2Fabc')
  await landsInOne(page, '/onboarding/facts', '/?next=%2Fonboarding%2Ffacts')
})

test('a new student lands on the welcome, and each bare step on its first question', async ({
  page,
}) => {
  const { email } = await student(page)
  try {
    for (const from of ['/', '/start', '/onboarding', '/road', '/roadmaps'])
      await landsInOne(page, from, '/onboarding/welcome')
    await landsInOne(page, '/onboarding/facts', '/onboarding/facts/where')
    await landsInOne(page, '/onboarding/study', '/onboarding/study/know')
    await landsInOne(page, '/onboarding/done', '/onboarding/attention')
    expect((await follow(page.request, '/onboarding/facts/nope')).status).toBe(404)
    expect((await follow(page.request, '/futures')).status).toBe(404)
  } finally {
    await deleteUsers([email])
  }
})

test('mid onboarding, the welcome moves on to where she left off', async ({ page }) => {
  const { email } = await student(page, { persona: 'female', draft: { lastStep: 'facts' } })
  try {
    await landsInOne(page, '/', '/onboarding/facts/where')
    await landsInOne(page, '/onboarding/welcome', '/onboarding/facts/where')
  } finally {
    await deleteUsers([email])
  }
})

test('coins stored but not finished yet: "You\'re all set" waits for her', async ({ page }) => {
  const { email } = await student(page, {
    persona: 'female',
    draft: { lastStep: 'attention', coins: { state: 'later' } },
  })
  try {
    for (const from of ['/', '/road', '/roadmaps', '/onboarding/welcome'])
      await landsInOne(page, from, '/onboarding/done')
  } finally {
    await deleteUsers([email])
  }
})

test('with a roadmap finished, every entry and every onboarding step goes to her roadmaps', async ({
  page,
}) => {
  const {
    email,
    finishedIds: [id],
  } = await student(page, { persona: 'female', finished: 1 })
  try {
    for (const from of [
      '/',
      '/start',
      '/onboarding',
      '/onboarding/welcome',
      '/onboarding/character',
      '/onboarding/facts',
      '/onboarding/facts/who-pays',
      '/onboarding/study/learning',
      '/onboarding/attention',
      '/onboarding/done',
    ])
      await landsInOne(page, from, '/roadmaps')
    // Sent back to sign-in from an onboarding page (an old tab, a bookmark): her roadmaps, not the
    // page and then the lock.
    await landsInOne(page, '/?next=%2Fonboarding%2Ffacts', '/roadmaps')
    // The old board's URL: her last opened roadmap.
    await landsInOne(page, '/road', `/roadmaps/${id}`)
    expect((await follow(page.request, '/roadmaps')).status).toBe(200)
    expect((await follow(page.request, `/roadmaps/${id}`)).status).toBe(200)
    expect((await follow(page.request, '/roadmaps/new')).status).toBe(200)
    expect((await follow(page.request, `/roadmaps/${crypto.randomUUID()}`)).status).toBe(404)
    // Opening a step never started a new roadmap: still closed.
    await landsInOne(page, '/', '/roadmaps')
  } finally {
    await deleteUsers([email])
  }
})

test("another student's roadmap is not found", async ({ page }) => {
  const first = await student(page, { persona: 'female', finished: 1 })
  // Signs the page in as a second student.
  const second = await student(page, { persona: 'female', finished: 1 })
  try {
    expect((await follow(page.request, `/roadmaps/${second.finishedIds[0]}`)).status).toBe(200)
    expect((await follow(page.request, `/roadmaps/${first.finishedIds[0]}`)).status).toBe(404)
  } finally {
    await deleteUsers([first.email, second.email])
  }
})

test('answering a new roadmap after finishing one, she lands on its step', async ({ page }) => {
  const {
    email,
    finishedIds: [id],
  } = await student(page, { persona: 'female', finished: 1, draft: { lastStep: 'facts' } })
  try {
    for (const from of ['/', '/start', '/onboarding', '/road', `/roadmaps/${id}`])
      await landsInOne(page, from, '/onboarding/facts/where')
    // The list stays open beside it.
    expect((await follow(page.request, '/roadmaps')).status).toBe(200)
  } finally {
    await deleteUsers([email])
  }
})

test('an admin on a student page goes straight to the admin', async ({ page }) => {
  const { email } = await student(page)
  try {
    await setRole(email, 'admin')
    for (const from of ['/', '/start', '/road', '/roadmaps', '/onboarding/facts'])
      await landsInOne(page, from, '/admin/users')
  } finally {
    await deleteUsers([email])
  }
})
