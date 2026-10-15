// A blog's text (BR3): what the source check reads in it, and the editor's changes to it in
// place. Each section body and FAQ answer names the facts it rests on, so its sentences are read
// against those facts' source sentences, as a slide's are (lib/claims.ts); a takeaway names none
// and is read against the source. Headings and questions are not claims. Pure and client-safe:
// the commands, the text step's controls and the approval gate read it.

import { z } from 'zod'
import type { LanguageId } from '../languages'
import type { Body } from '../model/artifacts'
import type { Fact } from '../model/types'
import { charCount } from '../text/script'
import { sentences } from '../text/sentences'
import { BLOG_OUTLINE_ERRORS, BLOG_POINT_MAX, HEADING_MAX, isQuestion } from './blog-outline'
import { type EvidencedClaim, factEvidence } from './claims'

export type BlogText = Pick<Body<'blog_text'>, 'sections' | 'takeaways' | 'faq'>

/** The longest section body and FAQ answer the editor may save. */
export const BLOG_BODY_MAX = 10_000
export const BLOG_ANSWER_MAX = 1_000
/** How many takeaways and questions a blog keeps (the outline's bounds). */
export const BLOG_TEXT_COUNTS = { takeaways: { min: 3 }, faq: { min: 3 } } as const

export const BLOG_TEXT_ERRORS = {
  part: 'That part is not in the blog.',
  heading: BLOG_OUTLINE_ERRORS.heading,
  question: `Write the question in 1 to ${HEADING_MAX} characters, ending with "?".`,
  body: `Write the section in 1 to ${BLOG_BODY_MAX} characters.`,
  takeaway: `Write the takeaway in 1 to ${BLOG_POINT_MAX} characters.`,
  answer: `Write the answer in 1 to ${BLOG_ANSWER_MAX} characters.`,
  fewestTakeaways: `A blog keeps at least ${BLOG_TEXT_COUNTS.takeaways.min} takeaways.`,
  fewestQuestions: `A blog keeps at least ${BLOG_TEXT_COUNTS.faq.min} questions.`,
} as const

/**
 * One change to a blog's text, each part by its index from 0: a section's heading or body, a
 * takeaway, an FAQ question or answer, or a takeaway or question removed.
 */
export type BlogTextEdit =
  | { part: 'section'; index: number; field: 'heading' | 'body'; text: string }
  | { part: 'takeaway'; index: number; text: string }
  | { part: 'faq'; index: number; field: 'q' | 'a'; text: string }
  | { part: 'takeaway' | 'faq'; index: number; remove: true }

const place = z.number()
const words = z.string()
/** A change as it arrives from the page, checked field by field before it is applied. */
export const BlogTextEditSchema: z.ZodType<BlogTextEdit> = z.union([
  z.strictObject({
    part: z.literal('section'),
    index: place,
    field: z.enum(['heading', 'body']),
    text: words,
  }),
  z.strictObject({ part: z.literal('takeaway'), index: place, text: words }),
  z.strictObject({ part: z.literal('faq'), index: place, field: z.enum(['q', 'a']), text: words }),
  z.strictObject({ part: z.enum(['takeaway', 'faq']), index: place, remove: z.literal(true) }),
])

/**
 * Every sentence the source check reads, in reading order: the section bodies, the takeaways,
 * then the FAQ answers. A claim names its part in `slot` and the part's place, from 1, in
 * `slide`; its evidence is the supported facts its part binds, none for a takeaway.
 */
export function blogClaims(text: BlogText, facts: Fact[]): EvidencedClaim[] {
  const byId = new Map(facts.map((f) => [f.id, f]))
  const claims: EvidencedClaim[] = []
  const add = (slot: string, place: number, body: string, factIds: readonly string[]) => {
    const evidence = factEvidence(factIds, byId)
    for (const sentence of sentences(body)) {
      claims.push({ slide: place, slot, text: sentence, evidence })
    }
  }
  text.sections.forEach((s, i) => {
    add('section', i + 1, s.body, s.factIds)
  })
  text.takeaways.forEach((t, i) => {
    add('takeaway', i + 1, t, [])
  })
  text.faq.forEach((f, i) => {
    add('faq', i + 1, f.a, f.factIds)
  })
  return claims
}

