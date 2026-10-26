import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { contentArtifact } from '@/shared/lib/db/schema'
import type { ActionResult } from '@/shared/types/action-result'
import { AI_ERRORS } from '../../ai/client'
import {
  artPromptError,
  draftStructures,
  redraftSlide as redraftSlideText,
  redraftVersion,
  VERSIONS_PER_TEMPLATE,
} from '../../ai/draft'
import { FEED_BRAND, isFeedPostPage } from '../../brands'
import { PRESETS } from '../../brands/guideline'
import { emotionError } from '../../emotions'
import { unboundSlots } from '../../lib/claims'
import { comicCaptionError, searchTitleOf } from '../../lib/comic-rules'
import { chipFailed } from '../../lib/failure'
import { draftChoices, themeOrDefault, versionLetter } from '../../lib/version-status'
import { approveStructureError, WORKFLOW_ERRORS } from '../../lib/workflow'
import { BODIES, type Body } from '../../model/artifacts'
import type { FitCheck, Structure } from '../../model/types'
import { type Nudge, textNudge } from '../../nudges'
import { isLook, templateById } from '../../templates'
import { charCount } from '../../text/script'
import { artifactId } from '../hash'
import { pageStyleOf } from '../page-style'
import { draftFitChecks } from '../preview'
import { runStep, runStepAfter, type StepRun } from '../steps'
import { bodyOf, type LoadedPost, putArtifact } from '../store'
import { goBack } from './back'
import { checkAfter } from './check'
import { planAfter } from './images'
import {
  type Actor,
  clearFromRevision,
  command,
  DB_ERROR,
  fail,
  layoutOf,
  open,
  putRevision,
  type Saved,
  save,
  sourcesAtOf,
  stamp,
  type Tx,
} from './shared'

// The structures stage: ticked templates, drafts, the pick, an edit or another take on the picked
// version's slides, the theme and the approval across the render gate, and reopening it (criteria
// 25–33, 98, 99). The source check runs by itself after each change to the picked text (./check.ts).

/** The step another take on a slide runs as, by slide: `draft_slide:2` (the page shows it running or failed on that slide). */
export const SLIDE_STEP = (slide: number) => `draft_slide:${slide}`

const NOT_BINDABLE = 'Bind an unbound claim to a supported fact.'
/** A version the ladder could not get clean is shown with its problems, never picked (criterion 97). */
const VERSION_PROBLEMS = 'This version has problems. Draft again.'
/**
 * The longest text a slot takes in an edit, in characters as a reader sees them; the fit checks
 * hold it to the template's own limit.
 */
const SLOT_TEXT_MAX = 2000
const SLOT_TEXT = `Write the slot's text, up to ${SLOT_TEXT_MAX} characters.`

export async function tickTemplates(
  actor: Actor,
  id: string,
  version: number,
  templateIds: string[],
): Promise<Saved> {
  return command('tickTemplates', 'tick', actor, id, version, async (post) => {
    const known = templateIds.every((t) => templateById(t) !== null)
    const unique = new Set(templateIds).size === templateIds.length
    if (templateIds.length < 1 || templateIds.length > 3 || !known || !unique) {
      return fail(WORKFLOW_ERRORS.ticks)
    }
    return save(post, version, actor, async () => ({
      stage: post.stage,
      pointers: { ...post.pointers, ticked: [...templateIds] },
    }))
  })
}

/** The copy style of the post's page when that page has a design language (criterion 105), else null. */
async function copyStyleOf(post: LoadedPost): Promise<string | null> {
  return (await pageStyleOf(post.pointers.pageBrandId ?? null))?.copyStyle ?? null
}

