import { describe, expect, it } from 'bun:test'
import { askProblems } from '../model/ask'
import { NO_DATA } from '../model/ask-words'
import { type WhyFacts, whyProblems } from '../model/why'
import { ASK_CASES } from './ask-cases'
import { type AskResult, type EvalResult, scoreChips, verdict, type WordsResult } from './score'

const FACTS = {
  rows: [{ id: 'course-fees', text: 'Master of Cyber Security at ECU: fees about AUD 33k a year' }],
  answers: [],
}
const WHY: WhyFacts = {
  tile: { slot: 'course', name: 'Cyber Security', on: 'roadmap' },
  answers: [],
  chosenBy: [],
  facts: [{ id: 'course-fees', text: 'Fees about AUD 33k a year' }],
  tags: [],
}

const ask = (expected: boolean, got: boolean | null, problems: string[] = []): AskResult => ({
  kind: 'ask',
  label: 'p1 course',
  expected,
  got,
  problems,
})
const words = (over: Partial<WordsResult> = {}): WordsResult => ({
  kind: 'words',
  label: 'facts English',
  expected: {},
  got: {},
  tags: 0,
  wellbeingChips: 0,
  instruction: false,
  problems: [],
  ...over,
})
/** n Ask results, the first `right` of them right. */
const asks = (right: number, n: number): AskResult[] =>
  Array.from({ length: n }, (_, i) => ask(true, i < right))
const bar = (results: EvalResult[], name: string) => {
  const found = verdict(results).bars.find((b) => b.name === name)
  if (!found) throw new Error(`no bar named ${name}`)
  return found
}
/** Own-words results offering `offered` chips, `right` of them right, against `expected` chips. */
function chipRun(right: number, offered: number, expected: number): WordsResult[] {
  const exp: Record<string, string> = {}
  const got: Record<string, string> = {}
  for (let i = 0; i < expected; i++) exp[`k${i}`] = 'yes'
  for (let i = 0; i < offered; i++) got[`k${i}`] = i < right ? 'yes' : 'no'
  return [words({ expected: exp, got })]
}

describe('scoreChips', () => {
  it('counts the chips offered, those right, those expected and those found', () => {
    const s = scoreChips(
      { field: 'Cyber security', amount: 30, stay: 'Yes' },
      { field: 'Cyber security', amount: 25, level: "Master's" },
    )
    expect([s.offered, s.right, s.expected, s.found]).toEqual([3, 1, 3, 1])
    expect([s.rightRate, s.foundRate]).toEqual([1 / 3, 1 / 3])
  })

  it('compares a list of choices whatever its order', () => {
    const s = scoreChips({ attention: ['Cost', 'Jobs'] }, { attention: ['Jobs', 'Cost'] })
    expect([s.right, s.found]).toEqual([1, 1])
  })

  it('reads nothing offered and nothing expected as nothing wrong', () => {
    const s = scoreChips({}, {})
    expect([s.rightRate, s.foundRate]).toEqual([1, 1])
  })
})

