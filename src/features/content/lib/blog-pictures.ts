// A blog's pictures (BR4): where they sit, the shape each is drawn at, and the linked posts whose
// slides sit after a section in place of a picture. Pure and client-safe: the commands and the
// images step read it.

import { BLOG_INLINE_MAX, type BlogEmbed, type BlogTarget } from '../model/types'

export const BLOG_PICTURE_ERRORS = {
  at: 'Choose one of the sections.',
  many: `A blog shows the slides of up to ${BLOG_INLINE_MAX} posts.`,
  notLinked: 'Only a post linked to this blog can be embedded.',
  notLive: "Only a live post's slides can be embedded.",
} as const

/**
 * The places a blog's pictures are planned for: the cover, then one fewer inline picture than
 * there are sections, up to three, spread evenly through the sections and never after the last
 * (the takeaways follow it). Numbered from 1 in that order, which is how the plan's scenes and
 * the drawn pictures are addressed.
 */
export function blogPictureTargets(sections: number): { slide: number; target: BlogTarget }[] {
  const inline = Math.max(0, Math.min(BLOG_INLINE_MAX, sections - 1))
  const afters = Array.from({ length: inline }, (_, i) =>
    Math.ceil(((i + 1) * sections) / (inline + 1)),
  )
  return [
    { slide: 1, target: 'cover' as const },
    ...afters.map((after, i) => ({ slide: i + 2, target: { after } })),
  ]
}

/** The cover is drawn wide, 16:9; a picture between sections at 4:3. */
export function blogAspect(target: BlogTarget): '16:9' | '4:3' {
  return target === 'cover' ? '16:9' : '4:3'
}

/** Whether the picture's place is one a post's slides sit at, in its place. */
export const embeddedAt = (embeds: readonly BlogEmbed[], target: BlogTarget): boolean =>
  target !== 'cover' && embeds.some((e) => e.after === target.after)

/**
 * The embeds with the post's slides after section `after` of `sections`, in section order: a
 * post already embedded moves there, and one that sat there gives way. Refused for a place that
 * is not one of the sections, and for a fourth post.
 */
export function withEmbed(
  embeds: readonly BlogEmbed[],
  embed: BlogEmbed,
  sections: number,
): { ok: true; embeds: BlogEmbed[] } | { ok: false; error: string } {
  const { after, postId } = embed
  if (!Number.isInteger(after) || after < 1 || after > sections) {
    return { ok: false, error: BLOG_PICTURE_ERRORS.at }
  }
  const others = embeds.filter((e) => e.postId !== postId && e.after !== after)
  if (others.length >= BLOG_INLINE_MAX) return { ok: false, error: BLOG_PICTURE_ERRORS.many }
  return { ok: true, embeds: [...others, { after, postId }].sort((a, b) => a.after - b.after) }
}