/** Why the post cannot be drafted now, or null. */
function draftError(post: LoadedPost, emotion: string | null): string | null {
  if (post.pointers.ticked.length === 0) return WORKFLOW_ERRORS.ticks
  // A chip's id or the editor's own word (criterion 100); the word reaches the art prompt
  // (ai/art.ts), so it passes the art prompt's rules first.
  if (emotion !== null) {
    const error = emotionError(emotion) ?? artPromptError(emotion)
    if (error) return error
  }
  const { source, facts } = post.current
  return source && facts ? null : WORKFLOW_ERRORS.movedOn
}

/**
 * One version of each ticked template (for the idea the versions serve, when they serve one),
 * saved as a new drafts record; run under the draft step's lock. "Draft again" adds them after the
 * versions there are, which stay as they were, so each press is one more to pick from (18 Oct);
 * the first draft, or a draft with none to keep, starts the list.
 */
async function draftVersions(
  post: LoadedPost,
  version: number,
  actor: Actor,
  again: boolean,
  emotion: string | null,
  run: StepRun,
): Promise<Saved> {
  const { source, facts, drafts } = post.current
  if (!source || !facts) return fail(WORKFLOW_ERRORS.movedOn)
  // How many versions are on their way, for the page to say (lib/running.ts).
  await run.progress(0, VERSIONS_PER_TEMPLATE * post.pointers.ticked.length)
  const attemptNo = again && drafts ? drafts.body.attempt + 1 : 1
  // Versions drafted for an idea card keep serving it (GD2), and in the looks, whose layouts it
  // names, follow its outline (GD32); none for ticked templates.
  const idea = drafts?.body.idea ?? null
  const { outline } = post.current
  const looks = post.pointers.ticked.every((t) => {
    const template = templateById(t)
    return template !== null && isLook(template)
  })
  const outlined =
    idea && outline && looks ? { format: outline.body.format, slides: outline.body.slides } : null
  const drafted = await draftStructures({
    templateIds: post.pointers.ticked,
    source: source.body,
    facts: facts.body.facts,
    attempt: attemptNo,
    postId: post.id,
    emotion,
    copyStyle: await copyStyleOf(post),
    idea,
    outline: outlined,
  })
  if (!drafted.ok) return fail(drafted.error)
  const kept = again && drafts ? drafts.body : null
  const items = [...(kept?.items ?? []), ...drafted.items]
  // Version A and the first colours are chosen for her; her own choices stay while they fit.
  const chosen = draftChoices(post.pointers, items)
  const saved = await save(post, version, actor, async (tx) => {
    const draftsId = await putArtifact(tx, {
      kind: 'drafts',
      postId: post.id,
      actorId: actor.id,
      body: {
        factsId: facts.id,
        attempt: attemptNo,
        items,
        replays: [...(kept?.replays ?? []), ...drafted.replays],
        emotion,
        note: attemptNo > 1 ? 'Drafted again' : 'Drafted',

        ...(idea ? { idea } : {}),
      },
    })
    return { stage: post.stage, pointers: { ...post.pointers, draftsId, ...chosen } }
  })
  // The version chosen for her is checked against the source, as a version she picks is.
  return chosen.picked === null ? saved : checkAfter(post.id, actor, saved)
}

export async function draftPost(
  actor: Actor,
  id: string,
  version: number,
  again: boolean,
  emotion: string | null = null,
): Promise<Saved> {
  return command('draftPost', 'draft', actor, id, version, async (post) => {
    const error = draftError(post, emotion)
    if (error) return fail(error)
    return runStep(id, 'draft', version, (run) =>
      draftVersions(post, version, actor, again, emotion, run),
    )
  })
}

/**
 * The first drafts of a post just made (criterion 93), after the response: the draft step's lock
 * is taken now, so the workbench the editor lands on shows drafting and polls until the versions
 * land, or shows the step failed with "Try again". The command's rules apply when it runs. False
 * when the step could not start.
 */
export async function draftAfter(actor: Actor, id: string, version: number): Promise<boolean> {
  return runStepAfter(id, 'draft', version, (run) =>
    command('draftPost', 'draft', actor, id, version, async (post) => {
      const error = draftError(post, null)
      return error ? fail(error) : draftVersions(post, version, actor, false, null, run)
    }),
  )
}

