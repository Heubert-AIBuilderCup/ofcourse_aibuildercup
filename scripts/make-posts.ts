// Makes admin feed posts end to end from a spec file, without the content workbench: idea or
// source, idea cards, outline, text versions, the pick and its fixes, the preset, approval, the
// images, the source check, settings, review and approval, live. Every step is the server command
// the workbench's action calls (src/features/content/server/commands); no row is written by hand.
//   bun --conditions react-server scripts/make-posts.ts <spec.json> [--as <email>] [--png-dir <dir>]
// The spec is an array of posts (scripts/make-posts-plan.ts parseSpec). The last post is made
// first, so the first, approved last, shows first in the feed (newest approval first). A post
// given by `id` is published again in its place (Edit on the live post, then the same steps from
// the text on), which is how posts made before take their place in the order.
// Bun loads .env and .env.local itself, so the database and the model are the dev server's.
// The commands run work after the response with Next's after(); here each such task runs at once
// and the script awaits it before the next step. A post may carry its own pictures (`art`): each
// SVG is drawn to PNG and kept in the art cache under the key Draw images reads for its slide
// (scripts/make-posts-art.ts), so Draw images uses it and the image model is never asked;
// --png-dir writes each PNG there too.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { and, count, eq, sql } from 'drizzle-orm'
import type { ActionResult } from '../src/shared/types/action-result'
import {
  type Account,
  chooseActors,
  closestFact,
  ideaTitle,
  nextFix,
  type PostSpec,
  parseSpec,
  runOrder,
  scenesFor,
  settingsFor,
  wordingFits,
} from './make-posts-plan'

const args = process.argv.slice(2)
const VALUED = ['--as', '--png-dir']
const option = (name: string) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}
const asEmail = option('--as')
const pngDir = option('--png-dir')
const specPath = args.find((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1] ?? ''))
if (!specPath) {
  console.error(
    'Usage: bun --conditions react-server scripts/make-posts.ts <spec.json> [--as <email>] [--png-dir <dir>]',
  )
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
// Only the local dev database unless asked: the host and name, never the credentials, are shown.
const where = new URL(url)
const local = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(where.hostname)
if (!local && !args.includes('--allow-remote')) {
  console.error(
    `Refusing ${where.hostname}: not a local database (pass --allow-remote to mean it).`,
  )
  process.exit(1)
}

let raw: unknown
try {
  raw = JSON.parse(readFileSync(specPath, 'utf8'))
} catch (err) {
  console.error(`Could not read ${specPath}:`, err instanceof Error ? err.message : err)
  process.exit(1)
}
const spec = parseSpec(raw)
if (!spec.ok) {
  for (const e of spec.errors) console.error(e)
  process.exit(1)
}

// No request here for after(): each task runs at once, kept to await before the next step.
const pending = new Set<Promise<unknown>>()
const { scheduleWith } = await import('../src/features/content/server/after')
scheduleWith((task) => {
  const running: Promise<unknown> = task()
    .catch((err) => console.error('[make-posts] after-task', err))
    .finally(() => pending.delete(running))
  pending.add(running)
})
async function drain(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending])
}

const { db } = await import('../src/shared/lib/db')
const { aiCall, user } = await import('../src/shared/lib/db/schema')
const commands = await import('../src/features/content/server/commands')
const { loadPost } = await import('../src/features/content/server/store')
const { failedNow } = await import('../src/features/content/server/steps')
const { draftFitChecks } = await import('../src/features/content/server/preview')
const { versionStatus } = await import('../src/features/content/lib/version-status')
const { unboundSlots } = await import('../src/features/content/lib/claims')
const { searchTitleOf } = await import('../src/features/content/lib/comic-rules')
const { IDEA_KIND } = await import('../src/features/content/model/artifacts')
const { PRESETS } = await import('../src/features/content/brands/guideline')
const { languageById } = await import('../src/features/content/languages')
const { artDeps, imagesOf } = await import('../src/features/content/server/commands/shared')
const { imageAspect } = await import('../src/features/content/ai/art')
const { artKey, svgToPng } = await import('./make-posts-art')

type Actor = import('../src/features/content/server/commands').Actor
type LoadedPost = NonNullable<Awaited<ReturnType<typeof loadPost>>>

