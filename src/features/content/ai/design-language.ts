import 'server-only'
// A page's design language (criterion 105): the page's reference images read once by a model, as
// an art style, a copy style and the closest template. The editor edits and saves the fields
// (server/page-style.ts). Code checks every answer: the art style passes the art prompt guard (it
// reaches the cover prompt), each style is short, and the template is one in the registry.

import type { z } from 'zod'
import { GUIDELINE, type Guideline } from '../brands/guideline'
import { STYLE_MAX } from '../lib/page-style'
import type { Brand } from '../model/types'
import { TEMPLATES } from '../templates'
import { type AiResult, ai } from './client'
import { artPromptError } from './draft'
import { DESIGN_LANGUAGE } from './prompts'

type Answer = z.infer<typeof DESIGN_LANGUAGE.schema>

export type DesignFields = { artStyle: string; copyStyle: string; closestTemplateId: string }

/** Every problem the model can fix in one answer. */
function problemsIn(answer: Answer): string[] {
  const problems: string[] = []
  const art = answer.art_style.trim()
  const copy = answer.copy_style.trim()
  if (art === '') problems.push('art_style: describe the look of the pictures.')
  if (copy === '') problems.push('copy_style: describe how the words read.')
  if (art.length > STYLE_MAX) problems.push(`art_style: at most ${STYLE_MAX} characters.`)
  if (copy.length > STYLE_MAX) problems.push(`copy_style: at most ${STYLE_MAX} characters.`)
  if (artPromptError(art)) {
    problems.push('art_style: no digits, no quotation marks and no brand names.')
  }
  if (!TEMPLATES.some((t) => t.id === answer.closest_template_id)) {
    problems.push(
      `closest_template_id: "${answer.closest_template_id}" is not a template in DATA.templates.`,
    )
  }
  return problems
}

/** The page's design language from its reference images, checked, or the step's failure. */
export async function describeDesign(input: {
  brand: Brand
  images: { mime: 'image/png' | 'image/jpeg'; bytes: Uint8Array }[]
  /** The guideline whose art style the images are described against; the brand guideline when absent. */
  guideline?: Guideline
}): Promise<AiResult<DesignFields>> {
  const data = {
    page: { name: input.brand.name, tone: input.brand.tone },
    // The brand's own art style: the images are described against it (GD15).
    guideline: { art_style: (input.guideline ?? GUIDELINE).art.style },
    templates: TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      format: t.format,
      description: t.description,
      slides: t.slides.length,
    })),
  }
  const res = await ai.generateJson(DESIGN_LANGUAGE, {
    data,
    images: input.images.map((i) => ({
      mime: i.mime,
      base64: Buffer.from(i.bytes).toString('base64'),
    })),
    verify: problemsIn,
  })
  if (!res.ok) return res
  return {
    ok: true,
    cached: res.cached,
    value: {
      artStyle: res.value.art_style.trim(),
      copyStyle: res.value.copy_style.trim(),
      closestTemplateId: res.value.closest_template_id,
    },
  }
}
