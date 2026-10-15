import { describe, expect, it } from 'bun:test'
import type { Fact } from '../model/types'
import { placesIn } from './places'

const fact = (id: string, text: string): Fact => ({
  id,
  text,
  value: null,
  ref: '¶1',
  quote: null,
  supported: true,
  why: null,
  span: null,
})

describe('placesIn (GD7)', () => {
  it('finds a city and a country the facts name, each once', () => {
    const facts = [
      fact('f1', 'Rents in Perth rose this year.'),
      fact('f2', 'Students across australia and in PERTH say so.'),
    ]
    expect(placesIn(facts)).toEqual(['Perth', 'Australia'])
  })

  it('finds nothing in a fact without places, nor a name inside another word', () => {
    expect(placesIn([fact('f1', 'Working up to 20 hours a week did not hurt grades.')])).toEqual([])
    expect(
      placesIn([fact('f1', 'Hindia and Perthshire are not places here; nor is UKulele.')]),
    ).toEqual([])
  })

  it('finds the short country names on word boundaries', () => {
    expect(placesIn([fact('f1', 'Graduates from the UK and the USA.')])).toEqual(['UK', 'USA'])
  })
})
