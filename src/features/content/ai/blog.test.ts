// A blog's outline (BR2) and its text (BR3), with the fake provider and an in-memory call log and
// cache: no network, no database. Code checks the sections' count and question headings, the
// takeaways, the FAQ and every number against the facts; the text's length, fact ids, banned
// phrases and numbers against its bound facts.

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from './client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '1000'

const store = new Map<string, unknown>()
const memoryCache: Cache = {
  get: async (key) => store.get(key) ?? null,
  put: async (key, row) => {
    store.set(key, row.value)
  },
}
const memoryCalls: CallLog = {
  countToday: async () => 0,
  record: async () => {},
  reserve: async () => 'reserved',
  settle: async () => {},
}

mock.module('server-only', () => ({}))
mock.module('./calls', () => ({ dbCallLog: memoryCalls }))
mock.module('./cache', () => ({ dbCache: memoryCache }))

const client = await import('./client')
const { aiConfig } = await import('./config')
const { makeFake } = await import('./fake')
const fakeProvider = makeFake()
let provider: Provider = fakeProvider
const memoryAi = client.makeAi({
  provider: { json: (req) => provider.json(req), image: (req) => provider.image(req) },
  config: aiConfig(process.env),
  calls: memoryCalls,
  cache: memoryCache,
  sleep: async () => {},
})
mock.module('./client', () => ({ ...client, ai: memoryAi }))

const { blogOutlineProblems, blogTextProblems, outlineBlog, writeBlogText } = await import('./blog')
const { BLOG_OUTLINE, BLOG_TEXT, buildPrompt, languageRule } = await import('./prompts')
const { scriptShare } = await import('../text/script')
const { languageById } = await import('../languages')
const { toModelSchema } = await import('./schema-guard')
const { BLOG_POINT_MAX, HEADING_MAX, isQuestion } = await import('../lib/blog-outline')
const { NATIVE_IDS, nativeOf } = await import('../text/native-fixtures')

type Answer = Parameters<typeof blogOutlineProblems>[0]
type Fact = import('../model/types').Fact
type IdeaCard = import('../model/types').IdeaCard

const fact = (id: string, text: string, supported = true): Fact => ({
  id,
  text,
  value: null,
  ref: '¶1',
  quote: null,
  supported,
  why: null,
  span: null,
})
const FACTS = [
  fact('f1', 'Students on a student visa can work up to 48 hours a fortnight.'),
  fact('f2', 'Work rights start once the course has begun.'),
  fact('f3', 'One in 3 students skipped classes for shifts.', false),
]
const CARD: IdeaCard = {
  angle: 'The hours that are allowed',
  hook: 'How much can you work while you study?',
  audience: 'New international students',
  look: 'field-notes',
  slides: 5,
}

/** A section with no number in it, by its letter. */
const section = (n: number) => {
  const letter = 'abcdefghijkl'[n - 1]
  return { heading: `What is question ${letter}?`, point: `Point ${letter}.` }
}
const clean = (): Answer => ({
  sections: [
    { heading: 'How many hours can I work on a student visa?', point: 'Up to 48 a fortnight.' },
    { heading: 'When can I start working?', point: 'Once the course has begun.' },
    { heading: 'What should I plan for?', point: 'Shifts that fit your classes.' },
  ],
  takeaways: ['Know your limit.', 'Wait for the course to start.', 'Plan around classes.'],
  faq: [
    { q: 'Can I work before my course starts?', point: 'No, work rights start with it.' },
    { q: 'Is the limit per week?', point: 'It is counted per fortnight.' },
    { q: 'Who checks my hours?', point: 'Your visa conditions set them.' },
  ],
})
const context = { facts: FACTS }

beforeEach(() => store.clear())
afterEach(() => {
  provider = fakeProvider
})

describe('the blog outline spec', () => {
  it('has an example that parses with its own schema, passes the schema guard and passes its own checks', () => {
    expect(BLOG_OUTLINE.schema.safeParse(BLOG_OUTLINE.example.answer).success).toBe(true)
    expect(() => toModelSchema(BLOG_OUTLINE.schema)).not.toThrow()
    expect(BLOG_OUTLINE).toMatchObject({
      useCase: 'blog_outline',
      version: 'blog_outline.v2',
      tier: 'flash',
    })
    const data = BLOG_OUTLINE.example.data as { facts: { id: string; text: string }[] }
    const facts = data.facts.map((f) => fact(f.id, f.text))
    const answer = BLOG_OUTLINE.schema.parse(BLOG_OUTLINE.example.answer)
    expect(blogOutlineProblems(answer, { facts })).toEqual([])
  })
})