/** A step that failed: its name and the command's reason. */
class StepFailed extends Error {
  constructor(
    readonly step: string,
    readonly reason: string,
  ) {
    super(`${step}: ${reason}`)
  }
}

const actorOf = (a: Account): Actor => ({
  id: a.id,
  role: a.role,
  editor: a.editor,
  reviewer: a.reviewer,
  name: a.name,
})

async function accounts(): Promise<Account[]> {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      editor: user.editor,
      reviewer: user.reviewer,
      suspendedAt: user.suspendedAt,
    })
    .from(user)
    .where(
      sql`${user.role} = 'superadmin' or ${user.editor} or ${user.reviewer} or ${user.email} = ${asEmail ?? ''}`,
    )
    .orderBy(user.createdAt)
    .limit(500)
  return rows.map(({ suspendedAt, ...r }) => ({ ...r, suspended: suspendedAt !== null }))
}

async function load(id: string): Promise<LoadedPost> {
  const post = await loadPost(id)
  if (!post) throw new StepFailed('load', 'The post is gone.')
  return post
}

/** The post being made, so a failure names it. */
let making: string | null = null

/** "[2/3] <id> structures · write the slides": one line per step. */
let label = ''
const line = (post: LoadedPost, step: string) =>
  console.log(`${label} ${post.id} ${post.stage} · ${step}`)

/**
 * One command on the post at its current version, its after-response work awaited; a model step
 * is tried `tries` times. Throws StepFailed with the command's reason.
 */
async function step(
  id: string,
  name: string,
  call: (version: number) => Promise<ActionResult<unknown>>,
  tries = 1,
): Promise<LoadedPost> {
  let error = ''
  for (let i = 0; i < tries; i++) {
    const res = await call((await load(id)).version)
    await drain()
    if (res.ok) {
      const post = await load(id)
      line(post, name)
      return post
    }
    error = res.error
    console.log(`${label} ${id} · ${name} failed (${error})${i + 1 < tries ? ', again' : ''}`)
  }
  throw new StepFailed(name, error)
}

/** Why a step's last run on the post failed, if it did. */
async function stepFailure(id: string, name: string): Promise<string | null> {
  const { failed, reasons } = await failedNow(id)
  return failed.includes(name) ? JSON.stringify(reasons[name]) : null
}

const MODEL_TRIES = 2
/** At most this many presses on the text versions before approval. */
const TEXT_PRESSES = 12

/** The source check of the text the post points at, run now when the automatic one left none. */
async function ensureCheck(id: string, actor: Actor): Promise<LoadedPost> {
  const post = await load(id)
  if (post.current.sourceCheck) return post
  return step(id, 'source check', (v) => commands.checkSource(actor, id, v), MODEL_TRIES)
}

/**
 * The picked version made ready: the shorter chip on a slide that does not fit, or the next
 * version. With the spec's own words on some slides (`edited`), the version stays, and a problem
 * on one of those slides stops the post, named: our words are never reworded.
 */
async function readyText(
  id: string,
  actor: Actor,
  edited: ReadonlySet<number>,
): Promise<LoadedPost> {
  const tried = new Set<string>()
  const versionsTried = new Set<number>()
  let post = await load(id)
  for (let press = 0; press < TEXT_PRESSES; press++) {
    const { drafts, facts, source } = post.current
    const picked = post.pointers.picked
    if (!drafts || !facts || !source) throw new StepFailed('text', 'No versions to pick from.')
    const clean = drafts.body.items.flatMap((it, i) =>
      (it.problems ?? []).length === 0 ? [i] : [],
    )
    if (picked === null) {
      const first = clean.find((i) => !versionsTried.has(i))
      if (first === undefined) throw new StepFailed('pick', 'Every version has problems.')
      versionsTried.add(first)
      post = await step(id, `pick version ${first + 1}`, (v) =>
        commands.pickStructure(actor, id, v, first),
      )
      continue
    }
    versionsTried.add(picked)
    post = await ensureCheck(id, actor)
    const item = post.current.drafts?.body.items[picked]
    if (!item) throw new StepFailed('text', 'The picked version is gone.')
    const checks =
      draftFitChecks(
        { ...drafts.body, items: [item] },
        post.pointers.themeId,
        facts.body.facts,
        source.body.title,
        searchTitleOf(post, source.body.title),
        source.body.language,
      )[0] ?? []
    const { problems } = versionStatus(item, checks, facts.body.facts, [])
    const fix = nextFix(problems, tried)
    if (fix.kind === 'ready') return post
    if (edited.size > 0 && (fix.kind === 'next' || edited.has(fix.slide))) {
      throw new StepFailed(
        'text',
        `Our words do not fit: ${problems.map((p) => p.text).join('; ')}`,
      )
    }
    if (fix.kind === 'nudge') {
      tried.add(`nudge:${fix.slide}`)
      post = await step(
        id,
        `shorter on slide ${fix.slide} (${problems[0].text})`,
        (v) => commands.nudgeSlide(actor, id, v, { slide: fix.slide, nudge: 'shorter' }),
        MODEL_TRIES,
      )
    } else {
      const next = clean.find((i) => !versionsTried.has(i))
      if (next === undefined) {
        throw new StepFailed(
          'text',
          `No version is ready: ${problems.map((p) => p.text).join('; ')}`,
        )
      }
      console.log(`${label} ${id} · version ${picked + 1}: ${problems[0].text}`)
      versionsTried.add(next)
      post = await step(id, `pick version ${next + 1}`, (v) =>
        commands.pickStructure(actor, id, v, next),
      )
    }
  }
  throw new StepFailed('text', `Still not ready after ${TEXT_PRESSES} presses.`)
}

