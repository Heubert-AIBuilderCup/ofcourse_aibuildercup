/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { FeedBlog, FeedPost, FeedVersion, Filters } from '../../lib/feed'
import type { FeedSettings } from '../../model/types'
import { FeedList } from './FeedList'

afterEach(cleanup)

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: null,
  home: null,
  theme: null,
  age: null,
  q: '',
  ...over,
})

const GENERAL: FeedSettings = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
}

const MAIN: FeedVersion = {
  excerpt: 'Main excerpt.',
  slides: [
    { pngAssetId: 'png-main-1', alt: 'Slide 1: Main' },
    { pngAssetId: 'png-main-2', alt: 'Slide 2: More' },
  ],
}
const NEPAL: FeedVersion = {
  excerpt: 'Nepal excerpt.',
  slides: [{ pngAssetId: 'png-np-1', alt: 'Slide 1: Nepal' }],
}

const post = (over: Partial<FeedPost> & { id: string; title: string }): FeedPost => ({
  approvedAt: '2026-10-07T09:00:00.000Z',
  settings: GENERAL,
  sourceLine: 'Source: Work rights guide · ¶2',
  sourceId: null,
  courseId: null,
  tags: [],
  main: MAIN,
  market: null,
  instagram: null,
  ...over,
})

const POSTS: FeedPost[] = [
  post({
    id: 'p1',
    title: 'Paid work in Australia',
    settings: {
      ...GENERAL,
      layer: 'personal',
      audience: { mode: 'matched', rules: [] },
      whyLine: 'You weighted work rights highly.',
    },
    market: { id: 'NP', version: NEPAL },
  }),
  post({ id: 'p2', title: 'Rent in Manchester' }),
]

describe('FeedList', () => {
  it('renders a card per post with its title, and "For you" on the Personal one', () => {
    render(<FeedList posts={POSTS} filters={F()} liveCount={2} />)
    expect(screen.getByText('Paid work in Australia')).toBeInTheDocument()
    expect(screen.getByText('Rent in Manchester')).toBeInTheDocument()
    expect(screen.getAllByText('For you')).toHaveLength(1)
    // No market: both show their main version.
    expect(screen.getAllByText('Main excerpt.')).toHaveLength(2)
  })

  it('links each title to its post page and each cover to the feed image route', () => {
    render(<FeedList posts={POSTS} filters={F()} liveCount={2} />)
    expect(screen.getByRole('link', { name: 'Paid work in Australia' })).toHaveAttribute(
      'href',
      '/feed/p1',
    )
    expect(screen.getByRole('link', { name: 'Rent in Manchester' })).toHaveAttribute(
      'href',
      '/feed/p2',
    )
    expect(screen.getByRole('img', { name: 'Cover of Paid work in Australia' })).toHaveAttribute(
      'src',
      '/feed/assets/png-main-1',
    )
  })

  it('keeps every filter in every link and shows the Nepal version under home=NP where there is one', () => {
    render(<FeedList posts={POSTS} filters={F({ home: 'NP', q: 'rent' })} liveCount={2} />)
    expect(screen.getByRole('link', { name: 'Paid work in Australia' })).toHaveAttribute(
      'href',
      '/feed/p1?home=NP&q=rent',
    )
    expect(screen.getByRole('link', { name: 'Rent in Manchester' })).toHaveAttribute(
      'href',
      '/feed/p2?home=NP&q=rent',
    )
    expect(screen.getByText('Nepal excerpt.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Cover of Paid work in Australia' })).toHaveAttribute(
      'src',
      '/feed/assets/png-np-1',
    )
    // The post with no Nepal version shows its main one.
    expect(screen.getByText('Main excerpt.')).toBeInTheDocument()
  })

  it('shows a blog as a blog card: its cover from the blog image route, its reading time, and a link to its page in the feed with the filters kept (BR11)', () => {
    const blog: FeedBlog = {
      kind: 'blog',
      id: 'b1',
      title: 'How many hours can I work?',
      slug: 'how-many-hours',
      approvedAt: '2026-10-07T10:00:00.000Z',
      settings: GENERAL,
      tags: [],
      cover: { assetId: 'png-cover', alt: 'A student at a café counter' },
      minutes: 6,
      text: '',
    }
    render(
      <FeedList posts={[blog, ...POSTS]} filters={F({ theme: 'work-study-life' })} liveCount={3} />,
    )
    expect(screen.getByRole('link', { name: 'How many hours can I work?' })).toHaveAttribute(
      'href',
      '/feed/blog/b1?theme=work-study-life',
    )
    expect(screen.getByRole('img', { name: 'A student at a café counter' })).toHaveAttribute(
      'src',
      '/blog/assets/png-cover',
    )
    expect(screen.getByText('6 min read')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('labels a Nepali post’s card and a Thai blog’s card with their language’s own name (GD40)', () => {
    const thai: FeedBlog = {
      kind: 'blog',
      id: 'b-th',
      title: 'ทำงานได้กี่ชั่วโมง',
      slug: 'b-th',
      approvedAt: '2026-10-07T10:00:00.000Z',
      settings: GENERAL,
      tags: [],
      cover: null,
      minutes: 3,
      text: '',
      language: 'th',
    }
    const nepali = post({ id: 'p-ne', title: 'काम र पढाइ', language: 'ne' })
    render(<FeedList posts={[thai, nepali, ...POSTS]} filters={F()} liveCount={4} />)
    expect(screen.getByText('ไทย')).toHaveAttribute('lang', 'th')
    expect(screen.getByText('नेपाली')).toHaveAttribute('lang', 'ne')
  })

  it('reads "Nothing in the feed yet." with no live posts', () => {
    render(<FeedList posts={[]} filters={F()} liveCount={0} />)
    expect(screen.getByText('Nothing in the feed yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('reads "No posts match." when the filters leave nothing of a feed that has posts (83)', () => {
    render(<FeedList posts={[]} filters={F({ q: 'nothing' })} liveCount={2} />)
    expect(screen.getByText('No posts match.')).toBeInTheDocument()
    expect(screen.queryByText('Nothing in the feed yet.')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
