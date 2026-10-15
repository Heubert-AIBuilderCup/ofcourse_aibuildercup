import 'server-only'
// A blog's outline before any text (BR2): one Flash call over the supported facts, the picked
// angle, the editor's framing line and the brand's voice. Code checks 3 to 8 sections, each
// heading a question, 3 to 5 takeaways, 3 to 5 FAQ questions, every line written and within its
// length, and no number a supported fact does not hold. Still failing is a failed step.
//
// Its text (BR3): one Flash call writes a body per section and an answer per question, each
// naming the facts it states, and the takeaways. Code checks 600 to 1,200 words of body, every
// body and answer bound to facts DATA gave, their numbers in those facts and the takeaways' in
// the facts (GD21), and no banned phrase; the ladder carries the problems back.

import type { z } from 'zod'
import type { Guideline } from '../brands/guideline'
import type { Language, LanguageId } from '../languages'
import { BLOG_POINT_MAX, type BlogSection, HEADING_MAX, isQuestion } from '../lib/blog-outline'
import type { BlogText } from '../lib/blog-text'
import type { Body } from '../model/artifacts'
import type { Fact, IdeaCard } from '../model/types'
import { bannedPhrases } from '../text/lint'
import { missingNumbers } from '../text/numbers'
import { charCount, scriptProblems } from '../text/script'
import { sentences } from '../text/sentences'
import { ai } from './client'
import { BLOG_OUTLINE, BLOG_TEXT, guidelineText, inLanguage, postLanguage } from './prompts'

type BlogOutlineAnswer = z.infer<typeof BLOG_OUTLINE.schema>

/** What the model may return; the editor may then shape the sections down to one (lib/blog-outline.ts). */
const COUNTS = {
  sections: { min: 3, max: 8 },
  takeaways: { min: 3, max: 5 },
  faq: { min: 3, max: 5 },
} as const

const outside = (n: number, range: { min: number; max: number }) => n < range.min || n > range.max

/**
 * Every problem the model can fix in one answer: a count outside its range, a heading or FAQ
 * question that is not a question, an empty or long line, a number no supported fact holds, and
 * text not in the post's language and script or with a digit outside 0–9 (GD37).
 */
export function blogOutlineProblems(
  answer: BlogOutlineAnswer,
  context: {
    facts: Fact[]
    /** The post's language (GD37); English when absent. */
    language?: Language
  },
): string[] {
  const problems: string[] = []
  const { sections, takeaways, faq } = answer
  if (outside(sections.length, COUNTS.sections)) {
    problems.push(
      `sections: return between ${COUNTS.sections.min} and ${COUNTS.sections.max} sections.`,
    )
  }
  if (outside(takeaways.length, COUNTS.takeaways)) {
    problems.push(
      `takeaways: return between ${COUNTS.takeaways.min} and ${COUNTS.takeaways.max} takeaways.`,
    )
  }
  if (outside(faq.length, COUNTS.faq)) {
    problems.push(`faq: return between ${COUNTS.faq.min} and ${COUNTS.faq.max} questions.`)
  }
  const factText = context.facts
    .filter((f) => f.supported)
    .map((f) => f.text)
    .join('\n')

  /** A line's problems: empty, over `max` characters, not a question when it must be, a number no fact holds. */
  function line(at: string, text: string, max: number, question = false) {
    const trimmed = text.trim()
    const length = charCount(trimmed)
    if (length === 0) {
      problems.push(`${at}: write it.`)
      return
    }
    if (question && !isQuestion(trimmed)) {
      problems.push(`${at}: write it as a question ending with "?".`)
    }
    if (length > max) problems.push(`${at}: ${length} characters; at most ${max}.`)
    for (const n of missingNumbers(trimmed, factText)) {
      problems.push(`${at}: "${trimmed.slice(n.start, n.end)}" is a number no fact holds.`)
    }
  }

  sections.forEach((s, i) => {
    line(`sections.${i}.heading`, s.heading, HEADING_MAX, true)
    line(`sections.${i}.point`, s.point, BLOG_POINT_MAX)
  })
  takeaways.forEach((t, i) => {
    line(`takeaways.${i}`, t, BLOG_POINT_MAX)
  })
  faq.forEach((f, i) => {
    line(`faq.${i}.q`, f.q, HEADING_MAX, true)
    line(`faq.${i}.point`, f.point, BLOG_POINT_MAX)
  })
  // In the post's language and script, Western digits only (GD37): each section and question with
  // its point, and the takeaways together.
  const language = context.language ?? postLanguage(null)
  sections.forEach((s, i) => {
    const parts: [string, string][] = [
      [`sections.${i}.heading`, s.heading],
      [`sections.${i}.point`, s.point],
    ]
    problems.push(...scriptProblems(`sections.${i}`, parts, language))
  })
  const lines = takeaways.map((t, i): [string, string] => [`takeaways.${i}`, t])
  problems.push(...scriptProblems('takeaways', lines, language))
  faq.forEach((f, i) => {
    const parts: [string, string][] = [
      [`faq.${i}.q`, f.q],
      [`faq.${i}.point`, f.point],
    ]
    problems.push(...scriptProblems(`faq.${i}`, parts, language))
  })
  return problems
}

