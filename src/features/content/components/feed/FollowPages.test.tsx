/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { Brand } from '../../model/types'
import { FollowPages } from './FollowPages'

afterEach(cleanup)

const brand = (id: string, handle: string | null, linkedin: string | null = null): Brand => ({
  id,
  name: id,
  kind: 'page',
  fonts: {
    heading: { family: 'Barlow Condensed', file: 'BarlowCondensed-Bold.ttf' },
    body: { family: 'Barlow', file: 'Barlow-Regular.ttf' },
  },
  tone: 'Plain.',
  byline: `OfCourse ${id}`,
  themes: [{ id, name: id, bg: '#FFFFFF', ink: '#000000', highlight: '#F5C542', muted: '#777777' }],
  instagram: handle ? { handle, url: `https://www.instagram.com/${handle}/` } : null,
  linkedin: linkedin ? { url: `https://www.linkedin.com/company/${linkedin}/` } : null,
})

describe('FollowPages', () => {
  it('lists every page brand with an Instagram handle under "Follow OfCourse on Instagram" (88)', () => {
    render(
      <FollowPages
        brands={[
          brand('main', 'ofcourse_ai'),
          brand('old', null),
          brand('c', 'ofcourse_philosophy'),
        ]}
      />,
    )
    expect(screen.getByText('Follow OfCourse on Instagram')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['@ofcourse_ai', 'https://www.instagram.com/ofcourse_ai/'],
      ['@ofcourse_philosophy', 'https://www.instagram.com/ofcourse_philosophy/'],
    ])
  })

  it('lists the repo’s four pages by default', () => {
    render(<FollowPages />)
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      '@ofcourse_ai',
      '@ofcourse_philosophy',
      '@ofcourse_selfhelp',
      '@ofcourse_comics',
    ])
  })

  it('under "Follow us", lists each page on Instagram, then each on LinkedIn by its byline (BR9)', () => {
    render(
      <FollowPages
        linkedin
        brands={[
          brand('main', 'ofcourse_ai', 'ofcourse-ai'),
          brand('old', null),
          brand('c', null, 'ofcourse-c'),
        ]}
      />,
    )
    expect(screen.getByText('Follow us')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['@ofcourse_ai', 'https://www.instagram.com/ofcourse_ai/'],
      ['OfCourse main', 'https://www.linkedin.com/company/ofcourse-ai/'],
      ['OfCourse c', 'https://www.linkedin.com/company/ofcourse-c/'],
    ])
  })

  it('shows nothing when no brand has a page', () => {
    const { container } = render(<FollowPages brands={[brand('old', null)]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
