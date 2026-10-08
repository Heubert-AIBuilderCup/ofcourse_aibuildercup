// The theme as a person meets it: open a page in the device's light or dark scheme, switch it from
// the header action, and read colours the way they paint (any CSS colour resolved to sRGB through a
// canvas, pixels read back from a screenshot). Shared by any spec that checks a screen in a theme.

import { type BrowserContext, expect, type Locator, type Page } from '@playwright/test'

export type Theme = 'light' | 'dark'
export type Rgba = [r: number, g: number, b: number, a: number]

export const html = (page: Page) => page.locator('html')

/** The device scheme set to `theme`, `path` opened, and the page painting in it. */
export async function openIn(page: Page, path: string, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme })
  await page.goto(path)
  await expect(html(page)).toHaveAttribute('data-theme', theme)
}

/** The stored theme for this browser: the `theme` cookie's value. */
export async function themeCookie(context: BrowserContext): Promise<string | undefined> {
  return (await context.cookies()).find((c) => c.name === 'theme')?.value
}

/** The header toggle on the sign-in pages and the admin console, whichever way it points. */
export const themeToggle = (page: Page) =>
  page.getByRole('button', { name: /^Switch to (dark|light) theme$/ })

/** The onboarding header menu button. */
export const headerMenu = (page: Page) =>
  page.getByRole('button', { name: 'Menu: theme and sign out' })

/** Open the onboarding header menu and return it. */
export async function openHeaderMenu(page: Page): Promise<Locator> {
  await headerMenu(page).click()
  const menu = page.getByRole('menu', { name: 'Menu' })
  await expect(menu).toBeVisible()
  return menu
}

/** Switch from the onboarding menu's Dark theme item; the page ends in `to`. */
export async function switchFromMenu(page: Page, to: Theme): Promise<void> {
  const menu = await openHeaderMenu(page)
  const item = menu.getByRole('menuitemcheckbox', { name: 'Dark theme' })
  await item.click()
  await expect(html(page)).toHaveAttribute('data-theme', to)
  await expect(item).toHaveAttribute('aria-checked', String(to === 'dark'))
  await expect.poll(() => themeCookie(page.context()), 'the choice is stored').toBe(to)
  await page.keyboard.press('Escape')
}

/** Switch from the header toggle; the page ends in `to`. */
export async function switchFromToggle(page: Page, to: Theme): Promise<void> {
  const from = to === 'dark' ? 'light' : 'dark'
  await page.getByRole('button', { name: `Switch to ${to} theme` }).click()
  await expect(html(page)).toHaveAttribute('data-theme', to)
  await expect(page.getByRole('button', { name: `Switch to ${from} theme` })).toBeVisible()
  await expect.poll(() => themeCookie(page.context()), 'the choice is stored').toBe(to)
}

// In the page: any CSS colour to sRGB through a 1×1 canvas, relative luminance and contrast.
const KIT = `window.__themeKit ??= (() => {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const rgba = (value) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }
  const over = (top, under) => {
    const a = top[3]
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1)
  }
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const token = (name) => rgba(getComputedStyle(document.documentElement).getPropertyValue(name).trim())
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  }
  // The colour behind an element: the page's ground, then every ancestor's fill over it.
  const ground = (el) => {
    const chain = []
    for (let n = el; n; n = n.parentElement) chain.unshift(n)
    let c = rgba(getComputedStyle(document.documentElement).backgroundColor)
    if (c[3] === 0) c = token('--background')
    for (const n of chain) {
      const fill = rgba(getComputedStyle(n).backgroundColor)
      if (fill[3] > 0) c = over(fill, c)
    }
    return c
  }
  const describe = (el) => {
    const role = el.getAttribute('role')
    const name = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 50)
    return el.tagName.toLowerCase() + (role ? '[' + role + ']' : '') + ' "' + name + '"'
  }
  return { rgba, over, lum, contrast, token, visible, ground, describe }
})()`

async function kit(page: Page): Promise<void> {
  await page.evaluate(KIT)
}

