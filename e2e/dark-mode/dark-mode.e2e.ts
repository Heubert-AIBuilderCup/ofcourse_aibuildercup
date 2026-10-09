import { readFileSync } from 'node:fs'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { freshEmail } from '../helpers/accounts'
import { deleteSignInCodes, deleteUsers, latestSignInCode, setRole } from '../helpers/db'
import { signInUser } from '../helpers/login'
import { answerOpening, card, factUrl, newStudent, PRIYA, skipSplash } from '../helpers/student'
import {
  colourOf,
  differingShare,
  hasEdgeLine,
  headerMenu,
  hex,
  html,
  lightSurfaces,
  lowContrastText,
  luminance,
  openHeaderMenu,
  openIn,
  painted,
  sameColour,
  shot,
  switchFromMenu,
  switchFromToggle,
  themeCookie,
  themeToggle,
  token,
  tokens,
} from '../helpers/theme'

// Dark mode, from the criteria's side: docs/dark-mode/intent.md, criteria 1–12 (8 as amended on
// 8 Oct). The build's own spec, e2e/dark-mode.e2e.ts, already proves the toggle, the device
// follow, the menu and the admin toggle; where it does, the test here is a thin check that the
// criterion still holds. Person checks are in dark-mode.manual.md beside this file.

const PHONE = { width: 390, height: 844 }
const TABLET = { width: 768, height: 1024 }
const DESKTOP = { width: 1440, height: 900 }
const WIDTHS = [PHONE, DESKTOP] as const

const panel = (page: Page) => page.getByRole('complementary', { name: 'Getting started' })
const hero = (page: Page) => page.getByRole('region', { name: 'About' })
const logo = (page: Page) => page.getByText(/^OfCourse(\s*Admin)?$/).first()

/** Where an element sits once it has stopped moving (entrances slide in). */
async function boxOf(locator: Locator) {
  await expect(locator).toBeVisible()
  let last = ''
  await expect
    .poll(async () => {
      const now = JSON.stringify(await locator.boundingBox())
      const settled = now === last
      last = now
      return settled
    })
    .toBe(true)
  const box = await locator.boundingBox()
  if (!box) throw new Error('no box')
  return box
}

const centreY = (b: { y: number; height: number }) => b.y + b.height / 2

/** Fail with the list, so a run shows every offender at once. */
function none(list: string[], what: string) {
  expect(list, what).toEqual([])
}

/** A signed-in admin on the admin console; returns her email. */
async function newAdmin(page: Page, label: string): Promise<string> {
  const { email } = await signInUser(page, { label })
  await setRole(email, 'admin')
  return email
}

/** The student sign-in up to the code step: an address typed and a code sent. */
async function requestCode(page: Page, email: string): Promise<void> {
  await page.getByLabel('Your email').fill(email)
  await page.getByRole('button', { name: 'Send me a code' }).click()
  await expect(page.getByText(`The code we sent to ${email}`)).toBeVisible()
}

/** Every built screen in this test, checked at 390 and 1440 for light surfaces. */
async function noLightAtBothWidths(page: Page, where: string): Promise<void> {
  for (const size of WIDTHS) {
    await page.setViewportSize(size)
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    none(await lightSurfaces(page), `${where} at ${size.width}: light surfaces in dark`)
  }
}

test.use({ viewport: DESKTOP })
test.beforeEach(async ({ page }) => {
  await skipSplash(page)
})

// ---------------------------------------------------------------------------------------------
// AC1: Industry's dark tokens.

