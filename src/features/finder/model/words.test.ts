// The two word rules: the search's word-count gate counts every real word but true stopwords
// (contentWords); criterion 15's no-shared-words check also sets very common words aside
// (topicWords).
import { describe, expect, test } from 'bun:test'
import { contentWords, topicWords } from './words'

const Q3 = 'I like drawing and I want to make apps people enjoy using'

describe('contentWords', () => {
  test('counts the common words a student says about herself', () => {
    expect(contentWords(Q3).length).toBeGreaterThanOrEqual(3)
  })

  test('finds fewer than three words in a murmur or in punctuation', () => {
    expect(contentWords('hmm').length).toBeLessThan(3)
    expect(contentWords('...').length).toBeLessThan(3)
  })

  test('reads a contraction as one word, never its last letter', () => {
    expect(contentWords("I'm good").join(' ')).toBe("i'm good")
    expect(contentWords('It’s fine').join(' ')).toBe("it's fine")
  })
})

describe('topicWords', () => {
  test('sets the common words aside as well', () => {
    expect(topicWords(Q3).join(' ')).toBe('drawing')
  })
})
