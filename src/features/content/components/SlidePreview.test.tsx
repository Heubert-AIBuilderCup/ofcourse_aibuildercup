/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SlidePreview } from './SlidePreview'

afterEach(cleanup)

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