export async function pickStructure(
  actor: Actor,
  id: string,
  version: number,
  index: number,
): Promise<Saved> {
  return command('pickStructure', 'pick', actor, id, version, async (post) => {
    // `index` is a position in the flattened versions list (model/artifacts.ts, drafts.items).
    const items = post.current.drafts?.body.items ?? []
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      return fail(WORKFLOW_ERRORS.movedOn)
    }
    if ((items[index].problems ?? []).length > 0) return fail(VERSION_PROBLEMS)
    const saved = await save(post, version, actor, async () => ({
      stage: post.stage,
      pointers: { ...post.pointers, picked: index },
    }))
    return checkAfter(id, actor, saved)
  })
}

/** The structure with one slot's text changed; null when the slide has no such slot. */
function withSlotText(structure: Structure, slide: number, key: string, text: string) {
  const slot = structure.slides[slide - 1]?.slots[key]
  if (!slot) return null
  return {
    ...structure,
    slides: structure.slides.map((s, i) =>
      i === slide - 1 ? { ...s, slots: { ...s.slots, [key]: { ...slot, text } } } : s,
    ),
  }
}

/**
 * The picked version with one slot's text changed by `change` (null: refused as moved on), as a
 * new drafts record, so its previews and fit rows are drawn again; its facts stay bound, and the
 * source check runs after. Text that does not change saves nothing. Only the picked version is
 * edited, and a version with problems is never picked, so an edit leaves `problems` as it was;
 * a figure its facts lack shows as "Number not in its fact" and blocks approval (criterion 28).
 * `note` is the history's line for the new record (criterion 101).
 */
export async function editPickedSlot(
  post: LoadedPost,
  version: number,
  actor: Actor,
  at: { slide: number; slot: string },
  change: (text: string) => string | null,
  note: string,
): Promise<Saved> {
  const { drafts } = post.current
  const picked = post.pointers.picked
  if (picked === null) return fail(WORKFLOW_ERRORS.noPick)
  const item = drafts?.body.items[picked]
  const slot = item?.structure.slides[at.slide - 1]?.slots[at.slot]
  if (!drafts || !item || !slot) return fail(WORKFLOW_ERRORS.movedOn)
  const text = change(slot.text)
  const structure = text === null ? null : withSlotText(item.structure, at.slide, at.slot, text)
  if (text === null || !structure) return fail(WORKFLOW_ERRORS.movedOn)
  if (text === slot.text) return { ok: true, id: post.id, version }

  const items = drafts.body.items.map((it, i) => (i === picked ? { ...it, structure } : it))
  const saved = await save(post, version, actor, async (tx) => {
    const draftsId = await putArtifact(tx, {
      kind: 'drafts',
      postId: post.id,
      actorId: actor.id,
      body: { ...drafts.body, items, note },
    })
    return { stage: post.stage, pointers: { ...post.pointers, draftsId } }
  })
  return checkAfter(post.id, actor, saved)
}

/** The fit rows of one slot as the editor types it, or why there are none. */
export type Measured = ActionResult<{ rows: FitCheck[] }>

/**
 * The fit rows one slot of the picked version would have with the text being typed (criterion
 * 98: the fit checks update as the editor types), by the same layout and checks as the saved
 * drafts (preview.ts draftFitChecks) with the post's theme. Nothing is saved: the saved drafts and
 * their layout stay the authority. Under the edit rule, so only an editor who may edit the slot
 * can ask. Measuring needs the brand's fonts (opentype, read from disk), so it runs here, not in
 * the browser.
 */