/** A CSS custom property of the page, resolved to sRGB. */
export async function token(page: Page, name: string): Promise<Rgba> {
  await kit(page)
  // biome-ignore lint/suspicious/noExplicitAny: the kit lives on window
  return page.evaluate((n) => (window as any).__themeKit.token(n), name)
}

/** Every custom property whose name matches `pattern`, resolved to sRGB. */
export async function tokens(page: Page, pattern: RegExp): Promise<Record<string, Rgba>> {
  await kit(page)
  return page.evaluate(
    ({ source, flags }) => {
      const re = new RegExp(source, flags)
      const cs = getComputedStyle(document.documentElement)
      const out: Record<string, unknown> = {}
      for (let i = 0; i < cs.length; i++) {
        // biome-ignore lint/suspicious/noExplicitAny: the kit lives on window
        if (re.test(cs[i])) out[cs[i]] = (window as any).__themeKit.token(cs[i])
      }
      return out as Record<string, Rgba>
    },
    { source: pattern.source, flags: pattern.flags },
  )
}

/** A computed colour property of an element, resolved to sRGB. */
export async function colourOf(locator: Locator, property: string): Promise<Rgba> {
  await kit(locator.page())
  return locator.evaluate(
    // biome-ignore lint/suspicious/noExplicitAny: the kit lives on window
    (el, p) => (window as any).__themeKit.rgba(getComputedStyle(el).getPropertyValue(p)),
    property,
  )
}

/** The hex `#rrggbb` as sRGB. */
export function hex(value: string): Rgba {
  const n = Number.parseInt(value.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
}

/** Two colours equal to within `tolerance` on each channel (alpha within 0.02). */
export function sameColour(a: Rgba, b: Rgba, tolerance = 3): boolean {
  return [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) <= tolerance) && Math.abs(a[3] - b[3]) <= 0.02
}

/** WCAG relative luminance of an opaque sRGB colour. */
export function luminance([r, g, b]: Rgba): number {
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio of two opaque colours. */
export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Light surfaces left on the page: every visible element holding text (a surface, box, tag, toast
 * or alert; not a control, nor inside one) whose fill, laid over what is behind it, is lighter
 * than `maxLuminance`. Controls are left out (a chosen card or a filled button is checked by its
 * own criterion), and so are empty marks such as a chart's bars or a coin.
 */
export async function lightSurfaces(page: Page, maxLuminance = 0.4): Promise<string[]> {
  await kit(page)
  return page.evaluate((max) => {
    // biome-ignore lint/suspicious/noExplicitAny: the kit lives on window
    const k = (window as any).__themeKit
    const out: string[] = []
    const controls =
      'button, a, input, select, textarea, [role="button"], [role="radio"], [role="switch"], [role="menuitem"], [role="menuitemcheckbox"], [role="checkbox"], [role="option"]'
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest(controls) || !(el.textContent ?? '').trim() || !k.visible(el)) continue
      const fill = k.rgba(getComputedStyle(el).backgroundColor)
      if (fill[3] === 0) continue
      const seen = k.ground(el)
      if (k.lum(seen) > max) out.push(`${k.describe(el)} ${getComputedStyle(el).backgroundColor}`)
    }
    return out
  }, maxLuminance)
}

/**
 * Text below its contrast floor on what is behind it: 4.5:1, or 3:1 for large text (24px, or
 * 18.66px bold). Disabled controls and hidden text are exempt, as WCAG has them; so is the text
 * inside `skip`.
 */