describe('blogOutlineProblems (BR2)', () => {
  it("passes three to eight question headings, three to five takeaways and FAQ, with only the facts' numbers", () => {
    expect(blogOutlineProblems(clean(), context)).toEqual([])
  })

  it('refuses a heading that is not a question', () => {
    const answer = clean()
    answer.sections[1].heading = 'Starting work'
    expect(blogOutlineProblems(answer, context)).toEqual([
      'sections.1.heading: write it as a question ending with "?".',
    ])
  })

  it('refuses nine sections, and two', () => {
    const problem = 'sections: return between 3 and 8 sections.'
    const nine = { ...clean(), sections: Array.from({ length: 9 }, (_, i) => section(i + 1)) }
    expect(blogOutlineProblems(nine, context)).toEqual([problem])
    const two = { ...clean(), sections: clean().sections.slice(0, 2) }
    expect(blogOutlineProblems(two, context)).toEqual([problem])
  })

  it('refuses two or six takeaways, and two or six questions', () => {
    const takeaways = 'takeaways: return between 3 and 5 takeaways.'
    const faq = 'faq: return between 3 and 5 questions.'
    expect(blogOutlineProblems({ ...clean(), takeaways: ['A.', 'B.'] }, context)).toEqual([
      takeaways,
    ])
    const six = Array.from({ length: 6 }, (_, i) => `Takeaway ${'abcdef'[i]}.`)
    expect(blogOutlineProblems({ ...clean(), takeaways: six }, context)).toEqual([takeaways])
    expect(blogOutlineProblems({ ...clean(), faq: clean().faq.slice(0, 2) }, context)).toEqual([
      faq,
    ])
    const many = Array.from({ length: 6 }, (_, i) => ({ q: `Why ${'abcdef'[i]}?`, point: 'So.' }))
    expect(blogOutlineProblems({ ...clean(), faq: many }, context)).toEqual([faq])
  })

  it('refuses an FAQ entry that is not a question, and empty text', () => {
    const answer = clean()
    answer.faq[0].q = 'Working early'
    answer.sections[0].point = ' '
    answer.takeaways[2] = ''
    expect(blogOutlineProblems(answer, context)).toEqual([
      'sections.0.point: write it.',
      'takeaways.2: write it.',
      'faq.0.q: write it as a question ending with "?".',
    ])
  })

  it('refuses a number no supported fact holds, wherever it is', () => {
    const answer = clean()
    answer.sections[2].heading = 'Why do 3 in 10 students struggle?'
    answer.takeaways[0] = 'Work 20 hours at most.'
    answer.faq[1].point = 'It is 40 hours.'
    expect(blogOutlineProblems(answer, context)).toEqual([
      'sections.2.heading: "3" is a number no fact holds.',
      'sections.2.heading: "10" is a number no fact holds.',
      'takeaways.0: "20" is a number no fact holds.',
      'faq.1.point: "40" is a number no fact holds.',
    ])
  })
})

