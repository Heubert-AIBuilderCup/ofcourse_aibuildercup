// Criterion 15: no demo query shares a content word (stopwords aside) with the description of any
// course it expects, so a hit comes from meaning, not from a shared word. Criterion 13: every
// negative case is long enough to reach the model, so it tests the search, not the word-count gate.
import { describe, expect, test } from 'bun:test'
import { FINDER_EXTRAS } from '../data/catalogue'
import { FINDER_MIN_WORDS } from '../model/config'
import { contentWords, topicWords } from '../model/words'
import { DEMO_QUERIES, NEGATIVE_QUERIES } from './queries'

describe('the demo queries', () => {
  for (const query of DEMO_QUERIES) {
    const expected = FINDER_EXTRAS.filter((e) => query.expect.includes(e.graphField))

    test(`"${query.text}" shares no content word with its expected courses`, () => {
      expect(expected.length).toBeGreaterThan(0)
      const words = new Set(topicWords(query.text))
      const shared = expected.flatMap((e) =>
        topicWords(e.description)
          .filter((w) => words.has(w))
          .map((w) => `${e.courseId}: ${w}`),
      )
      expect(shared).toEqual([])
    })
  }
})

describe('the negative cases', () => {
  for (const query of NEGATIVE_QUERIES) {
    test(`"${query.text}" has enough content words to reach the model`, () => {
      expect(contentWords(query.text).length).toBeGreaterThanOrEqual(FINDER_MIN_WORDS)
    })
  }
})