/** The text of a slide of the approved revision, every slot. */
function slideText(post: LoadedPost, slide: number): string {
  const at = post.current.revision?.body.structure.slides[slide - 1]
  return at
    ? Object.values(at.slots)
        .map((s) => s.text)
        .join('\n')
    : ''
}

/**
 * Each sentence the rendered post's check could not find: the source's wording when it is in the
 * post's script (wordingFits), else editorial opinion.
 */
async function settleClaims(id: string, actor: Actor): Promise<LoadedPost> {
  let post = await ensureCheck(id, actor)
  const worded = new Set<string>()
  for (let press = 0; press < TEXT_PRESSES; press++) {
    const claims = post.current.sourceCheck?.body.claims ?? []
    const at = claims.findIndex((c) => c.result === 'not_found')
    if (at < 0) return post
    const claim = claims[at]
    const script = languageById(post.current.source?.body.language ?? 'en')?.script ?? 'latin'
    if (claim.suggestion && wordingFits(claim.suggestion.text, script) && !worded.has(claim.text)) {
      worded.add(claim.text)
      const res = await commands.applySourceWording(actor, id, post.version, at)
      await drain()
      if (res.ok) {
        post = await ensureCheck(id, actor)
        line(post, `source's wording on slide ${claim.slide}`)
        if (post.stage !== 'rendered')
          throw new StepFailed('source wording', 'The post left Images.')
        continue
      }
      console.log(`${label} ${id} · source's wording refused (${res.error}), marking opinion`)
    }
    post = await step(id, `opinion on slide ${claim.slide}`, (v) =>
      commands.markOpinion(actor, id, v, at),
    )
  }
  throw new StepFailed('source check', 'Sentences still not found.')
}

/** A post made before, back to its text versions as a working copy ("Edit" on the live post). */
async function reopen(id: string, maker: Actor): Promise<LoadedPost> {
  making = id
  const post = await load(id)
  if (post.kind !== 'feed')
    throw new StepFailed('edit', `${id} is a ${post.kind}, not a feed post.`)
  // A post a failed run left part way is taken back to its text the way the workbench's moves do.
  switch (post.stage) {
    case 'live':
      return step(id, 'edit the live post', (v) => commands.editLive(maker, id, v))
    case 'structures':
      return post
    case 'in_review':
      await step(id, 'withdraw from review', (v) => commands.withdrawFromReview(maker, id, v))
      return step(id, 'back to text', (v) => commands.goBack(maker, id, v, 'structures'))
    case 'approved':
    case 'rendered':
      return step(id, 'back to text', (v) => commands.goBack(maker, id, v, 'structures'))
    default:
      throw new StepFailed('edit', `${id} is at ${post.stage}; take it back to its text first.`)
  }
}

