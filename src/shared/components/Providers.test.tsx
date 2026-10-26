/// <reference lib="dom" />
/// <reference path="../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  setSystemTime,
} from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { THEME_COOKIE_MAX_AGE } from '@/shared/lib/theme'

const setThemeChoice = mock(async (_choice: unknown) => {})
mock.module('@/shared/lib/theme-actions', () => ({ setThemeChoice }))

const { Providers, useThemeChoice } = await import('./Providers')

/** happy-dom's page address; the document keeps cookies only on a real one (not about:blank). */
const setPageUrl = (url: string) =>
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(url)

// A device whose colour scheme the test controls.
let deviceDark = false
let listeners: Array<() => void> = []
const realMatchMedia = window.matchMedia
beforeEach(() => {
  setPageUrl('http://localhost:3000/')
  deviceDark = false
  listeners = []
  window.matchMedia = ((query: string) => ({
    get matches() {
      return deviceDark
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => {
      listeners = listeners.filter((l) => l !== fn)
    },
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
  setThemeChoice.mockClear()
  delete document.documentElement.dataset.theme
  // Expired in the past: with max-age=0 happy-dom keeps it until the clock moves on.
  // biome-ignore lint/suspicious/noDocumentCookie: clearing the cookie the component set
  document.cookie = 'theme-os=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

function Probe() {
  const { theme, choice, setChoice } = useThemeChoice()
  return (
    <>
      <output data-testid="theme">{theme}</output>
      <output data-testid="choice">{choice}</output>
      <button type="button" onClick={() => setChoice('dark')}>
        go dark
      </button>
    </>
  )
}

const shown = () => screen.getByTestId('theme').textContent
const flipDevice = (dark: boolean) =>
  act(() => {
    deviceDark = dark
    for (const l of listeners) l()
  })

describe('Providers', () => {
  it('follows the device live while the choice is system', () => {
    deviceDark = true
    render(
      <Providers initialChoice="system" systemTheme={null}>
        <Probe />
      </Providers>,
    )
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(shown()).toBe('dark')

    flipDevice(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(shown()).toBe('light')
  })

  it('applies a picked theme at once and stops following the device', () => {
    render(
      <Providers initialChoice="system" systemTheme={null}>
        <Probe />
      </Providers>,
    )
    // The action never resolves: the page must not wait for it.
    setThemeChoice.mockImplementationOnce(() => new Promise<void>(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'go dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(shown()).toBe('dark')
    expect(setThemeChoice).toHaveBeenCalledTimes(1)
    expect(setThemeChoice).toHaveBeenCalledWith('dark')

    flipDevice(false)
    expect(shown()).toBe('dark')
    flipDevice(true)
    expect(shown()).toBe('dark')
  })

  it('lets a stored choice win over the device', () => {
    deviceDark = true
    render(
      <Providers initialChoice="light" systemTheme="dark">
        <Probe />
      </Providers>,
    )
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(shown()).toBe('light')
  })

  it('keeps the theme when the action rejects', () => {
    setThemeChoice.mockImplementationOnce(async () => {
      throw new Error('offline')
    })
    render(
      <Providers initialChoice="light" systemTheme={null}>
        <Probe />
      </Providers>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'go dark' }))
    expect(shown()).toBe('dark')
  })

  describe('the device scheme the server hears about', () => {
    // The clock held still, as when the next test reads the cookies in the same millisecond the
    // last one's cleanup ran: happy-dom drops a cookie only once its expiry has passed.
    beforeAll(() => setSystemTime(new Date('2026-10-26T09:00:00Z')))
    afterAll(() => setSystemTime())

    // The cookie is set in the browser: a server action that sets one refreshes the route.
    it('is written as a cookie on a first visit, with no server action', () => {
      deviceDark = true
      render(
        <Providers initialChoice="system" systemTheme={null}>
          <Probe />
        </Providers>,
      )
      expect(document.cookie).toContain('theme-os=dark')
      expect(setThemeChoice).not.toHaveBeenCalled()
    })

    it('is written again when the device changes, and not while it matches what the server knows', () => {
      render(
        <Providers initialChoice="system" systemTheme="light">
          <Probe />
        </Providers>,
      )
      expect(document.cookie).not.toContain('theme-os')

      flipDevice(true)
      expect(document.cookie).toContain('theme-os=dark')
      flipDevice(false)
      expect(document.cookie).toContain('theme-os=light')
    })

    it('is a year-long lax cookie for the whole site, secure only over https', () => {
      const written: string[] = []
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => '',
        set: (value: string) => void written.push(value),
      })
      try {
        deviceDark = true
        const view = render(
          <Providers initialChoice="system" systemTheme={null}>
            <Probe />
          </Providers>,
        )
        view.unmount()
        setPageUrl('https://example.test/')
        render(
          <Providers initialChoice="system" systemTheme={null}>
            <Probe />
          </Providers>,
        )
      } finally {
        delete (document as { cookie?: string }).cookie
        setPageUrl('http://localhost:3000/')
      }
      const base = `theme-os=dark; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
      expect(written).toEqual([base, `${base}; secure`])
    })
  })

  it('refuses useThemeChoice outside a Provider with a clear error', () => {
    const quiet = console.error
    console.error = () => {}
    try {
      expect(() => render(<Probe />)).toThrow(/Providers/)
    } finally {
      console.error = quiet
    }
  })
})
