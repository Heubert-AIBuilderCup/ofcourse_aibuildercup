/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'

mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
}))
mock.module('@/shared/lib/theme-actions', () => ({ setThemeChoice: async () => {} }))

const { Providers } = await import('@/shared/components/Providers')
const { RoadHeader } = await import('./RoadHeader')

// next/image resolves its src against the page's URL; happy-dom starts on about:blank.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/roadmaps/rm-1'))
afterAll(() => dom.setURL(startUrl))

const realMatchMedia = window.matchMedia
beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

const onLater = mock(() => {})
const header = () =>
  render(
    <Providers initialChoice="light" systemTheme={null}>
      <RoadHeader roadmapName="On a budget" onLater={onLater} />
    </Providers>,
  )

describe('RoadHeader', () => {
  it('leads back to her roadmaps and names the one open', () => {
    header()
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumb).getByRole('link', { name: 'Your roadmaps' })).toHaveAttribute(
      'href',
      '/roadmaps',
    )
    expect(within(crumb).getByText('On a budget')).toHaveAttribute('aria-current', 'page')
  })
})
