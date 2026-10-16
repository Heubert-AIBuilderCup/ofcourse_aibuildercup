import 'server-only'
// The comic character (RC9): one Flash call plans a reference sheet's views from the editor's
// description; code checks the count, each label and each scene (length, the art prompt guard),
// and the ladder retries with those problems. The sheet's prompt is built by code.

import type { z } from 'zod'
import { charCount } from '../text/script'
import { slidePrompt } from './art'
import { ai } from './client'
import { artPromptError } from './draft'
import { CHARACTER_PLAN } from './prompts'

type PlanAnswer = z.infer<typeof CHARACTER_PLAN.schema>
export type CharacterView = { label: string; scene: string }

const CHARACTER_VIEWS = { min: 4, max: 6 } as const
const VIEW_LABEL_MAX = 40
const VIEW_SCENE_MAX = 200

const SHEET_LEAD =
  'A character reference sheet of one person on a plain light background, the same person in every view:'

/** Why a view's label cannot be used, or null: empty, too long, or what the art prompt guard refuses. */
export function labelError(label: string): string | null {
  const text = label.trim()
  if (text === '') return 'name the view.'
  if (charCount(text) > VIEW_LABEL_MAX)
    return `${charCount(text)} characters; at most ${VIEW_LABEL_MAX}.`
  return artPromptError(text)
}

/** Why a view's scene cannot be used, or null: empty, too long, or what the art prompt guard refuses. */
export function sceneError(scene: string): string | null {
  const text = scene.trim()
  if (text === '') return 'describe the view.'
  if (charCount(text) > VIEW_SCENE_MAX)
    return `${charCount(text)} characters; at most ${VIEW_SCENE_MAX}.`
  return artPromptError(text)
}

/** Every problem the model can fix in one answer: the count, then each label and scene. */
export function viewProblems(answer: PlanAnswer): string[] {
  const problems: string[] = []
  const count = answer.views.length
  if (count < CHARACTER_VIEWS.min || count > CHARACTER_VIEWS.max) {
    problems.push(
      `views: ${count} views; a sheet has ${CHARACTER_VIEWS.min} to ${CHARACTER_VIEWS.max}.`,
    )
  }
  answer.views.forEach((view, i) => {
    const label = labelError(view.label)
    if (label) problems.push(`views.${i}.label: ${label}`)
    const scene = sceneError(view.scene)
    if (scene) problems.push(`views.${i}.scene: ${scene}`)
  })
  return problems
}

/** The views of the character the description names, each label and scene trimmed. */
export async function planViews(
  input: { description: string },
  deps: { ai: Pick<typeof ai, 'generateJson'> } = { ai },
): Promise<{ ok: true; views: CharacterView[] } | { ok: false; error: string }> {
  const res = await deps.ai.generateJson(CHARACTER_PLAN, {
    data: { description: input.description },
    verify: viewProblems,
  })
  if (!res.ok) return { ok: false, error: res.error }
  return {
    ok: true,
    views: res.value.views.map((v) => ({ label: v.label.trim(), scene: v.scene.trim() })),
  }
}

/**
 * The sheet's prompt, built by code: one person on a plain ground in every view, each view as
 * `label: scene`, the description, the editor's note as a change, the rule against text, and last
 * the brand guideline for images with the Comics art style as its style sentence, as a panel has.
 */
export function sheetPrompt(input: {
  views: CharacterView[]
  description: string
  note: string | null
  artStyle: string
}): string {
  const views = input.views.map((v) => `${v.label}: ${v.scene.replace(/[.!?]$/, '')}.`)
  const description = input.description.trim().replace(/[.!?]$/, '')
  return slidePrompt({
    scene: [SHEET_LEAD, ...views, `${description}.`].join(' '),
    emotion: null,
    nudge: input.note,
    artStyle: input.artStyle,
  })
}
