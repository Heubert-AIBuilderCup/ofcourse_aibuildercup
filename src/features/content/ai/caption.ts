import 'server-only'
// G6, the caption of a social version (criterion 109). The model writes only the opening hook and
// the call to action, from the approved slides' text, the lines code will place between them and
// the page brand. Code assembles the caption: hook, the post's own checked lines (each bound
// factual slot and the takeaway, as they stand on the slides), call to action, the last slide's
// search line, the post's sources by name (GD31), and last, while the post's blog is live, "Read
// the full guide" with its address (BR7); the hashtags come from the post's tags. Code checks the
// model's part: no number, no banned phrase, within the platform's words (criterion 65). Still
// failing is a failed step.

import type { z } from 'zod'
import type { Guideline } from '../brands/guideline'
import { type Language, type LanguageId, linesOf } from '../languages'
import { SEARCH_LINE, SOURCES_LINE } from '../layout/engine'
import { guideLine } from '../lib/public-blog'
import type { Body } from '../model/artifacts'
import type { Brand, Fact, Structure, Template } from '../model/types'
import { tagById } from '../tags'
import { findSlideSpec } from '../templates'
import { bannedPhrases } from '../text/lint'
import { numbersIn } from '../text/numbers'
import { scriptProblems } from '../text/script'
import { AI_ERRORS, ai } from './client'
import { CAPTION, guidelineText, inLanguage, postLanguage } from './prompts'
import { withReplay } from './replays'

type CaptionAnswer = z.infer<typeof CAPTION.schema>
type Platform = 'instagram' | 'linkedin'

/** The most words each platform's text may have. */
export const CAPTION_WORDS: Record<Platform, number> = { instagram: 150, linkedin: 300 }
/** The most hashtags each platform takes: LinkedIn post text carries none. */
export const CAPTION_HASHTAGS: Record<Platform, number> = { instagram: 8, linkedin: 0 }
/**
 * One word after the #: letters, digits and underscores, a letter's marks with it (Devanagari and
 * Thai write vowels as marks), never a mark first.
 */
export const HASHTAG = /^#(?!\p{M})[\p{L}\p{M}\p{N}_]{1,60}$/u

/** The most words the model's two parts may take; the lines are fitted around them. */
const HOOK_WORDS = 20
const CALL_WORDS = 15

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

/**
 * The post's own checked lines in slide order, that fit: every factual slot bound to a supported
 * fact, as it stands on the slide, until the next would not fit `budget` words with the takeaway,
 * which always comes last. Never a line cut in two.
 */
function linesThatFit(
  structure: Structure,
  template: Template,
  facts: Fact[],
  budget: number,
): string[] {
  const supported = new Set(facts.filter((f) => f.supported).map((f) => f.id))
  const factual: string[] = []
  let takeaway: string | null = null
  for (const slide of structure.slides) {
    const spec = findSlideSpec(template, slide)
    for (const slotSpec of spec?.slots ?? []) {
      const text = slide.slots[slotSpec.key]?.text.trim()
      if (!text) continue
      if (slotSpec.key === 'takeaway') takeaway = text
      else if (
        slotSpec.factual &&
        slide.slots[slotSpec.key].factIds.some((id) => supported.has(id))
      ) {
        factual.push(text)
      }
    }
  }
  const lines: string[] = []
  let used = takeaway ? words(takeaway) : 0
  for (const line of factual) {
    if (used + words(line) > budget) break
    lines.push(line)
    used += words(line)
  }
  if (takeaway) lines.push(takeaway)
  return lines
}

/** `#` and the tag's label capitalised without spaces; a tag the file lacks, or whose label has no letter, gives none. */
function hashtagsFor(tagIds: string[], max: number): string[] {
  const tags: string[] = []
  for (const id of tagIds) {
    const label = tagById(id)?.label
    if (!label) continue
    const word = label
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')
      .replace(/[^\p{L}\p{N}_]/gu, '')
    const tag = `#${word}`
    if (!/\p{L}/u.test(word) || !HASHTAG.test(tag) || tags.includes(tag)) continue
    tags.push(tag)
  }
  return tags.slice(0, max)
}

