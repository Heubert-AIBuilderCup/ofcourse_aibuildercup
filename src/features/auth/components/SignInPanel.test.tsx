/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SignInPanel } from './SignInPanel'

// next/image (the duck) resolves its src against the page's URL; happy-dom starts on about:blank.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

const realRaf = window.requestAnimationFrame
const realHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')

afterEach(() => {
  cleanup()
  window.requestAnimationFrame = realRaf
  if (realHidden) Object.defineProperty(document, 'hidden', realHidden)
})

const panel = () => screen.getByRole('region', { name: 'About' })

it('is the place the splash lands, with the page’s own copy', () => {
  render(<SignInPanel productName="OfCourse" overline="Student access" lede="Three futures." />)
  expect(panel()).toHaveAttribute('data-splash-target')
  expect(panel()).toHaveTextContent('OfCourse')
  expect(panel()).toHaveTextContent('Student access')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pick up whereyou left off.')
})

it('stays light in a dark page: the hero is marked data-theme="light"', () => {
  render(<SignInPanel productName="OfCourse" lede="Three futures." />)
  expect(panel()).toHaveAttribute('data-theme', 'light')
})

it('moves the crosshair once per frame, not once per pointer event', () => {
  const frames: FrameRequestCallback[] = []
  window.requestAnimationFrame = (cb) => {
    frames.push(cb)
    return frames.length
  }
  render(<SignInPanel productName="OfCourse" lede="Three futures." />)
  fireEvent.mouseMove(panel(), { clientX: 12, clientY: 30 })
  fireEvent.mouseMove(panel(), { clientX: 40, clientY: 50 })
  expect(frames).toHaveLength(1)
  expect(panel().style.getPropertyValue('--mx')).toBe('')
  act(() => frames[0](0))
  expect(panel().style.getPropertyValue('--mx')).toBe('40px')
  expect(panel().style.getPropertyValue('--my')).toBe('50px')
  expect(panel()).toHaveTextContent('X 0040 · Y 0050')
})

it('holds its loops still while the tab is hidden', () => {
  render(<SignInPanel productName="OfCourse" lede="Three futures." />)
  expect(panel()).not.toHaveAttribute('data-paused')
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(panel()).toHaveAttribute('data-paused')
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(panel()).not.toHaveAttribute('data-paused')
})
