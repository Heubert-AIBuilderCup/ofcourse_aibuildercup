import 'server-only'
// A comic's story (RC2): one Flash call over a path's facts, the editor's premise and the emotion,
// in the brand's voice. Code checks the panel count, each caption (length, promises, banned
// phrases, numbers no fact holds), each scene (length, the art prompt guard) and the title; the
// ladder retries with those problems, and still failing is a failed step.

import type { z } from 'zod'
import type { Language, LanguageId } from '../languages'
import { COMIC_PANELS, comicCaptionError, SCENE_MAX } from '../lib/comic-rules'
import type { Path } from '../lib/path-facts'
import type { Fact, Structure } from '../model/types'
import { COMIC_TEMPLATE_ID } from '../templates'
import { charCount, scriptProblems } from '../text/script'
import { ai } from './client'
import { artPromptError } from './draft'
import { COMIC_STORY, guidelineText, inLanguage, postLanguage } from './prompts'

type StoryAnswer = z.infer<typeof COMIC_STORY.schema>

const CAPTION_MAX = 140

/** Every problem the model can fix in one answer: the count, each caption and scene, the title, and the post's language (GD37). */
export function storyProblems(
  answer: StoryAnswer,
  facts: Fact[],
  language: Language = postLanguage(null),
): string[] {
  const problems: string[] = []
  const count = answer.panels.length
  if (count < COMIC_PANELS.min || count > COMIC_PANELS.max) {
    problems.push(
      `panels: ${count} panels; a comic has ${COMIC_PANELS.min} to ${COMIC_PANELS.max}.`,
    )
  }
  answer.panels.forEach((panel, i) => {
    const caption = panel.caption.trim()
    const captionLength = charCount(caption)
    if (captionLength > CAPTION_MAX) {
      problems.push(`panels.${i}.caption: ${captionLength} characters; at most ${CAPTION_MAX}.`)
    }
    const captionError = comicCaptionError(caption, facts)
    if (captionError) problems.push(`panels.${i}.caption: ${captionError}`)
    const scene = panel.scene.trim()
    const sceneLength = charCount(scene)
    if (sceneLength > SCENE_MAX) {
      problems.push(`panels.${i}.scene: ${sceneLength} characters; at most ${SCENE_MAX}.`)
    }
    const sceneError = artPromptError(scene)
    if (sceneError) problems.push(`panels.${i}.scene: ${sceneError}`)
  })
  if (answer.title.trim() === '') problems.push('title: write it.')
  // The title and captions in the post's language and script, Western digits only (GD37); the
  // scenes are for the image model.
  const words: [string, string][] = [
    ['title', answer.title],
    ...answer.panels.map((p, i): [string, string] => [`panels.${i}.caption`, p.caption]),
  ]
  problems.push(...scriptProblems('title and panels', words, language))
  return problems
}

/** The comic's story as a title and a structure in the comic template: the cover, then the panels. */
export async function draftStory(
  input: {
    path: Path
    facts: Fact[]
    premise: string | null
    emotion: { label: string; tone: string } | null
    postId: string
    /** The post's language (GD37); English when absent. */
    language?: LanguageId
  },
  deps: { ai: Pick<typeof ai, 'generateJson'> } = { ai },
): Promise<{ ok: true; title: string; structure: Structure } | { ok: false; error: string }> {
  const data = {
    path: input.path.label,
    premise: input.premise,
    emotion: input.emotion,
    brand_voice: guidelineText('copy'),
    facts: input.facts.map(({ id, text }) => ({ id, text })),
  }
  // Written in the post's language (GD37).
  const language = postLanguage(input.language)
  const call = inLanguage(COMIC_STORY, data, language)
  const verify = (answer: StoryAnswer) => storyProblems(answer, input.facts, language)
  const res = await deps.ai.generateJson(call.spec, {
    data: call.data,
    postId: input.postId,
    verify,
  })
  if (!res.ok) return { ok: false, error: res.error }
  const slides = res.value.panels.map((panel, i) => ({
    kind: i === 0 ? ('cover' as const) : ('body' as const),
    slots: { caption: { text: panel.caption.trim(), factIds: [], factual: false } },
    scene: panel.scene.trim(),
  }))
  return {
    ok: true,
    title: res.value.title.trim(),
    structure: { templateId: COMIC_TEMPLATE_ID, slides, artPrompt: slides[0].scene },
  }
}