export async function measureSlot(
  actor: Actor,
  id: string,
  version: number,
  at: { slide: number; slot: string; text: string },
): Promise<Measured> {
  try {
    const opened = await open(actor, 'editSlot', id, version)
    if (!opened.ok) return opened
    const { pointers, current } = opened.post
    const { drafts, facts, source } = current
    if (pointers.picked === null) return fail(WORKFLOW_ERRORS.noPick)
    const text = at.text.trim()
    if (text.length === 0 || charCount(text) > SLOT_TEXT_MAX) return fail(SLOT_TEXT)
    const item = drafts?.body.items[pointers.picked]
    const structure = item && withSlotText(item.structure, at.slide, at.slot, text)
    if (!drafts || !item || !structure || !facts || !source) return fail(WORKFLOW_ERRORS.movedOn)
    const [checks = []] = draftFitChecks(
      { ...drafts.body, items: [{ ...item, structure }] },
      pointers.themeId,
      facts.body.facts,
      source.body.title,
      searchTitleOf(opened.post, source.body.title),
      source.body.language,
    )
    return { ok: true, rows: checks.filter((c) => c.slide === at.slide && c.slot === at.slot) }
  } catch (err) {
    console.error('[content.commands.measureSlot]', err)
    return fail(DB_ERROR)
  }
}

/**
 * The editor's own words in one slot of the picked version, typed on its slide (criterion 98). A
 * comic's caption keeps the comic rules (RC4, RC5): no promised outcome, no banned phrase, no
 * number its path's facts lack.
 */
export async function editSlot(
  actor: Actor,
  id: string,
  version: number,
  at: { slide: number; slot: string; text: string },
): Promise<Saved> {
  return command('editSlot', 'editSlot', actor, id, version, async (post) => {
    const text = at.text.trim()
    if (text.length === 0 || charCount(text) > SLOT_TEXT_MAX) return fail(SLOT_TEXT)
    if (post.courseId !== null) {
      const error = comicCaptionError(text, post.current.facts?.body.facts ?? [])
      if (error) return fail(error)
    }
    return editPickedSlot(post, version, actor, at, () => text, `Slide ${at.slide} edited`)
  })
}

/**
 * Another take on one slide of the picked version (criterion 99): the model rewords that slide's
 * slots in the version's angle and the drafts' emotion, bound to the same facts, and the result is
 * a new drafts record the old one stays beside, so the history keeps the old wording. Every other
 * slide and version is the same bytes. A failed call saves nothing: the slide stays, and the step
 * shows failed on it with "Try again".
 */
export async function redraftSlide(
  actor: Actor,
  id: string,
  version: number,
  slide: number,
): Promise<Saved> {
  return command('redraftSlide', 'redraftSlide', actor, id, version, (post) =>
    retakeSlide(post, version, actor, slide, null),
  )
}

/**
 * A chip's refusal, named by its label whatever the failure (lib/failure.ts chipFailed): the
 * model's failed check says Try again, a 429, a timeout or the day's cap says why, and any other
 * refusal keeps its own words after the label.
 */
const nudgeFailed = (nudge: Nudge, error: string) =>
  chipFailed(nudge.label, error === AI_ERRORS.failed ? null : error)

/** The drafts record with the version at `index` replaced and `note` in the history; the source check runs after. */
async function saveVersion(
  post: LoadedPost,
  version: number,
  actor: Actor,
  at: { index: number; item: Body<'drafts'>['items'][number]; note: string },
): Promise<Saved> {
  const { drafts } = post.current
  if (!drafts) return fail(WORKFLOW_ERRORS.movedOn)
  const items = drafts.body.items.map((it, i) => (i === at.index ? at.item : it))
  const saved = await save(post, version, actor, async (tx) => {
    const draftsId = await putArtifact(tx, {
      kind: 'drafts',
      postId: post.id,
      actorId: actor.id,
      body: { ...drafts.body, items, note: at.note },
    })
    return { stage: post.stage, pointers: { ...post.pointers, draftsId } }
  })
  return checkAfter(post.id, actor, saved)
}

