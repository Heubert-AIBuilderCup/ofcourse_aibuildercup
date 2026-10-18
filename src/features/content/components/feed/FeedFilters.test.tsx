/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  destination: [],
  home: null,
  theme: [],
  age: [],
  q: '',
  ...over,
})

const click = (el: HTMLElement) =>
  act(() => {
    fireEvent.click(el)
  })
/** Home country stays a one-choice dropdown; the other groups list their values as checkboxes. */
const dropdown = (name: string) => screen.getByRole('combobox', { name })
const group = (name: string) => screen.getByRole('group', { name })
const box = (groupName: string, name: string) =>
  within(group(groupName)).getByRole('checkbox', { name })
const ticked = (groupName: string) =>
  within(group(groupName))
    .getAllByRole('checkbox')
    .filter((c) => c.getAttribute('aria-checked') === 'true')
    .map((c) => c.getAttribute('aria-label') ?? c.id)
const choose = async (name: string, option: string) => {
  await click(dropdown(name))
  await click(screen.getByRole('option', { name: option }))
}

describe('FeedFilters (81, 82, 84)', () => {
  it('lists each group’s values as checkboxes in the tag file’s order, and home country as a dropdown', () => {
    render(<FeedFilters pathname="/feed" filters={F()} />)
    expect(
      within(group('Destination'))
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('aria-label')),
    ).toEqual(['Australia', 'United Kingdom', 'New Zealand', 'United States'])
    expect(dropdown('Home country').textContent).toBe('Home country')
    expect(screen.queryAllByRole('button', { name: /^Clear/ })).toHaveLength(0)
  })

  it('adds a value to a group, sending both, the other filters kept, without scrolling to the top', async () => {
    render(<FeedFilters pathname="/feed" filters={F({ destination: ['AU'], home: 'NP' })} />)
    await click(box('Destination', 'United Kingdom'))
    expect(push).toHaveBeenCalledWith('/feed?destination=AU&destination=UK&home=NP', {
      scroll: false,
    })
  })

  it('takes a ticked value away, leaving the others', async () => {
    render(<FeedFilters pathname="/feed" filters={F({ destination: ['AU', 'UK'] })} />)
    expect(ticked('Destination')).toEqual(['Australia', 'United Kingdom'])
    await click(box('Destination', 'Australia'))
    expect(push).toHaveBeenCalledWith('/feed?destination=UK', { scroll: false })
  })

  it('keeps home country to one choice, the market version it shows (82)', async () => {
    render(<FeedFilters pathname="/feed" filters={F({ home: 'NP', q: 'rent' })} />)
    await choose('Home country', 'India')
    expect(push).toHaveBeenLastCalledWith('/feed?home=IN&q=rent', { scroll: false })
  })

  it('offers Clear only on a group with a choice, and Clear drops that group alone', async () => {
    render(
      <FeedFilters
        pathname="/feed"
        filters={F({ home: 'NP', theme: ['work-study-life', 'books-movies'] })}
      />,
    )
    expect(within(group('Destination')).queryByRole('button', { name: 'Clear' })).toBeNull()
    await click(within(group('Theme')).getByRole('button', { name: 'Clear' }))
    expect(push).toHaveBeenCalledWith('/feed?home=NP', { scroll: false })
    await choose('Home country', 'Clear')
    expect(push).toHaveBeenLastCalledWith('/feed?theme=work-study-life&theme=books-movies', {
      scroll: false,
    })
  })

  it('clears every filter at once, still naming the filters so her roadmaps do not fill them again', async () => {
    render(
      <FeedFilters pathname="/feed" filters={F({ destination: ['AU'], home: 'NP', q: 'rent' })} />,
    )
    await click(screen.getByRole('button', { name: 'Clear all' }))
    expect(push).toHaveBeenCalledWith('/feed?q=', { scroll: false })
  })

  it('puts the Show group first, Updates with her count, Posts and Blogs, all ticked by default', () => {
    render(<FeedFilters pathname="/feed" filters={F()} updateCount={3} />)
    expect(screen.getAllByRole('group')[0]?.querySelector('legend')?.textContent).toBe('Show')
    expect(ticked('Show')).toEqual(['Updates (3)', 'Posts', 'Blogs'])
  })

  it('sends a `show` value per kind left ticked, the other filters kept', async () => {
    render(<FeedFilters pathname="/feed" filters={F({ home: 'NP' })} updateCount={0} />)
    await click(box('Show', 'Posts'))
    expect(push).toHaveBeenCalledWith('/feed?show=updates&show=blogs&home=NP', { scroll: false })
  })

  it('ticks a kind back, leaving `show` out once all three are, and sends an empty one for none', async () => {
    render(
      <FeedFilters pathname="/feed" filters={F({ show: ['updates', 'posts'] })} updateCount={2} />,
    )
    expect(ticked('Show')).toEqual(['Updates (2)', 'Posts'])
    await click(box('Show', 'Blogs'))
    expect(push).toHaveBeenLastCalledWith('/feed?q=', { scroll: false })
    cleanup()
    render(<FeedFilters pathname="/feed" filters={F({ show: ['updates'] })} updateCount={2} />)
    await click(box('Show', 'Updates (2)'))
    expect(push).toHaveBeenLastCalledWith('/feed?show=', { scroll: false })
  })

  it('shows the choices her roadmaps filled in, with no filter in the URL, as chosen', () => {
    const filters = chipsFromProfile(
      { homeMarket: 'NP', destinations: ['AU', 'UK'], ageBand: 'under-21' },
      parseFilters({}),
    )
    render(<FeedFilters pathname="/feed" filters={filters} />)
    expect(ticked('Destination')).toEqual(['Australia', 'United Kingdom'])
    expect(dropdown('Home country').textContent).toBe('Nepal')
    expect(ticked('Age')).toEqual(['Under 21'])
    expect(ticked('Theme')).toEqual([])
  })
})
