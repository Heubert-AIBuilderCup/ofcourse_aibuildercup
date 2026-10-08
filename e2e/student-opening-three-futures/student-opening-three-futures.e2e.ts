import { expect, type Page, test } from '@playwright/test'
import { deleteUsers, profileOf, sql, userIdByEmail } from '../helpers/db'
import { devLogin } from '../helpers/login'
import {
  answerFact,
  answerOpening,
  card,
  factUrl,
  newStudent,
  signOutViaMenu,
} from '../helpers/student'

// Onboarding steps 00 (Your comic character) and 01 (Facts about you), one question per screen:
// criteria 2, 3, 4, 14, 22, 23, 24, 25, 26, 27, 30 and 60 of
// docs/student-opening-three-futures/intent.md, read with plan-onboarding-ui.md's decisions, plus
// the developer's asks: a failed save keeps the answer and Try again saves; the cards answer by
// keyboard; 1920 is the 1440 design scaled, 2560 centres it. Person checks are in
// student-opening-three-futures.manual.md beside this file.

const PHONE = { width: 390, height: 844 }
const TABLET = { width: 768, height: 1024 }
const DESKTOP = { width: 1440, height: 900 }

// Step 01's eleven questions in the order criterion 23 lists them, as each screen asks them.
const FACTS = [
  { key: 'where', question: 'Where are you right now?' },
  { key: 'amount', question: 'Amount' },
  { key: 'covers', question: 'It covers' },
  { key: 'who', question: 'Who pays' },
  { key: 'hard', question: 'Is this a hard limit, or roughly?' },
  { key: 'earliest', question: 'Earliest start' },
  { key: 'latest', question: "Latest you'd accept" },
  { key: 'years', question: "Most years you'd give it" },
  { key: 'dep', question: 'Anyone coming with you?' },
  { key: 'qual', question: 'Last qualification' },
  { key: 'eng', question: 'English test' },
] as const

const SAVED = 'Saved. Tap another answer to change it.'
const FAMILY = "Family isn't covered in this preview yet, so every route shows costs for you alone."

const question = (page: Page, name: string) => page.getByRole('heading', { level: 1, name })
const radios = (page: Page, name: string) =>
  page.getByRole('radiogroup', { name }).getByRole('radio')
/** The impact line under the question: the polite live region that holds it. */
const impact = (page: Page) => page.locator('[aria-live="polite"]').filter({ hasText: /\S/ })

/** Open one step 01 question on its own screen, at its slug. */
async function openFact(page: Page, name: string): Promise<void> {
  await page.goto(factUrl(name))
  await expect(question(page, name)).toBeVisible()
}

/**
 * From step 00, pick a character (or skip it), and press Start: step 01 opens on its first
 * question. Returns how long that took, from the press to the question showing.
 */
async function leaveStep00(page: Page, choice: 'Female' | 'Male' | null): Promise<number> {
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding\/character$/)
  await expect(
    page.getByRole('heading', { name: 'How would you like your comic character drawn?' }),
  ).toBeVisible()
  if (choice) await page.getByRole('button', { name: choice, exact: true }).click()
  const t0 = Date.now()
  await page.getByRole('button', { name: choice ? 'Start' : 'Skip', exact: true }).click()
  await expect(page).toHaveURL(/\/onboarding\/facts\/where$/)
  await expect(question(page, 'Where are you right now?')).toBeVisible()
  return Date.now() - t0
}

/**
 * Make the server slow to open step 01: once it is requested, her profile row stays locked until
 * the returned function is called, so the page's write waits. The function releases the lock and
 * waits for it. Holding until the test has seen what it needs keeps a loaded machine from ending
 * the wait first.
 */