// Industry's dark set as the canvas defines it (the `[data-theme="dark"]` block of the canvas's
// project/login.css), the ramps the app puts on the page are compared against.
const CANVAS_DARK: Record<string, string> = {
  'neutral-100': '#1e2125',
  'neutral-200': '#272a2f',
  'neutral-300': '#383b40',
  'neutral-400': '#4f5257',
  'neutral-500': '#75787d',
  'neutral-600': '#909398',
  'neutral-700': '#abaeb3',
  'neutral-800': '#d0d2d6',
  'neutral-900': '#08090a',
  'accent-100': '#172433',
  'accent-200': '#1f3247',
  'accent-300': '#2c4761',
  'accent-400': '#5f86ad',
  'accent-500': '#749dc4',
  'accent-600': '#94bce3',
  'accent-700': '#b5d9fd',
  'accent-800': '#d6ebff',
  'accent-900': '#1d2d3d',
  'danger-100': '#2a1412',
  'danger-200': '#3b1a17',
  'danger-300': '#6e2a24',
  'danger-400': '#cc473f',
  'danger-500': '#eb6b61',
  'danger-600': '#eb6b61',
  'danger-700': '#ff9d93',
  'danger-800': '#ffc4bd',
  'danger-900': '#ffe0dc',
  'accent-2-100': '#18242f',
  'accent-2-200': '#203141',
  'accent-2-300': '#2d4357',
  'accent-2-400': '#62809d',
  'accent-2-500': '#7e9cb8',
  'accent-2-600': '#9ebbd8',
  'accent-2-700': '#bdd8f2',
  'accent-2-800': '#d6ebff',
  'accent-2-900': '#1f2d3a',
}

test('AC1: every colour comes from Industry dark set on the canvas', async ({ page }) => {
  await openIn(page, '/', 'dark')

  expect(sameColour(await token(page, '--background'), hex('#121417')), 'background').toBe(true)
  expect(sameColour(await token(page, '--popover'), hex('#1b1e22')), 'surface').toBe(true)
  expect(sameColour(await token(page, '--foreground'), hex('#e6e7e9')), 'text').toBe(true)
  expect(sameColour(await token(page, '--primary'), hex('#7fa6cc')), 'accent').toBe(true)
  const hairline = await token(page, '--border')
  expect(sameColour(hairline, [230, 231, 233, 0.16]), `hairline ${hairline}`).toBe(true)

  // What paints: the page ground and its text.
  expect(sameColour(await colourOf(page.locator('body'), 'background-color'), hex('#121417'))).toBe(
    true,
  )
  expect(sameColour(await colourOf(page.locator('body'), 'color'), hex('#e6e7e9'))).toBe(true)

  // Every ramp step the app puts on the page is the canvas's dark value.
  const ramps = await tokens(page, /^--(accent|neutral|danger|accent-2)-\d+$/)
  expect(Object.keys(ramps).length, 'the ramps are on the page').toBeGreaterThan(0)
  const off = Object.entries(ramps)
    .filter(([name, value]) => !sameColour(value, hex(CANVAS_DARK[name.slice(2)] ?? '#ff00ff')))
    .map(([name, value]) => `${name}: ${value.slice(0, 3)} vs canvas ${CANVAS_DARK[name.slice(2)]}`)
  expect(off, 'ramp steps not from the dark set').toEqual([])
})

// ---------------------------------------------------------------------------------------------
// AC2: a chosen answer in dark is the dark accent tint with light accent text.

async function expectDarkChosen(chosen: Locator, label: string) {
  const page = chosen.page()
  const { fill, leftEdge } = await painted(chosen)
  const tint = await token(page, '--accent-100')
  expect(sameColour(fill, tint, 4), `fill ${fill} vs accent-100 ${tint}`).toBe(true)
  expect(luminance(fill), 'the fill is dark, never a light box').toBeLessThan(0.1)
  const text = await colourOf(chosen.getByText(label, { exact: true }), 'color')
  const ink = await token(page, '--accent-800')
  expect(sameColour(text, ink), `text ${text} vs accent-800 ${ink}`).toBe(true)
  const rule = await token(page, '--accent-700')
  expect(
    leftEdge.some((c) => sameColour(c, rule, 12)),
    `a rule in accent-700 ${rule}: ${leftEdge.map((c) => c.slice(0, 3)).join(' | ')}`,
  ).toBe(true)
}

test('AC2: the chosen answer is the dark accent tint with light accent text [picture choice, step 00]', async ({
  page,
}) => {
  const email = await newStudent(page, 'dm-ac2-picture')
  try {
    await openIn(page, '/onboarding/character', 'dark')
    const female = page.getByRole('button', { name: 'Female', exact: true })
    await female.click()
    await expect(female).toHaveAttribute('aria-pressed', 'true')
    await expectDarkChosen(female, 'Female')
  } finally {
    await deleteUsers([email])
  }
})

