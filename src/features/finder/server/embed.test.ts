// The embedding call under the fake provider: its size, its determinism, the shared-word rule a
// bag-of-words vector gives, the pool the scripts share, the query cache (hers alone), the model's
// name, the warm-up at server start and the forced failure. No live call here.

import { describe, expect, mock, spyOn, test } from 'bun:test'

process.env.AI_PROVIDER = 'fake'
mock.module('server-only', () => ({}))

const { EMBED_DIMS, EMBED_MODEL, embedAll, embedModelName, embedQuery, embedTexts, warmUp } =
  await import('./embed')

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}

describe('embedTexts under the fake provider', () => {
  test('one text gives one vector of EMBED_DIMS (768) numbers', async () => {
    const vectors = await embedTexts(['a b'], 'RETRIEVAL_QUERY')
    expect(EMBED_DIMS).toBe(768)
    expect(vectors.length).toBe(1)
    expect(vectors[0].length).toBe(768)
  })

  test('the same text gives the same vector', async () => {
    const [a, b] = await embedTexts(
      ['Nursing with patient care', 'Nursing with patient care'],
      'RETRIEVAL_DOCUMENT',
    )
    expect(a.join(',')).toBe(b.join(','))
  })

  test('texts sharing a word are similar; texts sharing none are not', async () => {
    const [nursing, care, code] = await embedTexts(
      ['nursing degree', 'patient nursing', 'software engineering'],
      'RETRIEVAL_DOCUMENT',
    )
    expect(cosine(nursing, care)).toBeGreaterThan(0)
    expect(cosine(nursing, code)).toBe(0)
  })

  test('fails when the text asks it to', async () => {
    await expect(embedTexts(['robots [fake:fail-embed]'], 'RETRIEVAL_QUERY')).rejects.toThrow()
  })
})

describe('embedAll', () => {
  test('gives one vector per text, in order, and reports each one done', async () => {
    const done: string[] = []
    const vectors = await embedAll(['nursing', 'software', 'nursing'], 'RETRIEVAL_DOCUMENT', {
      retries: 8,
      onProgress: (n, total) => done.push(`${n}/${total}`),
    })
    expect(vectors.length).toBe(3)
    expect(vectors[2].join(',')).toBe(vectors[0].join(','))
    expect(cosine(vectors[0], vectors[1])).toBe(0)
    expect(done).toEqual(['1/3', '2/3', '3/3'])
  })
})

describe('embedQuery', () => {
  test('the second call for the same text is served from the cache', async () => {
    const first = await embedQuery('student-1', 'x')
    const second = await embedQuery('student-1', 'x')
    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(second.vector.join(',')).toBe(first.vector.join(','))
  })

  test('is cached for the student who searched, never for another with the same words', async () => {
    expect((await embedQuery('student-a', 'robots and puzzles')).cached).toBe(false)
    expect((await embedQuery('student-a', 'gardens')).cached).toBe(false)
    expect((await embedQuery('student-b', 'robots and puzzles')).cached).toBe(false)
    expect((await embedQuery('student-a', ' robots and puzzles ')).cached).toBe(true)
  })
})

describe('embedModelName', () => {
  test('fake under the fake provider, else GEMINI_EMBEDDING_MODEL, else EMBED_MODEL', () => {
    expect(embedModelName({ AI_PROVIDER: 'fake', GEMINI_EMBEDDING_MODEL: 'other' })).toBe('fake')
    expect(embedModelName({ GEMINI_EMBEDDING_MODEL: 'other' })).toBe('other')
    expect(embedModelName({})).toBe(EMBED_MODEL)
  })
})

describe('warmUp', () => {
  test('embeds once with the finder on, never under tests, the fake provider or the finder off', async () => {
    const embed = mock(async (_texts: readonly string[], _task: string): Promise<number[][]> => {
      throw new Error('the model said no to "warm up"')
    })
    const logged = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const on = { FINDER_ON: '1', NODE_ENV: 'production' }
      warmUp({ ...on, NODE_ENV: 'test' }, embed)
      warmUp({ ...on, AI_PROVIDER: 'fake' }, embed)
      warmUp({ NODE_ENV: 'production' }, embed)
      warmUp({ ...on, STUDENT_AI_OFF: '1' }, embed)
      expect(embed).not.toHaveBeenCalled()

      warmUp(on, embed)
      warmUp(on, embed)
      await Bun.sleep(0)
      expect(embed).toHaveBeenCalledTimes(1)
      // Its failure is swallowed and logged by name, with no text.
      expect(logged.mock.calls.map((args) => args.join(' '))).toEqual(['[finder.warm-up] Error'])
    } finally {
      logged.mockRestore()
    }
  })
})
