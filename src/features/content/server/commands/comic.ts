import 'server-only'
import { z } from 'zod'
import { canEdit } from '@/shared/lib/auth/access'
import { db } from '@/shared/lib/db'
import type { ActionResult } from '@/shared/types/action-result'
import { draftStory } from '../../ai/comic'
import { artPromptError } from '../../ai/draft'
import { COMICS_BRAND_ID } from '../../brands'
import { PRESETS } from '../../brands/guideline'
import { emotionError, emotionOf } from '../../emotions'
import {
  applyPanelOp,
  type PanelOp,
  PREMISE_MAX,
  panelOpsError,
  SCENE_MAX,
} from '../../lib/comic-rules'
import { pathById, pathFacts } from '../../lib/path-facts'
import { defaultSettings } from '../../lib/settings-defaults'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import { type Body, emptyPointers } from '../../model/artifacts'
import type { Slide } from '../../model/types'
import { COMIC_TEMPLATE_ID, templateById } from '../../templates'
import { charCount } from '../../text/script'
import { runStep, runStepAfter } from '../steps'
import { insertPost, type LoadedPost, loadPost, putArtifact, savePointers } from '../store'
import { checkAfter } from './check'
import { type Actor, attempt, command, fail, Refused, type Saved, save } from './shared'

// "New comic" (RC1, RC2): a path from the catalogue, an optional premise and emotion, made into a
// feed post for the Comics page with the path's facts frozen in its own records, then its story
// drafted after the response as the storyboard the workbench opens on; then the storyboard shaped
// before it is drawn (RC3): a scene edited, a panel added, removed or moved, and "Try again" on a
// story that failed.

export const COMIC_ERRORS = {
  path: 'Choose a path.',
  premise: `Keep the premise to ${PREMISE_MAX} characters.`,
} as const

/** Every catalogue path is in Australia (engine/catalogue.ts), so the feed's destination chip finds it (RC15). */
const DESTINATION = 'destination:AU'

/** Why the input cannot make a comic, or null; checked before anything is saved or called. */
function inputError(input: {
  courseId: string
  premise: string | null
  emotion: string | null
  requestId: string
}): string | null {
  if (!z.uuid().safeParse(input.requestId).success || !pathById(input.courseId)) {
    return COMIC_ERRORS.path
  }
  if (input.premise !== null && charCount(input.premise) > PREMISE_MAX) {
    return COMIC_ERRORS.premise
  }
  if (input.emotion !== null) {
    const error = emotionError(input.emotion)
    if (error) return error
  }
  // The premise reaches the scene prompts, so it passes the art prompt's rules.
  return input.premise === null ? null : artPromptError(input.premise)
}

/**
 * "Make storyboard": a feed post for the Comics page telling this path (`course_id`), with a
 * `path` source of the path's catalogue sentences, their facts and its settings, at structures;
 * then its story, drafted after the response under the draft step's lock, as one comic version,
 * picked, in the Pop preset and titled by the story. A failed story keeps the post, source and
 * facts: the workbench shows the draft step failed with "Try again". The request id is the new
 * post's, so a second submit finds the first one's.
 */
