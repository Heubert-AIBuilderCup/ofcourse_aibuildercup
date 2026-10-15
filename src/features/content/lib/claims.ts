// The claims in a structure, and the factual slots that cannot stand. Pure: the commands and the
// approve button read the same answer. Slides are numbered from 1, cover first, as the layout
// engine numbers them.

import type { Fact, Paragraph, Structure, Template } from '../model/types'
import { findSlideSpec } from '../templates'
import { missingNumbers, numbersIn } from '../text/numbers'
import { sentences } from '../text/sentences'

export type ClaimRef = { slide: number; slot: string; text: string }

/** Each sentence of every factual slot, in slide order (the template says which slots are factual). */
export function claimsIn(structure: Structure, template: Template): ClaimRef[] {
  const claims: ClaimRef[] = []
  structure.slides.forEach((slide, index) => {
    const spec = findSlideSpec(template, slide)
    for (const slotSpec of spec?.slots ?? []) {
      const slot = slide.slots[slotSpec.key]
      if (!slotSpec.factual || !slot) continue
      for (const text of sentences(slot.text)) {
        claims.push({ slide: index + 1, slot: slotSpec.key, text })
      }
    }
  })
  return claims
}

/**
 * The text with one sentence replaced, or taken out when the replacement is empty; the rest
 * exactly as it was. Null when the sentence is not there.
 */
export function replaceSentence(
  text: string,
  sentence: string,
  replacement: string,
): string | null {
  const at = text.indexOf(sentence)
  if (at < 0) return null
  const before = text.slice(0, at).trimEnd()
  const after = text.slice(at + sentence.length).trimStart()
  return [before, replacement.trim(), after].filter((part) => part !== '').join(' ')
}

/** A claim with what it must match: the source sentences of its slot's bound facts. */
export type EvidencedClaim = ClaimRef & { evidence: Paragraph[] }

/**
 * Each claim with the sentences of the supported facts its slot binds, one entry per paragraph
 * in the order the slot binds them: the source check reads these, not every paragraph (ADR-129).
 * A slot that binds none gives no evidence, and the check falls back to the paragraphs. A fact
 * from before criterion 95 holds the source's words in its quote.
 */
export function claimsWithEvidence(
  structure: Structure,
  template: Template,
  facts: Fact[],
): EvidencedClaim[] {
  const byId = new Map(facts.map((f) => [f.id, f]))
  return claimsIn(structure, template).map((claim) => {
    const ids = structure.slides[claim.slide - 1].slots[claim.slot].factIds
    return { ...claim, evidence: factEvidence(ids, byId) }
  })
}

/**
 * The source sentences of the supported facts named, one entry per paragraph in the order they
 * are named: what a sentence bound to them is read against. A fact from before criterion 95
 * holds the source's words in its quote.
 */
export function factEvidence(ids: readonly string[], byId: ReadonlyMap<string, Fact>): Paragraph[] {
  const byRef = new Map<string, string[]>()
  for (const id of ids) {
    const fact = byId.get(id)
    if (!fact?.supported) continue
    byRef.set(fact.ref, [...(byRef.get(fact.ref) ?? []), fact.quote ?? fact.text])
  }
  return [...byRef].map(([ref, texts]) => ({ ref, text: texts.join(' ') }))
}

export type Unbound = ClaimRef & { reason: 'No source' | 'Number not in its fact' }

/**
 * Factual slots that cannot stand: no fact bound; a bound fact missing or not supported; or a
 * number in the slot's text that none of its bound facts' text or quote contains. One entry per
 * sentence, so the editor sees which sentence to fix.
 */
export function unboundSlots(structure: Structure, template: Template, facts: Fact[]): Unbound[] {
  const byId = new Map(facts.map((f) => [f.id, f]))
  const unbound: Unbound[] = []
  for (const claim of claimsIn(structure, template)) {
    const slot = structure.slides[claim.slide - 1].slots[claim.slot]
    const bound = slot.factIds.map((id) => byId.get(id))
    const sound = bound.flatMap((f) => (f?.supported ? [f] : []))
    if (bound.length === 0 || sound.length !== bound.length) {
      unbound.push({ ...claim, reason: 'No source' })
      continue
    }
    // " | " keeps number words from running together across one fact and the next.
    const evidence = sound.flatMap((f) => (f.quote ? [f.text, f.quote] : [f.text])).join(' | ')
    if (missingNumbers(claim.text, evidence).length > 0) {
      unbound.push({ ...claim, reason: 'Number not in its fact' })
    }
  }
  return unbound
}

/** The supported facts the structure's slots bind, in the order the slides first cite them. */
export function boundFacts(structure: Structure, facts: Fact[]): Fact[] {
  const byId = new Map(facts.map((f) => [f.id, f]))
  const out = new Map<string, Fact>()
  for (const slide of structure.slides) {
    for (const slot of Object.values(slide.slots)) {
      for (const id of slot.factIds) {
        const fact = byId.get(id)
        if (fact?.supported && !out.has(id)) out.set(id, fact)
      }
    }
  }
  return [...out.values()]
}

/**
 * The numbers a model may write about an approved structure: every number in its own slots, and
 * the value and text numbers of each supported fact it binds. Never an unbound or unsupported
 * fact's, such as the twin's planted figure (criteria 59, 65).
 */
export function boundFactValues(structure: Structure, facts: Fact[]): number[] {
  const values = new Set<number>()
  for (const slide of structure.slides) {
    for (const slot of Object.values(slide.slots)) {
      for (const n of numbersIn(slot.text)) values.add(n.value)
    }
  }
  for (const fact of boundFacts(structure, facts)) {
    if (fact.value) values.add(fact.value.number)
    for (const n of numbersIn(fact.text)) values.add(n.value)
  }
  return [...values]
}
