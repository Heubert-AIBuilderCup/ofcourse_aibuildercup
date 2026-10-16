import 'server-only'
// G5, the optional rewording of a market version, for any market in the markets file (ADR-123,
// criterion 110). The model rewords only the presentational slots of the approved revision and
// writes a feed excerpt; it sees those slots' text, the numbers the revision states and binds, and
// the market, nothing else.
// Code checks every answer: a slot that is not presentational, a number that is neither in the
// revision's slots nor a supported fact it binds (lib/claims.ts), a reworded slot over its limit
// as the layout engine measures it, a banned phrase, and for a post not in English, wording not in
// its language's script or a digit outside 0–9 (GD37). The converted figure never comes from the
// model (lib/market.ts). Facts and bindings are never touched.

import type { z } from 'zod'
import type { Language, LanguageId } from '../languages'
import { slideSpec } from '../layout/engine'
import { layoutMarket, type Reworded } from '../layout/market'
import { boundFactValues } from '../lib/claims'
import { conversionsFor } from '../lib/market'
import type { Market } from '../markets'
import type { Body } from '../model/artifacts'
import type { Conversion, Fact } from '../model/types'
import { bannedPhrases } from '../text/lint'
import { numbersIn } from '../text/numbers'
import { charCount, scriptProblems } from '../text/script'
import { AI_ERRORS, ai } from './client'
import { inLanguage, MARKET, postLanguage } from './prompts'
import { withReplay } from './replays'

type MarketAnswer = z.infer<typeof MARKET.schema>

/**
 * The step a market's rewording runs and is recorded as (ai/replays.ts): Nepal keeps `market`, the
 * name its recordings already use; every other market has its own (`market-IN`), so a failed call
 * never replays another market's wording, and recording one market never overwrites another's.
 */
const stepOf = (market: Market) => (market.id === 'NP' ? 'market' : `market-${market.id}`)
/** Bounds the excerpt the feed card shows. */
const EXCERPT_MAX = 200
const SAME = 1e-9

/** The presentational slots of the revision, in slide order, as the model is shown them. */
function presentational(revision: Body<'revision'>) {
  const { structure, template } = revision
  return structure.slides.flatMap((slide, index) =>
    slideSpec(template, slide)
      .slots.filter((spec) => spec.presentational && slide.slots[spec.key])
      .map((spec) => ({
        slide: index + 1,
        slot: spec.key,
        label: spec.label,
        text: slide.slots[spec.key].text,
        limit: spec.limit,
      })),
  )
}

