// The G2 eval: src/features/content/ai/evals/g2-claims.ts run with the real models. Each claim
// goes to the source check as a slide sentence; a title claim to the headline rule in extractFacts.
// Pass bar (build plan, G2): 10 of 10 planted claims caught, at most 2 false alarms. Run it after
// any prompt change: bun run ai:eval
// Needs AI_PROVIDER=vertex, the Google Cloud settings and the database (ai_call counts the daily caps).

// A module, so top-level await is allowed.
export {}

// Bun loads .env itself; a variable already set in the shell wins.
if (process.env.AI_PROVIDER !== 'vertex') {
  console.error('Set AI_PROVIDER=vertex.')
  process.exit(1)
}

const { EVAL_SOURCES, MAX_FALSE_ALARMS, runG2Eval, scoreG2 } = await import(
  '../src/features/content/ai/evals/g2-claims'
)
const { dbCallLog } = await import('../src/features/content/ai/calls')
const { extractFacts } = await import('../src/features/content/ai/extract')
const { checkClaims } = await import('../src/features/content/ai/source-check')

type Outcome = Parameters<typeof scoreG2>[0][number]

const POST_ID = 'eval'

// The database holds the daily caps; without it every capped call would be refused as over the cap.
try {
  await dbCallLog.countToday('pro', new Date().toISOString().slice(0, 10))
} catch {
  console.error('The database is not reachable: ai_call counts the daily caps. Run bun run db:up.')
  process.exit(1)
}

const run = await runG2Eval({
  extract: (source) => extractFacts({ ...source, postId: POST_ID }),
  check: (source, claims) => checkClaims({ claims, source, previous: null, postId: POST_ID }),
})
if (!run.ok) {
  console.error(run.error)
  process.exit(1)
}

const { planted, misses, alarms, passed } = scoreG2(run.outcomes)

function show(label: string, o: Outcome): void {
  const paragraph = EVAL_SOURCES.find((s) => s.id === o.case.source)?.paragraphs[
    o.case.paragraph - 1
  ]
  console.log(`${label} [${o.case.source}${o.case.planted ? `, ${o.case.planted}` : ''}]`)
  console.log(`  claim:     ${o.case.claim}`)
  console.log(`  paragraph: ${paragraph}`)
  console.log(`  verdict:   ${o.verdict}`)
}
for (const o of misses) show('MISS', o)
for (const o of alarms) show('FALSE ALARM', o)

console.log(
  `${run.outcomes.length} claims · planted caught ${planted - misses.length}/${planted} (bar: all) · false alarms ${alarms.length} (bar: at most ${MAX_FALSE_ALARMS})`,
)
console.log(passed ? 'PASS' : 'FAIL')
process.exit(passed ? 0 : 1)
