/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { FeedPost, Filters } from '../../lib/feed'
import type { Related } from '../../lib/related'
import { RelatedPosts } from './RelatedPosts'

afterEach(cleanup)

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: [],
  home: null,
  theme: [],
  age: [],
  q: '',
  ...over,
})

function post(id: string, title: string): FeedPost {
  return {
    id,
    title,
    approvedAt: '2026-10-07T09:00:00.000Z',
    settings: {
      layer: 'general',
      audience: { mode: 'everyone', rules: [] },
      whyLine: null,
      expiry: { kind: 'none' },
      studioLink: null,
      tags: [],
      sourcesAt: 'caption',
    },
    sourceLine: null,
    sourceId: null,
    courseId: null,
    tags: [],
    main: { excerpt: `${title}.`, slides: [] },
    market: null,
    instagram: null,
  }
}

const RELATED: Related[] = [
  { post: post('p2', 'Rent in Sydney'), why: 'built on the same source' },
  { post: post('p3', 'Part-time hours'), why: 'also about Work and study life' },
]

describe('RelatedPosts (criterion 91)', () => {
  it('shows a Related heading, a link per post that keeps the filters, and the why line of each', () => {
    render(
      <RelatedPosts related={RELATED} filters={F({ home: 'NP', theme: ['work-study-life'] })} />,
    )
    expect(screen.getByRole('heading', { name: 'Related' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rent in Sydney' })).toHaveAttribute(
      'href',
      '/feed/p2?home=NP&theme=work-study-life',
    )
    expect(screen.getByRole('link', { name: 'Part-time hours' })).toHaveAttribute(
      'href',
      '/feed/p3?home=NP&theme=work-study-life',
    )
    expect(screen.getByText('built on the same source')).toBeInTheDocument()
    expect(screen.getByText('also about Work and study life')).toBeInTheDocument()
  })

  it('renders nothing with no related posts', () => {
    const { container } = render(<RelatedPosts related={[]} filters={F()} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Related' })).toBeNull()
  })
})
