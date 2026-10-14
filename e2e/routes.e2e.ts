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

async function student(page: Page, profile: string): Promise<string> {
  const email = await newStudent(page, 'routes')
  await page.goto('/onboarding')
  const id = await userIdByEmail(email)
  await sql.unsafe(`update student_profile set ${profile} where user_id = $1`, [id as string])
  return email
}

test('signed out: a student page goes to sign-in, remembering it', async ({ page }) => {
  await landsInOne(page, '/road', '/?next=%2Froad')
  await landsInOne(page, '/onboarding/facts', '/?next=%2Fonboarding%2Ffacts')
})

test('a new student lands on the welcome, and each bare step on its first question', async ({
  page,
}) => {
  const email = await student(page, 'persona = null')
  try {
    for (const from of ['/', '/start', '/onboarding', '/road'])
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
  const email = await student(page, `persona = 'female', last_step = 'facts'`)
  try {
    await landsInOne(page, '/', '/onboarding/facts/where')
    await landsInOne(page, '/onboarding/welcome', '/onboarding/facts/where')
  } finally {
    await deleteUsers([email])
  }
})

test('coins stored but not on her road yet: "You\'re all set" waits for her', async ({ page }) => {
  const email = await student(
    page,
    `persona = 'female', last_step = 'attention', coins = '{"state":"later"}'::jsonb`,
  )
  try {
    for (const from of ['/', '/road', '/onboarding/welcome'])
      await landsInOne(page, from, '/onboarding/done')
  } finally {
    await deleteUsers([email])
  }
})

test('once on her road, every entry and every onboarding step goes to it', async ({ page }) => {
  const email = await student(
    page,
    `persona = 'female', coins = '{"state":"later"}'::jsonb, onboarded_at = now()`,
  )
  try {
    for (const from of [
      '/',
      '/start',
      '/onboarding',
      '/onboarding/welcome',
      '/onboarding/facts',
      '/onboarding/facts/who-pays',
      '/onboarding/attention',
    ])
      await landsInOne(page, from, '/road')
    // Sent back to sign-in from an onboarding page (an old tab, a bookmark): her road, not the
    // page and then the lock.
    await landsInOne(page, '/?next=%2Fonboarding%2Ffacts', '/road')
    // For now "You're all set" stays open after it (the (locked) group's layout says how to lock
    // it again).
    expect((await follow(page.request, '/onboarding/done')).status).toBe(200)
  } finally {
    await deleteUsers([email])
  }
})

test('an admin on a student page goes straight to the admin', async ({ page }) => {
  const email = await student(page, 'persona = null')
  try {
    await setRole(email, 'admin')
    for (const from of ['/', '/start', '/road', '/onboarding/facts'])
      await landsInOne(page, from, '/admin/users')
  } finally {
    await deleteUsers([email])
  }
})
