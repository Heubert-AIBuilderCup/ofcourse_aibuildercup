import { describe, expect, it } from 'bun:test'
import type { Fact, FeedSettings } from '../model/types'
import { PATHS, pathFacts } from './path-facts'
import { defaultSettings } from './settings-defaults'

const fact = (text: string, supported = true): Fact => ({
  id: text,
  text,
  value: null,
  ref: '¶1',
  quote: null,
  supported,
  why: null,
  span: null,
})

const GENERAL_EVERYONE_90: Omit<FeedSettings, 'tags'> = {
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'days', days: 90 },
  studioLink: null,
  sourcesAt: 'caption',
}

describe('defaultSettings (GD29)', () => {
  it('starts General, for everyone, for 90 days, the sources in the caption (GD31), with no tag when the facts name no place or theme', () => {
    expect(defaultSettings([fact('Rents rose by a tenth last year.')])).toEqual({
      ...GENERAL_EVERYONE_90,
      tags: [],
    })
  })

  it('tags the destination a city or country names, and the theme the facts name', () => {
    expect(
      defaultSettings([
        fact('Students in Perth who work up to 20 hours a week kept their grades.'),
        fact('Rents in Sydney rose.'),
      ]).tags,
    ).toEqual(['destination:AU', 'theme:work-study-life'])
    expect(
      defaultSettings([fact('The United Kingdom and New Zealand ask for the same visa fee.')]).tags,
    ).toEqual(['destination:UK', 'destination:NZ'])
    expect(
      defaultSettings([fact('Most students read two books and see a film a month.')]).tags,
    ).toEqual(['theme:books-movies'])
  })

  it('tags no home country, and reads only the supported facts', () => {
    expect(defaultSettings([fact('Most students here come from Nepal.')]).tags).toEqual([])
    expect(defaultSettings([fact('Rents in Sydney rose.', false)]).tags).toEqual([])
  })

  it("tags a Nepali, Hindi or Thai post with its language's home country, in the tag file's order (GD40)", () => {
    const facts = [fact('Rents in Sydney rose.')]
    expect(defaultSettings(facts, 'ne').tags).toEqual(['destination:AU', 'home:NP'])
    expect(defaultSettings(facts, 'hi').tags).toEqual(['destination:AU', 'home:IN'])
    expect(defaultSettings(facts, 'th').tags).toEqual(['destination:AU', 'home:TH'])
    expect(defaultSettings(facts, 'en').tags).toEqual(['destination:AU'])
  })
})

describe('defaultSettings for a comic (RC15)', () => {
  it("tags every path's facts for Australia, from the city they name", () => {
    for (const path of PATHS) {
      expect(defaultSettings(pathFacts(path.id)?.facts ?? []).tags).toContain('destination:AU')
    }
  })
})
