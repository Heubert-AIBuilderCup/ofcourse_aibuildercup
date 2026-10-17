// The finder's live quality eval (criteria 12, 13 and 14, and the floor for 8): every query in
// src/features/finder/evals/queries.ts through searchCourses on the real embedding model, against a
// seeded course_doc. It prints the demo queries' top 5, the negatives, the held-out hit@3, and the
// best scores of the held-out hits beside those of nonsense strings, with the floor they suggest.
//   DATABASE_URL=… GOOGLE_CLOUD_PROJECT=… GOOGLE_CLOUD_LOCATION=global bun run finder:eval
// Exit 1 unless every demo query and every negative passes and at least 16 of 20 held-out queries hit.

import { count, ne } from 'drizzle-orm'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set: the eval reads a seeded course_doc.')
  process.exit(1)
}

const { aiConfig } = await import('../src/features/content/ai/config')
if (aiConfig(process.env).provider === 'fake') {
  console.error('AI_PROVIDER is fake: a fake embedding cannot measure meaning.')
  process.exit(1)
}

const { DEMO_QUERIES, HELD_OUT_QUERIES, NEGATIVE_QUERIES } = await import(
  '../src/features/finder/evals/queries'
)
const { searchCourses } = await import('../src/features/finder/server/search')
const { embedModelName, embedTexts } = await import('../src/features/finder/server/embed')
const { FINDER_FLOOR } = await import('../src/features/finder/model/config')
const { searchWithRetry } = await import('../src/features/finder/server/retry')
const { FIELDS } = await import('../src/features/roads/data/fields')
const { db } = await import('../src/shared/lib/db')
const { courseDoc } = await import('../src/shared/lib/db/schema')

/** Held-out queries that must hit for the eval to pass (criterion 14). */
const HELD_OUT_PASS = 16
const NONSENSE = [
  'asdf',
  'qwerty uiop',
  'the',
  '123',
  'zzzz',
  'lorem ipsum',
  'blue',
  'hmm',
  'ok',
  '...',
]

const model = embedModelName()
/** The student id the eval searches as: its query vectors are cached apart from any student's. */
const EVAL_USER = 'finder-eval'
const [{ rows }] = await db.select({ rows: count() }).from(courseDoc)
const [{ other }] = await db
  .select({ other: count() })
  .from(courseDoc)
  .where(ne(courseDoc.embeddingModel, model))
if (rows === 0 || other > 0) {
  console.error(
    `course_doc holds ${rows} rows, ${other} not embedded by ${model}: run bun run finder:seed.`,
  )
  process.exit(1)
}

type Hit = { name: string; graphField: string; score: number }
type Run = { best: number; hits: Hit[]; error?: string }

/**
 * A query's best score and its nearest courses (none when under FINDER_FLOOR or when it failed),
 * with the action's time limit and one quiet retry, so the eval measures what a student gets.
 */
async function run(text: string): Promise<Run> {
  try {
    const result = await searchWithRetry((signal) => searchCourses(EVAL_USER, text, {}, signal))
    if (typeof result === 'symbol') return { best: 0, hits: [], error: 'timeout' }
    if (result.kind === 'nothing-close') return { best: result.best, hits: [] }
    return { best: result.hits[0]?.score ?? 0, hits: result.hits }
  } catch (e) {
    return { best: 0, hits: [], error: e instanceof Error ? e.name : String(e) }
  }
}

const inTop3 = (r: Run, fields: readonly string[]) =>
  r.hits.slice(0, 3).some((h) => fields.includes(h.graphField))
const rankOf = (r: Run, fields: readonly string[]) => {
  const i = r.hits.findIndex((h) => fields.includes(h.graphField))
  return i < 0 ? 'not in the top 10' : `rank ${i + 1}`
}
const line = (h: Hit, i: number) =>
  `   ${i + 1}. ${h.score.toFixed(3)}  ${h.name} [${h.graphField}]`
