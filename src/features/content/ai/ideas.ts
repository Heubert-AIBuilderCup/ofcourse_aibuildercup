import 'server-only'
// Idea cards before any draft (GD1, GD3, GD7, GD20): one lite call over the supported facts and
// the paragraphs, steered by the editor's framing line. Code checks the count, each hook's length,
// banned phrases and numbers against the facts, distinct angles, Postcard only where the facts
// name a place, no hook the editor has already seen, and each format and the top three formats
// against the format file (GD33). Still failing is a failed step.

import type { z } from 'zod'
import type { Guideline } from '../brands/guideline'
import { FORMATS, formatById, RECOMMENDED_FORMATS } from '../formats'
import type { Language } from '../languages'
import { placesIn } from '../lib/places'
import type { Body } from '../model/artifacts'
import type { Fact, FormatId, IdeaCard } from '../model/types'
import { LOOKS } from '../templates'
import { bannedPhrases } from '../text/lint'
import { missingNumbers } from '../text/numbers'
import { charCount, scriptProblems } from '../text/script'
import { ai } from './client'
import { guidelineText, IDEAS, inLanguage, postLanguage } from './prompts'

type IdeasAnswer = z.infer<typeof IDEAS.schema>

export const HOOK_MAX = 90
const COUNT = { min: 2, max: 6 }
const SLIDES = { min: 4, max: 8 }
/** A blog angle's sections in place of slides (BR1), the outline's range (ai/blog.ts). */
const SECTIONS = { min: 3, max: 8 }

/** What the ideas are for: a feed post, or a blog (BR1), whose angles take no format and whose look is not checked. */
export type IdeasKind = 'feed' | 'blog'
const COUNT_PROBLEM = `cards: return between ${COUNT.min} and ${COUNT.max} ideas.`
/** The best-ranked cards shown first and marked "Recommended" (GD29). */
const RECOMMENDED = 3

const same = (text: string) => text.trim().toLowerCase()

/** A verified card's format as the record keeps it, by the file's id. */
function formatOf(id: string): { format?: FormatId } {
  const format = formatById(id)
  return format ? { format: format.id } : {}
}

/**
 * Every problem the model can fix in one answer: the count, and per card an empty field, a
 * repeated angle, a hook over 90 characters, with a banned phrase, a number no fact holds or one
 * already shown, slides outside 4 to 8, Postcard where the facts name no place, and a format the
 * file lacks; ranks that are not each of 1 to the count once (GD29); top formats that are not
 * three of the file's, each once, and a best card whose format is not the first of them (GD33).
 * A blog's angles (BR1) take no format and have no look checked, and count their sections, 3 to 8.
 * Each card is in the post's language and script, with Western digits only (GD37).
 */
export function ideasProblems(
  answer: IdeasAnswer,
  context: {
    places: string[]
    avoid: string[]
    facts: Fact[]
    kind?: IdeasKind
    /** The post's language (GD37); English when absent. */
    language?: Language
  },
): string[] {
  const { cards } = answer
  const blog = context.kind === 'blog'
  const problems = cards.length < COUNT.min || cards.length > COUNT.max ? [COUNT_PROBLEM] : []
  const ranks = new Set(cards.map((c) => c.rank))
  if (ranks.size !== cards.length || cards.some((_, i) => !ranks.has(i + 1))) {
    problems.push(`cards: give each card its own rank from 1 to ${cards.length}, 1 the best.`)
  }
  const { formats } = answer
  const known = formats.filter((id) => formatById(id) !== null)
  const ranked =
    formats.length === RECOMMENDED_FORMATS && new Set(known).size === RECOMMENDED_FORMATS
  if (!blog && !ranked) {
    problems.push('formats: rank three of DATA.formats, best first, each once.')
  }
  const slides = blog ? SECTIONS : SLIDES
  const language = context.language ?? postLanguage(null)
  const factText = context.facts.map((f) => f.text).join('\n')
  const shown = new Set(context.avoid.map(same))
  const angles = new Map<string, number>()
  cards.forEach((card, i) => {
    const at = `cards.${i}`
    for (const field of ['angle', 'hook', 'audience'] as const) {
      if (card[field].trim() === '') problems.push(`${at}.${field}: write it.`)
    }
    const angle = same(card.angle)
    const earlier = angles.get(angle)
    if (angle !== '' && earlier !== undefined) {
      problems.push(
        `${at}.angle: "${card.angle}" is card ${earlier + 1}'s angle; give this one its own.`,
      )
    } else {
      angles.set(angle, i)
    }
    const hook = card.hook.trim()
    const length = charCount(hook)
    if (length > HOOK_MAX) problems.push(`${at}.hook: ${length} characters; at most ${HOOK_MAX}.`)
    for (const phrase of bannedPhrases(hook)) problems.push(`${at}.hook: remove "${phrase}".`)
    for (const n of missingNumbers(hook, factText)) {
      problems.push(`${at}.hook: "${hook.slice(n.start, n.end)}" is a number no fact holds.`)
    }
    if (shown.has(same(hook)))
      problems.push(`${at}.hook: this hook was shown already; write a new one.`)
    // In the post's language and script, Western digits only (GD37).
    const parts = (['angle', 'hook', 'audience'] as const).map((field): [string, string] => [
      `${at}.${field}`,
      card[field],
    ])
    problems.push(...scriptProblems(at, parts, language))
    if (!Number.isInteger(card.slides) || card.slides < slides.min || card.slides > slides.max) {
      problems.push(`${at}.slides: between ${slides.min} and ${slides.max}.`)
    }
    if (blog) return
    if (card.look === 'postcard' && context.places.length === 0) {
      problems.push(`${at}.look: postcard needs a place in the facts, and DATA.places is empty.`)
    }
    if (formatById(card.format) === null) {
      problems.push(`${at}.format: "${card.format}" is not one of DATA.formats.`)
    } else if (card.rank === 1 && formats[0] !== undefined && card.format !== formats[0]) {
      problems.push(`${at}.format: the card ranked 1 takes the first of formats, "${formats[0]}".`)
    }
  })
  return problems
}