/** Every problem the model can fix in one answer, the post's language among them (GD37). */
function problemsIn(
  answer: MarketAnswer,
  revision: Body<'revision'>,
  facts: Fact[],
  conversions: Conversion[],
  allowed: Set<string>,
  values: number[],
  source: { title: string; site?: string; sites?: Record<string, string> },
  language: Language,
): string[] {
  const problems: string[] = []
  const known = (n: number) => values.some((v) => Math.abs(v - n) < SAME)
  const texts = [
    ...answer.slots.map((s, i) => ({ path: `slots.${i}`, text: s.text })),
    { path: 'feed_excerpt', text: answer.feed_excerpt },
  ]
  for (const { path, text } of texts) {
    for (const n of numbersIn(text)) {
      if (!known(n.value)) {
        problems.push(`${path}: "${text.slice(n.start, n.end)}" is not a number in the facts.`)
      }
    }
    for (const phrase of bannedPhrases(text)) problems.push(`${path}: remove "${phrase}".`)
  }
  // In the post's language and script, Western digits only (GD37).
  const written = texts.map(({ path, text }): [string, string] => [path, text])
  problems.push(...scriptProblems('slots and feed_excerpt', written, language))
  const excerpt = answer.feed_excerpt.trim()
  if (excerpt.length === 0 || charCount(excerpt) > EXCERPT_MAX) {
    problems.push(`feed_excerpt: write one sentence of at most ${EXCERPT_MAX} characters.`)
  }

  const overrides = new Set<string>()
  const accepted: Reworded[] = []
  answer.slots.forEach((s, i) => {
    const key = `${s.slide}:${s.slot}`
    if (!allowed.has(key)) {
      problems.push(`slots.${i}: slide ${s.slide} ${s.slot} is not a slot to rewrite.`)
    } else if (overrides.has(key)) {
      problems.push(`slots.${i}: slide ${s.slide} ${s.slot} appears more than once.`)
    } else {
      overrides.add(key)
      accepted.push(s)
    }
  })
  // Lengths and boxes as drawn: the same layout as rewordMarket, with the real source lines, so an
  // answer that would be refused for its box is never accepted, and so never cached. Conversions
  // count even with no reworded slot. Only the slots the model reworded are reported: another slot
  // that overflows (a figure grown by its conversion) is not the model's to fix, so the command
  // refuses it with its fit row.
  const { fitChecks: rows } = layoutMarket({
    revision,
    slots: accepted,
    conversions,
    facts,
    sourceTitle: source.title,
    sourceSite: source.site,
    sites: source.sites,
    language: language.id,
  })
  for (const row of rows) {
    if (row.pass || !overrides.has(`${row.slide}:${row.slot}`)) continue
    if (row.check === 'length') {
      problems.push(`slide ${row.slide} ${row.slot}: ${row.label}. Stay inside its limit.`)
    } else if (row.check === 'box') {
      problems.push(
        `Slide ${row.slide} · ${row.slot} needs ${row.value} lines, room for ${Number.parseInt(row.limit, 10)}: shorten it.`,
      )
    }
  }
  return problems
}

export async function marketRewording(input: {
  revision: Body<'revision'>
  facts: Fact[]
  market: Market
  demoKey: string | null
  postId: string
  /** The source's title and site, as the saved layout draws them in the source and search lines. */
  sourceTitle: string
  sourceSite?: string
  /** Each paragraph ref to its site, for a source read from several links (GD19). */
  sites?: Record<string, string>
  /** The post's language (GD37); English when absent. */
  language?: LanguageId
}): Promise<
  | { ok: true; slots: Reworded[]; feedExcerpt: string; replays: string[] }
  | { ok: false; error: string }
> {
  const { revision, facts, market, demoKey, postId, sourceTitle, sourceSite, sites } = input
  try {
    // A pair the rate file has no row for is refused before the model is asked (criterion 86).
    const converted = conversionsFor(revision.structure, facts, market)
    if (!converted.ok) return converted
    const slots = presentational(revision)
    const values = boundFactValues(revision.structure, facts)
    const allowed = new Set(slots.map((s) => `${s.slide}:${s.slot}`))
    // Written in the post's language (GD37).
    const language = postLanguage(input.language)
    const verify = (answer: MarketAnswer) =>
      problemsIn(
        answer,
        revision,
        facts,
        converted.conversions,
        allowed,
        values,
        { title: sourceTitle, site: sourceSite, sites },
        language,
      )
    const call = inLanguage(MARKET, { market, slots, fact_values: values }, language)
    const step = stepOf(market)

    const res = await withReplay(demoKey, step, MARKET.schema, () =>
      ai.generateJson(call.spec, { data: call.data, postId, verify }),
    )
    if (!res.ok) return { ok: false, error: res.error }
    // A recording is verified again, like any answer.
    if (res.replay && verify(res.value).length > 0) return { ok: false, error: AI_ERRORS.failed }
    return {
      ok: true,
      slots: res.value.slots.map(({ slide, slot, text }) => ({ slide, slot, text })),
      feedExcerpt: res.value.feed_excerpt.trim(),
      replays: res.replay ? [step] : [],
    }
  } catch (err) {
    console.error('[ai] marketRewording', err instanceof Error ? err.message : err)
    return { ok: false, error: AI_ERRORS.failed }
  }
}
