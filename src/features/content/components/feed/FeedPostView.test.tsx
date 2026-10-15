/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { FeedPost, Filters } from '../../lib/feed'
import { FeedPostView } from './FeedPostView'

afterEach(cleanup)

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: null,
  home: null,
  theme: null,
  age: null,
  q: '',
  ...over,
})

const POST: FeedPost = {
  id: 'p1',
  title: 'Paid work in Australia',
  approvedAt: '2026-10-07T09:00:00.000Z',
  settings: {
    layer: 'personal',
    audience: { mode: 'matched', rules: [] },
    whyLine: 'You weighted work rights highly.',
    expiry: { kind: 'none' },
    studioLink: 'Work rights weight',
    tags: [],
    sourcesAt: 'caption',
  },
  sourceLine: 'Source: Work rights guide · ¶2',
  sourceId: null,
  courseId: null,
  tags: [],
  main: {
    excerpt: 'Main excerpt.',
    slides: [
      { pngAssetId: 'png-main-1', alt: 'Slide 1: Main one' },
      { pngAssetId: 'png-main-2', alt: 'Slide 2: Main two' },
    ],
  },
  market: {
    id: 'NP',
    version: {
      excerpt: 'Nepal excerpt.',
      slides: [{ pngAssetId: 'png-np-1', alt: 'Slide 1: Nepal one' }],
    },
  },
  instagram: null,
}

describe('FeedPostView', () => {
  it('shows the tag, title, why line, Studio call to action as text, the slides and the source line', () => {
    render(<FeedPostView post={POST} filters={F()} />)
    expect(screen.getByText('For you')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Paid work in Australia' }),
    ).toBeInTheDocument()
    expect(screen.getByText('You weighted work rights highly.')).toBeInTheDocument()
    const cta = screen.getByText('Open your Studio · Work rights weighted')
    expect(cta.closest('a')).toBeNull()
    expect(screen.getByText('Source: Work rights guide · ¶2')).toBeInTheDocument()
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
      'Slide 1: Main one',
      'Slide 2: Main two',
    ])
  })

  it('shows the Nepal version when the home market is NP and keeps every filter in the link back to the feed', () => {
    render(<FeedPostView post={POST} filters={F({ home: 'NP', theme: 'books-movies' })} />)
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual([
      '/feed/assets/png-np-1',
    ])
    expect(screen.getByRole('link', { name: 'Feed' })).toHaveAttribute(
      'href',
      '/feed?home=NP&theme=books-movies',
    )
  })

  it('shows the main version to another market, and no tag or call to action for a bare General post', () => {
    const general: FeedPost = {
      ...POST,
      settings: { ...POST.settings, layer: 'general', whyLine: null, studioLink: null },
    }
    render(<FeedPostView post={general} filters={F({ home: 'IN' })} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.queryByText('For you')).toBeNull()
    expect(screen.queryByText(/Studio|ranked routes/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Feed' })).toHaveAttribute('href', '/feed?home=IN')
    expect(screen.queryByRole('link', { name: /Instagram|Follow @/ })).toBeNull()
  })

  it('links "Read the full guide" to its live blog in the feed, keeping the filters, and only when it has one (BR7)', () => {
    const guided: FeedPost = { ...POST, guide: { id: 'b1', slug: 'paid-work-in-australia' } }
    render(<FeedPostView post={guided} filters={F({ theme: 'books-movies' })} />)
    expect(screen.getByRole('link', { name: 'Read the full guide' })).toHaveAttribute(
      'href',
      '/feed/blog/b1?theme=books-movies',
    )
    cleanup()
    render(<FeedPostView post={{ ...POST, guide: null }} filters={F()} />)
    expect(screen.queryByRole('link', { name: 'Read the full guide' })).toBeNull()
  })

  it('names a Thai post’s guide link and its sources in Thai (GD39)', () => {
    const thai: FeedPost = {
      ...POST,
      language: 'th',
      guide: { id: 'b1', slug: 'paid-work-in-australia' },
      sources: [{ site: 'abc.net.au', title: 'Students who work', url: null }],
    }
    render(<FeedPostView post={thai} filters={F()} />)
    expect(screen.getByRole('link', { name: 'อ่านคู่มือฉบับเต็ม' })).toHaveAttribute(
      'href',
      '/feed/blog/b1',
    )
    expect(screen.getByRole('heading', { name: 'แหล่งที่มา' })).toBeInTheDocument()
    expect(screen.queryByText('Read the full guide')).toBeNull()
    // Labelled with its language's own name (GD40).
    expect(screen.getByText('ไทย')).toHaveAttribute('lang', 'th')
  })

  it('links the Instagram post and its page when the Instagram version has a recorded link (90)', () => {
    const linked: FeedPost = {
      ...POST,
      instagram: {
        url: 'https://www.instagram.com/p/C-abc123/',
        handle: 'ofcourse_philosophy',
        pageUrl: 'https://www.instagram.com/ofcourse_philosophy/',
      },
    }
    render(<FeedPostView post={linked} filters={F()} />)
    expect(screen.getByRole('link', { name: 'See this post on Instagram' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/p/C-abc123/',
    )
    expect(screen.getByRole('link', { name: 'Follow @ofcourse_philosophy' })).toHaveAttribute(
      'href',
      'https://www.instagram.com/ofcourse_philosophy/',
    )
  })
})
