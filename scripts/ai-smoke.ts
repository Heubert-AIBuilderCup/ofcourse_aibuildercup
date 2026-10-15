// One live call per use case, straight to the Vertex provider so a rejected schema or a bad model
// name shows as the error it is, not as a quiet fallback. Run: bun run ai:smoke
// Needs AI_PROVIDER=vertex, GOOGLE_CLOUD_PROJECT and the model names; see the plan's environment.
// GEMINI_LITE_MODEL is optional: the lite tier (the source check here) uses the Flash model when
// it is unset.

// A module, so top-level await is allowed.
export {}

// Bun loads .env itself; a variable already set in the shell wins.
if (process.env.AI_PROVIDER !== 'vertex') {
  console.error('Set AI_PROVIDER=vertex.')
  process.exit(1)
}

const { aiConfig } = await import('../src/features/content/ai/config')
const { vertexProvider } = await import('../src/features/content/ai/vertex')
const { toModelSchema } = await import('../src/features/content/ai/schema-guard')
const {
  BLOG_OUTLINE,
  BLOG_TEXT,
  CHARACTER_PLAN,
  COMIC_STORY,
  DRAFT,
  DRAFT_SLIDE,
  EXTRACT,
  IDEAS,
  SCENE_PLAN,
  SOURCE_CHECK,
  buildPrompt,
  guidelineText,
} = await import('../src/features/content/ai/prompts')
const { RESEARCH_CLAIM, SUGGEST_SOURCES } = await import('../src/features/content/ai/search')
const { DEMO_SOURCES } = await import('../src/features/content/demo-sources')
const { pathById, pathFacts } = await import('../src/features/content/lib/path-facts')
const { sentences } = await import('../src/features/content/text/sentences')
const { LOOKS, templateById } = await import('../src/features/content/templates')
const { textNudge } = await import('../src/features/content/nudges')
const { FEED_BRAND } = await import('../src/features/content/brands')

const config = aiConfig(process.env)
const provider = vertexProvider(config)
const TIMEOUT_MS = 60_000
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

const missing = [
  config.project ? null : 'GOOGLE_CLOUD_PROJECT',
  config.models.flash ? null : 'GEMINI_FLASH_MODEL',
  config.models.pro ? null : 'GEMINI_PRO_MODEL',
  config.models.image ? null : 'GEMINI_IMAGE_MODEL',
].filter((name) => name !== null)
if (missing.length > 0) {
  console.error(`Set ${missing.join(', ')}.`)
  process.exit(1)
}

/** The paragraphs and facts of the first demo source, the way draftStructures reads a source. */
function sourceData() {
  const source = DEMO_SOURCES[0]
  if (!source) throw new Error('The demo source is missing')
  const paragraphs = source.text.split('\n\n').map((text, i) => ({ ref: `¶${i + 1}`, text }))
  const facts = paragraphs
    .slice(0, 3)
    .flatMap((p) => sentences(p.text))
    .map((text, i) => ({ id: `f${i + 1}`, text }))
  return { paragraphs, facts }
}

/** The draft the-line prompt, built from the first demo source the way draftStructures builds it. */
function draftData() {
  const template = templateById('the-line')
  if (!template) throw new Error('The-line template is missing')
  const { paragraphs, facts } = sourceData()
  return {
    template: {
      id: template.id,
      name: template.name,
      slides: template.slides.map(({ spec, repeat }) => ({
        kind: spec.kind,
        repeat,
        slots: spec.slots.map(({ key, label, factual, limit }) => ({ key, label, factual, limit })),
      })),
    },
    tone: FEED_BRAND.tone,
    market: 'default',
    facts,
    paragraphs,
  }
}

/** The ideas prompt over the demo source's facts, as suggestIdeas builds it (no editor intent, no place). */
function ideasData() {
  const { paragraphs, facts } = sourceData()
  return {
    editor_intent: null,
    brand_voice: guidelineText('copy'),
    looks: LOOKS.map((t) => ({ id: t.id, name: t.name, line: t.description })),
    places: [],
    avoid: [],
    facts,
    paragraphs,
  }
}

