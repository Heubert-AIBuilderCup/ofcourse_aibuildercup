/// <reference lib="dom" />
/// <reference path="../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const rememberSystemTheme = mock(async (_theme: unknown) => {})
const setThemeChoice = mock(async (_choice: unknown) => {})
mock.module('@/shared/lib/theme-actions', () => ({ rememberSystemTheme, setThemeChoice }))

const { Providers, useThemeChoice } = await import('./Providers')

// A device whose colour scheme the test controls.
let deviceDark = false
let listeners: Array<() => void> = []
const realMatchMedia = window.matchMedia
beforeEach(() => {
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
  rememberSystemTheme.mockClear()
  setThemeChoice.mockClear()
  delete document.documentElement.dataset.theme
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