/**
 * One slide of the picked version reworded by the model, under that slide's step: another take
 * (criterion 99), or in a text chip's direction (GD10). Verified the same way either way; a
 * failed answer saves nothing.
 */
async function retakeSlide(
  post: LoadedPost,
  version: number,
  actor: Actor,
  slide: number,
  nudge: Nudge | null,
): Promise<Saved> {
  const { drafts, facts } = post.current
  const picked = post.pointers.picked
  if (picked === null) return fail(WORKFLOW_ERRORS.noPick)
  const item = drafts?.body.items[picked]
  const target = item?.structure.slides[slide - 1]
  if (!drafts || !facts || !item || !target) return fail(WORKFLOW_ERRORS.movedOn)

  return runStep(post.id, SLIDE_STEP(slide), version, async () => {
    const taken = await redraftSlideText({
      item: { ...item, angle: item.angle ?? '', problems: item.problems ?? [] },
      slide,
      facts: facts.body.facts,
      language: post.current.source?.body.language,
      emotion: drafts.body.emotion,
      copyStyle: await copyStyleOf(post),
      nudge: nudge?.instruction ?? null,
      postId: post.id,
      // The post's version moves with every save, so each press is its own call.
      attempt: version,
    })
    if (!taken.ok) return fail(nudge ? nudgeFailed(nudge, taken.error) : taken.error)
    return saveVersion(post, version, actor, {
      index: picked,
      item: { ...item, structure: taken.structure },
      note: nudge ? `Slide ${slide}: ${nudge.label}` : `Another take on slide ${slide}`,
    })
  })
}

/**
 * A text chip on one slide of the picked version (GD10): that slide reworded in the chip's
 * direction, as another take is, its facts bound as they were. A new drafts record keeps the old
 * one beside it in the history. An answer that changes a number is refused, and the slide stays.
 */
export async function nudgeSlide(
  actor: Actor,
  id: string,
  version: number,
  at: { slide: number; nudge: string },
): Promise<Saved> {
  return command('nudgeSlide', 'nudgeSlide', actor, id, version, async (post) => {
    const nudge = textNudge(at.nudge)
    if (!nudge) return fail(WORKFLOW_ERRORS.nudge)
    return retakeSlide(post, version, actor, at.slide, nudge)
  })
}

/** The step a chip on a whole version runs as (lib/running.ts says it in words). */
export const NUDGE_VERSION_STEP = 'nudge_version'

/**
 * A text chip on a whole version (GD10): one draft call rewrites that version in the chip's
 * direction, checked as any draft is (facts, bindings, numbers). It replaces that version in a new
 * drafts record; every other version stays. A version that fails its checks keeps its old wording.
 */
export async function nudgeVersion(
  actor: Actor,
  id: string,
  version: number,
  at: { index: number; nudge: string },
): Promise<Saved> {
  return command('nudgeVersion', 'nudgeVersion', actor, id, version, async (post) => {
    const nudge = textNudge(at.nudge)
    if (!nudge) return fail(WORKFLOW_ERRORS.nudge)
    const { drafts, facts } = post.current
    const item = Number.isInteger(at.index) ? drafts?.body.items[at.index] : undefined
    if (!drafts || !facts || !item) return fail(WORKFLOW_ERRORS.movedOn)

    return runStep(id, NUDGE_VERSION_STEP, version, async () => {
      const nudged = await redraftVersion({
        item: { ...item, angle: item.angle ?? '', problems: item.problems ?? [] },
        facts: facts.body.facts,
        language: post.current.source?.body.language,
        nudge: nudge.instruction,
        emotion: drafts.body.emotion,
        copyStyle: await copyStyleOf(post),
        postId: id,
        attempt: version,
      })
      if (!nudged.ok) return fail(nudgeFailed(nudge, nudged.error))
      return saveVersion(post, version, actor, {
        index: at.index,
        item: nudged.item,
        note: `Version ${versionLetter(at.index)}: ${nudge.label}`,
      })
    })
  })
}

