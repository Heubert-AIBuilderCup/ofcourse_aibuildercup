import { expect, type Page, test } from '@playwright/test'
import { freshEmail } from './helpers/accounts'
import {
  accountState,
  ageSignInCode,
  deleteSignInCodes,
  deleteUsers,
  expireSignInCode,
  latestSignInCode,
  setRole,
  suspend,
} from './helpers/db'
import { devLogin } from './helpers/login'
import { STUDENT_APP_URL, skipSplash } from './helpers/student'

// The student sign-in page at /: Google or a six-digit email code, the code rules (wrong, expired,
// five wrong tries, a new code only after 30 seconds), the refusals, and the splash in front of
// it. No mail is sent in development, so each spec reads its code from the database.
// Email codes are off on the page (src/app/page.tsx, `codes`) until an email provider is set
// up: the page offers Google alone, and the code specs are skipped until they are back.

// Within the page's main: Next's route announcer is an (empty) alert too.
const alert = (page: Page) => page.getByRole('main').getByRole('alert')

async function sendCode(page: Page, email: string) {
  await page.getByLabel('Your email').fill(email)
  await page.getByRole('button', { name: 'Send me a code' }).click()
  await expect(page.getByText(`The code we sent to ${email}`)).toBeVisible()
}

async function enterCode(page: Page, code: string) {
  await page.getByLabel('Six-digit code').fill(code)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

const anotherCode = (code: string) => (code === '000000' ? '111111' : '000000')

test('the page offers Google alone, at phone width and on desktop', async ({ page }) => {
  await skipSplash(page)
  for (const size of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await expect(page.getByLabel('Your email')).toHaveCount(0)
  }
})

test.skip('a new address signs in with a code and becomes a student', async ({ page }) => {
  const email = freshEmail('code-new')
  try {
    await skipSplash(page)
    await page.goto('/')
    await sendCode(page, email)
    await expect(page.getByRole('button', { name: 'Use a different email' })).toBeVisible()
    await enterCode(page, await latestSignInCode(email))
    await expect(page).toHaveURL(STUDENT_APP_URL)
    expect((await accountState(email))?.role).toBe('user')
  } finally {
    await deleteUsers([email])
    await deleteSignInCodes([email])
  }
})

test.skip('a wrong code is refused, and after the fifth that code no longer works', async ({
  page,
}) => {
  const email = freshEmail('code-wrong')
  try {
    await skipSplash(page)
    await page.goto('/')
    await sendCode(page, email)
    const wrong = anotherCode(await latestSignInCode(email))
    await enterCode(page, wrong)
    await expect(alert(page)).toHaveText('That code is wrong. Check the email and try again.')
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(alert(page)).toHaveText('That code no longer works. Send a new one.')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    expect(await accountState(email)).toBeNull()
  } finally {
    await deleteUsers([email])
    await deleteSignInCodes([email])
  }
})

test.skip('a code older than ten minutes has expired and does not sign in', async ({ page }) => {
  const email = freshEmail('code-expired')
  try {
    await page.clock.install()
    await skipSplash(page)
    await page.goto('/')
    await sendCode(page, email)
    const code = await latestSignInCode(email)
    // Ten minutes later, for the server and for the page. Any other request may tidy the expired
    // code away first, after which the server calls it wrong; the page still says it expired.
    await expireSignInCode(email)
    await page.clock.fastForward(601_000)
    await enterCode(page, code)
    await expect(alert(page)).toHaveText('That code has expired. Send a new one.')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Send a new code', exact: true })).toBeEnabled()
    await expect(page).toHaveURL(/\/$/)
    expect(await accountState(email)).toBeNull()
  } finally {
    await deleteUsers([email])
    await deleteSignInCodes([email])
  }
})

test.skip('a new code is held back for 30 seconds, then replaces the old one', async ({ page }) => {
  const email = freshEmail('code-resend')
  try {
    await page.clock.install()
    await skipSplash(page)
    await page.goto('/')
    await sendCode(page, email)
    await expect(page.getByRole('button', { name: 'Send a new code in 30 s' })).toBeDisabled()
    const old = await latestSignInCode(email)

    // 31 seconds later, for the server (the stored code's send time) and for the page.
    await ageSignInCode(email, 31)
    await page.clock.fastForward(31_000)
    const resend = page.getByRole('button', { name: 'Send a new code', exact: true })
    await expect(resend).toBeEnabled()
    await resend.click()
    await expect(page.getByRole('button', { name: /^Send a new code in \d+ s$/ })).toBeDisabled()
    const fresh = await latestSignInCode(email)

    if (fresh !== old) {
      await enterCode(page, old)
      await expect(alert(page)).toHaveText('That code is wrong. Check the email and try again.')
    }
    await enterCode(page, fresh)
    await expect(page).toHaveURL(STUDENT_APP_URL)
  } finally {
    await deleteUsers([email])
    await deleteSignInCodes([email])
  }
})

test.skip('an admin account is refused on the student page and gets no session', async ({
  page,
}) => {
  const adm = freshEmail('code-admin')
  try {
    await devLogin(page, adm)
    await setRole(adm, 'admin')
    await page.context().clearCookies()
    const sessionsBefore = (await accountState(adm))?.sessions

    await skipSplash(page)
    await page.goto('/')
    await sendCode(page, adm)
    await enterCode(page, await latestSignInCode(adm))
    await expect(alert(page)).toHaveText(
      'This page is for students. This account signs in on the admin page.',
    )
    expect((await accountState(adm))?.sessions).toBe(sessionsBefore)
    await page.goto('/start')
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/?error=student-only')
    await expect(alert(page)).toHaveText(
      'This page is for students. This account signs in on the admin page.',
    )
  } finally {
    await deleteUsers([adm])
    await deleteSignInCodes([adm])
  }
})

test.skip('a suspended student signing in with a code lands on the suspended page', async ({
  page,
}) => {
  const email = freshEmail('code-suspended')
  try {
    await devLogin(page, email, 'E2E Suspended', { surface: 'student' })
    await page.context().clearCookies()
    await suspend(email)

    await skipSplash(page)
    await page.goto('/')
    await sendCode(page, email)
    await enterCode(page, await latestSignInCode(email))
    await expect(page).toHaveURL(/\/suspended$/)
  } finally {
    await deleteUsers([email])
    await deleteSignInCodes([email])
  }
})

test('the splash plays once in a tab, lands on the page and never shows on the admin', async ({
  page,
}) => {
  await page.goto('/')
  const splash = page.getByTestId('splash')
  await expect(splash).toHaveAttribute('data-splash', 'play')
  // 3.25 s of intro, then 1.3 s of handover onto the panel.
  await expect(splash).toHaveCount(0, { timeout: 6000 })
  await expect(page.getByRole('region', { name: 'About' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(splash).toHaveCount(0)

  // A new tab that opens on the admin: the server never renders it there.
  const admin = await page.context().newPage()
  const res = await admin.goto('/admin/sign-in')
  expect(await res?.text()).not.toContain('data-testid="splash"')
  await expect(admin.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(admin.getByTestId('splash')).toHaveCount(0)
})

test('a reload in a tab that has seen the splash never paints it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 6000 })

  // From the start of the next document until it has loaded, on every frame: is the overlay there,
  // not display: none, and taking up room? The server's HTML must never put a frame of blue up.
  await page.addInitScript(() => {
    const w = window as unknown as { __splashFrames: number; __splashShown: number }
    w.__splashFrames = 0
    w.__splashShown = 0
    const look = () => {
      w.__splashFrames++
      const el = document.querySelector('[data-testid="splash"]')
      if (el && getComputedStyle(el).display !== 'none') {
        const box = el.getBoundingClientRect()
        if (box.width > 0 && box.height > 0) w.__splashShown++
      }
      if (document.readyState !== 'complete') requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
  await page.reload()
  await page.waitForLoadState('load')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  const seen = await page.evaluate(() => {
    const w = window as unknown as { __splashFrames: number; __splashShown: number }
    return { frames: w.__splashFrames, shown: w.__splashShown }
  })
  expect(seen.frames, 'frames were looked at').toBeGreaterThan(0)
  expect(seen.shown, 'frames with the splash showing').toBe(0)
})
