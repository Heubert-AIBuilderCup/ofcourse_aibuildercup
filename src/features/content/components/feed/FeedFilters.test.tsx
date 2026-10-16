/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Filters } from '../../lib/feed'

const push = mock((_href: string, _options?: { scroll?: boolean }) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {}, back: () => {} }),
}))

const { chipsFromProfile } = await import('../../lib/profile-contract')
const { parseFilters } = await import('../../lib/feed')
const { FeedFilters } = await import('./FeedFilters')

afterEach(() => {
  cleanup()
  push.mockClear()
})

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: null,
  home: null,
  theme: null,
  age: null,
  q: '',
  ...over,
})

const click = (el: HTMLElement) =>
  act(() => {
    fireEvent.click(el)
  })
const dropdown = (name: string) => screen.getByRole('combobox', { name })
const choose = async (group: string, option: string) => {
  await click(dropdown(group))
  await click(screen.getByRole('option', { name: option }))
}

describe('FeedFilters (81, 82, 84)', () => {
  it('offers one dropdown per group, each showing the group’s name with nothing chosen', () => {
    render(<FeedFilters pathname="/feed" filters={F()} />)
    for (const name of ['Destination', 'Home country', 'Theme', 'Age'])
      expect(dropdown(name).textContent).toBe(name)
  })

  it('moves to the URL the chip led to, the other filters kept, without scrolling to the top', async () => {
    render(<FeedFilters pathname="/feed" filters={F({ home: 'NP', q: 'rent' })} />)
    await choose('Destination', 'Australia')
    expect(push).toHaveBeenCalledWith('/feed?destination=AU&home=NP&q=rent', { scroll: false })
    await choose('Home country', 'India')
    expect(push).toHaveBeenLastCalledWith('/feed?home=IN&q=rent', { scroll: false })
  })

  it('offers Clear only on a group with a choice, and Clear drops that group alone', async () => {
    render(<FeedFilters pathname="/feed" filters={F({ home: 'NP' })} />)
    await click(dropdown('Theme'))
    expect(screen.queryByRole('option', { name: 'Clear' })).toBeNull()
    cleanup()

    render(<FeedFilters pathname="/feed" filters={F({ home: 'NP', theme: 'books-movies' })} />)
    await choose('Home country', 'Clear')
    expect(push).toHaveBeenCalledWith('/feed?theme=books-movies', { scroll: false })
  })

  it('keeps naming the filters once the last is cleared, so the profile does not fill it again', async () => {
    render(<FeedFilters pathname="/feed" filters={F({ home: 'NP' })} />)
    await choose('Home country', 'Clear')
    expect(push).toHaveBeenCalledWith('/feed?q=', { scroll: false })
  })

  it('shows the choices her profile filled in, with no filter in the URL, as chosen', async () => {
    const filters = chipsFromProfile(
      { homeMarket: 'NP', destinations: ['AU'], ageBand: 'under-21' },
      parseFilters({}),
    )
    render(<FeedFilters pathname="/feed" filters={filters} />)
    expect(dropdown('Destination').textContent).toBe('Australia')
    expect(dropdown('Home country').textContent).toBe('Nepal')
    expect(dropdown('Age').textContent).toBe('Under 21')
    expect(dropdown('Theme').textContent).toBe('Theme')
    await click(dropdown('Destination'))
    expect(screen.getByRole('option', { name: 'Australia' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })
})
