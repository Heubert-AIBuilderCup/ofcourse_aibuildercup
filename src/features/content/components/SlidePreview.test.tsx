/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, jest } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SlidePreview, SlideThumbnail } from './SlidePreview'

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

it('draws a draft slide from the preview route', () => {
  render(
    <SlidePreview slide={2} draft={{ postId: 'p1', draftsId: 'd1', index: 1, themeId: 'ink' }} />,
  )
  expect(screen.getByRole('img', { name: /^Slide 2\b/ })).toHaveAttribute(
    'src',
    '/admin/posts/p1/preview?drafts=d1&i=1&slide=2&theme=ink',
  )
})

it('draws an approved layout slide from the preview route', () => {
  render(<SlidePreview slide={1} layout={{ postId: 'p1', layoutId: 'l1' }} />)
  expect(screen.getByRole('img', { name: /^Slide 1\b/ })).toHaveAttribute(
    'src',
    '/admin/posts/p1/preview?layout=l1&slide=1',
  )
})

it('names a slide by its words, so a screen reader reads what the picture says', () => {
  render(<SlidePreview slide={2} assetId="a1" text={['Grades hold', 'up to 20 hours a week.']} />)
  expect(screen.getByRole('img')).toHaveAttribute(
    'alt',
    'Slide 2: Grades hold up to 20 hours a week.',
  )
})

it('shows a rendered slide from its stored image', () => {
  render(<SlidePreview slide={3} assetId="a1" />)
  expect(screen.getByRole('img', { name: /^Slide 3\b/ })).toHaveAttribute('src', '/admin/assets/a1')
})

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })
const FAILED = "This slide's preview didn't load."
const srcOfSlide = () => screen.getByRole('img', { name: /^Slide 2\b/ }).getAttribute('src')

// Production (18 Oct): a preview that failed showed as a broken image with its alt text, and the
// filmstrip's layout collapsed.
it('a preview that fails to load is asked for again once after 2 s, then says so with a Retry for that image', () => {
  jest.useFakeTimers()
  render(<SlidePreview slide={2} layout={{ postId: 'p1', layoutId: 'l1', planId: 'pl1' }} />)
  const img = screen.getByRole('img', { name: /^Slide 2\b/ })
  fireEvent.error(img)
  // The broken picture is hidden (its alt stays for a screen reader) while it waits to ask again.
  expect(img.getAttribute('class')).toContain('sr-only')
  expect(screen.queryByText(FAILED)).toBeNull()
  advance(1999)
  expect(srcOfSlide()).toBe('/admin/posts/p1/preview?layout=l1&slide=2&plan=pl1')
  advance(1)
  expect(srcOfSlide()).toBe('/admin/posts/p1/preview?layout=l1&slide=2&plan=pl1&retry=1')
  expect(img.getAttribute('class')).not.toContain('sr-only')

  // The second failure is not retried by itself: the slide's place says so, with Retry.
  fireEvent.error(img)
  advance(5000)
  expect(screen.getByText(FAILED).textContent).toBe(FAILED)
  expect(srcOfSlide()).toBe('/admin/posts/p1/preview?layout=l1&slide=2&plan=pl1&retry=1')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(srcOfSlide()).toBe('/admin/posts/p1/preview?layout=l1&slide=2&plan=pl1&retry=2')
  expect(screen.queryByText(FAILED)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
})

it('a stored image asks again with its own query', () => {
  jest.useFakeTimers()
  render(<SlidePreview slide={2} assetId="a1" />)
  fireEvent.error(screen.getByRole('img', { name: /^Slide 2\b/ }))
  advance(2000)
  expect(srcOfSlide()).toBe('/admin/assets/a1?retry=1')
})

it('a filmstrip thumbnail that fails shows a small "!", with no words and no Retry', () => {
  jest.useFakeTimers()
  render(
    <SlideThumbnail>
      <SlidePreview slide={2} assetId="a1" />
    </SlideThumbnail>,
  )
  const img = screen.getByRole('img', { name: /^Slide 2\b/ })
  fireEvent.error(img)
  advance(2000)
  fireEvent.error(img)
  expect(screen.getByText('!').textContent).toBe('!')
  expect(screen.queryByText(FAILED)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  expect(img.getAttribute('class')).toContain('sr-only')
})
