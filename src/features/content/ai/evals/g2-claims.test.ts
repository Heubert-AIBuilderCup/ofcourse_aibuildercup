import { describe, expect, it, mock } from 'bun:test'
import { numberVerdict } from '../../text/locate'
import { sentences } from '../../text/sentences'
import { findQuote } from '../../text/verbatim'
import type { Cache, CallLog } from '../client'
import {
  EVAL_CASES,
  EVAL_SOURCES,
  type EvalCase,
  type PlantedKind,
  runG2Eval,
  scoreG2,
} from './g2-claims'

const KINDS: PlantedKind[] = ['number', 'unit', 'generalisation', 'number_word', 'title']
const sourceOf = (id: string) => EVAL_SOURCES.find((s) => s.id === id)

describe('the G2 eval cases', () => {
  it('are 30 claims over 5 sources, 10 planted: two of each kind', () => {
    expect(EVAL_SOURCES).toHaveLength(5)
    expect(EVAL_CASES).toHaveLength(30)
    const planted = EVAL_CASES.filter((c) => c.planted !== null)
    expect(planted).toHaveLength(10)
    for (const kind of KINDS) expect(planted.filter((c) => c.planted === kind)).toHaveLength(2)
  })

  it('name a source and a paragraph that exist', () => {
    for (const c of EVAL_CASES) {
      const source = sourceOf(c.source)
      expect(source).toBeDefined()
      expect(Number.isInteger(c.paragraph)).toBe(true)
      expect(c.paragraph).toBeGreaterThanOrEqual(1)
      expect(c.paragraph).toBeLessThanOrEqual(source?.paragraphs.length ?? 0)
    }
  })

  it('are one sentence each, so the source check sees one claim per case', () => {
    for (const c of EVAL_CASES) expect(sentences(c.claim)).toEqual([c.claim])
  })

  it('catch every numeric plant by numberVerdict alone, so that half never fails for model reasons', () => {
    for (const c of EVAL_CASES.filter((c) => c.planted !== null)) {
      const paragraph = sourceOf(c.source)?.paragraphs[c.paragraph - 1] ?? ''
      const verdict = numberVerdict(c.claim, { ref: `¶${c.paragraph}`, text: paragraph })
      // The numeric flag is exact: a plant is numeric when code catches it, and only then.
      expect(verdict.ok).toBe(!c.numeric)
    }
    expect(EVAL_CASES.filter((c) => c.planted !== null && c.numeric).length).toBeGreaterThan(0)
  })

  it('never fail a true claim on its numbers', () => {
    for (const c of EVAL_CASES.filter((c) => c.planted === null)) {
      const paragraph = sourceOf(c.source)?.paragraphs[c.paragraph - 1] ?? ''
      expect(numberVerdict(c.claim, { ref: `¶${c.paragraph}`, text: paragraph }).ok).toBe(true)
      expect(c.numeric).toBe(false)
    }
  })

  it('plant nothing a paragraph holds word for word', () => {
    for (const c of EVAL_CASES.filter((c) => c.planted !== null)) {
      const source = sourceOf(c.source)
      expect(source?.paragraphs.some((p) => findQuote(c.claim, p) !== null)).toBe(false)
    }
  })

  it('make a title case the source title itself, and no other case', () => {
    for (const c of EVAL_CASES) {
      const source = sourceOf(c.source)
      expect(c.claim === source?.title).toBe(c.planted === 'title')
    }
    for (const s of EVAL_SOURCES) expect(sentences(s.title)).toHaveLength(1)
  })
})

describe('the G2 eval run, on the fake provider', () => {
  it('checks every case: the source check on slide sentences, the headline rule on titles; every numeric and title plant caught', async () => {
    process.env.AI_PROVIDER = 'fake'
    const memoryCalls: CallLog = {
      countToday: async () => 0,
      record: async () => {},
      reserve: async () => 'reserved',
      settle: async () => {},
    }
    const memoryCache: Cache = { get: async () => null, put: async () => {} }
    mock.module('server-only', () => ({}))
    const client = await import('../client')
    const { aiConfig } = await import('../config')
    const { makeFake } = await import('../fake')
    const ai = client.makeAi({
      provider: makeFake(),
      config: aiConfig({ ...process.env, AI_DAILY_CAP_PRO: '1000' }),
      calls: memoryCalls,
      cache: memoryCache,
    })
    mock.module('../client', () => ({ ...client, ai }))
    const { extractFacts } = await import('../extract')
    const { checkClaims } = await import('../source-check')

    const run = await runG2Eval({
      extract: (source) => extractFacts({ ...source, postId: 'eval' }),
      check: (source, claims) => checkClaims({ claims, source, previous: null, postId: 'eval' }),
    })
    if (!run.ok) throw new Error(run.error)
    expect(new Set(run.outcomes.map((o) => o.case))).toEqual(new Set(EVAL_CASES))
    expect(run.outcomes).toHaveLength(EVAL_CASES.length)
    for (const o of run.outcomes.filter((o) => o.case.numeric || o.case.planted === 'title')) {
      expect([o.case.claim, o.found]).toEqual([o.case.claim, false])
    }
    for (const o of run.outcomes.filter((o) => o.case.planted === 'title')) {
      expect(o.verdict).toStartWith('Headline claim not in the article')
    }
  })

  it('reads each slide sentence against the paragraph it is about, as a slide reads its bound facts (ADR-129)', async () => {
    const seen: { text: string; evidence?: { ref: string; text: string }[] }[] = []
    const run = await runG2Eval({
      extract: async () => ({ ok: true, facts: [] }),
      check: async (_source, claims) => {
        seen.push(...claims)
        return {
          ok: true,
          claims: claims.map((c) => ({ ...c, result: 'found' as const, ref: null })),
        }
      },
    })
    if (!run.ok) throw new Error(run.error)
    const sentences = EVAL_CASES.filter((c) => c.planted !== 'title')
    expect(seen.map((c) => c.text)).toEqual(sentences.map((c) => c.claim))
    for (const [i, c] of sentences.entries()) {
      const paragraph = sourceOf(c.source)?.paragraphs[c.paragraph - 1] ?? ''
      expect(seen[i].evidence).toEqual([{ ref: `¶${c.paragraph}`, text: paragraph }])
    }
  })

  it('scores against the bar: every plant caught, at most two false alarms', () => {
    const outcome = (c: EvalCase, found: boolean) => ({ case: c, found, verdict: '' })
    const right = EVAL_CASES.map((c) => outcome(c, c.planted === null))
    expect(scoreG2(right)).toMatchObject({ planted: 10, misses: [], alarms: [], passed: true })
    const truths = EVAL_CASES.filter((c) => c.planted === null)
    const alarming = (n: number) =>
      right.map((o) => (truths.slice(0, n).includes(o.case) ? outcome(o.case, false) : o))
    expect(scoreG2(alarming(2))).toMatchObject({ passed: true })
    expect(scoreG2(alarming(3))).toMatchObject({ passed: false })
    const missed = right.map((o) => (o.case.planted === 'title' ? outcome(o.case, true) : o))
    expect(scoreG2(missed)).toMatchObject({ passed: false })
    expect(scoreG2(missed).misses).toHaveLength(2)
  })
})
