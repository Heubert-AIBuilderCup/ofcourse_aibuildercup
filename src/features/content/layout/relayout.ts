// A look slide laid out again in another layout (GD5), and which layouts its content can fill.
// Pure and code only: no model is called. Every look has the same slot keys per layout
// (templates.test.ts), so text moves by slot key and the first look's specs speak for all.

import {
  type Fact,
  LAYOUT_IDS,
  type LayoutId,
  type Slide,
  type SlideSpec,
  type Slot,
  type SlotSpec,
} from '../model/types'
import { LOOKS } from '../templates'
import { numbersIn } from '../text/numbers'
import { sentences } from '../text/sentences'

/** Each layout's name, as the picker and the history show it. */
export const LAYOUT_LABELS: Record<LayoutId, string> = {
  cover: 'Cover',
  picture: 'Picture and text',
  number: 'Big number',
  bars: 'Comparison bars',
  quote: 'Quote',
  checklist: 'Checklist',
  bullets: 'Bullet points',
  takeaway: 'Takeaway',
}

export const LAYOUT_REASONS = {
  /** Big number and bars both wait for a number: one line for the two under the picker (C2). */
  numbers: 'Big number and Comparison bars need a number from a fact on this slide; bars need two.',
  bars: 'Bars need two numbers from facts on this slide.',
  checklist: 'A checklist needs two or more points.',
  bullets: 'Bullet points need three to five points.',
  quote: 'A quote needs a sentence from the source.',
  cover: 'A cover goes on the first slide.',
  takeaway: 'A takeaway goes on the last slide.',
} as const

export type LayoutOption = { id: LayoutId; ok: true } | { id: LayoutId; ok: false; reason: string }

/** Where the slide sits in its post. */
export type Place = { first: boolean; last: boolean }

/** A look slide drafted without a layout is laid out in its kind's drafting spec. */
const BY_KIND: Record<Slide['kind'], LayoutId> = {
  cover: 'cover',
  body: 'picture',
  take: 'takeaway',
  single: 'picture',
}

/** The layout a look slide is laid out in now. */
export function layoutIn(slide: Slide): LayoutId {
  return slide.layout ?? BY_KIND[slide.kind]
}

function specOf(layout: LayoutId): SlideSpec {
  const spec = LOOKS[0]?.layouts?.[layout]
  if (!spec) throw new Error(`No look has the ${layout} layout`)
  return spec
}

/** The supported facts bound to any slot of the slide, in slot order, each once. */
function boundFacts(slide: Slide, facts: Fact[]): Fact[] {
  const ids = [...new Set(Object.values(slide.slots).flatMap((s) => s.factIds))]
  return ids.flatMap((id) => facts.find((f) => f.id === id && f.supported) ?? [])
}

const withFigure = (facts: Fact[]) => facts.filter((f) => f.value !== null)

/** Where the fact's sentence writes its figure, or undefined when it writes no number. */
function figureAt(fact: Fact) {
  const found = numbersIn(fact.text)
  return found.find((n) => n.value === fact.value?.number) ?? found[0]
}

/** The fact's figure as its sentence writes it, a percentage with "%" ("11%"), else its value. */
function figure(fact: Fact): string {
  const at = figureAt(fact)
  if (!at) return String(fact.value?.number ?? '')
  return `${fact.text.slice(at.start, at.end)}${at.unit === 'percent' ? '%' : ''}`
}

const wordsOf = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))

/** As many whole words as fit in `max` characters, from the start, or from the end when `fromEnd`. */
function fitWords(words: string[], max: number, fromEnd = false): string {
  const kept: string[] = []
  for (const word of fromEnd ? [...words].reverse() : words) {
    if ([...kept, word].join(' ').length > max) break
    if (fromEnd) kept.unshift(word)
    else kept.push(word)
  }
  return kept.join(' ')
}

/**
 * A short label for the fact's figure (GD5), by code: the words after the figure in its sentence,
 * or before it when the figure ends the sentence, cut at a word to the slot's limit, without the
 * closing stop. The figure itself stands in its own slot beside it.
 */