export type OutlinedBlog = {
  sections: BlogSection[]
  takeaways: string[]
  faq: { q: string; point: string }[]
}

/**
 * The outline for a blog: the model sees the supported facts, the angle picked (or none), the
 * framing line and the brand's voice, never the notes (GD21). `attempt` keeps each outline its
 * own call.
 */
export async function outlineBlog(input: {
  idea: IdeaCard | null
  /** The editor's framing line (GD20), or none. */
  framing: string | null
  facts: Fact[]
  postId: string
  attempt: number
  /** The guideline whose voice the call carries; the brand guideline when absent. */
  guideline?: Guideline
  /** The post's language (GD37); English when absent. */
  language?: LanguageId
}): Promise<({ ok: true } & OutlinedBlog) | { ok: false; error: string }> {
  const supported = input.facts.filter((f) => f.supported)
  const { idea } = input
  const data = {
    angle: idea ? { angle: idea.angle, hook: idea.hook, audience: idea.audience } : null,
    editor_intent: input.framing,
    brand_voice: guidelineText('copy', input.guideline),
    facts: supported.map(({ id, text }) => ({ id, text })),
  }
  // Written in the post's language (GD37).
  const language = postLanguage(input.language)
  const call = inLanguage(BLOG_OUTLINE, data, language)
  const verify = (answer: BlogOutlineAnswer) =>
    blogOutlineProblems(answer, { facts: supported, language })
  const res = await ai.generateJson(call.spec, {
    data: call.data,
    postId: input.postId,
    attemptKey: input.attempt,
    verify,
  })
  if (!res.ok) return { ok: false, error: res.error }
  const { sections, takeaways, faq } = res.value
  return {
    ok: true,
    sections: sections.map((s) => ({ heading: s.heading.trim(), point: s.point.trim() })),
    takeaways: takeaways.map((t) => t.trim()),
    faq: faq.map((f) => ({ q: f.q.trim(), point: f.point.trim() })),
  }
}

// ── The text (BR3) ───────────────────────────────────────────────────────────────────────────

type BlogTextAnswer = z.infer<typeof BLOG_TEXT.schema>

/** How many words of section body a blog runs to, in all. */
export const BLOG_WORDS = { min: 600, max: 1200 } as const

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

/**
 * Every problem the model can fix in one answer: a count that is not the outline's, bodies
 * outside 600 to 1,200 words in all, a body bound to no fact, a fact id DATA did not give, an
 * answer bound to none (an empty answer is the facts not answering), a sentence stating a number
 * its bound facts lack, a takeaway's number no fact holds, a banned phrase, and text not in the
 * post's language and script or with a digit outside 0–9 (GD37).
 */
