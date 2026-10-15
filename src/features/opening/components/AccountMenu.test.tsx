/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as navigation from 'next/navigation'

const setThemeChoice = mock(async (_choice: unknown) => {})
mock.module('@/shared/lib/theme-actions', () => ({ setThemeChoice }))

const calls: string[] = []
const signOut = mock(async () => {
  calls.push('signOut')
})
const replace = mock((path: string) => {
  calls.push(`replace ${path}`)
})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace, refresh: () => {}, back: () => {} }),
}))
mock.module('@/shared/lib/auth/client', () => ({ signOut }))

const { Providers } = await import('@/shared/components/Providers')
const { AccountMenu } = await import('./AccountMenu')

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
  signOut.mockClear()
  replace.mockClear()
  calls.length = 0
  delete document.documentElement.dataset.theme
})

function show() {
  render(
    <Providers initialChoice="light" systemTheme={null}>
      <AccountMenu />
    </Providers>,
  )
  return screen.getByRole('button', { name: 'Menu: theme and sign out' })
}

const open = (button: HTMLElement) =>
  act(() => {
    fireEvent.click(button)
  })
const roadmapsItem = () => screen.getByRole('menuitem', { name: 'Your roadmaps' })
const darkItem = () => screen.getByRole('menuitemcheckbox', { name: 'Dark theme' })
const signOutItem = () => screen.getByRole('menuitem', { name: 'Sign out' })

it('starts closed, a menu button', () => {
  const button = show()
  expect(button).toHaveAttribute('aria-haspopup', 'menu')
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('menu')).toBeNull()
})

it('opens on Your roadmaps, Dark theme and Sign out, focus on the first item', async () => {
  const button = show()
  await open(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('menu', { name: 'Menu' })).toBeInTheDocument()
  expect(roadmapsItem()).toHaveAttribute('href', '/roadmaps')
  expect(darkItem()).toHaveAttribute('aria-checked', 'false')
  expect(signOutItem()).toBeInTheDocument()
  expect(document.activeElement).toBe(roadmapsItem())
})

it('switches the theme from Dark theme and stays open', async () => {
  await open(show())
  fireEvent.click(darkItem())
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(darkItem()).toHaveAttribute('aria-checked', 'true')
  expect(setThemeChoice).toHaveBeenCalledWith('dark')
  expect(screen.getByRole('menu')).toBeInTheDocument()
})

it('closes on Escape and gives focus back to the button', async () => {
  const button = show()
  await open(button)
  await act(() => {
    fireEvent.keyDown(darkItem(), { key: 'Escape' })
  })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(document.activeElement).toBe(button)
})

it.each([false, true])('closes on Tab (shift %p) and lets focus move on', async (shiftKey) => {
  await open(show())
  let event: KeyboardEvent | undefined
  document.addEventListener('keydown', (e) => (event = e), { once: true })
  await act(() => {
    fireEvent.keyDown(darkItem(), { key: 'Tab', shiftKey })
  })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(event?.defaultPrevented).toBe(false)
})

it('closes on a click outside it', async () => {
  await open(show())
  const scrim = document.querySelector<HTMLButtonElement>('button[aria-hidden="true"]')
  expect(scrim).not.toBeNull()
  fireEvent.click(scrim as HTMLButtonElement)
  expect(screen.queryByRole('menu')).toBeNull()
})

it('moves between items with the arrow keys, Home and End', async () => {
  await open(show())
  fireEvent.keyDown(roadmapsItem(), { key: 'ArrowDown' })
  expect(document.activeElement).toBe(darkItem())
  fireEvent.keyDown(darkItem(), { key: 'ArrowDown' })
  expect(document.activeElement).toBe(signOutItem())
  fireEvent.keyDown(signOutItem(), { key: 'ArrowUp' })
  expect(document.activeElement).toBe(darkItem())
  fireEvent.keyDown(darkItem(), { key: 'End' })
  expect(document.activeElement).toBe(signOutItem())
  fireEvent.keyDown(signOutItem(), { key: 'Home' })
  expect(document.activeElement).toBe(roadmapsItem())
})

it('signs out, then leaves for the sign-in page', async () => {
  await open(show())
  fireEvent.click(signOutItem())
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(calls).toEqual(['signOut', 'replace /'])
})
