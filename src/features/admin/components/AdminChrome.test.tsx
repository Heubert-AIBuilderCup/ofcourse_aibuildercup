/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ReactNode } from 'react'

mock.module('@/shared/lib/theme-actions', () => ({ setThemeChoice: async () => {} }))
mock.module('@/shared/lib/auth/client', () => ({ signOut: async () => {} }))
mock.module('next/navigation', () => ({
  ...navigation,
  usePathname: () => '/admin/board',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
}))

const { Providers } = await import('@/shared/components/Providers')
const { AdminChrome } = await import('./AdminChrome')

// next/image (the duck) resolves its src against the page's URL; happy-dom starts on about:blank.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/admin/board'))
afterAll(() => dom.setURL(startUrl))

// The header's theme toggle reads the theme from Providers; a light device.
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
})

const render = (ui: ReactNode) =>
  rtlRender(
    <Providers initialChoice="system" systemTheme="light">
      {ui}
    </Providers>,
  )

const EDITOR = { role: 'user', editor: true, name: 'Maya Rai' }

it("shows the viewer's name and real role on the account button, never a capability as a role", () => {
  render(
    <AdminChrome viewer={{ ...EDITOR, reviewer: true }} ai={{ provider: 'fake', project: null }}>
      <p>Page</p>
    </AdminChrome>,
  )
  const account = screen.getByRole('button', { name: 'Account: Maya Rai, User' })
  expect(account.textContent).toContain('Maya Rai')
  expect(account.textContent).toContain('MR')
  expect(account.textContent).not.toMatch(/Editor|Reviewer/)
  cleanup()

  render(
    <AdminChrome
      viewer={{ role: 'superadmin', name: 'Sam' }}
      ai={{ provider: 'fake', project: null }}
    >
      <p>Page</p>
    </AdminChrome>,
  )
  expect(screen.getByRole('button', { name: 'Account: Sam, Superadmin' }).textContent).toContain(
    'Superadmin',
  )
})

it('opens the account menu with the theme and Sign out', () => {
  render(
    <AdminChrome viewer={EDITOR} ai={{ provider: 'fake', project: null }}>
      <p>Page</p>
    </AdminChrome>,
  )
  fireEvent.click(screen.getByRole('button', { name: /^Account/ }))
  const menu = within(screen.getByRole('menu'))
  expect(menu.getByRole('menuitemcheckbox', { name: 'Dark theme' })).toBeInTheDocument()
  expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
})

it('tells staff who see the board that the server runs the stand-in AI', () => {
  render(
    <AdminChrome viewer={EDITOR} ai={{ provider: 'fake', project: null }}>
      <p>Page</p>
    </AdminChrome>,
  )
  expect(screen.getByText('Stand-in AI')).toBeInTheDocument()
  expect(screen.queryByText(/Gemini/)).toBeNull()
})

it('names Gemini and its project when the server runs Vertex, and Gemini alone with no project', () => {
  render(
    <AdminChrome
      viewer={{ role: 'admin', name: 'Ada' }}
      ai={{ provider: 'vertex', project: 'ofcourse-demo' }}
    >
      <p>Page</p>
    </AdminChrome>,
  )
  expect(screen.getByText('Gemini · ofcourse-demo')).toBeInTheDocument()
  expect(screen.queryByText('Stand-in AI')).toBeNull()
  cleanup()

  render(
    <AdminChrome viewer={EDITOR} ai={{ provider: 'vertex', project: null }}>
      <p>Page</p>
    </AdminChrome>,
  )
  expect(screen.getByText('Gemini')).toBeInTheDocument()
})

it('shows no AI badge to an account that may not see the board', () => {
  render(
    <AdminChrome
      viewer={{ role: 'user', name: 'Uma' }}
      ai={{ provider: 'vertex', project: 'ofcourse-demo' }}
    >
      <p>Page</p>
    </AdminChrome>,
  )
  expect(screen.queryByText(/Gemini|Stand-in AI/)).toBeNull()
})