test('AC2: the chosen answer is the dark accent tint with light accent text [answer card, step 01]', async ({
  page,
}) => {
  const email = await newStudent(page, 'dm-ac2-card')
  try {
    await openIn(page, factUrl('Where are you right now?'), 'dark')
    const nepal = card(page, 'Where are you right now?', 'Nepal')
    await nepal.click()
    await expect(nepal).toHaveAttribute('aria-checked', 'true')
    await expectDarkChosen(nepal, 'Nepal')
  } finally {
    await deleteUsers([email])
  }
})

// ---------------------------------------------------------------------------------------------
// AC3: the steel panel and the login hero look the same in both themes; in dark a hairline.

test.describe('AC3', () => {
  test.use({ reducedMotion: 'reduce' })

  async function sameInBothThemes(page: Page, path: string, steel: (p: Page) => Locator) {
    await openIn(page, path, 'light')
    const lightShot = await shot(page, await boxOf(steel(page)))
    const lightFill = await colourOf(steel(page), 'background-color')
    await openIn(page, path, 'dark')
    const darkShot = await shot(page, await boxOf(steel(page)))
    const darkFill = await colourOf(steel(page), 'background-color')
    expect(sameColour(lightFill, darkFill, 1), `fill ${lightFill} vs ${darkFill}`).toBe(true)
    expect(await differingShare(page, lightShot, darkShot)).toBeLessThan(0.01)
  }

  async function hairlineInDark(page: Page, path: string, steel: (p: Page) => Locator) {
    await page.setViewportSize(DESKTOP)
    await openIn(page, path, 'dark')
    expect(await hasEdgeLine(page, await boxOf(steel(page)), 'right'), 'side by side: right').toBe(
      true,
    )
    await page.setViewportSize(TABLET)
    expect(await hasEdgeLine(page, await boxOf(steel(page)), 'bottom'), 'stacked: bottom').toBe(
      true,
    )
  }

  test('AC3: it looks the same in both themes [onboarding panel]', async ({ page }) => {
    const email = await newStudent(page, 'dm-ac3-panel')
    try {
      await sameInBothThemes(page, '/onboarding/character', panel)
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC3: it looks the same in both themes [login hero]', async ({ page }) => {
    await sameInBothThemes(page, '/', hero)
  })

  test('AC3: in dark a hairline marks where it meets the page [onboarding panel]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'dm-ac3-panel-line')
    try {
      await hairlineInDark(page, '/onboarding/character', panel)
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC3: in dark a hairline marks where it meets the page [login hero]', async ({ page }) => {
    await hairlineInDark(page, '/', hero)
  })
})

// ---------------------------------------------------------------------------------------------
// AC4: the header action.

/** A 44px toggle, top-right on the logo's line, labelled for the theme it switches to. */
async function expectToggle(
  page: Page,
  path: string,
  rightmost: (p: Page) => Locator = themeToggle,
) {
  for (const theme of ['light', 'dark'] as const) {
    await openIn(page, path, theme)
    const label = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
    const toggle = page.getByRole('button', { name: label })
    const box = await boxOf(toggle)
    expect(box.width, 'width').toBeCloseTo(44, 0)
    expect(box.height, 'height').toBeCloseTo(44, 0)
    // Top-right: as far in from the right as the logo is from the left, or within 80px.
    const right = await boxOf(rightmost(page))
    const inset = Math.max(80, (await boxOf(logo(page))).x + 8)
    expect(DESKTOP.width - (right.x + right.width), 'at the right').toBeLessThan(inset)
    expect(box.y, 'at the top').toBeLessThan(120)
  }
}

test('AC4: a 44px theme toggle sits top-right on the logo line [student sign-in]', async ({
  page,
}) => {
  await expectToggle(page, '/')
  const toggle = await boxOf(themeToggle(page))
  expect(
    Math.abs(centreY(toggle) - centreY(await boxOf(logo(page)))),
    'on the logo line',
  ).toBeLessThan(8)
})

test('AC4: a 44px theme toggle sits top-right on the logo line [admin sign-in]', async ({
  page,
}) => {
  await expectToggle(page, '/admin/sign-in')
  const toggle = await boxOf(themeToggle(page))
  expect(
    Math.abs(centreY(toggle) - centreY(await boxOf(logo(page)))),
    'on the logo line',
  ).toBeLessThan(8)
})

test('AC4: a 44px theme toggle sits top-right beside Sign out [admin console]', async ({
  page,
}) => {
  // The console has no steel panel: the toggle sits in the top bar beside Sign out (edge case).
  const email = await newAdmin(page, 'dm-ac4-admin')
  try {
    const signOutButton = (p: Page) => p.getByRole('button', { name: 'Sign out', exact: true })
    await expectToggle(page, '/admin', signOutButton)
    const toggle = await boxOf(themeToggle(page))
    const signOut = await boxOf(signOutButton(page))
    expect(Math.abs(centreY(toggle) - centreY(signOut)), 'on the Sign out line').toBeLessThan(8)
    expect(signOut.x - (toggle.x + toggle.width), 'beside Sign out').toBeLessThan(24)
  } finally {
    await deleteUsers([email])
  }
})

test('AC4: one 44px menu holds Dark theme and Sign out; Escape returns focus [onboarding]', async ({
  page,
}) => {
  // Also proved by e2e/dark-mode.e2e.ts "the onboarding menu" and "step 01 has no separate Sign out".
  const email = await newStudent(page, 'dm-ac4-menu')
  try {
    for (const path of ['/onboarding/character', '/onboarding/facts/where']) {
      await openIn(page, path, 'light')
      const button = headerMenu(page)
      const box = await boxOf(button)
      expect(box.width, `${path} width`).toBeCloseTo(44, 0)
      expect(box.height, `${path} height`).toBeCloseTo(44, 0)
      await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0)
      const menu = await openHeaderMenu(page)
      await expect(menu.getByRole('menuitemcheckbox', { name: 'Dark theme' })).toHaveAttribute(
        'aria-checked',
        'false',
      )
      await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      await expect(button).toBeFocused()
    }
  } finally {
    await deleteUsers([email])
  }
})