/** Prints a run's first n hits, or why it has none. */
function show(r: Run, n: number): void {
  if (r.error) console.log(`   search failed (${r.error})`)
  else if (r.hits.length === 0) console.log(`   nothing close (best ${r.best.toFixed(3)})`)
  for (const [i, h] of r.hits.slice(0, n).entries()) console.log(line(h, i))
}
const fieldIds = new Set(FIELDS.map((f) => f.id))

console.log(`finder eval · ${new Date().toISOString().slice(0, 10)} · ${model} · ${rows} courses`)
console.log(`floor in use ${FINDER_FLOOR}\n`)

// The client and its credentials load on the first call, which can outlast the search's 2-second
// timeout: one call outside it, so every query below is timed warm (criterion 7 is about warm).
await embedTexts(['warm up'], 'RETRIEVAL_QUERY')

// 1. Demo queries: an expected field in the top three.
let failed = 0
console.log('Demo queries (an expected field in the top 3)')
for (const q of DEMO_QUERIES) {
  const r = await run(q.text)
  const missing = q.expect.filter((id) => !fieldIds.has(id))
  const pass = missing.length === 0 && inTop3(r, q.expect)
  if (!pass) failed++
  const verdict =
    missing.length > 0
      ? `FAIL · cannot pass: no such field (${missing.join(', ')})`
      : `${pass ? 'PASS' : 'FAIL'} · ${q.expect.join('/')} at ${rankOf(r, q.expect)}`
  console.log(`- "${q.text}"\n  ${verdict}`)
  show(r, 5)
}

// 2. Negatives: none of the named fields in the top three.
console.log('\nNegative queries (none of the named fields in the top 3)')
for (const q of NEGATIVE_QUERIES) {
  const r = await run(q.text)
  const pass = !inTop3(r, q.notInTop3)
  if (!pass) failed++
  console.log(`- "${q.text}" · ${pass ? 'PASS' : 'FAIL'} · top 3:`)
  show(r, 3)
}

// 3. Held-out hit@3.
const hitBests: number[] = []
const misses: { text: string; expect: string[]; run: Run }[] = []
for (const q of HELD_OUT_QUERIES) {
  const r = await run(q.text)
  if (inTop3(r, q.expect)) hitBests.push(r.best)
  else misses.push({ text: q.text, expect: q.expect, run: r })
}
const hits = hitBests.length
console.log(`\nHeld-out hit@3: ${hits} of ${HELD_OUT_QUERIES.length} (pass at ${HELD_OUT_PASS})`)
for (const m of misses) {
  console.log(`- miss: "${m.text}" expects ${m.expect.join('/')} (${rankOf(m.run, m.expect)})`)
  show(m.run, 3)
}

// 4. The floor: between the best nonsense score and the weakest held-out hit.
const nonsense: { text: string; best: number }[] = []
for (const text of NONSENSE) nonsense.push({ text, best: (await run(text)).best })
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b).map((x) => x.toFixed(3))
console.log('\nBest scores')
console.log(`- held-out hits (${hits}): ${sorted(hitBests).join(' ')}`)
console.log(`- nonsense: ${nonsense.map((n) => `"${n.text}" ${n.best.toFixed(3)}`).join(' · ')}`)
const highNonsense = Math.max(...nonsense.map((n) => n.best))
const lowHit = hits > 0 ? Math.min(...hitBests) : Number.NaN
const suggested = Math.round(((highNonsense + lowHit) / 2) * 1000) / 1000
console.log(
  `- highest nonsense ${highNonsense.toFixed(3)} · lowest held-out hit ${lowHit.toFixed(3)}` +
    `${highNonsense >= lowHit ? ' · they overlap' : ''}`,
)
console.log(`Suggested FINDER_FLOOR: ${suggested} (in use: ${FINDER_FLOOR})`)

const pass = failed === 0 && hits >= HELD_OUT_PASS
console.log(`\n${pass ? 'PASS' : 'FAIL'} · ${failed} demo or negative failing · held-out ${hits}`)
process.exit(pass ? 0 : 1)
