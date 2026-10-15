import 'server-only'

// The source check, code first. A sentence the source holds word for word is found with no call.
// Any other sentence is read against what it rests on: the source sentences of the facts its slot
// binds, or, in a slot that binds none, every paragraph (ADR-129). A figure none of those holds
// is not found, final; the judge sees the rest, and its "supported" counts only when what it
// cites also holds the sentence's numbers. A sentence not found carries the source sentence it
// should match (criterion 104), and a sentence read before on the same basis is not read again.

import { type ClaimRef, claimsWithEvidence } from '../lib/claims'
import { mapLimited } from '../lib/map-limited'
import type { Body } from '../model/artifacts'
import type { ClaimResult, Fact, Paragraph, Structure, Template } from '../model/types'
import { canonicalJson, sha256Hex } from '../server/hash'
import { bestParagraph, numberVerdict } from '../text/locate'
import { sourceSentences } from '../text/sentences'
import { findQuote, normalise } from '../text/verbatim'
import { ai } from './client'
import { postLanguage, SOURCE_CHECK, sourceCheckFor } from './prompts'
import { withReplay } from './replays'

/** Judge calls in flight at once. */
const JUDGE_CONCURRENCY = 4

/** A claim to check; its evidence, when it has any, is what it is read against instead of the paragraphs. */
export type CheckClaim = ClaimRef & { evidence?: Paragraph[] }

type Checked = { ok: true; claims: ClaimResult[]; replays: string[] } | { ok: false; error: string }

/** A recording answers only the identical claim: the step is named by a hash of its text, not its place. */
function replayStep(claimText: string): string {
  return `source_check:${sha256Hex(normalise(claimText)).slice(0, 16)}`
}

/** The paragraph that holds the claim word for word, if any. */
function verbatimIn(claim: string, paragraphs: Paragraph[]): Paragraph | null {
  return paragraphs.find((p) => findQuote(claim, p.text) !== null) ?? null
}

/**
 * The source sentence a flagged claim should match: the closest sentence of its bound facts,
 * else the paragraph sentence sharing most of its words (text/locate.ts); none when no paragraph
 * shares a word with it.
 */
function suggestionFor(claim: string, against: Paragraph[], bound: boolean) {
  const candidates = against.flatMap((p) =>
    sourceSentences(p).map((s) => ({ ref: p.ref, text: s.text })),
  )
  if (candidates.length === 0) return undefined
  const best = bestParagraph(claim, candidates)
  return bound || best.overlap > 0 ? best.paragraph : undefined
}

/** What a claim is read against, and the result built on it. */
type Reading = { claim: CheckClaim; against: Paragraph[]; bound: boolean; basis: string }

function resultOf(r: Reading, result: ClaimResult['result'], ref: string | null): ClaimResult {
  const suggestion =
    result === 'not_found' ? suggestionFor(r.claim.text, r.against, r.bound) : undefined
  return {
    text: r.claim.text,
    slide: r.claim.slide,
    slot: r.claim.slot,
    result,
    ref,
    basis: r.basis,
    ...(suggestion ? { suggestion } : {}),
  }
}

export async function runSourceCheck(input: {
  structure: Structure
  template: Template
  facts: Fact[]
  source: Body<'source'>
  previous: Body<'source_check'> | null
  postId: string
}): Promise<Checked> {
  const { structure, template, facts, source, previous, postId } = input
  return checkClaims({
    claims: claimsWithEvidence(structure, template, facts),
    source,
    previous,
    postId,
  })
}

/**
 * The same check on any list of claims (a social caption's sentences, say): verbatim first, then
 * the number rule, then the judge on what is left. From the previous check, an "opinion" mark on
 * the same text stays, and a result for the same text on the same basis is kept unasked.
 */
export async function checkClaims(input: {
  claims: CheckClaim[]
  source: Body<'source'>
  previous: Body<'source_check'> | null
  postId: string
}): Promise<Checked> {
  const { claims, source, previous, postId } = input
  const { paragraphs, demoKey } = source
  const earlier = previous?.claims ?? []
  const opinions = new Map(earlier.filter((c) => c.result === 'opinion').map((c) => [c.text, c]))
  const known = new Map(
    earlier.flatMap((c) =>
      c.basis && c.result !== 'opinion' ? [[`${c.basis} ${c.text}`, c]] : [],
    ),
  )
  const replayed = new Set(previous?.replays ?? [])
  const sourceHash = sha256Hex(canonicalJson(paragraphs))
  const replays: string[] = []

  const results = new Array<ClaimResult>(claims.length)
  const toJudge: { index: number; reading: Reading }[] = []

  claims.forEach((claim, index) => {
    const evidence = claim.evidence ?? []
    const bound = evidence.length > 0
    // What the result rests on: the source, and the evidence the claim was read against.
    const basis = sha256Hex(`${sourceHash} ${canonicalJson(evidence)}`).slice(0, 16)
    const reading: Reading = { claim, against: bound ? evidence : paragraphs, bound, basis }
    const result = (result: ClaimResult['result'], ref: string | null) =>
      resultOf(reading, result, ref)
    const { against } = reading
    // An editor's earlier "opinion" mark on this exact text stays.
    const opinion = opinions.get(claim.text)
    if (opinion) {
      results[index] = result('opinion', opinion.ref)
      return
    }
    // Read before on the same basis: the same answer, with no call (criterion 98).
    const before = known.get(`${basis} ${claim.text}`)
    if (before) {
      results[index] = { ...before, slide: claim.slide, slot: claim.slot }
      if (replayed.has(replayStep(claim.text))) replays.push(replayStep(claim.text))
      return
    }
    const verbatim = verbatimIn(claim.text, paragraphs)
    if (verbatim) {
      results[index] = result('found', verbatim.ref)
      return
    }
    // Final: a figure nothing it rests on holds is never the judge's to pass.
    if (against.length === 0 || !against.some((p) => numberVerdict(claim.text, p).ok)) {
      results[index] = result('not_found', null)
      return
    }
    toJudge.push({ index, reading })
  })

  // A post not in English is judged against its English source by meaning (GD37).
  const judge = sourceCheckFor(postLanguage(source.language))
  const verdicts = await mapLimited(toJudge, JUDGE_CONCURRENCY, ({ reading: { claim, against } }) =>
    withReplay(demoKey, replayStep(claim.text), SOURCE_CHECK.schema, () =>
      ai.generateJson(judge, { data: { claim: claim.text, paragraphs: against }, postId }),
    ),
  )
  for (const [i, verdict] of verdicts.entries()) {
    if (!verdict.ok) return { ok: false, error: verdict.error }
    const { index, reading } = toJudge[i]
    const text = reading.claim.text
    if (verdict.replay) {
      replays.push(replayStep(text))
    }
    const cited = reading.against.find((p) => p.ref === verdict.value.ref)
    const holds = verdict.value.supported && cited !== undefined && numberVerdict(text, cited).ok
    results[index] = holds
      ? resultOf(reading, 'found', cited.ref)
      : resultOf(reading, 'not_found', null)
  }

  return { ok: true, claims: results, replays }
}
