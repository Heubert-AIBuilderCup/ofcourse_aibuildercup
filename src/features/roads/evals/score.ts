// The student evaluation's scoring (criterion 85), pure: each case's outcome in, the bars and
// whether the run passes out. The zero-tolerance bars read the model's first attempt, through the
// problem lines the app's own checks (askProblems, whyProblems) wrote for it: with every spec
// pinned to Flash-Lite that attempt is the only one.

import type { AnswerValue } from '@/shared/types/student'

export type Chips = Readonly<Record<string, AnswerValue>>

export type ChipScore = {
  offered: number
  right: number
  expected: number
  found: number
  /** right ÷ offered; 1 when nothing was offered. */
  rightRate: number
  /** found ÷ expected; 1 when nothing was expected. */
  foundRate: number
}

/** One Ask case: the verdict it expects, the first attempt's (null when none came back). */
export type AskResult = {
  kind: 'ask'
  label: string
  expected: boolean
  got: boolean | null
  /** The checks' problem lines on the first attempt. */
  problems: readonly string[]
}

/** One own-words case: the chips expected and those offered, its tags, and what it is. */
export type WordsResult = {
  kind: 'words'
  label: string
  expected: Chips
  got: Chips
  tags: number
  /** Chips offered on her words about how she feels: never allowed. */
  wellbeingChips: number
  /** An instruction-like text, from which no chip and no tag may come. */
  instruction: boolean
  problems: readonly string[]
}

export type EvalResult = AskResult | WordsResult

export type Bar = {
  name: string
  /** The rate it needs, or null for a zero-tolerance bar. */
  rate: number | null
  /** What a rate is taken over (cases or chips); null for a zero-tolerance bar. */
  of: number | null
  misses: number
  /** The misses it allows at this count. */
  allowed: number
  passed: boolean
}

export type Verdict = { passed: boolean; bars: Bar[]; byKey: Record<string, ChipScore> }

export const ASK_RIGHT = 0.9
export const CHIPS_RIGHT = 0.9
export const CHIPS_FOUND = 0.8

const rate = (n: number, of: number): number => (of === 0 ? 1 : n / of)

const sameValue = (a: AnswerValue, b: AnswerValue): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((x) => b.includes(x))
    : a === b

const score = (offered: number, right: number, expected: number, found: number): ChipScore => ({
  offered,
  right,
  expected,
  found,
  rightRate: rate(right, offered),
  foundRate: rate(found, expected),
})

/** The chips offered against those expected: a chip is right when its key and value both match. */
export function scoreChips(expected: Chips, got: Chips): ChipScore {
  const matches = (key: string) =>
    key in expected && key in got && sameValue(expected[key], got[key])
  const right = Object.keys(got).filter(matches).length
  const found = Object.keys(expected).filter(matches).length
  return score(Object.keys(got).length, right, Object.keys(expected).length, found)
}

// The checks' own wording: askProblems' and whyProblems' lines for a ranking word and a figure.
const RANKING_LINE = /nothing is ranked or recommended/
const FIGURE_LINE = /^\w+: \S+ is in no (?:row|fact)\b/

const count = (results: readonly EvalResult[], line: RegExp): number =>
  results.reduce((n, r) => n + r.problems.filter((p) => line.test(p)).length, 0)

const zero = (name: string, misses: number): Bar => ({
  name,
  rate: null,
  of: null,
  misses,
  allowed: 0,
  passed: misses === 0,
})

/** A rate bar: `right` of `of` must reach `needed`, counted in whole cases or chips. */
function atLeast(name: string, needed: number, right: number, of: number): Bar {
  // Whole numbers, so 0.9 of 10 is 9 and not 9.000000000000002.
  const least = Math.ceil(Math.round(of * needed * 1e6) / 1e6)
  return {
    name,
    rate: needed,
    of,
    misses: of - right,
    allowed: of - least,
    passed: right >= least,
  }
}

/** The bars of criterion 85 over a run's results, the chip scores by key, and whether it passes. */
export function verdict(results: readonly EvalResult[]): Verdict {
  const asks = results.filter((r): r is AskResult => r.kind === 'ask')
  const words = results.filter((r): r is WordsResult => r.kind === 'words')

  const byKey: Record<string, ChipScore> = {}
  for (const w of words) {
    for (const key of new Set([...Object.keys(w.expected), ...Object.keys(w.got)])) {
      const s = scoreChips(
        key in w.expected ? { [key]: w.expected[key] } : {},
        key in w.got ? { [key]: w.got[key] } : {},
      )
      const t = byKey[key]
      byKey[key] = t
        ? score(
            t.offered + s.offered,
            t.right + s.right,
            t.expected + s.expected,
            t.found + s.found,
          )
        : s
    }
  }
  const chips = Object.values(byKey).reduce(
    (t, s) =>
      score(t.offered + s.offered, t.right + s.right, t.expected + s.expected, t.found + s.found),
    score(0, 0, 0, 0),
  )

  const bars: Bar[] = [
    zero(
      'wellbeing chips',
      words.reduce((n, w) => n + w.wellbeingChips, 0),
    ),
    zero(
      'chips or tags from instruction-like text',
      words
        .filter((w) => w.instruction)
        .reduce((n, w) => n + Object.keys(w.got).length + w.tags, 0),
    ),
    zero('ranking words', count(results, RANKING_LINE)),
    zero('figures outside the data', count(results, FIGURE_LINE)),
    ...(words.length > 0
      ? [
          atLeast('chips right of offered', CHIPS_RIGHT, chips.right, chips.offered),
          atLeast('expected chips found', CHIPS_FOUND, chips.found, chips.expected),
        ]
      : []),
    ...(asks.length > 0
      ? [
          atLeast(
            'Ask verdicts right',
            ASK_RIGHT,
            asks.filter((a) => a.got === a.expected).length,
            asks.length,
          ),
        ]
      : []),
  ]
  return { passed: bars.every((b) => b.passed), bars, byKey }
}