/** The questions the facts did not answer (an empty answer), by place from 1: the editor rewords or removes each. */
export function unansweredQuestions(text: BlogText): number[] {
  return text.faq.flatMap((f, i) => (f.a.trim() === '' ? [i + 1] : []))
}

/** The text trimmed, or null when it is empty or over `max` characters as a reader sees them. */
function within(text: string, max: number): string | null {
  const trimmed = text.trim()
  const length = charCount(trimmed)
  return length >= 1 && length <= max ? trimmed : null
}

type Edited = { ok: true; text: BlogText } | { ok: false; error: string }

/**
 * The text after the change, or why it is refused; every other part as it was. Headings and
 * questions keep the question rule of the post's language (./blog-outline.ts isQuestion).
 */
export function editBlogText(
  text: BlogText,
  edit: BlogTextEdit,
  language: LanguageId = 'en',
): Edited {
  const fail = (error: string): Edited => ({ ok: false, error })
  const count =
    edit.part === 'section'
      ? text.sections.length
      : edit.part === 'takeaway'
        ? text.takeaways.length
        : text.faq.length
  const { index } = edit
  if (!Number.isInteger(index) || index < 0 || index >= count) return fail(BLOG_TEXT_ERRORS.part)
  const at = <T>(list: readonly T[], value: T) => list.map((x, i) => (i === index ? value : x))

  if ('remove' in edit) {
    if (edit.part === 'takeaway') {
      if (count <= BLOG_TEXT_COUNTS.takeaways.min) return fail(BLOG_TEXT_ERRORS.fewestTakeaways)
      return {
        ok: true,
        text: { ...text, takeaways: text.takeaways.filter((_, i) => i !== index) },
      }
    }
    if (count <= BLOG_TEXT_COUNTS.faq.min) return fail(BLOG_TEXT_ERRORS.fewestQuestions)
    return { ok: true, text: { ...text, faq: text.faq.filter((_, i) => i !== index) } }
  }

  switch (edit.part) {
    case 'section': {
      const was = text.sections[index]
      if (edit.field === 'heading') {
        const heading = isQuestion(edit.text, language) ? within(edit.text, HEADING_MAX) : null
        if (heading === null) return fail(BLOG_TEXT_ERRORS.heading)
        return { ok: true, text: { ...text, sections: at(text.sections, { ...was, heading }) } }
      }
      const body = within(edit.text, BLOG_BODY_MAX)
      if (body === null) return fail(BLOG_TEXT_ERRORS.body)
      return { ok: true, text: { ...text, sections: at(text.sections, { ...was, body }) } }
    }
    case 'takeaway': {
      const line = within(edit.text, BLOG_POINT_MAX)
      if (line === null) return fail(BLOG_TEXT_ERRORS.takeaway)
      return { ok: true, text: { ...text, takeaways: at(text.takeaways, line) } }
    }
    case 'faq': {
      const was = text.faq[index]
      if (edit.field === 'q') {
        const q = isQuestion(edit.text, language) ? within(edit.text, HEADING_MAX) : null
        if (q === null) return fail(BLOG_TEXT_ERRORS.question)
        return { ok: true, text: { ...text, faq: at(text.faq, { ...was, q }) } }
      }
      const a = within(edit.text, BLOG_ANSWER_MAX)
      if (a === null) return fail(BLOG_TEXT_ERRORS.answer)
      return { ok: true, text: { ...text, faq: at(text.faq, { ...was, a }) } }
    }
  }
}

/** The history's line for a change to the text, parts numbered from 1. */
export function blogTextNote(edit: BlogTextEdit): string {
  const n = edit.index + 1
  if ('remove' in edit)
    return edit.part === 'takeaway' ? `Takeaway ${n} removed` : `Question ${n} removed`
  switch (edit.part) {
    case 'section':
      return edit.field === 'heading' ? `Section ${n} heading edited` : `Section ${n} edited`
    case 'takeaway':
      return `Takeaway ${n} edited`
    case 'faq':
      return edit.field === 'q' ? `Question ${n} edited` : `Answer ${n} edited`
  }
}
