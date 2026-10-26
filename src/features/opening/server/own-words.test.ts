// Her own words read by the model (criteria 36, 37, 40, 42), with the fake provider and an
// in-memory call log and cache: no network, no database. Her draft comes from a mocked
// repository; the repository's writes are proven against the database in
// src/features/roadmaps/server/own-words.db.test.ts. The action is proven here too: who it
// refuses, and that a refusal reads nothing.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from '@/features/content/ai/client'
import type { Roadmap, RoadmapTag } from '@/shared/types/student'

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
mock.module('@/features/content/ai/calls', () => ({ dbCallLog: memoryCalls }))
mock.module('@/features/content/ai/cache', () => ({ dbCache: memoryCache }))

const client = await import('@/features/content/ai/client')
const { aiConfig } = await import('@/features/content/ai/config')
const { makeFake } = await import('@/features/content/ai/fake')
const fakeProvider = makeFake()
let provider: Provider = fakeProvider
const memoryAi = client.makeAi({
  provider: {
    json: (req) => provider.json(req),
    image: (req) => provider.image(req),
    search: (req) => fakeProvider.search!(req),
  },
  config: aiConfig(process.env),
  calls: memoryCalls,
  cache: memoryCache,
})
const searchJson = mock(memoryAi.searchJson)
mock.module('@/features/content/ai/client', () => ({
  ...client,
  ai: { ...memoryAi, searchJson },
}))

/** Her draft as the write returns it: null when she has none. */
let draft: Roadmap | null = null
const saveOwnWords = mock(async (_userId: string, _step: string, _text: string) => draft)
const addTags = mock(async (_userId: string, _tags: RoadmapTag[]) => {})
const none = async () => null
// Every export the module has (its own, then these stubs), as Bun keeps one mock of a module
// for the whole run.
const roadmaps = { ...(await import('@/features/roadmaps/server/roadmaps')) }
mock.module('@/features/roadmaps/server/roadmaps', () => ({
  ...roadmaps,
  saveOwnWords,
  addTags,
  getRoadmap: none,
  getDraft: none,
  ensureDraft: none,
  finishRoadmap: none,
  listRoadmaps: async () => [],
  renameRoadmap: none,
  softDeleteRoadmap: none,
  archiveRoadmap: none,
  hasArchived: none,
  restoreArchived: none,
  restoreRoadmap: none,
  touchOpened: none,
  saveChoices: none,
  saveRoadmapAnswers: none,
  createRoadmap: none,
}))

type FakeSession = { user: { id: string; role: string | null } } | null
let session: FakeSession = null
mock.module('@/shared/lib/auth/session', () => ({ getSession: async () => session }))

const { readOwnWords } = await import('./own-words')
const { readOwnWordsAction } = await import('../actions')
const { OWN_WORDS_PER_HOUR } = await import('./own-words-limit')
const { checkOwnWords } = await import('../model/own-words')
const { STUDENT_WORDS } = await import('@/features/content/ai/prompts')
const { toModelSchema } = await import('@/features/content/ai/schema-guard')

const STUDY_TEXT = 'I want to do data science, a masters, hands-on'

const roadmap = (over: Partial<Roadmap> = {}): Roadmap => ({
  id: 'rm-1',
  name: null,
  answers: {
    where: { value: 'Nepal', state: 'stated' },
    know: { value: 'Something particular', state: 'stated' },
  },
  relative: null,
  coins: null,
  choices: {},
  ownWords: {},
  tags: [],
  lastStep: 'study',
  copiedFrom: null,
  createdAt: new Date('2026-10-14T09:00:00Z'),
  finishedAt: null,
  lastOpenedAt: null,
  archivedAt: null,
  ...over,
})

let seen: { useCase: string; data: unknown }[] = []

