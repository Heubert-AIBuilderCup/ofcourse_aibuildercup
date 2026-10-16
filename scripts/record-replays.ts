// Records the demo sources' live model answers as exact-match replays (criteria 4 and 37), and the
// cover art of the-line. For each demo source: extraction, a draft per template, the source check
// per draft, and the cover. Run by hand with Google Cloud access: bun run ai:replays
// It writes src/features/content/ai/replays/<key>.json, regenerates replays/index.ts and saves
// src/features/content/demo-sources/covers/<key>.png.
// Needs AI_PROVIDER=vertex, the Google Cloud settings and the database (ai_call counts the daily caps).

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Bun loads .env itself; a variable already set in the shell wins.
if (process.env.AI_PROVIDER !== 'vertex') {
  console.error('Set AI_PROVIDER=vertex.')
  process.exit(1)
}

const { coverArt } = await import('../src/features/content/ai/art')
const { dbCallLog } = await import('../src/features/content/ai/calls')
const { draftStructures } = await import('../src/features/content/ai/draft')
const { extractFacts } = await import('../src/features/content/ai/extract')
const { onLiveResult } = await import('../src/features/content/ai/replays')
const { runSourceCheck } = await import('../src/features/content/ai/source-check')
const { DEMO_SOURCES } = await import('../src/features/content/demo-sources')
const { TEMPLATES } = await import('../src/features/content/templates')

const REPLAYS_DIR = join(process.cwd(), 'src/features/content/ai/replays')
const COVERS_DIR = join(process.cwd(), 'src/features/content/demo-sources/covers')
const COVER_TEMPLATE = 'the-line'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

// The database holds the daily caps; without it every Pro call would be refused as over the cap.
try {
  await dbCallLog.countToday('pro', new Date().toISOString().slice(0, 10))
} catch {
  fail('The database is not reachable: ai_call counts the daily caps. Run bun run db:up.')
}

/** A key that is a valid identifier is written bare, as the formatter would. */
const property = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`)

/** replays/index.ts: one static JSON import per recording on disk, so a partial run keeps the rest. */
async function writeIndex(): Promise<void> {
  const keys = (await readdir(REPLAYS_DIR))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort()
  const imports = keys.map((key, i) => `import r${i} from './${key}.json'`)
  const entries = keys.map((key, i) => `  ${property(key)}: r${i},`)
  const lines = [
    "// Recorded model answers, one entry per demo source, keyed by step. Task 21's script regenerates this file.",
    ...imports,
    '',
    'export const REPLAYS: Record<string, Record<string, unknown>> = {',
    ...entries,
    '}',
    '',
  ]
  await writeFile(join(REPLAYS_DIR, 'index.ts'), lines.join('\n'))
}

/** Object keys in order, so a re-recording changes only what the model changed. */
const sorted = (record: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))

for (const demo of DEMO_SOURCES) {
  const postId = `replay-${demo.key}`
  const recorded: Record<string, unknown> = {}
  onLiveResult((key, step, value) => {
    if (key === demo.key) recorded[step] = value
  })
  console.log(`${demo.key}: extracting`)

  const extracted = await extractFacts({
    title: demo.title,
    kind: demo.kind,
    text: demo.text,
    postId,
  })
  if (!extracted.ok) fail(`${demo.key}: extraction failed: ${extracted.error}`)
  if (extracted.source.demoKey !== demo.key) fail(`${demo.key}: the source is not recognised.`)
  // A recording made from a recording would only repeat itself.
  if (extracted.replays.length > 0) fail(`${demo.key}: extraction fell back to a replay.`)

  console.log(`${demo.key}: drafting ${TEMPLATES.length} templates`)
  const drafted = await draftStructures({
    templateIds: TEMPLATES.map((t) => t.id),
    source: extracted.source,
    facts: extracted.facts,
    attempt: 1,
    postId,
  })
  if (!drafted.ok) fail(`${demo.key}: drafting failed: ${drafted.error}`)
  if (drafted.replays.length > 0) fail(`${demo.key}: drafting fell back to a replay.`)

  // A source check's step key is a hash of the claim's text, so drafts that say the same thing
  // share a recording and no draft's recording answers a different claim.
  for (const item of drafted.items) {
    console.log(`${demo.key}: checking ${item.template.id}`)
    const checked = await runSourceCheck({
      structure: item.structure,
      template: item.template,
      facts: extracted.facts,
      source: extracted.source,
      previous: null,
      postId,
    })
    if (!checked.ok) fail(`${demo.key}: source check failed: ${checked.error}`)
    if (checked.replays.length > 0) fail(`${demo.key}: the source check fell back to a replay.`)
  }

  const cover = drafted.items.find((item) => item.template.id === COVER_TEMPLATE)
  if (!cover) fail(`${demo.key}: no ${COVER_TEMPLATE} draft.`)
  console.log(`${demo.key}: drawing the cover`)
  // No demoKey and no cache: a failure must not quietly keep the old cover.
  const art = await coverArt(
    { prompt: cover.structure.artPrompt, demoKey: null, postId },
    { cached: async () => null, remember: async () => {} },
  )
  if (!art.ok) fail(`${demo.key}: the art prompt was refused: ${art.error}`)
  if (art.art.bytes === null) fail(`${demo.key}: the image model gave no cover.`)

  onLiveResult(null)
  await mkdir(COVERS_DIR, { recursive: true })
  await writeFile(join(COVERS_DIR, `${demo.key}.png`), art.art.bytes)
  await writeFile(
    join(REPLAYS_DIR, `${demo.key}.json`),
    `${JSON.stringify(sorted(recorded), null, 2)}\n`,
  )
  await writeIndex()
  console.log(`${demo.key}: ${Object.keys(recorded).length} steps and a cover recorded`)
}

console.log('Done. Review the recordings, then run bun run lint:fix and the tests.')
process.exit(0)
