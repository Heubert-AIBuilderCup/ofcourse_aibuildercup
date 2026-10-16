/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, beforeEach, expect, it, mock } from 'bun:test'
import { cleanup, render as rtlRender, screen } from '@testing-library/react'
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

const EDITOR = { role: 'user', editor: true }

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
    <AdminChrome viewer={{ role: 'admin' }} ai={{ provider: 'vertex', project: 'ofcourse-demo' }}>
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
    <AdminChrome viewer={{ role: 'user' }} ai={{ provider: 'vertex', project: 'ofcourse-demo' }}>
      <p>Page</p>
    </AdminChrome>,
  )
  expect(screen.queryByText(/Gemini|Stand-in AI/)).toBeNull()
})
