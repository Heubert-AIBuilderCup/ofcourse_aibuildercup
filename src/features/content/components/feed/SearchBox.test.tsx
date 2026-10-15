/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { Filters } from '../../lib/feed'
import { SearchBox } from './SearchBox'

afterEach(cleanup)

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: null,
  home: null,
  theme: null,
  age: null,
  q: '',
  ...over,
})

describe('SearchBox (83)', () => {
  it('is a GET form to the feed, a search landmark, whose q field holds the current words', () => {
    render(<SearchBox pathname="/feed" filters={F({ q: 'rent' })} />)
    const form = screen.getByRole('search')
    expect(form).toHaveAttribute('method', 'get')
    expect(form).toHaveAttribute('action', '/feed')
    const input = screen.getByRole('searchbox', { name: 'Search' })
    expect(input).toHaveAttribute('name', 'q')
    expect(input).toHaveValue('rent')
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('type', 'submit')
  })

  it('keeps the chips as hidden fields and leaves the empty ones out', () => {
    const { container } = render(
      <SearchBox pathname="/feed" filters={F({ home: 'NP', theme: 'books-movies' })} />,
    )
    const hidden = [...container.querySelectorAll('input[type="hidden"]')].map((i) => [
      i.getAttribute('name'),
      i.getAttribute('value'),
    ])
    expect(hidden).toEqual([
      ['home', 'NP'],
      ['theme', 'books-movies'],
    ])
  })
})