/** A Field Notes version of two slides, both with an art box: the cover and a picture slide. */
function fieldNotesSlides() {
  const template = templateById('field-notes')
  const picture = template?.layouts?.picture
  const cover = template?.layouts?.cover
  const fact = sourceData().facts[1]
  if (!template || !picture || !cover || !fact)
    throw new Error('The Field Notes pieces are missing')
  return { template, cover, picture, fact }
}

/** The scene-plan prompt for those two slides, as planScenes builds it. */
function scenePlanData() {
  const { template, fact } = fieldNotesSlides()
  return {
    look: { id: template.id, name: template.name, line: template.description },
    panorama: false,
    idea: [{ angle: 'The 20-hour line', hook: 'Work up to 20 hours and your grades hold.' }],
    emotion: null,
    guideline: guidelineText('image'),
    slides: [
      { slide: 1, layout: 'cover', text: ['Study and work', 'The 20-hour line'] },
      { slide: 2, layout: 'picture', text: ['Up to 20 hours', fact.text] },
    ],
  }
}

/** The draft-slide prompt for the picture slide with the shorter chip, as redraftSlide builds it. */
function nudgedSlideData() {
  const { cover, picture, fact } = fieldNotesSlides()
  const nudge = textNudge('shorter')
  if (!nudge) throw new Error('The shorter nudge is missing')
  const texts: Record<string, string> = { heading: 'Up to 20 hours', body: fact.text }
  return {
    angle: 'The 20-hour line',
    slide: { number: 2, kind: picture.kind },
    slots: picture.slots.map(({ key, label, factual, limit }) => ({
      key,
      label,
      factual,
      limit,
      text: texts[key] ?? '',
      fact_ids: factual ? [fact.id] : [],
    })),
    facts: [fact],
    others: [{ number: 1, kind: cover.kind, text: ['Study and work', 'The 20-hour line'] }],
    brand_voice: guidelineText('copy'),
    emotion: null,
    nudge: nudge.instruction,
  }
}

/** The blog outline prompt over the demo source's facts for one angle, as outlineBlog builds it. */
function blogOutlineData() {
  return {
    angle: {
      angle: 'The 20-hour line',
      hook: 'Work up to 20 hours and your grades hold.',
      audience: 'International students',
    },
    editor_intent: null,
    brand_voice: guidelineText('copy'),
    facts: sourceData().facts,
  }
}

/** The comic story prompt over the ecu-cyber path's facts, no premise or emotion, as draftStory builds it. */
function comicStoryData() {
  const path = pathById('ecu-cyber')
  const facts = pathFacts('ecu-cyber')?.facts
  if (!path || !facts) throw new Error('The ecu-cyber path is missing')
  return {
    path: path.label,
    premise: null,
    emotion: null,
    brand_voice: guidelineText('copy'),
    facts: facts.map(({ id, text }) => ({ id, text })),
  }
}

type Spec =
  | typeof EXTRACT
  | typeof DRAFT
  | typeof SOURCE_CHECK
  | typeof IDEAS
  | typeof SCENE_PLAN
  | typeof DRAFT_SLIDE
  | typeof BLOG_OUTLINE
  | typeof BLOG_TEXT
  | typeof COMIC_STORY
  | typeof CHARACTER_PLAN
const JSON_CASES: { label: string; spec: Spec; data: unknown }[] = [
  { label: 'extract', spec: EXTRACT, data: EXTRACT.example.data },
  { label: 'draft (the-line)', spec: DRAFT, data: draftData() },
  { label: 'source_check', spec: SOURCE_CHECK, data: SOURCE_CHECK.example.data },
  { label: 'ideas', spec: IDEAS, data: ideasData() },
  { label: 'scene_plan (field notes)', spec: SCENE_PLAN, data: scenePlanData() },
  { label: 'draft_slide (shorter)', spec: DRAFT_SLIDE, data: nudgedSlideData() },
  { label: 'blog_outline', spec: BLOG_OUTLINE, data: blogOutlineData() },
  { label: 'blog_text', spec: BLOG_TEXT, data: BLOG_TEXT.example.data },
  { label: 'comic_story (ecu-cyber)', spec: COMIC_STORY, data: comicStoryData() },
  // The example's description is the studio's default one.
  { label: 'character_plan', spec: CHARACTER_PLAN, data: CHARACTER_PLAN.example.data },
]