export async function lowContrastText(page: Page, skip: Locator[] = []): Promise<string[]> {
  await kit(page)
  for (const area of skip) await area.evaluate((el) => el.setAttribute('data-contrast-skip', ''))
  return page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: the kit lives on window
    const k = (window as any).__themeKit
    const out: string[] = []
    for (const el of document.body.querySelectorAll('*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim())
      if (!own || !k.visible(el)) continue
      if (
        el.closest(':disabled, [aria-disabled="true"], [aria-hidden="true"], [data-contrast-skip]')
      )
        continue
      const cs = getComputedStyle(el)
      const fg = k.rgba(cs.color)
      if (fg[3] === 0) continue
      const bg = k.ground(el)
      const ratio = k.contrast(k.over(fg, bg), bg)
      const size = Number.parseFloat(cs.fontSize)
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
      const floor = large ? 3 : 4.5
      if (ratio < floor)
        out.push(
          `${k.describe(el)} ${ratio.toFixed(2)}:1 < ${floor} (${cs.color} on rgb(${bg.slice(0, 3).map(Math.round).join(',')}))`,
        )
    }
    return out
  })
}

/** The pixels of a screenshot of `clip`, read back as rows of sRGB. */
async function pixels(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<number[][][]> {
  const png = (await page.screenshot({ clip, animations: 'disabled' })).toString('base64')
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const d = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
    const rows: number[][][] = []
    for (let y = 0; y < bitmap.height; y++) {
      const row: number[][] = []
      for (let x = 0; x < bitmap.width; x++) {
        const i = (y * bitmap.width + x) * 4
        row.push([d[i], d[i + 1], d[i + 2]])
      }
      rows.push(row)
    }
    return rows
  }, png)
}

const median = (values: number[][]) =>
  [0, 1, 2].map((i) => values.map((v) => v[i]).sort((a, b) => a - b)[values.length >> 1])
const distance = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

/**
 * Whether a line is painted where `box` meets the page on its `side`: across the edge (from 5px
 * inside to 5px outside), some line of pixels differs from both the inside and the outside.
 */
export async function hasEdgeLine(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  side: 'right' | 'bottom',
): Promise<boolean> {
  const span = 240
  const clip =
    side === 'right'
      ? { x: box.x + box.width - 5, y: box.y + box.height / 3, width: 10, height: span }
      : { x: box.x + box.width / 3, y: box.y + box.height - 5, width: span, height: 10 }
  const rows = await pixels(page, clip)
  const lines =
    side === 'right'
      ? rows[0].map((_, x) => median(rows.map((row) => row[x])))
      : rows.map((row) => median(row))
  const inside = lines[0]
  const outside = lines[lines.length - 1]
  return lines.some((l) => distance(l, inside) >= 6 && distance(l, outside) >= 6)
}

/**
 * How an element paints: the colour most of its pixels have (its fill, under text and icons), and
 * the column colours across its left edge, from 3px outside to 6px inside (where its rule is).
 */
export async function painted(locator: Locator): Promise<{ fill: Rgba; leftEdge: Rgba[] }> {
  const page = locator.page()
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  if (!box) throw new Error('no box')
  const all = (await pixels(page, box)).flat()
  const rows = await pixels(page, {
    x: box.x - 3,
    y: box.y + box.height / 4,
    width: 9,
    height: box.height / 2,
  })
  const leftEdge = rows[0].map((_, x) => median(rows.map((row) => row[x])))
  const rgba = (c: number[]) => [c[0], c[1], c[2], 1] as Rgba
  return { fill: rgba(median(all)), leftEdge: leftEdge.map(rgba) }
}

/** A screenshot of `box`, inset so its edges are left out. */
export async function shot(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  inset = 6,
): Promise<Buffer> {
  return page.screenshot({
    clip: {
      x: box.x + inset,
      y: box.y + inset,
      width: box.width - 2 * inset,
      height: Math.min(box.height, page.viewportSize()?.height ?? box.height) - 2 * inset,
    },
    animations: 'disabled',
  })
}

/** The share of pixels that differ between two screenshots of the same size. */
export async function differingShare(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([one, two]) => {
      const read = async (b64: string) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bitmap, 0, 0)
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
      }
      const [x, y] = await Promise.all([read(one), read(two)])
      if (x.length !== y.length) return 1
      let differing = 0
      for (let i = 0; i < x.length; i += 4) {
        const d =
          Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2])
        if (d > 24) differing++
      }
      return differing / (x.length / 4)
    },
    [a.toString('base64'), b.toString('base64')],
  )
}
