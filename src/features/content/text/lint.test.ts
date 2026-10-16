import { describe, expect, it } from 'bun:test'
import { bannedPhrases, outcomePromises } from './lint'

describe('bannedPhrases', () => {
  it('finds each banned phrase once, in list order', () => {
    expect(bannedPhrases('The best way to unlock your journey')).toEqual([
      'best',
      'unlock',
      'journey',
    ])
  })

  it('matches whole words only', () => {
    expect(bannedPhrases('Bestow')).toEqual([])
  })

  it('finds nothing in plain words', () => {
    expect(bannedPhrases('Plain words.')).toEqual([])
  })

  it('ignores case and finds a repeated phrase once', () => {
    expect(bannedPhrases('BEST. Best. best.')).toEqual(['best'])
  })

  it('finds multi-word phrases and curly apostrophes', () => {
    expect(bannedPhrases('Don’t miss out, act now')).toEqual(["don't miss out", 'act now'])
  })
})

describe('outcomePromises', () => {
  it('finds the longest promise first, as written', () => {
    expect(outcomePromises('You will get PR. You will wait.')).toEqual(['You will get', 'You will'])
  })

  it('matches whole words, with curly apostrophes and percent', () => {
    expect(outcomePromises('Guaranteed, 100% sure, you’ll see; the guarantee holds')).toEqual([
      'Guaranteed',
      'guarantee',
      'you’ll',
      '100%',
    ])
    expect(outcomePromises('Rent felt lighter than in Sydney')).toEqual([])
  })
})