beforeEach(() => {
  store.clear()
  seen = []
  draft = roadmap()
  session = { user: { id: 'student-1', role: 'user' } }
  saveOwnWords.mockClear()
  addTags.mockClear()
  searchJson.mockClear()
  provider = {
    json: async (req) => {
      seen.push({ useCase: req.useCase, data: req.data })
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
})

/** A provider that answers every reading with this. */
const answering = (answer: unknown): Provider => ({
  json: async (req) => {
    seen.push({ useCase: req.useCase, data: req.data })
    return JSON.stringify(answer)
  },
  image: fakeProvider.image,
})

describe('readOwnWords (36, 37, 40, 42)', () => {
  it("reads the step's questions from her words, checked in code, and keeps the words", async () => {
    const res = await readOwnWords('student-1', 'study', STUDY_TEXT)
    expect(seen).toHaveLength(1)
    expect(seen[0].useCase).toBe('student_words')
    const data = seen[0].data as {
      text: string
      questions: { key: string; options: string[] }[]
    }
    expect(data.text).toBe(STUDY_TEXT)
    expect(data.questions.map((q) => q.key)).toEqual(['know', 'field', 'areas', 'level'])
    expect(res?.failed).toBe(false)
    expect(res?.chips.map((c) => [c.key, c.value, c.quote])).toEqual([
      ['field', 'Data science', 'data science'],
      ['level', "Master's", 'masters'],
    ])
    expect(saveOwnWords).toHaveBeenCalledTimes(1)
    expect(saveOwnWords).toHaveBeenCalledWith('student-1', 'study', STUDY_TEXT)
    expect(addTags).toHaveBeenCalledTimes(1)
    expect(addTags).toHaveBeenCalledWith('student-1', res?.tags ?? [])
    expect(searchJson).not.toHaveBeenCalled()
  })

  it('leaves nothing she wrote in the model cache, so the same words are read again', async () => {
    await readOwnWords('student-1', 'study', STUDY_TEXT)
    expect(store.size).toBe(0)
    await readOwnWords('student-1', 'study', STUDY_TEXT)
    expect(seen).toHaveLength(2)
  })

  it("keeps only what checkOwnWords keeps of the model's answer, and stores its tags", async () => {
    const answer = {
      chips: [
        { key: 'level', value: "Master's", quote: 'a masters' },
        { key: 'stay', value: 'Yes', quote: 'hands-on' },
        { key: 'learn', value: 'Hands-on with placements', quote: 'not her words' },
      ],
      tags: [{ text: 'Wants hands-on work', quote: 'hands-on', wellbeing: false }],
    }
    provider = answering(answer)
    const res = await readOwnWords('student-1', 'study', STUDY_TEXT)
    const expected = checkOwnWords('study', STUDY_TEXT, answer, roadmap().answers, 'Nepal')
    expect(res).toEqual({ ...expected, failed: false })
    expect(res?.chips.map((c) => c.key)).toEqual(['level'])
    expect(addTags).toHaveBeenCalledWith('student-1', [
      { text: 'Wants hands-on work', quote: 'hands-on', step: 'study', wellbeing: false },
    ])
  })

  it('reads an amount in lakh in the currency of where she is', async () => {
    provider = answering({
      chips: [{ key: 'amount', value: '26 lakh', quote: '26 lakh' }],
      tags: [],
    })
    const text = 'Family has 26 lakh for me'
    // AUD 29.5k at NPR 88, AUD 47.3k at INR 55 (the mock rates), snapped to an option.
    const res = await readOwnWords('student-1', 'facts', text)
    expect(res?.chips.map((c) => [c.key, c.value, c.needsTap])).toEqual([['amount', 30, true]])
    draft = roadmap({ answers: { where: { value: 'India', state: 'stated' } } })
    const india = await readOwnWords('student-1', 'facts', text)
    expect(india?.chips.map((c) => [c.key, c.value])).toEqual([['amount', 42]])
  })

  it('says it failed, keeps her words and adds no tag, when the model fails', async () => {
    const text = `I want data science [fake:fail-student_words]`
    const res = await readOwnWords('student-1', 'study', text)
    expect(res).toEqual({ chips: [], tags: [], failed: true })
    expect(saveOwnWords).toHaveBeenCalledWith('student-1', 'study', text)
    expect(addTags).not.toHaveBeenCalled()
  })

  it('still offers the amount and start code reads when the model fails (criterion 73)', async () => {
    const text = 'Papa can give 30 lakh, I can start next July [fake:fail-student_words]'
    const res = await readOwnWords('student-1', 'facts', text)
    // 30 lakh in NPR at 88 is AUD 34.1k, offered as 36k.
    expect(res).toEqual({
      chips: [
        { key: 'amount', value: 36, quote: '30 lakh', needsTap: true, change: false },
        { key: 'earliest', value: 'Jul 2027', quote: 'next July', needsTap: true, change: false },
      ],
      tags: [],
      failed: false,
    })
    expect(addTags).not.toHaveBeenCalled()
  })

  it('says it failed when the answer holds nothing usable', async () => {
    provider = answering({
      chips: [{ key: 'field', value: 'Data science', quote: 'words she never wrote' }],
      tags: [{ text: 'Something', quote: 'nor these', wellbeing: false }],
    })
    const res = await readOwnWords('student-1', 'study', STUDY_TEXT)
    expect(res).toEqual({ chips: [], tags: [], failed: true })
    expect(saveOwnWords).toHaveBeenCalledTimes(1)
    expect(addTags).not.toHaveBeenCalled()
  })

  it('reads nothing, writes nothing and calls no model for empty or too long text', async () => {
    expect(await readOwnWords('student-1', 'study', '   \n ')).toBeNull()
    expect(await readOwnWords('student-1', 'study', 'a'.repeat(1001))).toBeNull()
    expect(seen).toHaveLength(0)
    expect(saveOwnWords).not.toHaveBeenCalled()
    expect(addTags).not.toHaveBeenCalled()
  })

  it('keeps her words trimmed, up to 1000 characters', async () => {
    const text = 'a'.repeat(1000)
    await readOwnWords('student-1', 'study', `  ${text}  `)
    expect(saveOwnWords).toHaveBeenCalledWith('student-1', 'study', text)
  })

  it('calls no model when she has no roadmap being answered', async () => {
    draft = null
    expect(await readOwnWords('student-1', 'study', STUDY_TEXT)).toBeNull()
    expect(seen).toHaveLength(0)
    expect(addTags).not.toHaveBeenCalled()
  })

  it('gives up past its deadline, keeps her words, and ignores the late answer', async () => {
    let answer: (text: string) => void = () => {}
    const late = new Promise<string>((resolve) => {
      answer = resolve
    })
    provider = {
      json: async (req) => {
        seen.push({ useCase: req.useCase, data: req.data })
        return late
      },
      image: fakeProvider.image,
    }
    const res = await readOwnWords('student-1', 'study', STUDY_TEXT, true, 20)
    expect(res).toEqual({ chips: [], tags: [], failed: true })
    expect(saveOwnWords).toHaveBeenCalledWith('student-1', 'study', STUDY_TEXT)
    expect(seen).toHaveLength(1)
    answer(
      JSON.stringify({
        chips: [{ key: 'level', value: "Master's", quote: 'masters' }],
        tags: [{ text: 'Wants hands-on work', quote: 'hands-on', wellbeing: false }],
      }),
    )
    await Bun.sleep(20)
    expect(addTags).not.toHaveBeenCalled()
  })
})

describe('readOwnWordsAction', () => {
  it('returns the reading for a student', async () => {
    const res = await readOwnWordsAction('study', STUDY_TEXT)
    expect(res).toMatchObject({ ok: true, failed: false })
    expect(saveOwnWords).toHaveBeenCalledWith('student-1', 'study', STUDY_TEXT)
  })

  it('refuses a visitor who is not signed in, and one who is not a student, reading nothing', async () => {
    session = null
    expect(await readOwnWordsAction('study', STUDY_TEXT)).toMatchObject({ ok: false })
    session = { user: { id: 'admin-1', role: 'admin' } }
    expect(await readOwnWordsAction('study', STUDY_TEXT)).toMatchObject({ ok: false })
    expect(saveOwnWords).not.toHaveBeenCalled()
    expect(seen).toHaveLength(0)
  })

  it('gives a student over her hourly limit the failed reading, keeping her words, with no model call; others still read', async () => {
    session = { user: { id: 'student-busy', role: 'user' } }
    for (let i = 0; i < OWN_WORDS_PER_HOUR; i++) {
      expect(await readOwnWordsAction('study', STUDY_TEXT)).toMatchObject({ ok: true })
    }
    seen = []
    saveOwnWords.mockClear()
    addTags.mockClear()
    expect(await readOwnWordsAction('study', STUDY_TEXT)).toEqual({
      ok: true,
      chips: [],
      tags: [],
      failed: true,
    })
    expect(seen).toHaveLength(0)
    expect(saveOwnWords).toHaveBeenCalledWith('student-busy', 'study', STUDY_TEXT)
    expect(addTags).not.toHaveBeenCalled()

    session = { user: { id: 'student-calm', role: 'user' } }
    expect(await readOwnWordsAction('study', STUDY_TEXT)).toMatchObject({ ok: true, failed: false })
    expect(seen).toHaveLength(1)
  })

  it('refuses a step without a box, and text that is not text, reading nothing', async () => {
    for (const step of ['attention', 'character', 'welcome', 2, null]) {
      expect(await readOwnWordsAction(step, STUDY_TEXT)).toMatchObject({ ok: false })
    }
    for (const text of [42, null, { text: STUDY_TEXT }, '  ', 'a'.repeat(1001)]) {
      expect(await readOwnWordsAction('study', text)).toMatchObject({ ok: false })
    }
    expect(saveOwnWords).not.toHaveBeenCalled()
    expect(seen).toHaveLength(0)
  })

  it('gives the failed reading with no model call while the student AI is off (criterion 81)', async () => {
    process.env.STUDENT_AI_OFF = '1'
    try {
      expect(await readOwnWordsAction('study', STUDY_TEXT)).toEqual({
        ok: true,
        chips: [],
        tags: [],
        failed: true,
      })
      expect(seen).toHaveLength(0)
      expect(saveOwnWords).toHaveBeenCalledWith('student-1', 'study', STUDY_TEXT)
      expect(addTags).not.toHaveBeenCalled()
    } finally {
      delete process.env.STUDENT_AI_OFF
    }
    expect(await readOwnWordsAction('study', STUDY_TEXT)).toMatchObject({ ok: true, failed: false })
    expect(seen).toHaveLength(1)
  })

  it('refuses once onboarding is closed, reading nothing', async () => {
    draft = null
    expect(await readOwnWordsAction('study', STUDY_TEXT)).toMatchObject({ ok: false })
    expect(seen).toHaveLength(0)
  })
})

describe('the student words spec', () => {
  it('has an example its schema accepts, and passes the schema guard', () => {
    STUDENT_WORDS.schema.parse(STUDENT_WORDS.example.answer)
    expect(() => toModelSchema(STUDENT_WORDS.schema)).not.toThrow()
  })

  it('runs on Flash-Lite and never climbs past Flash (criteria 71, 79)', () => {
    expect(STUDENT_WORDS).toMatchObject({
      useCase: 'student_words',
      version: 'student_words.v3',
      tier: 'lite',
      maxTier: 'flash',
    })
  })
})
