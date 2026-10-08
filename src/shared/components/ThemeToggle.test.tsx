/// <reference lib="dom" />
/// <reference path="../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const rememberSystemTheme = mock(async (_theme: unknown) => {})
const setThemeChoice = mock(async (_choice: unknown) => {})
mock.module('@/shared/lib/theme-actions', () => ({ rememberSystemTheme, setThemeChoice }))

const { Providers } = await import('./Providers')
const { ThemeToggle } = await import('./ThemeToggle')

// A light device, so the page starts light.
const realMatchMedia = window.matchMedia
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
  setThemeChoice.mockClear()
  delete document.documentElement.dataset.theme
})

it('offers the other theme and switches to it at once', () => {
  render(
    <Providers initialChoice="light" systemTheme={null}>
      <ThemeToggle />
    </Providers>,
  )
  const toggle = screen.getByRole('button', { name: 'Switch to dark theme' })
  expect(toggle).toHaveAttribute('title', 'Switch to dark theme')
  expect(toggle.querySelector('svg.lucide-moon')).not.toBeNull()

  fireEvent.click(toggle)
  expect(document.documentElement.dataset.theme).toBe('dark')
  const back = screen.getByRole('button', { name: 'Switch to light theme' })
  expect(back.querySelector('svg.lucide-sun')).not.toBeNull()
  expect(setThemeChoice).toHaveBeenCalledWith('dark')
})