/**
 * The page the post is made for (criterion 105): a page brand, or none. It steers the drafts and
 * covers made after it; what is already drafted stays as it is. Only before approval.
 */
export async function choosePage(
  actor: Actor,
  id: string,
  version: number,
  pageBrandId: string | null,
): Promise<Saved> {
  return command('choosePage', 'page', actor, id, version, async (post) => {
    if (pageBrandId !== null && !isFeedPostPage(pageBrandId)) return fail(WORKFLOW_ERRORS.page)
    return save(post, version, actor, async () => ({
      stage: post.stage,
      pointers: { ...post.pointers, pageBrandId },
    }))
  })
}

export async function chooseTheme(
  actor: Actor,
  id: string,
  version: number,
  themeId: string,
): Promise<Saved> {
  return command('chooseTheme', 'theme', actor, id, version, async (post) => {
    if (!FEED_BRAND.themes.some((t) => t.id === themeId)) return fail(WORKFLOW_ERRORS.noTheme)
    return save(post, version, actor, async () => ({
      stage: post.stage,
      pointers: { ...post.pointers, themeId },
    }))
  })
}

export async function fixUnbound(
  actor: Actor,
  id: string,
  version: number,
  at: { slide: number; slot: string; factId: string },
): Promise<Saved> {
  return command('fixUnbound', 'fixUnbound', actor, id, version, async (post) => {
    const { drafts, facts } = post.current
    const picked = post.pointers.picked
    if (picked === null) return fail(WORKFLOW_ERRORS.noPick)
    const item = drafts?.body.items[picked]
    if (!drafts || !facts || !item) return fail(WORKFLOW_ERRORS.movedOn)

    const fact = facts.body.facts.find((f) => f.id === at.factId)
    const listed = unboundSlots(item.structure, item.template, facts.body.facts).some(
      (u) => u.slide === at.slide && u.slot === at.slot,
    )
    const slot = item.structure.slides[at.slide - 1]?.slots[at.slot]
    if (!fact?.supported || !listed || !slot?.factual) return fail(NOT_BINDABLE)

    // The slot says the fact, bound to it alone (AD-F9); everything else stays as drafted.
    const slides = item.structure.slides.map((s, i) =>
      i === at.slide - 1
        ? {
            ...s,
            slots: { ...s.slots, [at.slot]: { ...slot, text: fact.text, factIds: [fact.id] } },
          }
        : s,
    )
    const items = drafts.body.items.map((it, i) =>
      i === picked ? { ...it, structure: { ...it.structure, slides } } : it,
    )
    const saved = await save(post, version, actor, async (tx) => {
      const draftsId = await putArtifact(tx, {
        kind: 'drafts',
        postId: id,
        actorId: actor.id,
        body: { ...drafts.body, items, note: `Fact bound on slide ${at.slide}` },
      })
      return { stage: post.stage, pointers: { ...post.pointers, draftsId } }
    })
    return checkAfter(id, actor, saved)
  })
}

/**
 * The options of the newest covers made for an earlier revision of the post with this very text
 * (criterion 114): the same structure, template, brand, theme and emotion, drawn for the same
 * page (criterion 105), so each option's preview shows what it will draw. Covers that do not name
 * their page (before 13 Oct 2026) are not reused, since the page may have changed since. A new
 * revision's id differs (it carries who approved it and when), so the text is matched, not the
 * id, as restore keeps covers only for the same text (./restore.ts).
 * One query over the post's records (content_artifact_post_id_idx); null when none match.
 */
