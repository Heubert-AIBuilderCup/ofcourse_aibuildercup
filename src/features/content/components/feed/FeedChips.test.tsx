/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { Filters } from '../../lib/feed'
import { FeedChips } from './FeedChips'

afterEach(cleanup)

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: null,
  home: null,
  theme: null,
  age: null,
  q: '',
  ...over,
})

const ROWS: [string, string[]][] = [
  ['Destination', ['Australia', 'United Kingdom', 'New Zealand', 'United States']],
  ['Home country', ['Nepal', 'India', 'Thailand']],
  ['Theme', ['Work and study life', 'Books and movies']],
  ['Age', ['Under 21', '21–25', 'Over 25']],
]

describe('FeedChips (81, 82)', () => {
  it('renders four rows of link chips from the tag file, in the file order', () => {
    render(<FeedChips pathname="/feed" filters={F()} />)
    for (const [name, labels] of ROWS) {
      const row = screen.getByRole('group', { name })
      expect(
        within(row)
          .getAllByRole('link')
          .map((l) => l.textContent),
      ).toEqual(labels)
    }
    expect(screen.queryByRole('link', { name: 'Clear' })).toBeNull()
  })

  it('links each chip to the page with its own filter set and the others kept', () => {
    render(<FeedChips pathname="/feed" filters={F({ home: 'NP', q: 'rent' })} />)
    expect(screen.getByRole('link', { name: 'Australia' })).toHaveAttribute(
      'href',
      '/feed?destination=AU&home=NP&q=rent',
    )
    expect(screen.getByRole('link', { name: 'Books and movies' })).toHaveAttribute(
      'href',
      '/feed?home=NP&theme=books-movies&q=rent',
    )
    expect(screen.getByRole('link', { name: 'India' })).toHaveAttribute(
      'href',
      '/feed?home=IN&q=rent',
    )
  })

  it('marks the active chip with aria-current and offers Clear in that row alone', () => {
    render(<FeedChips pathname="/feed/p1" filters={F({ home: 'NP' })} />)
    expect(screen.getByRole('link', { name: 'Nepal' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'India' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Nepal' })).not.toHaveAttribute('aria-pressed')
    const clears = screen.getAllByRole('link', { name: 'Clear' })
    expect(clears).toHaveLength(1)
    // Still a chosen URL once cleared, so the profile does not fill the chip again (84).
    expect(clears[0]).toHaveAttribute('href', '/feed/p1?q=')
    expect(
      within(screen.getByRole('group', { name: 'Home country' })).getByRole('link', {
        name: 'Clear',
      }),
    ).toBe(clears[0])
  })
})
