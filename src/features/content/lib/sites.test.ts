import { describe, expect, it } from 'bun:test'
import { postSources, sourceNames } from './sites'

describe('postSources (GD31)', () => {
  it('lists each link of a source read from several once, in the order read', () => {
    const parts = [
      { url: 'https://abc.net.au/a', site: 'abc.net.au', title: 'Long hours', from: 1, to: 3 },
      { url: 'https://abc.net.au/a', site: 'abc.net.au', title: 'Long hours', from: 4, to: 5 },
      { url: 'https://study.gov.au/w', site: 'study.gov.au', title: 'Work rights', from: 6, to: 8 },
    ]
    expect(postSources({ title: 'Paid work', parts })).toEqual([
      { site: 'abc.net.au', title: 'Long hours', url: 'https://abc.net.au/a' },
      { site: 'study.gov.au', title: 'Work rights', url: 'https://study.gov.au/w' },
    ])
  })

  it('gives a source read from one link its site and link, and a pasted one its title alone', () => {
    expect(
      postSources({ title: 'Paid work', url: 'https://abc.net.au/a', site: 'abc.net.au' }),
    ).toEqual([{ site: 'abc.net.au', title: 'Paid work', url: 'https://abc.net.au/a' }])
    expect(postSources({ title: 'Paid work' })).toEqual([
      { site: null, title: 'Paid work', url: null },
    ])
  })

  it('never makes a link of an address that is not a web page', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'not a url']) {
      expect(postSources({ title: 'Paid work', url, site: 'abc.net.au' })[0].url).toBeNull()
    }
  })
})

describe('sourceNames (GD31)', () => {
  it('names each site once, a source with no site by its title', () => {
    expect(
      sourceNames([
        { site: 'abc.net.au', title: 'A', url: null },
        { site: 'abc.net.au', title: 'B', url: null },
        { site: null, title: 'Notes from the office', url: null },
      ]),
    ).toEqual(['abc.net.au', 'Notes from the office'])
  })
})
