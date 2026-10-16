// The languages a post can be written in (GD36): four in one repo file, parsed at load as
// emotions/index.ts does. A source record keeps its post's language by id; English is the
// default. `script` is what the text is written in, `home` the country whose students the post
// is shown to (null: everyone). The lines code writes on a post (GD39) are in lines.json, one set
// per language. Client-safe: JSON and zod only.

import { z } from 'zod'
import languages from './languages.json'
import lines from './lines.json'

export const LANGUAGE_IDS = ['en', 'ne', 'hi', 'th'] as const
export type LanguageId = (typeof LANGUAGE_IDS)[number]

const LanguageSchema = z.object({
  id: z.enum(LANGUAGE_IDS),
  /** The language's name in English, as the admin screens and the prompts read it. */
  label: z.string().min(1),
  /** Its name in its own script, as the language choice shows it. */
  nativeLabel: z.string().min(1),
  script: z.enum(['latin', 'devanagari', 'thai']),
  home: z.enum(['NP', 'IN', 'TH']).nullable(),
})

export type Language = z.infer<typeof LanguageSchema>

/** The language file's shape: each id once, in LANGUAGE_IDS order; throws on anything else. */
export function parseLanguages(raw: unknown): Language[] {
  return z
    .array(LanguageSchema)
    .refine((all) => all.map((l) => l.id).join() === LANGUAGE_IDS.join(), {
      message: 'the language file lists each language id once, in order',
    })
    .parse(raw)
}

export const LANGUAGES: readonly Language[] = parseLanguages(languages)

export function languageById(id: string): Language | null {
  return LANGUAGES.find((l) => l.id === id) ?? null
}

/** The language a card and a page are labelled with (GD40), with its own name; null for English, which has none. */
export function labelledLanguage(id: LanguageId | null | undefined): Language | null {
  return id && id !== 'en' ? languageById(id) : null
}

/** Where the post's title goes in the search line; "OfCourse" stays before it in every language. */
export const SEARCH_PHRASE = '“OfCourse {title}”'

const FixedLinesSchema = z.object({
  /** The last slide's search line (ADR-131), with SEARCH_PHRASE where the title goes. */
  search: z.string().refine((s) => s.split(SEARCH_PHRASE).length === 2, {
    message: `the search line carries ${SEARCH_PHRASE} once`,
  }),
  /** The link to a post's live blog, and the caption's last line before its address (BR7). */
  guide: z.string().min(1),
  /** The sources line on the last slide and the sources slide's heading (GD31). */
  sources: z.string().min(1),
  /** The swipe cue in a look's frame (GD6). */
  swipe: z.string().min(1),
  /** The caption's sources line, before the names (GD31). */
  captionSources: z.string().min(1),
})

/** The lines code writes on a post in one language (GD39). */
export type FixedLines = z.infer<typeof FixedLinesSchema>

/** The lines file's shape: every language's lines, the search line keeping its phrase; throws on anything else. */
export function parseLines(raw: unknown): Record<LanguageId, FixedLines> {
  return z
    .object({
      en: FixedLinesSchema,
      ne: FixedLinesSchema,
      hi: FixedLinesSchema,
      th: FixedLinesSchema,
    })
    .parse(raw)
}

const LINES = parseLines(lines)

/** The lines code writes on a post in this language; English when none is given. */
export function linesOf(id: LanguageId | null | undefined): FixedLines {
  return LINES[id ?? 'en']
}
