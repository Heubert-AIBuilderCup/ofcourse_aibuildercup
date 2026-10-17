import 'server-only'
// The images planned in words before any is drawn (GD12): one lite call over the art-box slides'
// words and layouts, the idea, the look, the emotion and the brand guideline for images. Code
// checks one scene per art box (one in all for Postcard's panorama), each at most 200 characters
// and passing the art prompt guard. Still failing is a failed step. A blog's pictures (BR4) are
// planned by the same call, from its title, takeaways and sections.

import type { z } from 'zod'
import type { Guideline } from '../brands/guideline'
import { emotionOf } from '../emotions'
import type { Body } from '../model/artifacts'
import type { BlogTarget, IdeaCard, Structure, Template } from '../model/types'
import { artSlides, isPanorama } from '../templates'
import { charCount } from '../text/script'
import { ai } from './client'
import { artPromptError } from './draft'
import { guidelineText, SCENE_PLAN } from './prompts'

type ScenePlanAnswer = z.infer<typeof SCENE_PLAN.schema>

/** The longest planned scene, the model's and the editor's alike. */
export const SCENE_MAX = 200

export type PlannedScene = { slide: number; scene: string }

/**
 * Every problem the model can fix in one answer: a scene for each expected slide and none other,
 * once each (exactly one, for slide 1, across a panorama), and per scene an empty one, one over
 * 200 characters, or one the art prompt guard refuses.
 */
export function scenePlanProblems(
  answer: ScenePlanAnswer,
  expected: { slides: number[]; panorama: boolean },
): string[] {
  const wanted = expected.panorama ? [1] : expected.slides
  const problems: string[] = []
  const got = answer.scenes.map((s) => s.slide)
  const missing = wanted.filter((n) => !got.includes(n))
  if (answer.scenes.length !== wanted.length || missing.length > 0) {
    problems.push(
      expected.panorama
        ? 'scenes: return exactly one scene, with slide 1, across all the slides.'
        : `scenes: return one scene for each of slides ${wanted.join(', ')}.`,
    )
  }
  const seen = new Set<number>()
  answer.scenes.forEach(({ slide, scene }, i) => {
    const at = `scenes.${i}`
    if (!wanted.includes(slide)) problems.push(`${at}.slide: ${slide} is not one of DATA.slides.`)
    else if (seen.has(slide)) problems.push(`${at}.slide: slide ${slide} has a scene already.`)
    seen.add(slide)
    const text = scene.trim()
    const length = charCount(text)
    if (length === 0) problems.push(`${at}.scene: write it.`)
    if (length > SCENE_MAX)
      problems.push(`${at}.scene: ${length} characters; at most ${SCENE_MAX}.`)
    if (artPromptError(text)) {
      problems.push(`${at}.scene: no digits, quotation marks or brand names.`)
    }
  })
  return problems
}

/**
 * The scenes for a look's slides: one per art-box slide in slide order, or one wide scene for a
 * panorama, which the model plans from every slide's words.
 */
export async function planScenes(input: {
  template: Template
  structure: Structure
  /** The idea card the version was drafted for, or up to four combined; null for none. */
  idea: IdeaCard[] | null
  emotion: string | null
  postId: string
  /** The guideline whose image section the call carries; the brand guideline when absent. */
  guideline?: Guideline
  /** Distinct per plan, so "Plan again" is never answered from the cache with the last plan. */
  attempt?: number
  /** The art-box slides to plan when the others keep their scenes (story 14); all when absent. */
  slides?: number[]
}): Promise<
  { ok: true; scenes: PlannedScene[]; panorama: boolean } | { ok: false; error: string }
> {
  const { template, structure } = input
  const panorama = isPanorama(template)
  const slides = input.slides ?? artSlides(template, structure)
  const data = {
    look: { id: template.id, name: template.name, line: template.description },
    panorama,
    idea: input.idea?.map(({ angle, hook }) => ({ angle, hook })) ?? null,
    emotion: emotionOf(input.emotion)?.label ?? null,
    guideline: guidelineText('image', input.guideline),
    slides: slides.map((n) => {
      const slide = structure.slides[n - 1]
      return {
        slide: n,
        layout: slide.layout ?? null,
        text: Object.values(slide.slots).map((s) => s.text),
      }
    }),
  }
  const res = await askScenes(data, { slides, panorama }, input.postId, input.attempt ?? 0)
  return res.ok ? { ...res, panorama } : res
}

/** The one SCENE_PLAN call, verified for the slides wanted, its scenes trimmed in slide order. */
async function askScenes(
  data: { slides: { slide: number; layout: string | null; text: string[] }[] } & Record<
    string,
    unknown
  >,
  expected: { slides: number[]; panorama: boolean },
  postId: string,
  attempt: number,
): Promise<{ ok: true; scenes: PlannedScene[] } | { ok: false; error: string }> {
  const verify = (answer: ScenePlanAnswer) => scenePlanProblems(answer, expected)
  const res = await ai.generateJson(SCENE_PLAN, { data, postId, attemptKey: attempt, verify })
  if (!res.ok) return { ok: false, error: res.error }
  const scenes = res.value.scenes
    .map(({ slide, scene }) => ({ slide, scene: scene.trim() }))
    .sort((a, b) => a.slide - b.slide)
  return { ok: true, scenes }
}

/** What a blog's look says to the scene plan: there is no slide template, only the article. */
const BLOG_LOOK = {
  id: 'blog',
  name: 'Blog',
  line: 'a wide cover picture, and pictures between the sections of an article',
}

/**
 * The scenes for a blog's pictures (BR4), from its own words: the cover from the title and the
 * takeaways, each picture between sections from the section it follows (heading and body), with
 * the idea it was outlined for, its emotion and the guideline. Same call and checks as a look's.
 */
export async function planBlogScenes(input: {
  title: string
  text: Pick<Body<'blog_text'>, 'sections' | 'takeaways'>
  /** The pictures to plan, numbered as the plan addresses them. */
  targets: { slide: number; target: BlogTarget }[]
  idea: IdeaCard | null
  emotion: string | null
  postId: string
  guideline?: Guideline
  /** Distinct per plan, so "Plan again" is never answered from the cache with the last plan. */
  attempt?: number
}): Promise<{ ok: true; scenes: PlannedScene[] } | { ok: false; error: string }> {
  const { title, text, targets } = input
  const data = {
    look: BLOG_LOOK,
    panorama: false,
    idea: input.idea ? [{ angle: input.idea.angle, hook: input.idea.hook }] : null,
    emotion: emotionOf(input.emotion)?.label ?? null,
    guideline: guidelineText('image', input.guideline),
    slides: targets.map(({ slide, target }) => {
      if (target === 'cover') return { slide, layout: 'cover', text: [title, ...text.takeaways] }
      const section = text.sections[target.after - 1]
      return {
        slide,
        layout: `after section ${target.after}`,
        text: section ? [section.heading, section.body] : [],
      }
    }),
  }
  const slides = targets.map((t) => t.slide)
  return askScenes(data, { slides, panorama: false }, input.postId, input.attempt ?? 0)
}