function label(fact: Fact, max: number): string {
  const at = figureAt(fact)
  const strip = (text: string) => text.replace(/[.,;:!?]+$/, '')
  if (!at) return strip(fitWords(wordsOf(fact.text), max))
  const after = wordsOf(fact.text.slice(at.end).replace(/^\s*(%|percent\b)/i, ''))
  const text =
    after.length > 0
      ? fitWords(after, max)
      : fitWords(wordsOf(fact.text.slice(0, at.start)), max, true)
  return strip(text)
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** The slide's points: a checklist's or a bullets slide's lines, else the body's sentences. */
function points(slide: Slide): string[] {
  const { items, points: listed, body } = slide.slots
  const list = items ?? listed
  if (list) return lines(list.text)
  return body ? sentences(body.text) : []
}

/** A point as a sentence of a body: closed with a stop when it has none (GD34). */
const closed = (point: string) => (/[.!?…]["'”’)]*$/.test(point) ? point : `${point}.`)

/** How many points a bullets slide takes (GD34), from its layout's points slot. */
function pointsRange(): { min: number; max: number } {
  const limit = specOf('bullets').slots.find((s) => s.limit.unit === 'points')?.limit
  if (!limit) throw new Error('The bullets layout has no points slot')
  return limit
}

/**
 * Every layout, with whether the slide's content can fill it and why not. Cover and takeaway go
 * only at the first and last place; `place` defaults to what the slide's kind says.
 */
export function layoutOptions(
  slide: Slide,
  facts: Fact[],
  place: Place = { first: slide.kind === 'cover', last: slide.kind === 'take' },
): LayoutOption[] {
  const bound = boundFacts(slide, facts)
  const figures = withFigure(bound).length
  const count = points(slide).length
  const range = pointsRange()
  const why: Record<LayoutId, string | null> = {
    cover: place.first ? null : LAYOUT_REASONS.cover,
    picture: null,
    number: figures >= 1 ? null : LAYOUT_REASONS.numbers,
    bars: figures >= 2 ? null : figures === 1 ? LAYOUT_REASONS.bars : LAYOUT_REASONS.numbers,
    quote: bound.length >= 1 ? null : LAYOUT_REASONS.quote,
    checklist: count >= 2 ? null : LAYOUT_REASONS.checklist,
    bullets: count >= range.min && count <= range.max ? null : LAYOUT_REASONS.bullets,
    takeaway: place.last ? null : LAYOUT_REASONS.takeaway,
  }
  return LAYOUT_IDS.map((id) => {
    const reason = why[id]
    return reason === null ? { id, ok: true as const } : { id, ok: false as const, reason }
  })
}

type Derived = { text: string; factIds: string[] }

/** The text of a slot the slide lacks, worked out by code from its other slots and its facts. */
function derive(slide: Slide, spec: SlotSpec, facts: Fact[]): Derived {
  const { key } = spec
  const bound = boundFacts(slide, facts)
  const [a, b] = withFigure(bound)
  const { body, items, points: listed } = slide.slots
  const said = (f: Fact | undefined, text: (f: Fact) => string): Derived =>
    f ? { text: text(f), factIds: [f.id] } : { text: '', factIds: [] }
  switch (key) {
    case 'number':
    case 'valueA':
      return said(a, figure)
    case 'label':
    case 'labelA':
      return said(a, (f) => label(f, spec.limit.max))
    case 'valueB':
      return said(b, figure)
    case 'labelB':
      return said(b, (f) => label(f, spec.limit.max))
    case 'quote':
      return said(bound[0], (f) => f.quote ?? f.text)
    case 'items':
    case 'points': {
      // A list from the other list line for line, else from the body's sentences.
      const from = items ?? listed ?? body
      return from
        ? { text: points(slide).join('\n'), factIds: from.factIds }
        : { text: '', factIds: [] }
    }
    case 'body':
      if (items) return { text: lines(items.text).join(' '), factIds: items.factIds }
      if (listed) return { text: lines(listed.text).map(closed).join(' '), factIds: listed.factIds }
      return { text: '', factIds: [] }
    default:
      return { text: '', factIds: [] }
  }
}

/**
 * The slide laid out in `to`: the slot keys both layouts share keep their text and facts, the new
 * ones are derived by code, keys `to` lacks are dropped, and the kind follows the layout. A slot
 * nothing fills is left empty for the editor, and its fit row says so.
 */
export function relayout(slide: Slide, to: LayoutId, facts: Fact[]): Slide {
  const spec = specOf(to)
  const slots: Record<string, Slot> = {}
  for (const s of spec.slots) {
    const kept = slide.slots[s.key]
    const { text, factIds } = kept ?? derive(slide, s, facts)
    slots[s.key] = { text, factIds, factual: s.factual }
  }
  return { kind: spec.kind, slots, layout: to }
}
