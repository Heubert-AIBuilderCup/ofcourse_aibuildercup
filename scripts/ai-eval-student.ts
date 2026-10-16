// The student evaluation (criteria 84, 85): the labelled cases, Ask's then own words', each one
// call through the app's real client, so its checks and its ai_call log apply, with the cache
// bypassed and every spec pinned to Flash-Lite (one attempt per call). One shared counter stops the
// run at 60 attempts, 50 on the one rerun (--rerun); cases past it are skipped and the run says so.
//   DATABASE_URL=…/student_roads AI_DAILY_CAP_PRO=0 bun run ai:eval:student [--rerun]
// Guards first: the real provider, Pro capped at 0, a Flash-Lite model, the student_roads database.

import type { Pin } from '../src/features/roads/evals/check-cases'
import type { EvalResult } from '../src/features/roads/evals/score'

const { aiConfig } = await import('../src/features/content/ai/config')

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.some((a) => a !== '--rerun')) fail('Usage: bun run ai:eval:student [--rerun]')
const cap = args.includes('--rerun') ? 50 : 60

// Guards: before any import that reaches the database or a model.
const env = process.env
const config = aiConfig(env)
if (config.provider === 'fake') fail('AI_PROVIDER is fake: set it to vertex.')
if (env.AI_DAILY_CAP_PRO !== '0')
  fail('AI_DAILY_CAP_PRO must be 0: the evaluation never reaches Pro.')
if (!env.GEMINI_LITE_MODEL?.trim())
  fail('GEMINI_LITE_MODEL is not set: the evaluation runs Flash-Lite.')
if (!env.DATABASE_URL?.endsWith('/student_roads'))
  fail('DATABASE_URL must end with /student_roads: the evaluation writes only to that database.')

console.log(`provider ${config.provider} · project ${config.project ?? '(none)'}`)
console.log(
  `models · lite ${config.models.lite} · flash ${config.models.flash || '(none)'} · pro ${config.models.pro || '(none)'}`,
)
console.log(`budget · ${cap} attempts`)

const { makeAi } = await import('../src/features/content/ai/client')
const { recording } = await import('../src/features/content/ai/recording')
const { vertexProvider } = await import('../src/features/content/ai/vertex')
const { dbCallLog } = await import('../src/features/content/ai/calls')
const { dbCache } = await import('../src/features/content/ai/cache')
const { STUDENT_ASK, STUDENT_WORDS } = await import('../src/features/content/ai/prompts')
const { OWN_WORDS_CASES } = await import('../src/features/opening/evals/own-words-cases')
const { checkOwnWords, ownWordsQuestions } = await import('../src/features/opening/model/own-words')
const { ASK_CASES } = await import('../src/features/roads/evals/ask-cases')
const { scoreChips, verdict, wordsResult } = await import('../src/features/roads/evals/score')
const { askFacts, askProblems } = await import('../src/features/roads/model/ask')
const { DEMO_PROFILES } = await import('../src/features/roads/model/demo-profiles')
const { roadFor } = await import('../src/features/roads/model/road-for')

// Its own client, never the app's `ai`: the recording provider sees each attempt and holds the cap.
const rec = recording(vertexProvider(config), { cap })
const ai = makeAi({ provider: rec.provider, config, calls: dbCallLog, cache: dbCache })
const pin: Pin = (spec) => ({ ...spec, maxTier: 'lite' })

const results: EvalResult[] = []
/** What came back for each case, by its label, for the misses. */
const replies = new Map<string, string>()
let skipped = 0
const spent = () => rec.attempts.length >= cap

// Ask: each case through askFacts and STUDENT_ASK; its verdict and problems are the first attempt's.
for (const c of ASK_CASES) {
  const label = `ask p${c.profile} ${c.slot} "${c.question}"`
  if (spent()) {
    skipped++
    continue
  }
  const profile = DEMO_PROFILES[c.profile - 1]
  const { spec } = roadFor({ answers: profile.answers, relative: profile.relative }, {})
  if (!spec) {
    results.push({ kind: 'ask', label, expected: c.answerable, got: null, problems: [] })
    replies.set(label, `no road matched demo profile ${c.profile}`)
    continue
  }
  const facts = askFacts(spec, c.slot, profile.answers, [])
  const seen: { first?: { answerable: boolean; reply: string; problems: string[] } } = {}
  const res = await ai.generateJson(pin(STUDENT_ASK), {
    data: { ...facts, question: c.question },
    verify: (v) => {
      const problems = askProblems(v, facts)
      seen.first ??= { answerable: v.answerable, reply: v.reply, problems }
      return problems
    },
    cache: false,
  })
  results.push({
    kind: 'ask',
    label,
    expected: c.answerable,
    got: seen.first?.answerable ?? null,
    problems: seen.first?.problems ?? [],
  })
  replies.set(label, seen.first?.reply ?? (res.ok ? '' : res.error))
}

