// The real-Gemini check of the student calls (criteria 76–78): the cases in
// src/features/roads/evals/check-cases.ts, each one call through the app's real client, so its
// checks and its ai_call log apply, with the cache bypassed and every spec pinned to Flash-Lite
// (one attempt per call). One shared counter stops the run at the number of cases it runs.
//   DATABASE_URL=…/student_roads AI_DAILY_CAP_PRO=0 bun run ai:smoke:student [--only <label>]…
// Guards first: the real provider, Pro capped at 0, a Flash-Lite model, the student_roads database.

import type { Pin } from '../src/features/roads/evals/check-cases'

const { CHECK_CASES } = await import('../src/features/roads/evals/check-cases')
const { aiConfig } = await import('../src/features/content/ai/config')

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

// --only <label>, repeatable: only those cases. Anything else stops the run before any call.
const only: string[] = []
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const label = args[i + 1]
  if (args[i] !== '--only' || !label) fail('Usage: bun run ai:smoke:student [--only <label>]…')
  only.push(label)
  i++
}
const labels = new Set(CHECK_CASES.map((c) => c.label))
const unknown = only.filter((label) => !labels.has(label))
if (unknown.length > 0)
  fail(`No case named ${unknown.join(', ')}. The cases: ${[...labels].join(', ')}.`)
const cases = only.length > 0 ? CHECK_CASES.filter((c) => only.includes(c.label)) : CHECK_CASES

// Guards: before any import that reaches the database or a model.
const env = process.env
const config = aiConfig(env)
if (config.provider === 'fake') fail('AI_PROVIDER is fake: set it to vertex.')
if (env.AI_DAILY_CAP_PRO !== '0') fail('AI_DAILY_CAP_PRO must be 0: the check never reaches Pro.')
if (!env.GEMINI_LITE_MODEL?.trim()) fail('GEMINI_LITE_MODEL is not set: the check runs Flash-Lite.')
if (!env.DATABASE_URL?.endsWith('/student_roads'))
  fail('DATABASE_URL must end with /student_roads: the check writes only to that database.')

console.log(`provider ${config.provider} · project ${config.project ?? '(none)'}`)
console.log(
  `models · lite ${config.models.lite} · flash ${config.models.flash || '(none)'} · pro ${config.models.pro || '(none)'}`,
)

const { makeAi } = await import('../src/features/content/ai/client')
const { recording } = await import('../src/features/content/ai/recording')
const { vertexProvider } = await import('../src/features/content/ai/vertex')
const { dbCallLog } = await import('../src/features/content/ai/calls')
const { dbCache } = await import('../src/features/content/ai/cache')

// Its own client, never the app's `ai`: the recording provider sees each attempt and holds the cap.
const rec = recording(vertexProvider(config), { cap: cases.length })
const ai = makeAi({ provider: rec.provider, config, calls: dbCallLog, cache: dbCache })
const pin: Pin = (spec) => ({ ...spec, maxTier: 'lite' })

let failed = 0
for (const c of cases) {
  const before = rec.attempts.length
  let problems: string[]
  try {
    problems = await c.run(ai, pin)
  } catch (err) {
    problems = [err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500)]
  }
  const attempts = rec.attempts.slice(before)
  const ok = problems.length === 0 && attempts.length > 0 && attempts.every((a) => a.ok)
  if (!ok) failed++
  if (attempts.length === 0) console.log(`${c.label} · no call · failed`)
  for (const a of attempts) {
    console.log(`${c.label} · ${a.model} · ${a.ms} ms · ${ok ? 'ok' : 'failed'}`)
    if (a.error) console.log(`  error: ${a.error}`)
  }
  for (const problem of problems) console.log(`  problem: ${problem}`)
}

console.log(
  `${failed === 0 ? 'PASS' : `FAIL (${failed} of ${cases.length})`} · ${rec.attempts.length} attempts made`,
)
process.exit(failed === 0 ? 0 : 1)
