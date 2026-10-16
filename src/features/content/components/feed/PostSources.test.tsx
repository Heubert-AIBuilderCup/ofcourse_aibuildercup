/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { PostSources } from './PostSources'

afterEach(cleanup)

describe('PostSources (GD31)', () => {
  it('lists each source by its site and title, linked to the page it was read from', () => {
    render(
      <PostSources
        sources={[
          { site: 'abc.net.au', title: 'Long hours', url: 'https://abc.net.au/a' },
          { site: 'study.gov.au', title: 'Work rights', url: 'https://study.gov.au/w' },
        ]}
      />,
    )
    const list = screen.getByRole('list', { name: 'Sources' })
    expect(list).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['abc.net.au · Long hours', 'https://abc.net.au/a'],
      ['study.gov.au · Work rights', 'https://study.gov.au/w'],
    ])
    for (const a of links) expect(a).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('names a source with no link by its title, as text', () => {
    render(<PostSources sources={[{ site: null, title: 'Notes from the office', url: null }]} />)
    expect(screen.getByText('Notes from the office')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