async function slowStep01(page: Page, email: string): Promise<() => Promise<void>> {
  const id = await userIdByEmail(email)
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let lock: Promise<unknown> | null = null
  await page.route(/\/onboarding\/facts\/where(\?|$)/, async (route) => {
    if (!lock) {
      let locked = () => {}
      const taken = new Promise<void>((resolve) => {
        locked = resolve
      })
      lock = sql.begin(async (tx) => {
        await tx`select 1 from student_profile where user_id = ${id} for update`
        locked()
        await held
      })
      await taken
    }
    await route.continue()
  })
  return async () => {
    release()
    await lock
  }
}

const BANNED = /ranked 1st|\bbest\b|recommended/i
const COUNSELLOR = /counsell?or|already ha(s|ve) your/i

test.describe('on a phone', () => {
  test.use({ viewport: PHONE })

  test('AC2: no screen says "ranked 1st", "best" or "recommended", or that anyone already has her information', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac2')
    try {
      const texts: string[] = []
      await page.goto('/')
      await expect(page).toHaveURL(/\/onboarding\/character$/)
      texts.push(await page.locator('body').innerText())
      await page.getByRole('button', { name: 'Female', exact: true }).click()
      texts.push(await page.locator('body').innerText())
      for (const fact of FACTS) {
        await openFact(page, fact.question)
        texts.push(await page.locator('body').innerText())
        for (const pick of [
          radios(page, fact.question).first(),
          card(page, fact.question, 'Not sure'),
        ]) {
          await pick.click()
          await expect(pick).toHaveAttribute('aria-checked', 'true')
          await expect(page.getByText(SAVED)).toBeVisible()
          texts.push(await page.locator('body').innerText())
        }
      }
      const all = texts.join('\n')
      expect(all.match(BANNED)?.[0] ?? null).toBeNull()
      expect(all.match(COUNSELLOR)?.[0] ?? null).toBeNull()
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC3: a mock figure on an impact line is labelled mock', async ({ page }) => {
    const email = await newStudent(page, 'qa-ac3')
    try {
      await openFact(page, "Latest you'd accept")
      await card(page, "Latest you'd accept", 'Jul 2027').click()
      await expect(impact(page)).toBeVisible()
      await expect(impact(page).getByText('mock', { exact: true })).toBeVisible()
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC4: a wait over 400 ms between step 00 and step 01 shows the duck loader [slow]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac4-slow')
    let done = async () => {}
    try {
      await page.goto('/')
      await expect(page).toHaveURL(/\/onboarding\/character$/)
      done = await slowStep01(page, email)
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(page.getByText('Keep floating.')).toBeVisible()
      await done()
      await expect(question(page, 'Where are you right now?')).toBeVisible()
      await expect(page.getByText('Keep floating.')).toHaveCount(0)
    } finally {
      await done()
      await deleteUsers([email])
    }
  })

  test('AC4: a wait under 400 ms between step 00 and step 01 shows nothing [fast]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac4-fast')
    try {
      // Compile step 01 first, so the dev server's first build is not the wait being measured.
      await openFact(page, 'Where are you right now?')
      await page.goto('/onboarding/character')
      await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible()
      await page.evaluate(() => {
        const w = window as unknown as { clickAt?: number; loaderAt?: number; shownAt?: number }
        document.addEventListener(
          'click',
          () => {
            w.clickAt ??= performance.now()
          },
          true,
        )
        // Each frame: when the loader is on screen (in the page and not faded out), and when the
        // first question shows.
        const tick = () => {
          const h2 = [...document.querySelectorAll('h2')].find(
            (h) => h.textContent === 'Keep floating.',
          )
          if (h2 && w.loaderAt === undefined) {
            let opacity = 1
            for (let n: Element | null = h2; n; n = n.parentElement)
              opacity *= Number(getComputedStyle(n).opacity)
            if (opacity > 0.05 && h2.getBoundingClientRect().width > 0)
              w.loaderAt = performance.now()
          }
          if (
            w.shownAt === undefined &&
            document.querySelector('h1')?.textContent === 'Where are you right now?'
          )
            w.shownAt = performance.now()
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(question(page, 'Where are you right now?')).toBeVisible()
      const { clickAt, loaderAt, shownAt } = await page.evaluate(() => {
        const w = window as unknown as { clickAt?: number; loaderAt?: number; shownAt?: number }
        return { clickAt: w.clickAt ?? 0, loaderAt: w.loaderAt ?? null, shownAt: w.shownAt ?? 0 }
      })
      // Shown at all, the loader must not come before about 400 ms of waiting.
      if (loaderAt !== null)
        expect(
          loaderAt - clickAt,
          `loader shown in a wait of ${Math.round(shownAt - clickAt)} ms`,
        ).toBeGreaterThanOrEqual(350)
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC4: with reduced motion the duck sits still on the water', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const email = await newStudent(page, 'qa-ac4-still')
    let done = async () => {}
    try {
      await page.goto('/')
      await expect(page).toHaveURL(/\/onboarding\/character$/)
      done = await slowStep01(page, email)
      await page.getByRole('button', { name: 'Start', exact: true }).click()
      const loader = page.getByRole('status').filter({ hasText: 'Keep floating.' })
      await expect(loader).toBeVisible()
      // The duck is decorative, hidden from the accessibility tree. Sitting still: nothing in the
      // loader moves. The loader may fade in (opacity only), which is not motion.
      const moving = await loader.evaluate((el) =>
        el
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === 'running')
          .flatMap((a) =>
            (a.effect as KeyframeEffect)
              .getKeyframes()
              .flatMap((k) => Object.keys(k))
              .filter(
                (p) => !['offset', 'computedOffset', 'easing', 'composite', 'opacity'].includes(p),
              )
              .map((p) => `${(a as CSSAnimation).animationName}: ${p}`),
          ),
      )
      expect([...new Set(moving)]).toEqual([])
      await done()
      await expect(question(page, 'Where are you right now?')).toBeVisible()
    } finally {
      await done()
      await deleteUsers([email])
    }
  })

  test('AC14: her pick is her comic character, and step 01 opens within 3 s of Start [Female]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac14-pick')
    try {
      expect((await profileOf(email))?.persona ?? null).toBeNull()
      const took = await leaveStep00(page, 'Female')
      expect(took).toBeLessThan(3000)
      await expect.poll(async () => (await profileOf(email))?.persona).toBe('female')
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC14: skipping leaves her comic character neutral, and step 01 opens within 3 s [Skip]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac14-skip')
    try {
      const took = await leaveStep00(page, null)
      expect(took).toBeLessThan(3000)
      await expect.poll(async () => (await profileOf(email))?.persona).toBe('neutral')
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC22: the progress shows which step she is on, read out as "Step N of 6" [phone]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac22-phone')
    try {
      await page.goto('/')
      await expect(page).toHaveURL(/\/onboarding\/character$/)
      await expect(page.getByText('Step 0 of 6.', { exact: true })).toBeAttached()
      await page.getByRole('button', { name: 'Skip', exact: true }).click()
      await expect(question(page, 'Where are you right now?')).toBeVisible()
      await expect(page.getByText('Step 1 of 6.', { exact: true })).toBeAttached()
      await expect(page.getByText('Step 0 of 6.', { exact: true })).toHaveCount(0)
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC23: step 01 asks where she is, her budget, timing, who comes, qualifications and English, one per screen', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac23')
    try {
      await openFact(page, 'Where are you right now?')
      for (const [i, fact] of FACTS.entries()) {
        await expect(page).toHaveURL(new RegExp(`${factUrl(fact.question)}$`))
        await expect(question(page, fact.question)).toBeVisible()
        await expect(
          page.getByText(`Facts about you · ${i + 1} of 11`, { exact: true }),
        ).toBeVisible()
        await expect(radios(page, fact.question).last()).toHaveAccessibleName('Not sure')
        if (i < FACTS.length - 1)
          await page.getByRole('button', { name: 'Skip', exact: true }).click()
      }
      await expect(page.getByRole('button', { name: "Next: What you'd study" })).toBeVisible()
      await openFact(page, 'Amount')
      await expect(page.getByText('Your budget per year', { exact: true })).toBeVisible()
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC24: "Australia (on a visa)" gives a different impact line from an offshore country', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac24')
    try {
      await openFact(page, 'Where are you right now?')
      await card(page, 'Where are you right now?', 'Nepal').click()
      await expect(impact(page)).toBeVisible()
      const offshore = await impact(page).innerText()
      await card(page, 'Where are you right now?', 'Australia (on a visa)').click()
      await expect(impact(page)).not.toHaveText(offshore)
      await expect(impact(page)).toHaveText(/onshore/i)
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC25: a one-line impact appears under the question within 300 ms of any answer', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac25')
    try {
      for (const fact of FACTS) {
        await openFact(page, fact.question)
        await expect(impact(page)).toHaveCount(0)
        await radios(page, fact.question).first().click()
        await expect.soft(impact(page), `impact line for ${fact.key}`).toBeVisible({ timeout: 300 })
      }
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC26: "Not sure" stores the default as assumed, the line says so, and the futures show it as a chip', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac26')
    try {
      for (const fact of FACTS) {
        await openFact(page, fact.question)
        await card(page, fact.question, 'Not sure').click()
        await expect(impact(page), `assumed line for ${fact.key}`).toHaveText(/assum/i)
        await expect(page.getByText(SAVED)).toBeVisible()
      }
      const answers = (await profileOf(email))?.answers ?? {}
      for (const fact of FACTS) expect(answers[fact.key]?.state, fact.key).toBe('assumed')
      expect(answers.amount).toEqual({ value: 30, state: 'assumed' })

      await answerOpening(page, {})
      await expect(
        page.getByRole('button', { name: 'Assumed: Budget about AUD 30k a year' }).first(),
      ).toBeVisible()
    } finally {
      await deleteUsers([email])
    }
  })

  for (const dependants of ['Partner', 'Partner and children']) {
    test(`AC27: the answer is saved, no follow-up form appears, and the line says family isn't covered yet [${dependants}]`, async ({
      page,
    }) => {
      const email = await newStudent(page, 'qa-ac27')
      try {
        await answerFact(page, ['Anyone coming with you?', dependants])
        await expect(impact(page)).toContainText(FAMILY)
        await expect(page.getByRole('textbox')).toHaveCount(0)
        await expect(page.getByRole('radiogroup')).toHaveCount(1)
        await expect
          .poll(async () => (await profileOf(email))?.answers.dep)
          .toEqual({ value: dependants, state: 'stated' })
      } finally {
        await deleteUsers([email])
      }
    })
  }

  test('AC30: Back from step 02 shows step 01 with her answers as she left them [step 02 to step 01]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac30-study')
    try {
      await answerFact(page, ['Amount', 'AUD 36k'])
      await answerFact(page, ['English test', 'Not sure'])
      await page.getByRole('button', { name: "Next: What you'd study" }).click()
      await expect(page).toHaveURL(/\/onboarding\/study$/)
      await page.getByRole('link', { name: 'Back', exact: true }).click()
      await expect(page).toHaveURL(/\/onboarding\/facts\/english$/)
      await expect(question(page, 'English test')).toBeVisible()
      await expect(card(page, 'English test', 'Not sure')).toHaveAttribute('aria-checked', 'true')
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(question(page, 'Last qualification')).toBeVisible()
      await openFact(page, 'Amount')
      await expect(card(page, 'Amount', 'AUD 36k')).toHaveAttribute('aria-checked', 'true')
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC30: Back from step 01 shows step 00 with her choice as she left it [step 01 to step 00]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac30-picture')
    try {
      await leaveStep00(page, 'Female')
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(page).toHaveURL(/\/onboarding\/character$/)
      await expect(page.getByRole('button', { name: 'Female', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC30: Back from one step 01 question shows the one before as she left it [question to question]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac30-question')
    try {
      await openFact(page, 'Where are you right now?')
      await card(page, 'Where are you right now?', 'Nepal').click()
      await expect(page.getByText(SAVED)).toBeVisible()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(question(page, 'Amount')).toBeVisible()
      await card(page, 'Amount', 'AUD 42k').click()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(question(page, 'Where are you right now?')).toBeVisible()
      await expect(card(page, 'Where are you right now?', 'Nepal')).toHaveAttribute(
        'aria-checked',
        'true',
      )
      await expect(impact(page)).toBeVisible()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(card(page, 'Amount', 'AUD 42k')).toHaveAttribute('aria-checked', 'true')
    } finally {
      await deleteUsers([email])
    }
  })

  test('AC60: signing in again opens step 01 where she left it, with all her earlier answers', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac60')
    try {
      await leaveStep00(page, null)
      await answerFact(page, ['Where are you right now?', 'Nepal'])
      await answerFact(page, ['Amount', 'AUD 36k'])
      await answerFact(page, ['It covers', 'Fees and living'])
      await openFact(page, 'Who pays')

      await signOutViaMenu(page)
      await expect(page).toHaveURL((url) => url.pathname === '/')
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

      await devLogin(page, email, 'E2E Student', { surface: 'student' })
      await page.goto('/')
      await expect(page).toHaveURL(/\/onboarding\/facts\/who-pays$/)
      await expect(question(page, 'Who pays')).toBeVisible()
      for (const [name, option] of [
        ['Where are you right now?', 'Nepal'],
        ['Amount', 'AUD 36k'],
        ['It covers', 'Fees and living'],
      ] as const) {
        await openFact(page, name)
        await expect(card(page, name, option)).toHaveAttribute('aria-checked', 'true')
      }
    } finally {
      await deleteUsers([email])
    }
  })

  test('save failure: the answer stays picked, the page says so, and Try again saves it', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-save-fails')
    try {
      await openFact(page, 'Is this a hard limit, or roughly?')
      const offline = (url: URL) => url.pathname === '/onboarding/facts/limit'
      await page.route(offline, (route) =>
        route.request().method() === 'POST'
          ? route.abort('internetdisconnected')
          : route.fallback(),
      )
      const hard = card(page, 'Is this a hard limit, or roughly?', 'Hard limit')
      await hard.click()
      const failed = page
        .getByRole('alert')
        .filter({ hasText: "We couldn't save that. Your answer is still here." })
      await expect(failed).toBeVisible()
      await expect(hard).toHaveAttribute('aria-checked', 'true')
      expect((await profileOf(email))?.answers.hard).toBeUndefined()

      await page.unroute(offline)
      await page.getByRole('button', { name: 'Try again' }).click()
      await expect(page.getByText(SAVED)).toBeVisible()
      await expect(failed).toHaveCount(0)
      await expect(hard).toHaveAttribute('aria-checked', 'true')
      await expect
        .poll(async () => (await profileOf(email))?.answers.hard)
        .toEqual({ value: 'Hard limit', state: 'stated' })
    } finally {
      await deleteUsers([email])
    }
  })

  test('keyboard: arrows, Home and End move through the cards, and each pick is saved', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-keys')
    try {
      await openFact(page, 'It covers')
      const options = await radios(page, 'It covers').allInnerTexts()
      const names = options.map((o) => o.trim())
      const first = names[0]
      const second = names[1]
      await question(page, 'It covers').focus()
      await page.keyboard.press('Tab')
      await expect(card(page, 'It covers', first)).toBeFocused()

      const saved = (value: string) =>
        expect
          .poll(async () => (await profileOf(email))?.answers.covers)
          .toEqual(
            value === 'Not sure'
              ? expect.objectContaining({ state: 'assumed' })
              : { value, state: 'stated' },
          )

      for (const [key, name] of [
        ['ArrowRight', second],
        ['ArrowLeft', first],
        ['ArrowDown', second],
        ['ArrowUp', first],
        ['End', 'Not sure'],
        ['Home', first],
      ] as const) {
        await page.keyboard.press(key)
        await expect(card(page, 'It covers', name), key).toBeFocused()
        await expect(card(page, 'It covers', name), key).toHaveAttribute('aria-checked', 'true')
        await saved(name)
      }
    } finally {
      await deleteUsers([email])
    }
  })
})

test.describe('on a tablet', () => {
  test.use({ viewport: TABLET })

  test('AC22: the progress shows which step she is on, read out as "Step N of 6" [tablet]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac22-tablet')
    try {
      await leaveStep00(page, 'Male')
      await expect(page.getByText('Step 1 of 6.', { exact: true })).toBeAttached()
    } finally {
      await deleteUsers([email])
    }
  })
})

