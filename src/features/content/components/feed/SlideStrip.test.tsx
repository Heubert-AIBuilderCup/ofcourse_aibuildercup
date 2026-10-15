/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { FeedSlide } from '../../lib/feed'
import { SlideStrip } from './SlideStrip'

afterEach(cleanup)

const SLIDES: FeedSlide[] = [
  { pngAssetId: 'png-1', alt: 'Slide 1: Up to 20 hours a week' },
  { pngAssetId: 'png-2', alt: 'Slide 2: 48 hours a fortnight' },
  { pngAssetId: 'png-3', alt: 'Slide 3: Source: Work rights guide' },
]

describe('SlideStrip', () => {
  it('renders every slide as an image in order, each with its alt text (criterion 75)', () => {
    render(<SlideStrip slides={SLIDES} />)
    const images = screen.getAllByRole('img')
    expect(images.map((img) => img.getAttribute('alt'))).toEqual([
      'Slide 1: Up to 20 hours a week',
      'Slide 2: 48 hours a fortnight',
      'Slide 3: Source: Work rights guide',
    ])
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      '/feed/assets/png-1',
      '/feed/assets/png-2',
      '/feed/assets/png-3',
    ])
  })

  it('takes its images from the route it is given: the public one on a post page (107)', () => {
    render(<SlideStrip slides={SLIDES} assetHref={(id) => `/posts/assets/${id}`} />)
    const images = screen.getAllByRole('img')
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      '/posts/assets/png-1',
      '/posts/assets/png-2',
      '/posts/assets/png-3',
    ])
  })

  it('is an ordered list that snaps one slide per swipe at phone width and wraps wider, by its own width', () => {
    render(<SlideStrip slides={SLIDES} />)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('OL')
    expect(list.parentElement).toHaveClass('@container')
    for (const cls of ['flex', 'overflow-x-auto', 'snap-x', 'snap-mandatory', '@xl:flex-wrap']) {
      expect(list).toHaveClass(cls)
    }
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    for (const item of items) {
      expect(item).toHaveClass('snap-start')
      expect(item).toHaveClass('w-90')
    }
  })
})