export async function makeComic(
  actor: Actor,
  input: { courseId: string; premise: string | null; emotion: string | null; requestId: string },
): Promise<ActionResult<{ id: string }>> {
  // No post exists yet: the rule is who may make one.
  if (!canEdit(actor)) return fail(WORKFLOW_ERRORS.notAuthorised)
  const premise = input.premise?.trim() || null
  const emotion = input.emotion?.trim() || null
  const error = inputError({ ...input, premise, emotion })
  if (error) return fail(error)
  const path = pathById(input.courseId)
  const facts = pathFacts(input.courseId)
  if (!path || !facts) return fail(COMIC_ERRORS.path)
  const id = input.requestId

  const saved = await attempt('makeComic', async () => {
    const existing = await loadPost(id)
    if (existing) return { ok: true, id, version: existing.version }
    const source: Body<'source'> = {
      kind: 'path',
      title: path.label,
      text: facts.paragraphs.map((p) => p.text).join('\n\n'),
      paragraphs: facts.paragraphs,
      demoKey: null,
      language: 'en',
      // The premise is the story the editor wants told (GD20), kept for the source step.
      framing: premise,
    }
    const version = await db.transaction(async (tx) => {
      await insertPost(tx, {
        id,
        kind: 'feed',
        parentId: null,
        title: `Comic: ${path.label}`,
        stage: 'structures',
        pointers: emptyPointers(),
        actorId: actor.id,
        courseId: path.id,
      })
      const sourceId = await putArtifact(tx, {
        kind: 'source',
        postId: id,
        body: source,
        actorId: actor.id,
      })
      // The facts are frozen here, whatever the catalogue says later.
      const factsId = await putArtifact(tx, {
        kind: 'facts',
        postId: id,
        actorId: actor.id,
        body: { sourceId, keyIdeas: [], facts: facts.facts, replays: [] },
      })
      const settingsId = await putArtifact(tx, {
        kind: 'settings',
        postId: id,
        actorId: actor.id,
        body: { ...defaultSettings(facts.facts), tags: [DESTINATION] },
      })
      const result = await savePointers(
        tx,
        id,
        1,
        {
          stage: 'structures',
          pointers: {
            ...emptyPointers(),
            sourceId,
            factsId,
            settingsId,
            pageBrandId: COMICS_BRAND_ID,
          },
        },
        actor.id,
      )
      if (!result.ok) throw new Refused(result.error)
      return result.version
    })
    await storyAfter(actor, id, version, premise, emotion)
    return { ok: true, id, version }
  })
  return saved.ok ? { ok: true, id } : saved
}

/** The comic's story after the response, under the draft step's lock; false when it could not start. */
function storyAfter(
  actor: Actor,
  id: string,
  version: number,
  premise: string | null,
  emotion: string | null,
): Promise<boolean> {
  return runStepAfter(id, 'draft', version, () =>
    command('makeComic', 'draft', actor, id, version, (post) =>
      draftComic(post, version, actor, premise, emotion),
    ),
  )
}

/** The story drafted from the post's frozen facts, saved as its one picked comic version. */
async function draftComic(
  post: LoadedPost,
  version: number,
  actor: Actor,
  premise: string | null,
  emotion: string | null,
): Promise<Saved> {
  const { facts } = post.current
  const path = post.courseId === null ? null : pathById(post.courseId)
  const template = templateById(COMIC_TEMPLATE_ID)
  if (!facts || !path || !template) return fail(WORKFLOW_ERRORS.movedOn)
  const feel = emotionOf(emotion)
  const story = await draftStory({
    path,
    facts: facts.body.facts,
    language: post.current.source?.body.language,
    premise,
    emotion: feel ? { label: feel.label, tone: feel.tone } : null,
    postId: post.id,
  })
  if (!story.ok) return fail(story.error)
  const next = await db.transaction(async (tx) => {
    const draftsId = await putArtifact(tx, {
      kind: 'drafts',
      postId: post.id,
      actorId: actor.id,
      body: {
        factsId: facts.id,
        attempt: 1,
        items: [{ structure: story.structure, template, angle: 'Story' }],
        replays: [],
        emotion,
        note: 'Storyboard drafted',
      },
    })
    const result = await savePointers(
      tx,
      post.id,
      version,
      {
        stage: post.stage,
        // A look draws in a preset: the approve gate needs one (lib/workflow.ts).
        pointers: {
          ...post.pointers,
          draftsId,
          ticked: [COMIC_TEMPLATE_ID],
          picked: 0,
          themeId: PRESETS[0],
        },
        // The search line and the slug read the post's title.
        title: story.title,
      },
      actor.id,
    )
    if (!result.ok) throw new Refused(result.error)
    return result.version
  })
  return { ok: true, id: post.id, version: next }
}

/**
 * "Try again" on a comic whose story failed (RC2): its story drafted again from its frozen facts
 * and the premise its source keeps, under the draft step, as makeComic drafts it. Not draftPost,
 * which drafts ticked templates a comic has none of until its story lands.
 */