test.describe('on desktop', () => {
  test.use({ viewport: DESKTOP })

  test('AC22: the step list shows which step she is on, earlier steps done [desktop]', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-ac22-desktop')
    try {
      await page.goto('/')
      await expect(page).toHaveURL(/\/onboarding\/character$/)
      const steps = page.getByRole('list', { name: 'Your steps' }).getByRole('listitem')
      await expect(steps).toHaveCount(7)
      await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step')

      await page.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(question(page, 'Where are you right now?')).toBeVisible()
      await expect(steps).toHaveCount(7)
      await expect(steps.nth(0)).toContainText('Done')
      await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step')
      await expect(steps.nth(1)).toContainText('Facts about you')
      await expect(steps.nth(1)).toContainText('Now · 1/11')
      await expect(page.locator('[aria-current="step"]')).toHaveCount(1)

      await page.getByRole('button', { name: 'Skip', exact: true }).click()
      await expect(steps.nth(1)).toContainText('Now · 2/11')
    } finally {
      await deleteUsers([email])
    }
  })

  test('wide: at 1920 the 1440 design is scaled up, the question 56px against 42px', async ({
    page,
  }) => {
    const email = await newStudent(page, 'qa-wide-1920')
    try {
      const size = async () =>
        question(page, 'Where are you right now?').evaluate((h) =>
          Number.parseFloat(getComputedStyle(h).fontSize),
        )
      await openFact(page, 'Where are you right now?')
      expect(await size()).toBeCloseTo(42, 0)
      await page.setViewportSize({ width: 1920, height: 1080 })
      await expect.poll(size).toBeCloseTo(56, 0)
    } finally {
      await deleteUsers([email])
    }
  })

  test('wide: at 2560 the 1920 frame is centred, the same size', async ({ page }) => {
    const email = await newStudent(page, 'qa-wide-2560')
    try {
      const boxes = async () => {
        const h = await question(page, 'Where are you right now?').boundingBox()
        const g = await page
          .getByRole('radiogroup', { name: 'Where are you right now?' })
          .boundingBox()
        const p = await page
          .getByRole('complementary', { name: 'Getting started' })
          .getByRole('list', { name: 'Your steps' })
          .boundingBox()
        return { h, g, p }
      }
      await page.setViewportSize({ width: 1920, height: 1080 })
      await openFact(page, 'Where are you right now?')
      const at1920 = await boxes()
      await page.setViewportSize({ width: 2560, height: 1080 })
      await expect
        .poll(async () => (await boxes()).g?.x ?? 0)
        .toBeCloseTo((at1920.g?.x ?? 0) + 320, 0)
      const at2560 = await boxes()
      for (const k of ['h', 'g', 'p'] as const) {
        expect(
          Math.abs((at2560[k]?.x ?? 0) - ((at1920[k]?.x ?? 0) + 320)),
          `${k} shifted by 320`,
        ).toBeLessThan(2)
        expect(
          Math.abs((at2560[k]?.width ?? 0) - (at1920[k]?.width ?? 0)),
          `${k} same width`,
        ).toBeLessThan(2)
      }
    } finally {
      await deleteUsers([email])
    }
  })
})