/** A new post from the idea or the source, through its idea cards and outline to its text versions. */
async function start(spec: PostSpec, maker: Actor): Promise<LoadedPost> {
  const id = crypto.randomUUID()
  making = id
  const base = { requestId: id, postKind: spec.kind, language: spec.language }
  const input = spec.idea
    ? {
        ...base,
        links: [],
        title: spec.title ?? ideaTitle(spec.idea),
        kind: IDEA_KIND,
        text: spec.idea,
      }
    : { ...base, links: [spec.source ?? ''], title: spec.title ?? '' }
  const made = await commands.makePost(maker, input)
  await drain()
  if (!made.ok) {
    const failed = 'failed' in made && made.failed ? ` ${JSON.stringify(made.failed)}` : ''
    throw new StepFailed('make', `${made.error}${failed}`)
  }
  let post = await load(id)
  line(post, spec.idea ? 'made from the idea' : 'made from the source')

  // Idea cards: made with the post; "Try again" when that step failed.
  if (!post.current.ideas) {
    post = await step(id, 'idea cards', (v) => commands.moreIdeas(maker, id, v), MODEL_TRIES)
  } else line(post, `idea cards (${post.current.ideas.body.cards.length})`)
  const card = post.current.ideas?.body.cards[0]
  post = await step(
    id,
    `use idea 1 (${card?.look}: ${card?.hook})`,
    (v) => commands.pickIdeas(maker, id, v, { cards: [0] }),
    MODEL_TRIES,
  )
  return step(id, 'write the slides', (v) => commands.writeSlides(maker, id, v), MODEL_TRIES)
}

/** The picked version moved to the spec's look, each edited slide laid out again, then given its words. */
async function shapeText(post: LoadedPost, spec: PostSpec, maker: Actor): Promise<LoadedPost> {
  const { id } = post
  const index = post.pointers.picked
  if (index === null) throw new StepFailed('text', 'No version is picked to edit.')
  const template = post.current.drafts?.body.items[index]?.template.id
  if (spec.template && template !== spec.template) {
    const look = spec.template
    post = await step(id, `look ${look}`, (v) => commands.setLook(maker, id, v, { index, look }))
  }
  for (const edit of spec.edits) {
    const { slide, layout } = edit
    if (layout) {
      post = await step(id, `slide ${slide} as ${layout}`, (v) =>
        commands.setSlideLayout(maker, id, v, { index, slide, layout }),
      )
    }
    for (const [slot, text] of Object.entries(edit.text ?? {})) {
      // A factual slot with no source (a layout that derived nothing) is bound first, so our
      // words keep a fact behind them.
      const item = post.current.drafts?.body.items[index]
      const facts = post.current.facts?.body.facts ?? []
      const unbound =
        item &&
        unboundSlots(item.structure, item.template, facts).some(
          (u) => u.slide === slide && u.slot === slot && u.reason === 'No source',
        )
      const fact = unbound ? closestFact(text, facts) : null
      if (unbound && !fact) throw new StepFailed('text', `No fact says slide ${slide}'s ${slot}.`)
      if (fact) {
        post = await step(id, `slide ${slide} ${slot} bound to ${fact.id}`, (v) =>
          commands.fixUnbound(maker, id, v, { slide, slot, factId: fact.id }),
        )
      }
      post = await step(id, `slide ${slide} ${slot}: ${text}`, (v) =>
        commands.editSlot(maker, id, v, { slide, slot, text }),
      )
    }
  }
  return post
}

/** A PNG's height from its IHDR chunk. */
const pngHeight = (png: Uint8Array) => Buffer.from(png).readUInt32BE(20)

/**
 * Our own pictures, one for every slide the plan pictures: each slide's scene named as the spec
 * says, then its SVG drawn at its art box and kept under the key Draw images reads for it. The
 * key names no post, and a key kept before is not replaced (ai/cache.ts), so a scene worded as
 * another post's draws that post's picture: `pngs` lets the draw be checked.
 */
