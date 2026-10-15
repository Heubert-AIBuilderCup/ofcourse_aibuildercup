// A blog's outline (BR2): its sections, each a question-style heading and the one point it
// makes, and the editor's changes to them, each refused when it would leave the outline with no
// section or more than eight, or a heading that is not a question. Pure and client-safe: the
// command, the outline step's controls and the model's checks read it.

import type { LanguageId } from '../languages'
import { charCount } from '../text/script'

/** How many sections an outline the editor shapes may have (the blog_outline record's bounds). */
export const BLOG_SECTIONS = { min: 1, max: 8 } as const
export const HEADING_MAX = 120
export const BLOG_POINT_MAX = 200

export const BLOG_OUTLINE_ERRORS = {
  section: 'That section is not in the outline.',
  heading: `Write the heading as a question of 1 to ${HEADING_MAX} characters, ending with "?".`,
  point: `Write the point in 1 to ${BLOG_POINT_MAX} characters.`,
  fewest: 'A blog keeps at least one section.',
  most: `A blog has at most ${BLOG_SECTIONS.max} sections.`,
} as const

export type BlogSection = { heading: string; point: string }

/** One change to a blog's sections, sections and places numbered from 1. */
export type BlogOutlineOp =
  | { op: 'move'; section: number; to: number }
  | { op: 'add'; at: number; section: BlogSection }
  | { op: 'remove'; section: number }
  | { op: 'reword'; section: number; heading?: string; point?: string }

/**
 * A question-style heading: some words, ending with a question mark. In a post not in English any
 * heading of some words is one: Thai asks with a particle (ไหม) and no mark, and a Devanagari
 * question may close with a danda (।).
 */
export function isQuestion(heading: string, language: LanguageId = 'en'): boolean {
  const trimmed = heading.trim()
  return charCount(trimmed) > 1 && (language !== 'en' || trimmed.endsWith('?'))
}

/** The text trimmed, or null when it is empty or over `max` characters as a reader sees them. */
function within(text: string, max: number): string | null {
  const trimmed = text.trim()
  const length = charCount(trimmed)
  return length >= 1 && length <= max ? trimmed : null
}

const pointOf = (text: string) => within(text, BLOG_POINT_MAX)

type Edited = { ok: true; sections: BlogSection[] } | { ok: false; error: string }

/** The sections after the change, or why it is refused; headings by the question rule of the post's language. */
export function editBlogSections(
  sections: readonly BlogSection[],
  op: BlogOutlineOp,
  language: LanguageId = 'en',
): Edited {
  const headingOf = (text: string) =>
    isQuestion(text, language) ? within(text, HEADING_MAX) : null
  const fail = (error: string): Edited => ({ ok: false, error })
  const isSection = (n: number) => Number.isInteger(n) && n >= 1 && n <= sections.length
  switch (op.op) {
    case 'move': {
      if (!isSection(op.section) || !isSection(op.to)) return fail(BLOG_OUTLINE_ERRORS.section)
      const next = sections.filter((_, i) => i !== op.section - 1)
      next.splice(op.to - 1, 0, sections[op.section - 1])
      return { ok: true, sections: next }
    }
    case 'add': {
      if (!Number.isInteger(op.at) || op.at < 1 || op.at > sections.length + 1) {
        return fail(BLOG_OUTLINE_ERRORS.section)
      }
      if (sections.length >= BLOG_SECTIONS.max) return fail(BLOG_OUTLINE_ERRORS.most)
      const heading = headingOf(op.section.heading)
      if (heading === null) return fail(BLOG_OUTLINE_ERRORS.heading)
      const point = pointOf(op.section.point)
      if (point === null) return fail(BLOG_OUTLINE_ERRORS.point)
      const next = [...sections]
      next.splice(op.at - 1, 0, { heading, point })
      return { ok: true, sections: next }
    }
    case 'remove': {
      if (!isSection(op.section)) return fail(BLOG_OUTLINE_ERRORS.section)
      if (sections.length <= BLOG_SECTIONS.min) return fail(BLOG_OUTLINE_ERRORS.fewest)
      return { ok: true, sections: sections.filter((_, i) => i !== op.section - 1) }
    }
    case 'reword': {
      if (!isSection(op.section)) return fail(BLOG_OUTLINE_ERRORS.section)
      const was = sections[op.section - 1]
      const heading = op.heading === undefined ? was.heading : headingOf(op.heading)
      if (heading === null) return fail(BLOG_OUTLINE_ERRORS.heading)
      const point = op.point === undefined ? was.point : pointOf(op.point)
      if (point === null) return fail(BLOG_OUTLINE_ERRORS.point)
      const next = sections.map((s, i) => (i === op.section - 1 ? { heading, point } : s))
      return { ok: true, sections: next }
    }
  }
}

/** The history's line for a change to the sections. */
export function blogOutlineNote(op: BlogOutlineOp): string {
  switch (op.op) {
    case 'move':
      return `Section ${op.section} moved`
    case 'add':
      return 'Section added'
    case 'remove':
      return `Section ${op.section} removed`
    case 'reword':
      return `Section ${op.section} reworded`
  }
}
