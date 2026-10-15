import { describe, expect, it } from 'bun:test'
import { MARKET_IDS } from '../markets'
import { groupOf, TAG_GROUPS, TAGS, tagById, tagsIn } from './index'

// The tag file (criteria 80, 92, ADR-122): four groups, ids "<group>:<value>", unique, and every
// home-country value a market id, since the home chip is also the market-version switch.

describe('tags', () => {
  it('names the four groups in form order', () => {
    expect(TAG_GROUPS).toEqual(['destination', 'home', 'theme', 'age'])
  })

  it('lists the destinations, home countries, themes and age bands with their labels', () => {
    expect(tagsIn('destination').map((t) => [t.id, t.label])).toEqual([
      ['destination:AU', 'Australia'],
      ['destination:UK', 'United Kingdom'],
      ['destination:NZ', 'New Zealand'],
      ['destination:US', 'United States'],
    ])
    expect(tagsIn('home').map((t) => [t.id, t.label])).toEqual([
      ['home:NP', 'Nepal'],
      ['home:IN', 'India'],
      ['home:TH', 'Thailand'],
    ])
    expect(tagsIn('theme').map((t) => [t.id, t.label])).toEqual([
      ['theme:work-study-life', 'Work and study life'],
      ['theme:books-movies', 'Books and movies'],
    ])
    expect(tagsIn('age').map((t) => [t.id, t.label])).toEqual([
      ['age:under-21', 'Under 21'],
      ['age:21-25', '21–25'],
      ['age:over-25', 'Over 25'],
    ])
  })

  it('gives every tag a unique id of the form "<group>:<value>"', () => {
    const ids = TAGS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of TAGS) {
      expect(t.id.startsWith(`${t.group}:`), t.id).toBe(true)
      expect(t.id.length, t.id).toBeGreaterThan(t.group.length + 1)
    }
  })

  it('keeps every home country a market id', () => {
    for (const t of tagsIn('home')) {
      expect(MARKET_IDS as readonly string[], t.id).toContain(t.id.slice('home:'.length))
    }
  })

  it('finds a tag by id, null for an unknown one', () => {
    expect(tagById('home:IN')).toEqual({ id: 'home:IN', group: 'home', label: 'India' })
    expect(tagById('home:in')).toBeNull()
    expect(tagById('theme:nope')).toBeNull()
    expect(tagById('')).toBeNull()
  })

  it('reads the group off an id, null when it is not a tag', () => {
    expect(groupOf('destination:AU')).toBe('destination')
    expect(groupOf('age:21-25')).toBe('age')
    expect(groupOf('nope:AU')).toBeNull()
    expect(groupOf('destination:XX')).toBeNull()
  })
})