async function ownArt(
  post: LoadedPost,
  spec: PostSpec,
  maker: Actor,
): Promise<{ post: LoadedPost; pngs: Map<number, Uint8Array> }> {
  const pngs = new Map<number, Uint8Array>()
  const { id } = post
  const planned = post.current.artPlan?.body.scenes ?? []
  const bare = planned.filter((p) => !spec.art.some((a) => a.slide === p.slide))
  if (bare.length > 0) {
    const slides = bare.map((p) => p.slide).join(', ')
    throw new StepFailed(
      'art',
      `No picture given for slide ${slides}; nothing is left for the model.`,
    )
  }
  const unplanned = spec.art.filter((a) => !planned.some((p) => p.slide === a.slide))
  if (unplanned.length > 0) {
    const slides = unplanned.map((a) => a.slide).join(', ')
    throw new StepFailed('art', `Slide ${slides} has no picture in this look.`)
  }
  for (const art of spec.art) {
    const was = planned.find((p) => p.slide === art.slide)
    if (was?.scene === art.scene) continue
    post = await step(id, `scene for slide ${art.slide}`, (v) =>
      commands.editImageScene(maker, id, v, { slide: art.slide, text: art.scene }),
    )
  }
  const { layout, revision, render } = post.current
  if (!layout || !revision) throw new StepFailed('art', 'The text is not approved.')
  // The art version Draw images draws under (commands/images.ts drawImages).
  const set = post.stage === 'rendered' ? (render?.body.art.version ?? 1) : 1
  for (const art of spec.art) {
    const box = layout.body.slides[art.slide - 1]?.artBox
    if (!box) throw new StepFailed('art', `Slide ${art.slide} has no art box.`)
    const file = resolve(dirname(specPath as string), art.svg)
    const png = svgToPng(readFileSync(file, 'utf8'), box.w)
    if (pngHeight(png) !== box.h) {
      throw new StepFailed(
        'art',
        `${art.svg} is not ${box.w}x${box.h}, the art box of slide ${art.slide}.`,
      )
    }
    const key = artKey({
      scene: art.scene,
      emotion: revision.body.emotion ?? null,
      aspectRatio: imageAspect(box),
      set,
      slide: art.slide,
    })
    await artDeps.remember(key, png)
    pngs.set(art.slide, png)
    if (pngDir) {
      mkdirSync(pngDir, { recursive: true })
      writeFileSync(join(pngDir, `${id}-slide-${art.slide}.png`), png)
    }
    line(post, `picture for slide ${art.slide} from ${art.svg}`)
  }
  return { post, pngs }
}

/** Each of our pictures as the render drew it: refused when a slide shows any other. */
async function checkOwnArt(post: LoadedPost, pngs: Map<number, Uint8Array>): Promise<void> {
  const render = post.current.render
  const drawn = render ? ((await imagesOf(render.body))?.slideArt ?? []) : []
  for (const [slide, png] of pngs) {
    const bytes = drawn.find((a) => a.slide === slide)?.bytes
    if (!bytes || !Buffer.from(bytes).equals(Buffer.from(png))) {
      throw new StepFailed(
        'art',
        `Slide ${slide} shows a picture kept for another post under the same scene; word this post's scene its own way.`,
      )
    }
  }
}

/** How many images the model was asked for on the post. */
async function artCalls(id: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(aiCall)
    .where(and(eq(aiCall.postId, id), eq(aiCall.useCase, 'art')))
  return row?.n ?? 0
}

/**
 * A post made, or one made before published again: its text made ready in the look, approved,
 * its pictures drawn, its source check settled, its settings saved, sent to review and approved.
 */
