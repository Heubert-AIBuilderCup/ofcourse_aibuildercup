import { describe, expect, it } from 'bun:test'
import { type Filters, filterHref, parseFilters } from './feed'
import { chipsFromProfile, type StudentProfile } from './profile-contract'

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: null,
  home: null,
  theme: null,
  age: null,
  q: '',
  ...over,
})

/** The filters a feed link opens with, as the page reads them. */
const opened = (href: string) =>
  parseFilters(Object.fromEntries(new URL(href, 'https://ofcourse.test').searchParams))

describe('chipsFromProfile (84)', () => {
  const profile: StudentProfile = {
    homeMarket: 'IN',
    destinations: ['UK', 'AU'],
    ageBand: 'under-21',
  }

  it('fills the chips of a URL with no filter key: the home market, the first destination, the age band', () => {
    expect(chipsFromProfile(profile, opened('/feed'))).toEqual(
      F({ home: 'IN', destination: 'UK', age: 'under-21', chosen: false }),
    )
  })

  it('stays out of a URL that names any filter, even an empty one: the URL wins whole', () => {
    expect(chipsFromProfile(profile, opened('/feed?home=NP&q=rent'))).toEqual(
      F({ home: 'NP', q: 'rent', chosen: true }),
    )
    expect(chipsFromProfile(profile, opened('/feed?q='))).toEqual(F({ chosen: true }))
  })

  it('lets Clear stick: a chip the profile filled stays clear, down to the last one', () => {
    let filters = chipsFromProfile(profile, opened('/feed'))
    for (const group of ['home', 'destination', 'age'] as const) {
      filters = chipsFromProfile(profile, opened(filterHref('/feed', filters, { [group]: null })))
      expect(filters[group]).toBeNull()
    }
    expect(filters).toEqual(F({ chosen: true }))
  })

  it('changes nothing with no profile, and ignores a value the tag file lacks', () => {
    expect(chipsFromProfile(null, opened('/feed?theme=books-movies'))).toEqual(
      F({ theme: 'books-movies', chosen: true }),
    )
    expect(
      chipsFromProfile({ homeMarket: null, destinations: ['XX', 'NZ'], ageBand: 'teen' }, F()),
    ).toEqual(F({ destination: 'NZ' }))
  })
})