test('AC4: side by side over the main column, stacked in the steel band light on steel [onboarding]', async ({
  page,
}) => {
  const email = await newStudent(page, 'dm-ac4-place')
  try {
    await openIn(page, '/onboarding/facts/where', 'light')
    let button = await boxOf(headerMenu(page))
    let steel = await boxOf(panel(page))
    expect(button.x, 'side by side: over the main column').toBeGreaterThanOrEqual(
      steel.x + steel.width,
    )
    expect(
      Math.abs(centreY(button) - centreY(await boxOf(logo(page)))),
      'on the logo line',
    ).toBeLessThan(8)

    for (const size of [TABLET, PHONE]) {
      await page.setViewportSize(size)
      button = await boxOf(headerMenu(page))
      steel = await boxOf(panel(page))
      const inside =
        button.x >= steel.x &&
        button.y >= steel.y &&
        button.x + button.width <= steel.x + steel.width + 0.5 &&
        button.y + button.height <= steel.y + steel.height + 0.5
      expect(inside, `${size.width}: in the steel band`).toBe(true)
      expect(
        Math.abs(centreY(button) - centreY(await boxOf(logo(page)))),
        'on the logo line',
      ).toBeLessThan(8)
      const ink = await colourOf(headerMenu(page), 'color')
      expect(luminance(ink), `${size.width}: light on steel (${ink})`).toBeGreaterThan(0.6)
    }
  } finally {
    await deleteUsers([email])
  }
})

// ---------------------------------------------------------------------------------------------
// AC5: the switch is immediate, stored for the browser, and the next page is served in it.

