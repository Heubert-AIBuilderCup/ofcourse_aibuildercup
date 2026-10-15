import 'server-only'
// G2, source to facts (criteria 95, 96). Code numbers each paragraph's sentences (¶2.3) and the
// model names the ones that state a fact; code copies each named sentence word for word, so a
// fact's wording and numbers are its source's and no model judges a paraphrase. Each sentence of
// the title that makes a claim (a verb or a number, text/statement.ts; a label such as "Test Feed"
// makes none) is checked against the paragraphs with the source check: one no paragraph supports
// is a headline claim not in the article, never bindable.

import type { z } from 'zod'
import type { Body } from '../model/artifacts'
import type { Fact, Paragraph } from '../model/types'
import { bestParagraph, numberVerdict } from '../text/locate'
import { numbersIn } from '../text/numbers'
import { type SourceSentence, sentences, sourceSentences } from '../text/sentences'
import { statesClaim } from '../text/statement'
import { AI_ERRORS, ai } from './client'
import { EXTRACT } from './prompts'
import { demoKeyFor, withReplay } from './replays'
import { checkClaims } from './source-check'

const NO_PARAGRAPHS = 'The source has no paragraphs.'

/** Blank-line separated, trimmed, empty dropped, numbered ¶1 … ¶n. */
export function splitParagraphs(text: string): Paragraph[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[^\S\n]*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p, i) => ({ ref: `¶${i + 1}`, text: p }))
}

export type Extracted =
  | { ok: true; source: Body<'source'>; facts: Fact[]; keyIdeas: string[]; replays: string[] }
  | { ok: false; error: string }

type Answer = z.infer<typeof EXTRACT.schema>

function firstValue(text: string): Fact['value'] {
  const first = numbersIn(text)[0]
  return first ? { number: first.value, unit: first.unit ?? 'number' } : null
}

/** A source sentence as a fact: its exact text, which is its own quote. */
export function sentenceFact(sentence: SourceSentence, id: string): Fact {
  return {
    id,
    text: sentence.text,
    value: firstValue(sentence.text),
    ref: sentence.ref,
    quote: sentence.text,
    supported: true,
    why: null,
    span: null,
    sentenceId: sentence.id,
  }
}

/** Every sentence of the source, by its id. */
export function sentencesById(paragraphs: Paragraph[]): Map<string, SourceSentence> {
  return new Map(paragraphs.flatMap((p) => sourceSentences(p)).map((s) => [s.id, s]))
}

/** One line per named id that is not a sentence in DATA, for the retry ladder. */
function problemsIn(answer: Answer, byId: Map<string, SourceSentence>): string[] {
  return answer.facts.flatMap((id, i) =>
    byId.has(id) ? [] : [`facts.${i}: ${id} is not a sentence id in DATA.`],
  )
}

/**
 * The title's claims no paragraph supports, by the source check, each as an unsupported headline
 * fact. A title sentence with no verb and no number is a label, not a claim: never checked, and
 * with none to check no call is made. Where its numbers fail, the why and span point at the
 * paragraph's figure.
 */
async function headlineClaims(
  source: Body<'source'>,
  postId: string,
): Promise<
  { ok: true; facts: Omit<Fact, 'id'>[]; replays: string[] } | { ok: false; error: string }
> {
  const claims = sentences(source.title)
    .filter(statesClaim)
    .map((text) => ({ slide: 0, slot: 'title', text }))
  if (claims.length === 0) return { ok: true, facts: [], replays: [] }
  const checked = await checkClaims({ claims, source, previous: null, postId })
  if (!checked.ok) return checked
  const facts = checked.claims
    .filter((c) => c.result !== 'found')
    .map(({ text }) => {
      const paragraph = bestParagraph(text, source.paragraphs).paragraph
      const numbers = numberVerdict(text, paragraph)
      return {
        text,
        value: firstValue(text),
        ref: paragraph.ref,
        quote: null,
        supported: false,
        why: numbers.ok ? null : numbers.why,
        span: numbers.ok ? null : numbers.span,
        headline: true,
      }
    })
  return { ok: true, facts, replays: checked.replays }
}

export async function extractFacts(input: {
  title: string
  kind: string
  text: string
  postId: string
  /** The editor's framing line (GD20): it steers the key ideas only, never the facts. */
  framing?: string | null
}): Promise<Extracted> {
  const { title, kind, text, postId } = input
  const paragraphs = splitParagraphs(text)
  if (paragraphs.length === 0) return { ok: false, error: NO_PARAGRAPHS }
  const numbered = paragraphs.map((p) => sourceSentences(p))
  const byId = new Map(numbered.flat().map((s) => [s.id, s]))
  const demoKey = demoKeyFor(title, text)
  // The post's language is the caller's to set (../server/commands/source.ts); the text is as given.
  const source: Body<'source'> = { title, kind, text, paragraphs, demoKey, language: 'en' }
  const replays: string[] = []

  const data = {
    title,
    kind,
    editor_intent: input.framing ?? null,
    paragraphs: paragraphs.map((p, i) => ({
      ref: p.ref,
      sentences: numbered[i].map(({ id, text }) => ({ id, text })),
    })),
  }
  const verify = (answer: Answer) => problemsIn(answer, byId)
  const extracted = await withReplay(demoKey, 'extract', EXTRACT.schema, () =>
    ai.generateJson(EXTRACT, { data, postId, verify }),
  )
  if (!extracted.ok) return { ok: false, error: extracted.error }
  // A recording is verified again, like any answer.
  if (extracted.replay) {
    if (verify(extracted.value).length > 0) return { ok: false, error: AI_ERRORS.failed }
    replays.push('extract')
  }

  const named = [...new Set(extracted.value.facts)].flatMap((id) => byId.get(id) ?? [])
  const headlines = await headlineClaims(source, postId)
  if (!headlines.ok) return { ok: false, error: headlines.error }
  replays.push(...headlines.replays)

  const facts: Fact[] = [
    ...named.map((sentence, i) => sentenceFact(sentence, `f${i + 1}`)),
    ...headlines.facts.map((fact, i) => ({ ...fact, id: `f${named.length + i + 1}` })),
  ]
  return { ok: true, source, facts, keyIdeas: extracted.value.key_ideas, replays }
}
