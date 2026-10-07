/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { LOADER_LINES, LOADER_TITLE } from '../model/loader-lines'
import { DuckLoader } from './DuckLoader'

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

const realStorage = Object.getOwnPropertyDescriptor(window, 'sessionStorage')

afterEach(() => {
  cleanup()
  if (realStorage) Object.defineProperty(window, 'sessionStorage', realStorage)
  sessionStorage.clear()
})

const shownLine = () => LOADER_LINES.filter((line) => screen.queryByText(line) !== null)

it('says "Keep floating." and one line, as a loading status', () => {
  render(<DuckLoader />)
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: LOADER_TITLE })).toBeInTheDocument()
  expect(LOADER_TITLE).toBe('Keep floating.')
  expect(shownLine()).toHaveLength(1)
})

it('shows a different line on each mount', () => {
  const first = render(<DuckLoader />)
  const one = shownLine()
  first.unmount()
  const second = render(<DuckLoader />)
  const two = shownLine()
  second.unmount()
  render(<DuckLoader />)
  const three = shownLine()
  expect(one).not.toEqual(two)
  expect(two).not.toEqual(three)
  expect(new Set([...one, ...two, ...three]).size).toBe(3)
})

it('still renders the first line when sessionStorage throws', () => {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('denied')
    },
  })
  render(<DuckLoader />)
  expect(screen.getByText(LOADER_LINES[0])).toBeInTheDocument()
})

it('has the duck facing right, the way it drifts', () => {
  render(<DuckLoader />)
  const duck = document.querySelector('img')
  expect(duck).not.toBeNull()
  expect(duck?.getAttribute('alt')).toBe('')
  // The PNG faces left; mirrored, it faces the way it moves.
  expect(duck?.className).toContain('-scale-x-100')
})