// Own words: each case through STUDENT_WORDS, then checkOwnWords, as the app reads her words (with
// no stated answers, and code's own reading alone when the call fails); what it keeps is scored
// against the labels (wordsResult). Wellbeing and instructions are judged by each case's labelled
// words, never the app's own patterns: a chip or tag on them, shown or in the model's first (only)
// attempt before the app's checks drop it, fails its bar. A failed call fails its own bar, "failed
// calls", never the wellbeing one.
for (const c of OWN_WORDS_CASES) {
  const label = `words ${c.step} "${c.text}"`
  if (spent()) {
    skipped++
    continue
  }
  const res = await ai.generateJson(pin(STUDENT_WORDS), {
    data: { text: c.text, questions: ownWordsQuestions(c.step) },
    cache: false,
  })
  const answer = res.ok ? res.value : null
  const read = checkOwnWords(c.step, c.text, answer ?? { chips: [], tags: [] }, {}, c.where)
  results.push(wordsResult(label, c.expect, answer, read, res.ok ? [] : [res.error]))
  replies.set(label, res.ok ? JSON.stringify(res.value).slice(0, 500) : res.error)
}

const verdictName = (v: boolean | null) => (v === null ? 'no answer' : v ? 'answerable' : 'refused')
for (const r of results) {
  const chips = r.kind === 'words' ? scoreChips(r.expected, r.got) : null
  const missed =
    r.kind === 'ask'
      ? r.got !== r.expected
      : chips !== null &&
        (chips.right < chips.offered ||
          chips.found < chips.expected ||
          r.wellbeingChips > 0 ||
          r.untaggedWellbeing > 0 ||
          r.modelWellbeingChips > 0 ||
          r.instructionItems > 0 ||
          r.modelInstructionItems > 0 ||
          r.failed)
  if (!missed && r.problems.length === 0) continue
  console.log(missed ? `MISS ${r.label}` : r.label)
  if (r.kind === 'ask') {
    console.log(`  expected ${verdictName(r.expected)} · got ${verdictName(r.got)}`)
    console.log(`  reply: ${replies.get(r.label)}`)
  } else if (r.failed) {
    console.log(`  no reading: the call failed · got ${JSON.stringify(r.got)} from code alone`)
  } else {
    console.log(`  expected ${JSON.stringify(r.expected)} · got ${JSON.stringify(r.got)}`)
    console.log(
      `  tags ${r.tags} · wellbeing chips ${r.wellbeingChips} shown, ${r.modelWellbeingChips} from the model · labelled wellbeing with no tag ${r.untaggedWellbeing} · on instructions ${r.instructionItems} shown, ${r.modelInstructionItems} from the model`,
    )
    console.log(`  reply: ${replies.get(r.label)}`)
  }
  for (const problem of r.problems) console.log(`  problem: ${problem}`)
}

const v = verdict(results)
for (const [key, s] of Object.entries(v.byKey)) {
  console.log(
    `${key} · ${s.right}/${s.offered} right of offered · ${s.found}/${s.expected} expected found`,
  )
}
for (const b of v.bars) {
  const measure =
    b.rate === null
      ? `${b.misses} (bar: none)`
      : `${(b.of ?? 0) - b.misses}/${b.of} (bar: ${Math.round(b.rate * 100)}%, at most ${b.allowed} misses of ${b.of})`
  console.log(`${b.name} · ${measure} · ${b.passed ? 'ok' : 'failed'}`)
}
if (skipped > 0) console.log(`Budget spent at ${cap} attempts: ${skipped} cases skipped.`)
console.log(v.passed ? 'PASS' : 'FAIL')
console.log(`${rec.attempts.length} attempts made`)
process.exit(v.passed ? 0 : 1)
