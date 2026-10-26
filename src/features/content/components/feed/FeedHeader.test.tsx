/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'

mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
}))
mock.module('@/shared/lib/theme-actions', () => ({ setThemeChoice: async () => {} }))

const { Providers } = await import('@/shared/components/Providers')
const { FeedHeader } = await import('./FeedHeader')

// next/image resolves its src against the page's URL; happy-dom starts on about:blank.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/feed'))
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

const header = (student: boolean) =>
  render(
    <Providers initialChoice="light" systemTheme={null}>
      <FeedHeader student={student} />
    </Providers>,
  )

describe('FeedHeader', () => {
  it('gives a student the app’s way around: Your roadmaps, the Feed as the page she is on, her menu', () => {
    header(true)
    expect(screen.getByRole('link', { name: 'Your roadmaps' }).getAttribute('href')).toBe(
      '/roadmaps',
    )
    const feed = screen.getByRole('link', { name: 'Feed' })
    expect(feed.getAttribute('href')).toBe('/feed')
    expect(feed.getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('button', { name: 'Menu: theme and sign out' }) !== null).toBe(true)
  })

  it('keeps staff on their own bar: the site name to the Board and Sign out, none of the student’s way around', () => {
    header(false)
    expect(screen.queryByRole('link', { name: 'Your roadmaps' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Feed' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Menu: theme and sign out' })).toBeNull()
    expect(screen.getByRole('link', { name: 'OfCourse' }).getAttribute('href')).toBe('/admin/board')
    expect(screen.queryByRole('button', { name: 'Sign out' }) !== null).toBe(true)
  })
})