export async function retryStory(actor: Actor, id: string, version: number): Promise<Saved> {
  return command('retryStory', 'draft', actor, id, version, async (post) => {
    if (post.courseId === null) return fail(WORKFLOW_ERRORS.movedOn)
    const premise = post.current.source?.body.framing ?? null
    const emotion = post.current.drafts?.body.emotion ?? null
    return runStep(id, 'draft', version, () => draftComic(post, version, actor, premise, emotion))
  })
}

export const STORYBOARD_ERRORS = {
  scene: `Keep the scene to ${SCENE_MAX} characters.`,
} as const

/** A panel added in the storyboard: no caption and no scene yet, both for the editor to write. */
const BLANK_PANEL: Slide = {
  kind: 'body',
  slots: { caption: { text: '', factIds: [], factual: false } },
  scene: '',
}

/** The comic's picked version, or why the storyboard cannot be changed. */
function pickedStory(post: LoadedPost) {
  const { drafts } = post.current
  const picked = post.pointers.picked
  const item = picked === null ? undefined : drafts?.body.items[picked]
  if (post.courseId === null || !drafts || picked === null || !item) return null
  return { drafts, picked, item }
}

/**
 * The picked version with new slides, as a new drafts record with `note` in the history, so the
 * history and restore keep the earlier storyboard (store.ts listHistory); the source check runs
 * after, as for any text change.
 */
async function saveStory(
  post: LoadedPost,
  version: number,
  actor: Actor,
  story: NonNullable<ReturnType<typeof pickedStory>>,
  slides: Slide[],
  note: string,
): Promise<Saved> {
  const { drafts, picked, item } = story
  const structure = { ...item.structure, slides }
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

/**
 * A panel's planned scene in the editor's words (RC3), slide numbered from 1: at most 300
 * characters, and passing the art prompt's rules, since it reaches the picture's prompt. A scene
 * that does not change saves nothing.
 */
export async function editScene(
  actor: Actor,
  id: string,
  version: number,
  at: { slide: number; text: string },
): Promise<Saved> {
  return command('editScene', 'editScene', actor, id, version, async (post) => {
    const story = pickedStory(post)
    const slide = story?.item.structure.slides[at.slide - 1]
    if (!story || !slide) return fail(WORKFLOW_ERRORS.movedOn)
    const text = at.text.trim()
    if (charCount(text) > SCENE_MAX) return fail(STORYBOARD_ERRORS.scene)
    const error = artPromptError(text)
    if (error) return fail(error)
    if (text === (slide.scene ?? '')) return { ok: true, id, version }
    const slides = story.item.structure.slides.map((s, i) =>
      i === at.slide - 1 ? { ...s, scene: text } : s,
    )
    return saveStory(post, version, actor, story, slides, `Panel ${at.slide} scene edited`)
  })
}

/** The history's line for a panel change, panels numbered from 1. */
function panelNote(op: PanelOp): string {
  if (op.kind === 'add') return `Panel ${op.after + 2} added`
  if (op.kind === 'remove') return `Panel ${op.at + 1} removed`
  return `Panel ${op.at + 1} moved to ${op.to + 1}`
}

/**
 * A panel added after another, removed, or moved (RC3), panels by place from 0, keeping a comic
 * to 3 to 6 panels. The kinds follow the places: the first panel is the cover, the rest bodies, so
 * the template's repeat rules hold.
 */
export async function editPanels(
  actor: Actor,
  id: string,
  version: number,
  op: PanelOp,
): Promise<Saved> {
  return command('editPanels', 'editPanels', actor, id, version, async (post) => {
    const story = pickedStory(post)
    if (!story) return fail(WORKFLOW_ERRORS.movedOn)
    const current = story.item.structure.slides
    const error = panelOpsError(current.length, op)
    if (error) return fail(error)
    const slides = applyPanelOp(current, op, BLANK_PANEL).map((s, i) => ({
      ...s,
      kind: i === 0 ? ('cover' as const) : ('body' as const),
    }))
    return saveStory(post, version, actor, story, slides, panelNote(op))
  })
}