async function expectSwitchedInPlace(page: Page, other: string, act: () => Promise<void>) {
  await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: a marker that a reload would wipe
    ;(window as any).__noReload = true
  })
  await act()
  // biome-ignore lint/suspicious/noExplicitAny: the marker above
  expect(await page.evaluate(() => (window as any).__noReload), 'no reload').toBe(true)
  await expect.poll(() => themeCookie(page.context())).toBe('dark')
  // A later page, as the server sends it: already dark before any script runs.
  const served = await (await page.request.get(other)).text()
  expect(served).toMatch(/<html[^>]*data-theme="dark"/)
}

test('AC5: the page changes at once and later pages render dark from the server [toggle]', async ({
  page,
}) => {
  // Also proved by e2e/dark-mode.e2e.ts "the toggle stores the theme".
  await openIn(page, '/', 'light')
  await expectSwitchedInPlace(page, '/admin/sign-in', () => switchFromToggle(page, 'dark'))
})

test('AC5: the page changes at once and later pages render dark from the server [Dark theme item]', async ({
  page,
}) => {
  const email = await newStudent(page, 'dm-ac5-menu')
  try {
    await openIn(page, '/onboarding/character', 'light')
    await expectSwitchedInPlace(page, '/onboarding/facts/where', () => switchFromMenu(page, 'dark'))
  } finally {
    await deleteUsers([email])
  }
})

// ---------------------------------------------------------------------------------------------
// AC6 and AC7: following the device.

test('AC6: the page follows a device change until she toggles; clearing cookies follows it again', async ({
  page,
}) => {
  // Also proved by e2e/dark-mode.e2e.ts "with no choice the page follows the device".
  await openIn(page, '/admin/sign-in', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html(page)).toHaveAttribute('data-theme', 'light')

  await switchFromToggle(page, 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload()
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')

  await page.context().clearCookies()
  await page.reload()
  await expect(html(page)).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
})

test('AC7: with no stored choice a page opened follows the device', async ({ browser }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ colorScheme, viewport: DESKTOP })
    try {
      const page = await context.newPage()
      await skipSplash(page)
      for (const path of ['/', '/admin/sign-in']) {
        await page.goto(path)
        await expect(html(page), `${path} in ${colorScheme}`).toHaveAttribute(
          'data-theme',
          colorScheme,
        )
      }
      expect(['light', 'dark'], 'nothing stored as a choice').not.toContain(
        await themeCookie(context),
      )
    } finally {
      await context.close()
    }
  }
})

// ---------------------------------------------------------------------------------------------
// AC8: text contrast in dark, as it paints, on the background and on cards (the criterion's
// scope). The steel panel and the hero are left out: they look the same in both themes (AC3).

test('AC8: text is at least 4.5:1 and large text 3:1 in dark [sign-in and its code error]', async ({
  page,
}) => {
  const email = freshEmail('dm-ac8')
  try {
    await openIn(page, '/', 'dark')
    none(await lowContrastText(page, [hero(page)]), 'sign-in')
    await requestCode(page, email)
    const code = await latestSignInCode(email)
    await page.getByLabel('Six-digit code').fill(code === '000000' ? '111111' : '000000')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
    none(await lowContrastText(page, [hero(page)]), 'code step with the wrong-code error')
  } finally {
    await deleteSignInCodes([email])
    await deleteUsers([email])
  }
})

test('AC8: text is at least 4.5:1 and large text 3:1 in dark [step 01 impact lines]', async ({
  page,
}) => {
  const email = await newStudent(page, 'dm-ac8-facts')
  try {
    await openIn(page, factUrl('Amount'), 'dark')
    await card(page, 'Amount', 'Not sure').click()
    await expect(page.getByText('Saved. Tap another answer to change it.')).toBeVisible()
    none(await lowContrastText(page, [panel(page)]), 'step 01, Amount: Not sure')
    await page.goto(factUrl('Anyone coming with you?'))
    await card(page, 'Anyone coming with you?', 'Partner').click()
    await expect(page.getByText('Saved. Tap another answer to change it.')).toBeVisible()
    none(await lowContrastText(page, [panel(page)]), 'step 01, Anyone coming: Partner')
  } finally {
    await deleteUsers([email])
  }
})

