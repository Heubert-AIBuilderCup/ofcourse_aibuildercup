import { describe, expect, it } from 'bun:test'
import { type Filters, filterHref, parseFilters } from './feed'
import { chipsFromProfile, type StudentProfile } from './profile-contract'

const F = (over: Partial<Filters> = {}): Filters => ({
  destination: [],
  home: null,
  theme: [],
  age: [],
  q: '',
  ...over,
})

/** The filters a feed link opens with, as the page reads them: a repeated key as its values. */
const opened = (href: string) => {
  const params = new URL(href, 'https://ofcourse.test').searchParams
  return parseFilters(
    Object.fromEntries(
      [...new Set(params.keys())].map((k) => {
        const all = params.getAll(k)
        return [k, all.length > 1 ? all : all[0]]
      }),
    ),
  )
}

describe('chipsFromProfile (84)', () => {
  const profile: StudentProfile = {
    homeMarket: 'IN',
    destinations: ['UK', 'AU'],
    ageBand: 'under-21',
  }

  it('fills the chips of a URL with no filter key: the home market, every destination, the age band', () => {
    expect(chipsFromProfile(profile, opened('/feed'))).toEqual(
      F({ home: 'IN', destination: ['AU', 'UK'], age: ['under-21'], chosen: false }),
    )
  })

  it('stays out of a URL that names any filter, even an empty one: the URL wins whole', () => {
    expect(chipsFromProfile(profile, opened('/feed?home=NP&q=rent'))).toEqual(
      F({ home: 'NP', q: 'rent', chosen: true }),
    )
    expect(chipsFromProfile(profile, opened('/feed?q='))).toEqual(F({ chosen: true }))
  })

  it('keeps several destinations through a link, and lets Clear stick down to the last one', () => {
    let filters = chipsFromProfile(profile, opened('/feed'))
    expect(chipsFromProfile(profile, opened(filterHref('/feed', filters, {})))).toEqual({
      ...filters,
      chosen: true,
    })
    const changes: Partial<Filters>[] = [{ home: null }, { destination: [] }, { age: [] }]
    for (const change of changes) {
      filters = chipsFromProfile(profile, opened(filterHref('/feed', filters, change)))
      expect(filters).toMatchObject(change)
    }
    expect(filters).toEqual(F({ chosen: true }))
  })

  it('changes nothing with no profile, and ignores a value the tag file lacks', () => {
    expect(chipsFromProfile(null, opened('/feed?theme=books-movies'))).toEqual(
      F({ theme: ['books-movies'], chosen: true }),
    )
    expect(
      chipsFromProfile({ homeMarket: null, destinations: ['XX', 'NZ'], ageBand: 'teen' }, F()),
    ).toEqual(F({ destination: ['NZ'] }))
  })
})