/** The calls with Google Search: the same JSON answer, grounded on the pages the search found. */
type SearchSpec = typeof SUGGEST_SOURCES | typeof RESEARCH_CLAIM
const SEARCH_CASES: { label: string; spec: SearchSpec; data: unknown }[] = [
  {
    label: 'suggest_sources',
    spec: SUGGEST_SOURCES,
    // As findSources builds it.
    data: {
      idea: 'student work hours in Australia',
      audience: 'international students',
      brand_voice: guidelineText('copy'),
    },
  },
  { label: 'research_claim', spec: RESEARCH_CLAIM, data: RESEARCH_CLAIM.example.data },
]

type Row = { label: string; model: string; ms: number; ok: boolean; error?: string }
const rows: Row[] = []

async function timed(label: string, model: string, run: () => Promise<void>): Promise<boolean> {
  const started = Date.now()
  try {
    await run()
    rows.push({ label, model, ms: Date.now() - started, ok: true })
    return true
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    rows.push({ label, model, ms: Date.now() - started, ok: false, error })
    return false
  }
}

for (const { label, spec, data } of JSON_CASES) {
  const model = config.models[spec.tier]
  await timed(label, model, async () => {
    const { system, user } = buildPrompt(spec, data)
    // The schema goes through the allowlist and to Gemini exactly as in production.
    const text = await provider.json({
      model,
      system,
      user,
      temperature: spec.temperature,
      jsonSchema: toModelSchema(spec.schema),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      useCase: spec.useCase,
      tier: spec.tier,
      promptVersion: spec.version,
      data,
    })
    const parsed = spec.schema.safeParse(JSON.parse(text))
    if (!parsed.success)
      throw new Error(`The answer does not fit the schema: ${parsed.error.message}`)
  })
}

for (const { label, spec, data } of SEARCH_CASES) {
  const model = config.models.flash
  await timed(label, model, async () => {
    if (!provider.search) throw new Error('The provider has no search')
    const { system, user } = buildPrompt(spec, data)
    const answer = await provider.search({
      model,
      system,
      user,
      temperature: spec.temperature,
      jsonSchema: toModelSchema(spec.schema),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      useCase: spec.useCase,
      tier: spec.tier,
      promptVersion: spec.version,
      data,
    })
    const parsed = spec.schema.safeParse(JSON.parse(answer.text))
    if (!parsed.success)
      throw new Error(`The answer does not fit the schema: ${parsed.error.message}`)
    if (answer.sources.length === 0) throw new Error('The answer is grounded on no page')
  })
}

const IMAGE_PROMPT =
  'A quiet reading room at night, warm desk lamps, seen from a high corner, soft grain.'

await timed('image', config.models.image, async () => {
  const bytes = await provider.image({
    model: config.models.image,
    prompt: IMAGE_PROMPT,
    aspectRatio: '4:5',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    useCase: 'art',
    tier: 'image',
    promptVersion: 'image.v1',
    data: { prompt: IMAGE_PROMPT },
  })
  if (!PNG_MAGIC.every((byte, i) => bytes[i] === byte)) throw new Error('The image is not a PNG')
})

for (const row of rows) {
  console.log(`${row.label} · ${row.model} · ${row.ms} ms · ${row.ok ? 'ok' : 'failed'}`)
  if (row.error) console.log(`  ${row.error.slice(0, 500)}`)
}

const failed = rows.filter((row) => !row.ok)
process.exit(failed.length > 0 ? 1 : 0)