// ---------------------------------------------------------------------------------------------
// AC9: native controls follow the theme.

test('AC9: native controls follow the theme (color-scheme dark)', async ({ page }) => {
  // No native select was found on the screens visited (study, living); the select itself is a
  // person check in dark-mode.manual.md. color-scheme on the root reaches every native control,
  // scrollbars and focus rings included; the email field stands for them.
  for (const theme of ['light', 'dark'] as const) {
    await openIn(page, '/', theme)
    expect(await html(page).evaluate((el) => getComputedStyle(el).colorScheme)).toBe(theme)
    const field = page.getByLabel('Your email')
    expect(await field.evaluate((el) => getComputedStyle(el).colorScheme), 'a native field').toBe(
      theme,
    )
  }
})

// ---------------------------------------------------------------------------------------------
// AC10: every built screen in dark at 390 and 1440, nothing light-themed.

test('AC10: nothing light-themed remains in dark [student sign-in, code step, errors]', async ({
  page,
}) => {
  const email = freshEmail('dm-ac10-signin')
  try {
    await openIn(page, '/', 'dark')
    await noLightAtBothWidths(page, 'sign-in')
    await page.setViewportSize(DESKTOP)
    await requestCode(page, email)
    await noLightAtBothWidths(page, 'code step')
    const code = await latestSignInCode(email)
    await page.getByLabel('Six-digit code').fill(code === '000000' ? '111111' : '000000')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
    await noLightAtBothWidths(page, 'wrong code')
  } finally {
    await deleteSignInCodes([email])
    await deleteUsers([email])
  }
})

test('AC10: nothing light-themed remains in dark [admin sign-in]', async ({ page }) => {
  await openIn(page, '/admin/sign-in', 'dark')
  await noLightAtBothWidths(page, 'admin sign-in')
})

test('AC10: nothing light-themed remains in dark [step 00]', async ({ page }) => {
  const email = await newStudent(page, 'dm-ac10-00')
  try {
    await openIn(page, '/onboarding/character', 'dark')
    await noLightAtBothWidths(page, 'step 00')
    await page.getByRole('button', { name: 'Female', exact: true }).click()
    await noLightAtBothWidths(page, 'step 00, Female chosen')
  } finally {
    await deleteUsers([email])
  }
})

test('AC10: nothing light-themed remains in dark [step 01]', async ({ page }) => {
  test.setTimeout(180_000)
  const email = await newStudent(page, 'dm-ac10-01')
  const states: [question: string, option: string][] = [
    ['Where are you right now?', 'Nepal'],
    ['Amount', 'Not sure'],
    ['Anyone coming with you?', 'Partner'],
    ["Latest you'd accept", 'Jul 2027'],
  ]
  try {
    await openIn(page, factUrl('Where are you right now?'), 'dark')
    await noLightAtBothWidths(page, 'step 01, nothing chosen')
    for (const [question, option] of states) {
      await page.setViewportSize(DESKTOP)
      await page.goto(factUrl(question))
      await card(page, question, option).click()
      await expect(page.getByText('Saved. Tap another answer to change it.')).toBeVisible()
      await noLightAtBothWidths(page, `step 01, ${question}: ${option}`)
    }

    // The save-failed alert.
    await page.setViewportSize(DESKTOP)
    const hard = 'Is this a hard limit, or roughly?'
    await page.goto(factUrl(hard))
    const offline = (url: URL) => url.pathname === '/onboarding/facts/limit'
    await page.route(offline, (route) =>
      route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback(),
    )
    await card(page, hard, 'Hard limit').click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: "We couldn't save that. Your answer is still here." }),
    ).toBeVisible()
    await noLightAtBothWidths(page, 'step 01, save failed')
    await page.unroute(offline)
  } finally {
    await deleteUsers([email])
  }
})