/** Every problem the model can fix in one answer, the post's language among them (GD37); `budget` is the words left for its two parts together. */
function problemsIn(answer: CaptionAnswer, budget: number, language: Language): string[] {
  const problems: string[] = []
  const parts: [string, string, number][] = [
    ['hook', answer.hook.trim(), HOOK_WORDS],
    ['call_to_action', answer.call_to_action.trim(), CALL_WORDS],
  ]
  for (const [path, text, max] of parts) {
    if (text.length === 0) problems.push(`${path}: write it.`)
    if (words(text) > max) problems.push(`${path}: at most ${max} words.`)
    for (const n of numbersIn(text)) {
      problems.push(`${path}: "${text.slice(n.start, n.end)}" is a number; write none.`)
    }
    for (const phrase of bannedPhrases(text)) problems.push(`${path}: remove "${phrase}".`)
  }
  if (words(parts[0][1]) + words(parts[1][1]) > budget) {
    problems.push(`hook and call_to_action: together at most ${budget} words.`)
  }
  // In the post's language and script, Western digits only (GD37).
  const written = parts.map(([path, text]): [string, string] => [path, text])
  problems.push(...scriptProblems('hook and call_to_action', written, language))
  return problems
}

export async function writeCaption(input: {
  platform: Platform
  brand: Brand
  revision: Body<'revision'>
  facts: Fact[]
  demoKey: string | null
  postId: string
  /** The title the last slide's search line names (criterion 106). */
  title: string
  /** The post's tag ids, for the hashtags. */
  tags: string[]
  /** The post's sources by name (`sourceNames`): every caption ends with them (GD31). */
  sources: string[]
  /** The address of the post's blog while it is live (BR7): the caption ends with the guide line. */
  guide?: string | null
  /** The copy style of the version's page, when that page has a design language (criterion 105). */
  copyStyle?: string | null
  /** The guideline whose voice the call carries; the brand guideline when absent. Tests pass a changed one. */
  guideline?: Guideline
  /** The post's language (GD37); English when absent. */
  language?: LanguageId
}): Promise<
  { ok: true; text: string; hashtags: string[]; replays: string[] } | { ok: false; error: string }
> {
  const { platform, brand, revision, demoKey, postId } = input
  try {
    // The lines code writes, in the post's language (GD39).
    const fixed = linesOf(input.language)
    const search = SEARCH_LINE(input.title, input.language)
    // Every caption ends with the sources, after the search line (GD31).
    const sources = SOURCES_LINE(input.sources, fixed.captionSources)
    // And, while its blog is live, with the guide after them (BR7).
    const guide = input.guide ? guideLine(input.guide, fixed.guide) : ''
    const closing = words(search) + words(sources) + words(guide)
    const lines = linesThatFit(
      revision.structure,
      revision.template,
      input.facts,
      CAPTION_WORDS[platform] - closing - HOOK_WORDS - CALL_WORDS,
    )
    const hashtags = hashtagsFor(input.tags, CAPTION_HASHTAGS[platform])
    const budget = CAPTION_WORDS[platform] - closing - lines.reduce((n, l) => n + words(l), 0)
    // Written in the post's language (GD37).
    const language = postLanguage(input.language)
    const verify = (answer: CaptionAnswer) => problemsIn(answer, budget, language)
    const data = {
      platform,
      brand: {
        name: brand.name,
        brand_voice: guidelineText('copy', input.guideline),
        // Only when the page has one, so a page with none sends the data it always did.
        ...(input.copyStyle?.trim() && { copy_style: input.copyStyle.trim() }),
      },
      slides: revision.structure.slides.map((s) => Object.values(s.slots).map((slot) => slot.text)),
      body: lines,
    }
    const call = inLanguage(CAPTION, data, language)
    const step = `caption:${platform}`

    const res = await withReplay(demoKey, step, CAPTION.schema, () =>
      ai.generateJson(call.spec, { data: call.data, postId, verify }),
    )
    if (!res.ok) return { ok: false, error: res.error }
    // A recording is verified again, like any answer.
    if (res.replay && verify(res.value).length > 0) return { ok: false, error: AI_ERRORS.failed }
    const text = [
      res.value.hook.trim(),
      lines.join('\n'),
      res.value.call_to_action.trim(),
      search,
      sources,
      guide,
    ]
      .filter((part) => part !== '')
      .join('\n\n')
    return { ok: true, text, hashtags, replays: res.replay ? [step] : [] }
  } catch (err) {
    console.error('[ai] writeCaption', err instanceof Error ? err.message : err)
    return { ok: false, error: AI_ERRORS.failed }
  }
}
