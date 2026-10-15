import { describe, expect, it } from 'bun:test'
import { scriptShare } from '../text/script'
import { LANGUAGE_IDS, LANGUAGES, languageById, linesOf, parseLanguages, parseLines } from './index'

// The language file (GD36): the four languages a post can be written in, parsed at load as the
// emotions are, each with its native name, its script and the home country it is shown to.

describe('languages', () => {
  it('lists English, Nepali, Hindi and Thai in order, English first as the default', () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual([...LANGUAGE_IDS])
    expect(LANGUAGES).toEqual([
      { id: 'en', label: 'English', nativeLabel: 'English', script: 'latin', home: null },
      { id: 'ne', label: 'Nepali', nativeLabel: 'नेपाली', script: 'devanagari', home: 'NP' },
      { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', script: 'devanagari', home: 'IN' },
      { id: 'th', label: 'Thai', nativeLabel: 'ไทย', script: 'thai', home: 'TH' },
    ])
  })

  it('finds a language by id, null for an unknown one', () => {
    expect(languageById('ne')?.label).toBe('Nepali')
    expect(languageById('NE')).toBeNull()
    expect(languageById('fr')).toBeNull()
    expect(languageById('')).toBeNull()
  })

  it('refuses a file with a language missing, repeated or out of order, or an unknown script', () => {
    const en = { id: 'en', label: 'English', nativeLabel: 'English', script: 'latin', home: null }
    const ne = { id: 'ne', label: 'Nepali', nativeLabel: 'नेपाली', script: 'devanagari', home: 'NP' }
    const hi = { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', script: 'devanagari', home: 'IN' }
    const th = { id: 'th', label: 'Thai', nativeLabel: 'ไทย', script: 'thai', home: 'TH' }
    expect(parseLanguages([en, ne, hi, th])).toHaveLength(4)
    expect(() => parseLanguages([en, ne, hi])).toThrow()
    expect(() => parseLanguages([en, ne, hi, th, th])).toThrow()
    expect(() => parseLanguages([ne, en, hi, th])).toThrow()
    expect(() => parseLanguages([en, ne, hi, { ...th, script: 'arabic' }])).toThrow()
  })
})

// The lines code writes on a post (GD39): the search line, "Read the full guide", "Sources",
// the swipe cue and the caption's sources heading, one set per language, in one repo file.
describe('fixed lines (GD39)', () => {
  const en = {
    search: 'To find this again, search “OfCourse {title}”',
    guide: 'Read the full guide',
    sources: 'Sources',
    swipe: 'Swipe',
    captionSources: 'Sources',
  }

  it('keeps the English lines as they always were, and English for no language', () => {
    expect(linesOf('en')).toEqual(en)
    expect(linesOf(undefined)).toEqual(en)
    expect(linesOf(null)).toEqual(en)
  })

  it('writes every language’s lines in its own script, its search line keeping “OfCourse {title}”', () => {
    for (const language of LANGUAGES) {
      const lines = linesOf(language.id)
      expect(lines.search).toContain('“OfCourse {title}”')
      if (language.id === 'en') continue
      const { search, ...rest } = lines
      for (const text of [search.replace('“OfCourse {title}”', ''), ...Object.values(rest)]) {
        expect({ id: language.id, text, share: scriptShare(text, language.script) }).toEqual({
          id: language.id,
          text,
          share: 1,
        })
      }
    }
  })

  it('refuses a file with a language missing, a line empty, or a search line without “OfCourse {title}”', () => {
    const file = { en, ne: en, hi: en, th: en }
    expect(Object.keys(parseLines(file))).toEqual([...LANGUAGE_IDS])
    expect(() => parseLines({ en, ne: en, hi: en })).toThrow()
    expect(() => parseLines({ ...file, th: { ...en, swipe: '' } })).toThrow()
    expect(() => parseLines({ ...file, ne: { ...en, search: 'Search “{title}”' } })).toThrow()
    expect(() => parseLines({ ...file, hi: { ...en, search: 'Search “OfCourse”' } })).toThrow()
  })
})