test('AC10: nothing light-themed remains in dark [screens 2–4, futures, coins]', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const email = await newStudent(page, 'dm-ac10-later')
  try {
    await openIn(page, '/onboarding/study/know', 'dark')
    for (const path of ['/onboarding/study/know', '/onboarding/living', '/onboarding/after']) {
      await page.setViewportSize(DESKTOP)
      await page.goto(path)
      await noLightAtBothWidths(page, path)
    }
    await page.setViewportSize(DESKTOP)
    await answerOpening(page, PRIYA)
    await expect(
      page.getByRole('heading', { level: 1, name: "Here's what each would give you" }),
    ).toBeVisible()
    await noLightAtBothWidths(page, '/futures')
    await page.setViewportSize(DESKTOP)
    await page.goto('/attention')
    await expect(page.getByText('10 coins left to place')).toBeVisible()
    await noLightAtBothWidths(page, '/attention')
  } finally {
    await deleteUsers([email])
  }
})

test('AC10: nothing light-themed remains in dark [admin console and users list]', async ({
  page,
}) => {
  const email = await newAdmin(page, 'dm-ac10-admin')
  try {
    for (const path of ['/admin', '/admin/users']) {
      await page.setViewportSize(DESKTOP)
      await openIn(page, path, 'dark')
      await noLightAtBothWidths(page, path)
    }
  } finally {
    await deleteUsers([email])
  }
})

// ---------------------------------------------------------------------------------------------
// AC11: reduced motion and the keyboard; nothing else changes with the theme.

test.describe('AC11', () => {
  test.use({ reducedMotion: 'reduce' })

  test('AC11: the toggle works from the keyboard and nothing else on the page changes [sign-in]', async ({
    page,
  }) => {
    await openIn(page, '/', 'light')
    const field = page.getByLabel('Your email')
    await field.fill('kept@e2e.starter.test')
    const before = await boxOf(field)
    await themeToggle(page).focus()
    await page.keyboard.press('Enter')
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeFocused()
    await expect(field).toHaveValue('kept@e2e.starter.test')
    expect(await boxOf(field), 'the layout stays').toEqual(before)
  })

  test('AC11: the menu works from the keyboard: Tab, Enter, arrows move, Space picks, Escape [onboarding]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'dm-ac11-keys')
    try {
      await openIn(page, '/onboarding/character', 'light')
      const button = headerMenu(page)
      let reached = false
      for (let i = 0; i < 30 && !reached; i++) {
        await page.keyboard.press('Tab')
        reached = await button.evaluate((el) => el === document.activeElement)
      }
      expect(reached, 'Tab reaches the menu button').toBe(true)
      const heading = await boxOf(page.getByRole('heading', { level: 1 }).first())

      await page.keyboard.press('Enter')
      const menu = page.getByRole('menu', { name: 'Menu' })
      await expect(menu).toBeVisible()
      const dark = menu.getByRole('menuitemcheckbox', { name: 'Dark theme' })
      const signOut = menu.getByRole('menuitem', { name: 'Sign out' })
      await page.keyboard.press('ArrowDown')
      const first = (await dark.evaluate((el) => el === document.activeElement)) ? dark : signOut
      const second = first === dark ? signOut : dark
      await expect(first).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(second).toBeFocused()
      await page.keyboard.press('ArrowUp')
      await expect(first).toBeFocused()

      if (second === dark) await page.keyboard.press('ArrowDown')
      await expect(dark).toBeFocused()
      await page.keyboard.press('Space')
      await expect(html(page)).toHaveAttribute('data-theme', 'dark')
      await expect(dark).toHaveAttribute('aria-checked', 'true')
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      await expect(button).toBeFocused()
      await expect(page).toHaveURL(/\/onboarding\/character$/)
      expect(
        await boxOf(page.getByRole('heading', { level: 1 }).first()),
        'the layout stays',
      ).toEqual(heading)
    } finally {
      await deleteUsers([email])
    }
  })
})

// ---------------------------------------------------------------------------------------------
// AC12: DESIGN.md.

test('AC12: DESIGN.md says Industry ships both themes and how the dark one reaches the code', () => {
  const doc = readFileSync('src/design-systems/industry/DESIGN.md', 'utf8')
  expect(doc).not.toMatch(/Industry itself ships light only/i)
  expect(doc).toMatch(/dark/i)
  expect(doc).toMatch(/data-theme/)
})