async function earlierCovers(
  tx: Tx,
  postId: string,
  revision: Body<'revision'>,
  pageBrandId: string | null,
): Promise<Body<'covers'>['options'] | null> {
  const made = alias(contentArtifact, 'made_for')
  const asJson = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`
  const [row] = await tx
    .select({ id: contentArtifact.id, body: contentArtifact.body })
    .from(contentArtifact)
    .innerJoin(
      made,
      and(
        eq(made.postId, contentArtifact.postId),
        eq(made.kind, 'revision'),
        eq(made.id, sql`${contentArtifact.body}->>'revisionId'`),
      ),
    )
    .where(
      and(
        eq(contentArtifact.postId, postId),
        eq(contentArtifact.kind, 'covers'),
        sql`${made.body}->'structure' = ${asJson(revision.structure)}`,
        sql`${made.body}->'template' = ${asJson(revision.template)}`,
        sql`${made.body}->'brand' = ${asJson(revision.brand)}`,
        sql`${made.body}->>'themeId' = ${revision.themeId}`,
        sql`${made.body}->>'emotion' is not distinct from ${revision.emotion}`,
        sql`${contentArtifact.body}->'pageBrandId' = ${asJson(pageBrandId)}`,
      ),
    )
    .orderBy(desc(contentArtifact.createdAt), desc(contentArtifact.id))
    .limit(1)
  return row ? (bodyOf('covers', row.body, row.id)?.options ?? null) : null
}

export async function approveStructure(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('approveStructure', 'approve', actor, id, version, async (post) => {
    const error = approveStructureError(post.pointers, post.current)
    if (error) return fail(error)
    const { source, facts, drafts } = post.current
    const item = drafts?.body.items[post.pointers.picked ?? -1]
    if (!source || !facts || !item) return fail(WORKFLOW_ERRORS.movedOn)
    // No theme stored (drafted before draftChoices): the default the Text step shows as chosen.
    const themeId = themeOrDefault(post.pointers.themeId, [item])
    // A look takes a preset (GD9, ./look.ts setPreset); any version takes one of the brand's themes.
    const preset = isLook(item.template) && (PRESETS as readonly string[]).includes(themeId)
    if (!preset && !FEED_BRAND.themes.some((t) => t.id === themeId)) {
      return fail(WORKFLOW_ERRORS.noTheme)
    }

    // The picked wording with its frozen template, and a frozen copy of the brand.
    const revision: Body<'revision'> = {
      factsId: facts.id,
      structure: item.structure,
      template: item.template,
      brand: structuredClone(FEED_BRAND),
      themeId,
      by: stamp(actor),
      note: 'approved',
      emotion: drafts.body.emotion ?? null,
    }
    const stored = BODIES.revision.parse(revision)
    const revisionId = artifactId('revision', id, stored)
    const layout = layoutOf(revisionId, revision, source.body, facts.body, sourcesAtOf(post), post)

    const saved = await save(post, version, actor, async (tx) => {
      await putRevision(tx, id, revision, revisionId, actor)
      const layoutId = await putArtifact(tx, {
        kind: 'layout',
        postId: id,
        body: layout,
        actorId: actor.id,
      })
      const { pageBrandId } = post.pointers
      const options = await earlierCovers(tx, id, stored, pageBrandId)
      const coversId = options
        ? await putArtifact(tx, {
            kind: 'covers',
            postId: id,
            actorId: actor.id,
            body: { revisionId, options, pageBrandId },
          })
        : null
      // The picked version's check stays named: the revision's own check reads from it.
      const { sourceCheckId } = post.pointers
      return {
        stage: 'approved',
        pointers: {
          ...clearFromRevision(post.pointers),
          sourceCheckId,
          revisionId,
          layoutId,
          coversId,
        },
      }
    })
    // A look's images are planned by themselves, so Images opens on its scenes (GD12).
    if (saved.ok && isLook(item.template)) await planAfter(actor, id, saved.version)
    return checkAfter(id, actor, saved)
  })
}

/** "Reopen structures": the move back to the text versions (./back.ts, criterion 112). */
export function reopenStructures(actor: Actor, id: string, version: number): Promise<Saved> {
  return goBack(actor, id, version, 'structures')
}