/**
 * Idea cards for a source: the model sees the supported facts, the paragraphs, the brand voice,
 * the looks, the formats, the places the facts name, the hooks to avoid and the framing line,
 * never the notes (GD21). `attempt` keeps each round its own call. The cards come best first, the
 * top three marked recommended (GD29), each with its format, and with them the three formats the
 * model ranks best for the source (GD33). A blog's angles (BR1, `kind` 'blog') are the same
 * cards with no format, the formats neither sent nor ranked.
 */
export async function suggestIdeas(input: {
  source: Body<'source'>
  facts: Fact[]
  /** The hooks already shown (GD3). */
  avoid: string[]
  postId: string
  attempt: number
  /** A feed post's ideas unless said. */
  kind?: IdeasKind
  /** The guideline whose voice the call carries; the brand guideline when absent. */
  guideline?: Guideline
}): Promise<{ ok: true; cards: IdeaCard[]; formats: FormatId[] } | { ok: false; error: string }> {
  const { source, avoid } = input
  const kind = input.kind ?? 'feed'
  const supported = input.facts.filter((f) => f.supported)
  const places = placesIn(supported)
  const data = {
    kind,
    // A post made from a blog draws its ideas from the blog's sections (BR6).
    from_blog_sections: source.blogSections ?? null,
    editor_intent: source.framing ?? null,
    brand_voice: guidelineText('copy', input.guideline),
    looks: LOOKS.map((t) => ({ id: t.id, name: t.name, line: t.description })),
    formats:
      kind === 'blog'
        ? []
        : FORMATS.map(({ id, label, description }) => ({ id, label, description })),
    places,
    avoid,
    facts: supported.map(({ id, text }) => ({ id, text })),
    paragraphs: source.paragraphs,
  }
  // Written in the post's language (GD37).
  const language = postLanguage(source.language)
  const call = inLanguage(IDEAS, data, language)
  const verify = (answer: IdeasAnswer) =>
    ideasProblems(answer, { places, avoid, facts: supported, kind, language })
  const res = await ai.generateJson(call.spec, {
    data: call.data,
    postId: input.postId,
    attemptKey: input.attempt,
    verify,
  })
  if (!res.ok) return { ok: false, error: res.error }
  // Best first, the top three marked (GD29).
  const cards = res.value.cards
    .toSorted((a, b) => a.rank - b.rank)
    .map((c) => ({
      angle: c.angle.trim(),
      hook: c.hook.trim(),
      audience: c.audience.trim(),
      look: c.look,
      ...(kind === 'blog' ? {} : formatOf(c.format)),
      slides: c.slides,
      recommended: c.rank <= RECOMMENDED,
    }))
  const formats = kind === 'blog' ? [] : res.value.formats.flatMap((id) => formatById(id)?.id ?? [])
  return { ok: true, cards, formats }
}