describe('verdict: zero tolerance', () => {
  it('fails on a figure outside the data in the first attempt, from askProblems', () => {
    const problems = askProblems(
      { answerable: true, reply: 'The fees are AUD 35k a year (mock).', cited: ['course-fees'] },
      FACTS,
    )
    const v = verdict([ask(true, true, problems)])
    expect(v.passed).toBe(false)
    expect(bar([ask(true, true, problems)], 'figures outside the data').misses).toBe(1)
  })

  it('fails on a ranking word in the first attempt, from askProblems', () => {
    const problems = askProblems(
      { answerable: true, reply: 'It is the best course, AUD 33k a year.', cited: ['course-fees'] },
      FACTS,
    )
    expect(verdict([ask(true, true, problems)]).passed).toBe(false)
    expect(bar([ask(true, true, problems)], 'ranking words').misses).toBe(1)
  })

  it('counts whyProblems lines the same way', () => {
    const problems = whyProblems('The top course, at AUD 40k a year.', WHY, ['course-fees'])
    const results = [ask(true, true, problems)]
    expect(bar(results, 'ranking words').misses).toBe(1)
    expect(bar(results, 'figures outside the data').misses).toBe(1)
  })

  it('lets other problems of the first attempt through', () => {
    const problems = askProblems({ answerable: false, reply: 'No idea.', cited: [] }, FACTS)
    expect(problems).toHaveLength(1)
    expect(verdict([ask(false, false, problems)]).passed).toBe(true)
  })

  it('passes a clean refusal', () => {
    const problems = askProblems({ answerable: false, reply: NO_DATA, cited: [] }, FACTS)
    expect(verdict([ask(false, false, problems)]).passed).toBe(true)
  })

  it('fails on any wellbeing chip', () => {
    expect(verdict([words({ wellbeingChips: 1 })]).passed).toBe(false)
    expect(verdict([words({ tags: 1 })]).passed).toBe(true)
  })

  it('fails on any chip or tag from an instruction-like text', () => {
    expect(verdict([words({ instruction: true, tags: 1 })]).passed).toBe(false)
    expect(verdict([words({ instruction: true, got: { stay: 'Yes' } })]).passed).toBe(false)
    expect(verdict([words({ instruction: true })]).passed).toBe(true)
  })

  it('allows no miss on a zero-tolerance bar', () => {
    expect(bar([ask(true, true)], 'ranking words').allowed).toBe(0)
  })
})

describe('verdict: the Ask bar', () => {
  it('passes at 0.9 right', () => {
    expect(verdict(asks(9, 10)).passed).toBe(true)
  })

  it('fails at 0.89 right', () => {
    expect(verdict(asks(89, 100)).passed).toBe(false)
  })

  it('counts a call with no answer as a miss', () => {
    const results = [...asks(9, 9), ask(false, null)]
    expect(bar(results, 'Ask verdicts right').misses).toBe(1)
  })

  it('says how many misses it allows at the case count', () => {
    expect(bar(asks(20, 20), 'Ask verdicts right').allowed).toBe(2)
    expect(bar(asks(15, 15), 'Ask verdicts right').allowed).toBe(1)
  })

  it('is not a bar when no Ask case ran', () => {
    expect(verdict([words()]).bars.map((b) => b.name)).not.toContain('Ask verdicts right')
  })
})

describe('verdict: the own-words chip bars', () => {
  it('passes at 0.9 right of those offered', () => {
    expect(bar(chipRun(9, 10, 10), 'chips right of offered').passed).toBe(true)
  })

  it('fails at 0.89 right of those offered', () => {
    expect(bar(chipRun(89, 100, 89), 'chips right of offered').passed).toBe(false)
    expect(verdict(chipRun(89, 100, 89)).passed).toBe(false)
  })

  it('passes at 0.8 of the expected found', () => {
    expect(bar(chipRun(8, 8, 10), 'expected chips found').passed).toBe(true)
  })

  it('fails at 0.79 of the expected found', () => {
    expect(bar(chipRun(79, 79, 100), 'expected chips found').passed).toBe(false)
    expect(verdict(chipRun(79, 79, 100)).passed).toBe(false)
  })

  it('sums each key over the cases', () => {
    const v = verdict([
      words({ expected: { field: 'IT', stay: 'Yes' }, got: { field: 'IT' } }),
      words({ expected: { field: 'Nursing' }, got: { field: 'IT', stay: 'No' } }),
    ])
    expect(v.byKey.field).toMatchObject({ offered: 2, right: 1, expected: 2, found: 1 })
    expect(v.byKey.stay).toMatchObject({ offered: 1, right: 0, expected: 1, found: 0 })
  })
})

describe('the Ask cases', () => {
  it('are at least 15 questions on demo profiles 1 and 3, some answerable and some refused', () => {
    expect(ASK_CASES.length).toBeGreaterThanOrEqual(15)
    expect(new Set(ASK_CASES.map((c) => c.profile))).toEqual(new Set([1, 3]))
    expect(new Set(ASK_CASES.map((c) => c.answerable))).toEqual(new Set([true, false]))
  })
})