export function blogTextProblems(
  answer: BlogTextAnswer,
  context: {
    outline: Pick<Body<'blog_outline'>, 'sections' | 'takeaways' | 'faq'>
    facts: Fact[]
    /** The post's language (GD37); English when absent. */
    language?: Language
  },
): string[] {
  const problems: string[] = []
  const { outline } = context
  const supported = context.facts.filter((f) => f.supported)
  const byId = new Map(supported.map((f) => [f.id, f]))
  // " | " keeps number words from running together across one fact and the next.
  const evidenceOf = (facts: Fact[]) =>
    facts.flatMap((f) => (f.quote ? [f.text, f.quote] : [f.text])).join(' | ')
  const allFacts = evidenceOf(supported)

  const want = (n: number, of: string, write: string) =>
    `${of}: DATA.outline has ${n} ${of === 'faq' ? 'questions' : of}; write exactly ${write}, one for each, in its order.`
  if (answer.sections.length !== outline.sections.length) {
    const n = outline.sections.length
    problems.push(want(n, 'sections', `${n} bodies`))
  }
  if (answer.takeaways.length !== outline.takeaways.length) {
    problems.push(want(outline.takeaways.length, 'takeaways', `${outline.takeaways.length}`))
  }
  if (answer.faq.length !== outline.faq.length) {
    problems.push(want(outline.faq.length, 'faq', `${outline.faq.length} answers`))
  }

  const words = answer.sections.reduce((n, s) => n + wordCount(s.body), 0)
  if (words < BLOG_WORDS.min || words > BLOG_WORDS.max) {
    problems.push(
      `sections: the bodies run to ${words} words; write between ${BLOG_WORDS.min} and ${BLOG_WORDS.max.toLocaleString('en-GB')} in all.`,
    )
  }

  /** A bound text's problems: its fact ids, banned phrases, and each sentence's numbers its facts lack. */
  function bound(at: string, text: string, factIds: string[], none: string) {
    if (factIds.length === 0) problems.push(`${at}.fact_ids: ${none}`)
    for (const id of factIds) {
      if (!byId.has(id)) problems.push(`${at}.fact_ids: ${id} is not a fact in DATA.`)
    }
    const field = at.startsWith('faq') ? 'a' : 'body'
    for (const phrase of bannedPhrases(text)) problems.push(`${at}.${field}: remove "${phrase}".`)
    // Text bound to nothing has that one problem; its numbers are read once it binds facts.
    if (factIds.length === 0) return
    const evidence = evidenceOf(factIds.flatMap((id) => byId.get(id) ?? []))
    for (const sentence of sentences(text)) {
      if (missingNumbers(sentence, evidence).length > 0) {
        problems.push(
          `${at}.${field}: "${sentence}" states a number its fact_ids do not. Use only their numbers.`,
        )
      }
    }
  }

  answer.sections.forEach((s, i) => {
    if (s.body.trim() === '') problems.push(`sections.${i}.body: write it.`)
    bound(`sections.${i}`, s.body, s.fact_ids, 'bind the facts this section states.')
  })
  answer.takeaways.forEach((t, i) => {
    const line = t.trim()
    const length = charCount(line)
    if (length === 0) problems.push(`takeaways.${i}: write it.`)
    if (length > BLOG_POINT_MAX) {
      problems.push(`takeaways.${i}: ${length} characters; at most ${BLOG_POINT_MAX}.`)
    }
    for (const phrase of bannedPhrases(line)) problems.push(`takeaways.${i}: remove "${phrase}".`)
    for (const n of missingNumbers(line, allFacts)) {
      problems.push(`takeaways.${i}: "${line.slice(n.start, n.end)}" is a number no fact holds.`)
    }
  })
  answer.faq.forEach((f, i) => {
    // An empty answer is the facts not answering the question: the editor rewords or removes it.
    if (f.a.trim() === '') return
    bound(
      `faq.${i}`,
      f.a,
      f.fact_ids,
      'bind the facts this answer states, or leave a empty when no fact answers the question.',
    )
  })
  // In the post's language and script, Western digits only (GD37): each body and answer, and the
  // takeaways together.
  const language = context.language ?? postLanguage(null)
  answer.sections.forEach((s, i) => {
    problems.push(
      ...scriptProblems(`sections.${i}.body`, [[`sections.${i}.body`, s.body]], language),
    )
  })
  const lines = answer.takeaways.map((t, i): [string, string] => [`takeaways.${i}`, t])
  problems.push(...scriptProblems('takeaways', lines, language))
  answer.faq.forEach((f, i) => {
    if (f.a.trim() !== '')
      problems.push(...scriptProblems(`faq.${i}.a`, [[`faq.${i}.a`, f.a]], language))
  })
  return problems
}

/**
 * A blog's text from its outline: the model sees the outline, the angle, the framing line, the
 * editor's notes as opinion, the brand's voice and the supported facts, never the source's
 * paragraphs. The outline's headings and questions are kept as they are; a question the facts do
 * not answer comes back with an empty answer and no facts. `attempt` keeps each writing its own
 * call.
 */
export async function writeBlogText(input: {
  outline: Body<'blog_outline'>
  /** The editor's framing line (GD20), or none. */
  framing: string | null
  /** The editor's notes (GD21): opinion, never a fact or a number. */
  notes: string | null
  facts: Fact[]
  postId: string
  attempt: number
  /** The guideline whose voice the call carries; the brand guideline when absent. */
  guideline?: Guideline
  /** The post's language (GD37); English when absent. */
  language?: LanguageId
}): Promise<{ ok: true; text: BlogText } | { ok: false; error: string }> {
  const { outline } = input
  const supported = input.facts.filter((f) => f.supported)
  const { idea } = outline
  const data = {
    outline: { sections: outline.sections, takeaways: outline.takeaways, faq: outline.faq },
    angle: idea ? { angle: idea.angle, hook: idea.hook, audience: idea.audience } : null,
    editor_intent: input.framing,
    // Only when given, and never among the facts.
    ...(input.notes ? { editor_notes: input.notes } : {}),
    brand_voice: guidelineText('copy', input.guideline),
    words: BLOG_WORDS,
    facts: supported.map(({ id, text }) => ({ id, text })),
  }
  // Written in the post's language (GD37).
  const language = postLanguage(input.language)
  const call = inLanguage(BLOG_TEXT, data, language)
  const verify = (answer: BlogTextAnswer) =>
    blogTextProblems(answer, { outline, facts: supported, language })
  const res = await ai.generateJson(call.spec, {
    data: call.data,
    postId: input.postId,
    attemptKey: input.attempt,
    verify,
  })
  if (!res.ok) return { ok: false, error: res.error }
  const unique = (ids: string[]) => [...new Set(ids)]
  const { sections, takeaways, faq } = res.value
  return {
    ok: true,
    text: {
      sections: sections.map((s, i) => ({
        heading: outline.sections[i].heading,
        body: s.body.trim(),
        factIds: unique(s.fact_ids),
      })),
      takeaways: takeaways.map((t) => t.trim()),
      faq: faq.map((f, i) => {
        const a = f.a.trim()
        return { q: outline.faq[i].q, a, factIds: a === '' ? [] : unique(f.fact_ids) }
      }),
    },
  }
}