describe('outlineBlog (BR2)', () => {
  function recordCalls(): unknown[] {
    const data: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'blog_outline') data.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    return data
  }

  it("outlines the angle from the supported facts, the framing line and the brand's voice", async () => {
    const sent = recordCalls()
    const res = await outlineBlog({
      idea: CARD,
      framing: 'What new students can and cannot do',
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.sections.length).toBeGreaterThanOrEqual(3)
    expect(res.sections.every((s) => isQuestion(s.heading))).toBe(true)
    expect(res.takeaways.length).toBeGreaterThanOrEqual(3)
    expect(res.faq.length).toBeGreaterThanOrEqual(3)
    expect(sent).toHaveLength(1)
    const data = sent[0] as {
      angle: unknown
      editor_intent: unknown
      brand_voice: string
      facts: { id: string }[]
    }
    expect(data.angle).toEqual({ angle: CARD.angle, hook: CARD.hook, audience: CARD.audience })
    expect(data.editor_intent).toBe('What new students can and cannot do')
    expect(data.brand_voice.length).toBeGreaterThan(0)
    expect(data.facts.map((f) => f.id)).toEqual(['f1', 'f2'])
  })

  it('fails with the standard message on [fake:fail-blog_outline]', async () => {
    const res = await outlineBlog({
      idea: { ...CARD, hook: `${CARD.hook} [fake:fail-blog_outline]` },
      framing: null,
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
    })
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

type TextAnswer = Parameters<typeof blogTextProblems>[0]
type BlogOutline = import('../model/artifacts').Body<'blog_outline'>

/** `n` words with no number in them, as one sentence. */
const wordsOf = (n: number) => `Plan ${Array.from({ length: n - 1 }, () => 'ahead').join(' ')}.`
const OUTLINE: BlogOutline = {
  factsId: 'facts-1',
  idea: CARD,
  sections: clean().sections,
  takeaways: clean().takeaways,
  faq: clean().faq,
  note: 'Outlined',
}
/** Three bodies of 249 words, each bound to f1 and stating its 48; takeaways and answers clean. */
const cleanText = (): TextAnswer => ({
  sections: [0, 1, 2].map(() => ({
    body: `You can work up to 48 hours a fortnight. ${wordsOf(240)}`,
    fact_ids: ['f1'],
  })),
  takeaways: ['Know your limit.', 'Wait for the course to start.', 'Plan around classes.'],
  faq: [
    { a: 'No. Work rights start once the course has begun.', fact_ids: ['f2'] },
    { a: 'It is counted per fortnight.', fact_ids: ['f1'] },
    { a: 'Your visa conditions set the limit.', fact_ids: ['f1'] },
  ],
})
const textContext = { outline: OUTLINE, facts: FACTS }
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

describe('the blog text spec', () => {
  it('has an example that parses with its own schema, passes the schema guard and every check but the length', () => {
    expect(BLOG_TEXT.schema.safeParse(BLOG_TEXT.example.answer).success).toBe(true)
    expect(() => toModelSchema(BLOG_TEXT.schema)).not.toThrow()
    expect(BLOG_TEXT).toMatchObject({
      useCase: 'blog_text',
      version: 'blog_text.v2',
      tier: 'flash',
    })
    const data = BLOG_TEXT.example.data as {
      outline: Pick<BlogOutline, 'sections' | 'takeaways' | 'faq'>
      facts: { id: string; text: string }[]
    }
    const facts = data.facts.map((f) => fact(f.id, f.text))
    const answer = BLOG_TEXT.schema.parse(BLOG_TEXT.example.answer)
    const outline = { ...OUTLINE, ...data.outline }
    // A worked example stays short, so only the length is left to the real answer.
    const problems = blogTextProblems(answer, { outline, facts })
    expect(problems.filter((p) => !p.startsWith('sections: the bodies run to'))).toEqual([])
  })
})

describe('blogTextProblems (BR3)', () => {
  it('passes a body per section, 600 to 1,200 words in all, each bound to facts with only their numbers, and an answer per question bound to its facts', () => {
    expect(blogTextProblems(cleanText(), textContext)).toEqual([])
  })

  it('refuses fewer than 600 words or more than 1,200 in all', () => {
    const short = cleanText()
    short.sections[2].body = 'You can work up to 48 hours a fortnight.'
    expect(blogTextProblems(short, textContext)).toEqual([
      'sections: the bodies run to 507 words; write between 600 and 1,200 in all.',
    ])
    const long = cleanText()
    long.sections[0].body = `${long.sections[0].body} ${wordsOf(500)}`
    expect(blogTextProblems(long, textContext)).toEqual([
      'sections: the bodies run to 1247 words; write between 600 and 1,200 in all.',
    ])
  })

  it("refuses a body or answer stating a number its fact_ids do not, and a takeaway's number no fact holds (GD21)", () => {
    const answer = cleanText()
    answer.sections[1].body = `Most work 20 hours a week. ${wordsOf(244)}`
    answer.faq[1].a = 'It is 40 hours a fortnight.'
    answer.takeaways[0] = 'Work 20 hours at most.'
    expect(blogTextProblems(answer, textContext)).toEqual([
      'sections.1.body: "Most work 20 hours a week." states a number its fact_ids do not. Use only their numbers.',
      'takeaways.0: "20" is a number no fact holds.',
      'faq.1.a: "It is 40 hours a fortnight." states a number its fact_ids do not. Use only their numbers.',
    ])
  })

  it('refuses a body bound to no fact or to one not in DATA, and a banned phrase anywhere', () => {
    const answer = cleanText()
    answer.sections[0].fact_ids = []
    answer.sections[1].fact_ids = ['f1', 'f9']
    // f3 is not supported, so the model never saw it.
    answer.sections[2].fact_ids = ['f1', 'f3']
    answer.takeaways[1] = 'The best plan is to wait.'
    answer.faq[0].a = 'No, and that is guaranteed.'
    expect(blogTextProblems(answer, textContext)).toEqual([
      'sections.0.fact_ids: bind the facts this section states.',
      'sections.1.fact_ids: f9 is not a fact in DATA.',
      'sections.2.fact_ids: f3 is not a fact in DATA.',
      'takeaways.1: remove "best".',
      'faq.0.a: remove "guaranteed".',
    ])
  })

  it('refuses an answer bound to no fact, but takes an empty answer for a question the facts do not answer', () => {
    const answer = cleanText()
    answer.faq[0] = { a: 'Your school will tell you.', fact_ids: [] }
    answer.faq[2] = { a: '', fact_ids: [] }
    expect(blogTextProblems(answer, textContext)).toEqual([
      'faq.0.fact_ids: bind the facts this answer states, or leave a empty when no fact answers the question.',
    ])
  })

  it("refuses counts that are not the outline's", () => {
    const answer = cleanText()
    answer.sections = answer.sections
      .slice(0, 2)
      .map((s) => ({ ...s, body: `${s.body} ${wordsOf(60)}` }))
    answer.takeaways = answer.takeaways.slice(0, 2)
    answer.faq = [...answer.faq, { a: 'It is counted per fortnight.', fact_ids: ['f1'] }]
    expect(blogTextProblems(answer, textContext)).toEqual([
      'sections: DATA.outline has 3 sections; write exactly 3 bodies, one for each, in its order.',
      'takeaways: DATA.outline has 3 takeaways; write exactly 3, one for each, in its order.',
      'faq: DATA.outline has 3 questions; write exactly 3 answers, one for each, in its order.',
    ])
  })
})

describe('writeBlogText (BR3)', () => {
  it("writes the outline's sections and questions from the supported facts, with the notes as opinion and the brand's voice", async () => {
    const sent: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'blog_text') sent.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const res = await writeBlogText({
      outline: OUTLINE,
      framing: 'What new students can and cannot do',
      notes: 'I think students underestimate this.',
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.text.sections.map((s) => s.heading)).toEqual(OUTLINE.sections.map((s) => s.heading))
    expect(res.text.faq.map((f) => f.q)).toEqual(OUTLINE.faq.map((f) => f.q))
    expect(res.text.takeaways).toHaveLength(OUTLINE.takeaways.length)
    expect(res.text.sections.every((s) => s.factIds.length > 0)).toBe(true)
    const total = res.text.sections.reduce((n, s) => n + wordCount(s.body), 0)
    expect(total).toBeGreaterThanOrEqual(600)
    expect(total).toBeLessThanOrEqual(1200)
    expect(sent).toHaveLength(1)
    const data = sent[0] as {
      outline: unknown
      angle: unknown
      editor_intent: unknown
      editor_notes: unknown
      brand_voice: string
      facts: { id: string }[]
    }
    expect(data.outline).toEqual({
      sections: OUTLINE.sections,
      takeaways: OUTLINE.takeaways,
      faq: OUTLINE.faq,
    })
    expect(data.angle).toEqual({ angle: CARD.angle, hook: CARD.hook, audience: CARD.audience })
    expect(data.editor_intent).toBe('What new students can and cannot do')
    expect(data.editor_notes).toBe('I think students underestimate this.')
    expect(data.brand_voice.length).toBeGreaterThan(0)
    expect(data.facts.map((f) => f.id)).toEqual(['f1', 'f2'])
  })

  it('keeps an empty answer with no facts: the question the facts do not answer', async () => {
    provider = {
      json: async (req) => {
        if (req.useCase !== 'blog_text') return fakeProvider.json(req)
        const answer = JSON.parse(await fakeProvider.json(req)) as TextAnswer
        answer.faq[2] = { a: ' ', fact_ids: ['f1'] }
        return JSON.stringify(answer)
      },
      image: fakeProvider.image,
    }
    const res = await writeBlogText({
      outline: OUTLINE,
      framing: null,
      notes: null,
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.text.faq[2]).toEqual({ q: OUTLINE.faq[2].q, a: '', factIds: [] })
  })

  it('fails with the standard message on [fake:fail-blog_text]', async () => {
    const res = await writeBlogText({
      outline: OUTLINE,
      framing: '[fake:fail-blog_text]',
      notes: null,
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
    })
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

describe('a blog in its language (GD37)', () => {
  const HINDI = languageById('hi') ?? undefined
  /** The calls that reached the provider for `useCase`, by their system text and data. */
  function recordLanguageCalls(useCase: string): { system: string; data: unknown }[] {
    const seen: { system: string; data: unknown }[] = []
    provider = {
      json: (req) => {
        if (req.useCase === useCase) seen.push({ system: req.system, data: req.data })
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    return seen
  }

  it('refuses an outline and a text in Latin for a Hindi blog, part by part, and nothing for an English one', () => {
    const outline = blogOutlineProblems(clean(), { ...context, language: HINDI })
    expect(outline.map((p) => p.split(':')[0])).toEqual([
      'sections.0',
      'sections.1',
      'sections.2',
      'takeaways',
      'faq.0',
      'faq.1',
      'faq.2',
    ])
    expect(outline[0]).toStartWith('sections.0: write it in Hindi, in its own script')
    const text = blogTextProblems(cleanText(), { ...textContext, language: HINDI })
    expect(text.map((p) => p.split(':')[0])).toEqual([
      'sections.0.body',
      'sections.1.body',
      'sections.2.body',
      'takeaways',
      'faq.0.a',
      'faq.1.a',
      'faq.2.a',
    ])
    expect(blogOutlineProblems(clean(), context)).toEqual([])
    expect(blogTextProblems(cleanText(), textContext)).toEqual([])
  })

  it('counts a Nepali, Hindi or Thai heading, point and takeaway at its limit in characters as a reader sees them', () => {
    for (const id of NATIVE_IDS) {
      const heading = `${nativeOf(id, HEADING_MAX - 1)}?`
      const point = nativeOf(id, BLOG_POINT_MAX)
      const outline: Answer = {
        sections: [0, 1, 2].map(() => ({ heading, point })),
        takeaways: [point, point, point],
        faq: [0, 1, 2].map(() => ({ q: heading, point })),
      }
      const language = languageById(id) ?? undefined
      expect(blogOutlineProblems(outline, { ...context, language }), id).toEqual([])
      const text = { ...cleanText(), takeaways: [point, point, point] }
      const lengths = blogTextProblems(text, { ...textContext, language }).filter((p) =>
        p.includes('characters'),
      )
      expect(lengths, id).toEqual([])
    }
  })

  it('sends a Hindi blog its language and the rule, and the fake outlines and writes in Devanagari', async () => {
    const outlines = recordLanguageCalls('blog_outline')
    const outlined = await outlineBlog({
      idea: CARD,
      framing: null,
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
      language: 'hi',
    })
    if (!outlined.ok) throw new Error(outlined.error)
    expect(outlines[0].data).toMatchObject({ language: { id: 'hi', label: 'Hindi' } })
    expect(outlines[0].system).toContain(languageRule('Hindi'))
    expect(scriptShare(outlined.sections.map((s) => s.heading).join(' '), 'devanagari')).toBe(1)

    const texts = recordLanguageCalls('blog_text')
    const written = await writeBlogText({
      outline: { ...OUTLINE, ...outlined },
      framing: null,
      notes: null,
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
      language: 'hi',
    })
    if (!written.ok) throw new Error(written.error)
    expect(texts[0].data).toMatchObject({ language: { id: 'hi', label: 'Hindi' } })
    expect(texts[0].system).toContain(languageRule('Hindi'))
    expect(scriptShare(written.text.sections[0].body, 'devanagari')).toBe(1)
  })

  it('sends an English blog no language and no rule', async () => {
    const outlines = recordLanguageCalls('blog_outline')
    await outlineBlog({ idea: CARD, framing: null, facts: FACTS, postId: 'p', attempt: 1 })
    expect(outlines[0].data).not.toHaveProperty('language')
    expect(outlines[0].system).toBe(buildPrompt(BLOG_OUTLINE, outlines[0].data).system)
    const texts = recordLanguageCalls('blog_text')
    await writeBlogText({
      outline: OUTLINE,
      framing: null,
      notes: null,
      facts: FACTS,
      postId: 'p',
      attempt: 1,
    })
    expect(texts[0].data).not.toHaveProperty('language')
    expect(texts[0].system).toBe(buildPrompt(BLOG_TEXT, texts[0].data).system)
  })
})
