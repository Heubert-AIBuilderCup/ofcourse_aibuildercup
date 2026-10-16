import 'server-only'
// A post's outline before any text (GD32): one lite call over the supported facts, the idea or
// two to combine, the format and the brand's voice, in the first card's look. Code checks the
// count and order against the look, that each layout is the look's, and each point: written, at
// most 120 characters, and no number a supported fact does not hold. Still failing is a failed step.

import type { z } from 'zod'
import type { Guideline } from '../brands/guideline'
import { formatById } from '../formats'
import type { Language, LanguageId } from '../languages'
import { outlineShape } from '../lib/outline'
import {
  type Fact,
  type FormatId,
  type IdeaCard,
  type OutlineSlide,
  POINT_MAX,
  type Template,
} from '../model/types'
import { missingNumbers } from '../text/numbers'
import { charCount, scriptProblems } from '../text/script'
import { ai } from './client'
import { guidelineText, inLanguage, OUTLINE, postLanguage } from './prompts'

type OutlineAnswer = z.infer<typeof OUTLINE.schema>

/** The format as DATA carries it: its id, label, one-line description and slide jobs; none is null. */
function formatData(id: FormatId | null) {
  const format = id === null ? null : formatById(id)
  if (!format) return null
  const { label, description, jobs } = format
  return { id: format.id, label, description, jobs }
}

/**
 * Every problem the model can fix in one answer: the look's count, order and layouts, and per
 * slide an empty point, one over 120 characters, or a number no supported fact holds; and points
 * not in the post's language and script, or with a digit outside 0–9 (GD37).
 */
export function outlineProblems(
  answer: OutlineAnswer,
  context: {
    template: Template
    facts: Fact[]
    /** The post's language (GD37); English when absent. */
    language?: Language
  },
): string[] {
  const problems = outlineShape(
    context.template,
    answer.slides.map((s) => s.layout),
  ).map((p) => `slides: ${p}`)
  const factText = context.facts
    .filter((f) => f.supported)
    .map((f) => f.text)
    .join('\n')
  answer.slides.forEach((slide, i) => {
    const at = `slides.${i}.point`
    const point = slide.point.trim()
    const length = charCount(point)
    if (length === 0) problems.push(`${at}: write it.`)
    if (length > POINT_MAX) problems.push(`${at}: ${length} characters; at most ${POINT_MAX}.`)
    for (const n of missingNumbers(point, factText)) {
      problems.push(`${at}: "${point.slice(n.start, n.end)}" is a number no fact holds.`)
    }
  })
  // In the post's language and script, Western digits only (GD37).
  const points = answer.slides.map((s, i): [string, string] => [`slides.${i}.point`, s.point])
  problems.push(...scriptProblems('slides', points, context.language ?? postLanguage(null)))
  return problems
}

/**
 * The outline for an idea in its look: the model sees the look's slides and layouts, the idea or
 * two to combine, the format with its description and slide jobs (GD33), the brand's voice and
 * the supported facts. `attempt` keeps each outline its own call: a new one is never the cache's.
 */
export async function outlinePost(input: {
  template: Template
  ideas: IdeaCard[]
  /** The chosen format (GD33); none for a card without one. */
  format: FormatId | null
  facts: Fact[]
  postId: string
  attempt: number
  /** The guideline whose voice the call carries; the brand guideline when absent. */
  guideline?: Guideline
  /** The post's language (GD37); English when absent. */
  language?: LanguageId
}): Promise<{ ok: true; slides: OutlineSlide[] } | { ok: false; error: string }> {
  const { template, ideas } = input
  const supported = input.facts.filter((f) => f.supported)
  const data = {
    look: {
      id: template.id,
      name: template.name,
      slides: template.slides.map(({ spec, repeat }) => ({ kind: spec.kind, repeat })),
      layouts: Object.entries(template.layouts ?? {}).flatMap(([id, spec]) =>
        spec ? [{ id, kind: spec.kind }] : [],
      ),
    },
    idea: {
      combine: ideas.length > 1,
      cards: ideas.map(({ angle, hook, audience }) => ({ angle, hook, audience })),
    },
    format: formatData(input.format),
    brand_voice: guidelineText('copy', input.guideline),
    facts: supported.map(({ id, text }) => ({ id, text })),
  }
  // Written in the post's language (GD37).
  const language = postLanguage(input.language)
  const call = inLanguage(OUTLINE, data, language)
  const verify = (answer: OutlineAnswer) =>
    outlineProblems(answer, { template, facts: supported, language })
  const res = await ai.generateJson(call.spec, {
    data: call.data,
    postId: input.postId,
    attemptKey: input.attempt,
    verify,
  })
  if (!res.ok) return { ok: false, error: res.error }
  const slides = res.value.slides.map(({ job, layout, point }) => ({
    job,
    layout,
    point: point.trim(),
  }))
  return { ok: true, slides }
}