async function makeOne(spec: PostSpec, maker: Actor, reviewer: Actor): Promise<string> {
  if (spec.kind === 'blog') throw new StepFailed('make', 'Blogs are not made by this script yet.')
  let post = spec.id ? await reopen(spec.id, maker) : await start(spec, maker)
  const { id } = post

  // The look: a preset on a look post, a brand theme on any other.
  const look = spec.look ?? 'pop'
  if (post.pointers.themeId !== look) {
    const preset = (PRESETS as readonly string[]).includes(look)
    post = await step(id, `look ${look}`, (v) =>
      preset
        ? commands.setPreset(maker, id, v, { preset: look as (typeof PRESETS)[number] })
        : commands.chooseTheme(maker, id, v, look),
    )
  } else line(post, `look ${look}`)

  if (spec.template || spec.edits.length > 0) post = await shapeText(post, spec, maker)
  post = await readyText(id, maker, new Set(spec.edits.map((e) => e.slide)))
  post = await step(id, 'approve text', (v) => commands.approveStructure(maker, id, v))

  // Images: planned by themselves after approval; planned again when that failed.
  if (!post.current.artPlan) {
    post = await step(id, 'plan images', (v) => commands.planImages(maker, id, v), MODEL_TRIES)
  }
  const asked = await artCalls(id)
  let pngs = new Map<number, Uint8Array>()
  if (spec.art.length > 0) ({ post, pngs } = await ownArt(post, spec, maker))
  const planned = spec.art.length > 0 ? [] : (post.current.artPlan?.body.scenes ?? [])
  const hinted = scenesFor(
    planned.map((p) => ({ slide: p.slide, text: slideText(post, p.slide) })),
    spec.scenes,
  )
  for (const { slide, scene } of hinted) {
    if (planned.find((p) => p.slide === slide)?.scene === scene) continue
    post = await step(id, `scene for slide ${slide}`, (v) =>
      commands.editImageScene(maker, id, v, { slide, text: scene }),
    )
  }
  for (let round = 1; round <= 2; round++) {
    post = await step(id, round === 1 ? 'draw images' : 'draw remaining', (v) =>
      commands.drawImages(maker, id, v),
    )
    const art = post.current.render?.body.slideArt ?? []
    const missing = art.filter((a) => a.assetId === null)
    if (post.stage === 'rendered' && missing.length === 0) break
    const why = await stepFailure(id, 'images')
    console.log(
      `${label} ${id} · images: ${art.length - missing.length} drawn, ${missing.length} missing${why ? ` (${why})` : ''}`,
    )
  }
  if (post.stage !== 'rendered') throw new StepFailed('draw images', 'No slide could be drawn.')
  await checkOwnArt(post, pngs)
  const more = (await artCalls(id)) - asked
  if (spec.art.length > 0 && more > 0) {
    console.log(`${label} ${id} · WARNING: the image model was asked ${more} times`)
  }

  post = await settleClaims(id, maker)
  const facts = post.current.facts?.body.facts ?? []
  const settings = settingsFor(facts, spec.language, spec)
  post = await step(
    id,
    `settings (${settings.layer}, ${settings.tags.join(', ') || 'no tags'})`,
    (v) => commands.saveSettings(maker, id, v, settings),
  )
  post = await step(id, 'send to review', (v) => commands.sendToReview(maker, id, v))
  post = await step(id, `approve as ${reviewer.name}`, (v) =>
    commands.approveAndPublish(reviewer, id, v),
  )
  return id
}

/** The model calls logged for the post, by use case. */
async function callsOf(id: string): Promise<string> {
  const rows = await db
    .select({
      useCase: aiCall.useCase,
      calls: count(),
      cached: sql<number>`count(*) filter (where ${aiCall.cached})::int`,
      failed: sql<number>`count(*) filter (where not ${aiCall.ok})::int`,
    })
    .from(aiCall)
    .where(and(eq(aiCall.postId, id)))
    .groupBy(aiCall.useCase)
    .orderBy(aiCall.useCase)
  if (rows.length === 0) return 'none logged'
  return rows
    .map(
      (r) =>
        `${r.useCase} ${r.calls}${r.cached ? ` (${r.cached} cached)` : ''}${r.failed ? ` (${r.failed} failed)` : ''}`,
    )
    .join(', ')
}

let exitCode = 0
try {
  console.log(`Database ${where.hostname}:${where.port}${where.pathname}`)
  const chosen = chooseActors(await accounts(), asEmail)
  if (!chosen.ok) {
    console.error(chosen.error)
    exitCode = 1
  } else {
    const maker = actorOf(chosen.maker)
    const reviewer = actorOf(chosen.reviewer)
    console.log(`Making as ${chosen.maker.email}, approving as ${chosen.reviewer.email}`)
    const order = runOrder(spec.posts)
    const results: string[] = []
    for (const { at, post } of order) {
      label = `[${at}/${spec.posts.length}]`
      making = null
      try {
        const id = await makeOne(post, maker, reviewer)
        const done = await load(id)
        results.push(
          `${label} ${id} ${done.stage} /admin/posts/${id} · calls: ${await callsOf(id)}`,
        )
      } catch (err) {
        await drain()
        const reason = err instanceof StepFailed ? `${err.step}: ${err.reason}` : String(err)
        console.error(`${label} stopped at ${reason}`)
        const left = making ? ` (post ${making} left behind)` : ''
        results.push(`${label} failed: ${reason}${left}`)
        exitCode = 1
      }
    }
    console.log('\nDone:')
    for (const r of results.reverse()) console.log(r)
  }
} finally {
  await drain()
  process.exit(exitCode)
}
