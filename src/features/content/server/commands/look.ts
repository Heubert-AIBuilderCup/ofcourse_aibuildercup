import 'server-only'
import { PRESETS, type Preset } from '../../brands/guideline'
import { LAYOUT_LABELS, layoutIn, layoutOptions, relayout } from '../../layout/relayout'
import { WORKFLOW_ERRORS } from '../../lib/workflow'
import type { Body } from '../../model/artifacts'
import type { LayoutId } from '../../model/types'
import { isLook, LOOKS } from '../../templates'
import { type LoadedPost, putArtifact } from '../store'
import { checkAfter } from './check'
import { type Actor, command, fail, type Saved, save } from './shared'

// A look post's design before approval, by code alone (GD4, GD5, GD9): a slide laid out in
// another layout, a version moved to another look, and the post's colour preset. No model is
// called; the source check runs by itself after a new drafts record, as after any edit.

type Item = Body<'drafts'>['items'][number]

/** The version at `index` as a new drafts record with `note`; the source check runs after. */
async function saveItem(
  post: LoadedPost,
  version: number,
  actor: Actor,
  at: { index: number; item: Item; note: string },
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

/** The look version at `index`, or null when there is none. */
function lookItem(post: LoadedPost, index: number): Item | null {
  const item = Number.isInteger(index) ? post.current.drafts?.body.items[index] : undefined
  return item && isLook(item.template) ? item : null
}

/**
 * One slide of a look version laid out in another layout (GD5), its text moved by slot key
 * (layout/relayout.ts). A layout the slide cannot fill is refused with the reason the picker shows.
 */
export async function setSlideLayout(
  actor: Actor,
  id: string,
  version: number,
  at: { index: number; slide: number; layout: LayoutId },
): Promise<Saved> {
  return command('setSlideLayout', 'setSlideLayout', actor, id, version, async (post) => {
    const item = lookItem(post, at.index)
    const slides = item?.structure.slides ?? []
    const target = slides[at.slide - 1]
    const facts = post.current.facts?.body.facts
    if (!item || !target || !facts) return fail(WORKFLOW_ERRORS.movedOn)
    const place = { first: at.slide === 1, last: at.slide === slides.length }
    const option = layoutOptions(target, facts, place).find((o) => o.id === at.layout)
    if (!option) return fail(WORKFLOW_ERRORS.movedOn)
    if (!option.ok) return fail(option.reason)
    if (layoutIn(target) === at.layout) return { ok: true, id, version }

    const laid = relayout(target, at.layout, facts)
    const structure = {
      ...item.structure,
      slides: slides.map((s, i) => (i === at.slide - 1 ? laid : s)),
    }
    return saveItem(post, version, actor, {
      index: at.index,
      item: { ...item, structure },
      note: `Slide ${at.slide}: ${LAYOUT_LABELS[at.layout]}`,
    })
  })
}

/**
 * A look version moved to another look (GD4): the frozen template changes, its slides and their
 * layouts stay, so every slot keeps its text and is laid out again in the new look's boxes.
 */
export async function setLook(
  actor: Actor,
  id: string,
  version: number,
  at: { index: number; look: string },
): Promise<Saved> {
  return command('setLook', 'setLook', actor, id, version, async (post) => {
    const look = LOOKS.find((t) => t.id === at.look)
    if (!look) return fail(WORKFLOW_ERRORS.look)
    const item = lookItem(post, at.index)
    if (!item) return fail(WORKFLOW_ERRORS.movedOn)
    if (item.template.id === look.id) return { ok: true, id, version }
    return saveItem(post, version, actor, {
      index: at.index,
      item: {
        ...item,
        template: structuredClone(look),
        structure: { ...item.structure, templateId: look.id },
      },
      note: `Look: ${look.name}`,
    })
  })
}

/**
 * The post's colour preset (GD9): a look draws on Pop's or Subdued's surfaces. Refused when the
 * picked version, or every version when none is picked, is not a look: a template from before
 * the looks draws on the brand's themes, and a preset would leave it with no colours.
 */
export async function setPreset(
  actor: Actor,
  id: string,
  version: number,
  at: { preset: Preset },
): Promise<Saved> {
  return command('setPreset', 'setPreset', actor, id, version, async (post) => {
    if (!PRESETS.includes(at.preset)) return fail(WORKFLOW_ERRORS.preset)
    const items = post.current.drafts?.body.items ?? []
    const { picked } = post.pointers
    const versions = picked === null ? items : items.slice(picked, picked + 1)
    if (!versions.some((item) => isLook(item.template))) return fail(WORKFLOW_ERRORS.preset)
    return save(post, version, actor, async () => ({
      stage: post.stage,
      pointers: { ...post.pointers, themeId: at.preset },
    }))
  })
}
