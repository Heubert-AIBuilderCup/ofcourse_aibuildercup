import 'server-only'
// G3, facts to structures. One call per ticked template returns three versions, each a different
// angle (criterion 97); code checks each version's slot keys, slide counts, fact ids, art prompt,
// banned phrases and every number in a factual slot, and that the angles differ. A factual slot
// with no fact bound is not the model's problem: it reaches the editor as "No source". Slot
// lengths are left to the measured fit checks.

import type { z } from 'zod'
import { FEED_BRAND, PAGE_BRANDS } from '../brands'
import type { Guideline } from '../brands/guideline'
import { emotionOf } from '../emotions'
import type { Language, LanguageId } from '../languages'
import { unboundSlots } from '../lib/claims'
import type { Body } from '../model/artifacts'
import {
  type Fact,
  type IdeaCard,
  type OutlineSlide,
  type Slide,
  type SlideSpec,
  type SlotSpec,
  type Structure,
  StructureSchema,
  type Template,
} from '../model/types'
import { findSlideSpec, isLook, layoutSpec, templateById } from '../templates'
import { bannedPhrases } from '../text/lint'
import { missingNumbers } from '../text/numbers'
import { escapeRegExp } from '../text/regexp'
import { charCount, scriptProblems, wordCount } from '../text/script'
import { AI_ERRORS, ai } from './client'
import { DRAFT, DRAFT_SLIDE, guidelineText, inLanguage, postLanguage } from './prompts'
import { withReplay } from './replays'

export const ART_PROMPT_ERROR = 'Art prompts carry no words in quotes, numbers or brand names.'

export type DraftAnswer = z.infer<typeof DRAFT.schema>
export type DraftVersion = DraftAnswer['versions'][number]
export type SlideAnswer = z.infer<typeof DRAFT_SLIDE.schema>
/** One version as the drafts record keeps it: its wording, its frozen template, its angle, and the problems it still had when the ladder gave up (none when clean). */
export type DraftItem = {
  structure: Structure
  template: Template
  angle: string
  problems: string[]
}

/** The idea the versions are drafted for (GD2): one card, or up to four to combine. */
export type DraftIdea = { cards: IdeaCard[] }

/** The outline the versions follow (GD32): its slides in order, each with its job, layout and point, and its format. */
export type DraftOutline = { format: string | null; slides: OutlineSlide[] }

export const VERSIONS_PER_TEMPLATE = 3
const COUNT_PROBLEM = 'versions: return exactly three versions.'

const BRAND_NAMES = ['OfCourse', FEED_BRAND.name, ...PAGE_BRANDS.map((b) => b.name)]
const BRAND = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${BRAND_NAMES.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
  'iu',
)

/** Null when allowed: no digit, no " “ ” quote mark, no brand name from the registries or "OfCourse" (case-insensitive). */
export function artPromptError(prompt: string): string | null {
  if (/\p{Nd}/u.test(prompt) || /["“”]/.test(prompt) || BRAND.test(prompt)) {
    return ART_PROMPT_ERROR
  }
  return null
}

/**
 * Each answered slide's kind and layout. In a look the layout decides both (GD4): a layout's own
 * kind, whatever kind the model wrote; a look slide with no layout is a problem. An old template's
 * slides keep their kind and take no layout.
 */
function slidesOf(
  template: Template,
  answer: Pick<DraftVersion, 'slides'>,
  problems: string[],
): Pick<Slide, 'kind' | 'layout'>[] {
  if (!isLook(template)) return answer.slides.map((s) => ({ kind: s.kind }))
  return answer.slides.map((s, i) => {
    const spec = s.layout ? layoutSpec(template, s.layout) : undefined
    if (!s.layout || !spec) {
      problems.push(`slides.${i}.layout: choose one of the look's layouts for this slide.`)
      return { kind: s.kind }
    }
    return { kind: spec.kind, layout: s.layout }
  })
}

/** One version of the model's answer as a Structure, or the problems: unknown or missing slot keys, a slide kind, layout or count outside the template, an unknown fact id. */
export function toStructure(
  template: Template,
  answer: Pick<DraftVersion, 'slides' | 'art_prompt'>,
  facts: Fact[],
): { ok: true; structure: Structure } | { ok: false; problems: string[] } {
  const problems: string[] = []
  const known = new Set(facts.map((f) => f.id))
  const kinds = template.slides.map((s) => s.spec.kind)
  const placed = slidesOf(template, answer, problems)

  for (const { spec, repeat } of template.slides) {
    const count = placed.filter((s) => s.kind === spec.kind).length
    if (count < repeat.min || count > repeat.max) {
      const allowed = repeat.min === repeat.max ? `${repeat.min}` : `${repeat.min}–${repeat.max}`
      problems.push(`slides: ${count} ${spec.kind} slides; this template takes ${allowed}.`)
    }
  }
  const order = placed.map((s) => kinds.indexOf(s.kind)).filter((i) => i >= 0)
  if (order.some((index, i) => i > 0 && index < order[i - 1])) {
    problems.push(`slides: keep the template's order, ${kinds.join(', ')}.`)
  }

  const slides: Slide[] = []
  answer.slides.forEach((slide, i) => {
    const { kind, layout } = placed[i]
    const spec = findSlideSpec(template, placed[i])
    if (!spec) {
      problems.push(`slides.${i}.kind: ${kind} is not a slide in this template.`)
      return
    }
    const slots: Slide['slots'] = {}
    for (const slot of slide.slots) {
      const slotSpec = spec.slots.find((s) => s.key === slot.key)
      if (!slotSpec) {
        problems.push(`slides.${i}.slots: ${slot.key} is not a slot on a ${layout ?? kind} slide.`)
        continue
      }
      if (slots[slot.key]) {
        problems.push(`slides.${i}.slots: ${slot.key} appears more than once.`)
        continue
      }
      for (const id of slot.fact_ids) {
        if (!known.has(id)) {
          problems.push(`slides.${i}.slots.${slot.key}: ${id} is not a fact in DATA.`)
        }
      }
      slots[slot.key] = { text: slot.text, factIds: slot.fact_ids, factual: slotSpec.factual }
    }
    for (const slotSpec of spec.slots) {
      if (!slide.slots.some((s) => s.key === slotSpec.key)) {
        problems.push(`slides.${i}.slots: ${slotSpec.key} is missing.`)
      }
    }
    slides.push(layout ? { kind, layout, slots } : { kind, slots })
  })

  const parsed = StructureSchema.safeParse({
    templateId: template.id,
    slides,
    artPrompt: answer.art_prompt,
  })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] === 'artPrompt' ? 'art_prompt' : issue.path.join('.')
      problems.push(`${path}: ${issue.message}`)
    }
  }
  if (problems.length > 0 || !parsed.success) return { ok: false, problems }
  return { ok: true, structure: parsed.data }
}

/** Every problem the model can fix in one version: structure, art prompt, banned phrases, numbers its facts lack, the post's language (GD37). */
function problemsIn(
  template: Template,
  answer: DraftVersion,
  facts: Fact[],
  notes: string | null = null,
  language: Language = postLanguage(null),
): string[] {
  const converted = toStructure(template, answer, facts)
  const problems = converted.ok ? [] : [...converted.problems]
  const art = artPromptError(answer.art_prompt)
  if (art) problems.push(`art_prompt: ${art}`)
  answer.slides.forEach((slide, i) => {
    for (const slot of slide.slots) {
      for (const phrase of bannedPhrases(slot.text)) {
        problems.push(`slides.${i}.slots.${slot.key}: remove "${phrase}".`)
      }
    }
  })
  // Every slot in the post's language and script, Western digits only (GD37); the art prompt is
  // for the image model, not the reader.
  const slots = answer.slides.flatMap((slide, i) =>
    slide.slots.map((slot): [string, string] => [`slides.${i}.slots.${slot.key}`, slot.text]),
  )
  problems.push(...scriptProblems('slides', slots, language))
  if (converted.ok) {
    // One problem per slot, naming its sentences; "No source" is for the editor, not the model.
    const bySlot = new Map<string, string[]>()
    for (const u of unboundSlots(converted.structure, template, facts)) {
      if (u.reason !== 'Number not in its fact') continue
      const key = `slides.${u.slide - 1}.slots.${u.slot}`
      bySlot.set(key, [...(bySlot.get(key) ?? []), u.text])
    }
    for (const [key, texts] of bySlot) {
      problems.push(
        `${key}: ${texts.map((t) => `"${t}"`).join(' ')} states a number its fact_ids do not. Use only their numbers.`,
      )
    }
    if (notes) problems.push(...notesNumbers(converted.structure, facts, notes))
  }
  return problems
}

/**
 * A number from the editor's notes that no fact gives, in any slot (GD21): the notes are opinion
 * and never support a number, so such a figure in a heading, or any slot the claims check does
 * not read, goes back to the model. A factual slot's numbers are checked against its own facts
 * above.
 */
function notesNumbers(structure: Structure, facts: Fact[], notes: string): string[] {
  const evidence = facts.flatMap((f) => (f.quote ? [f.text, f.quote] : [f.text])).join(' | ')
  const fromNotes = (text: string) =>
    missingNumbers(text, evidence).some(
      (n) => missingNumbers(text.slice(n.start, n.end), notes).length === 0,
    )
  const problems: string[] = []
  structure.slides.forEach((slide, i) => {
    for (const [key, slot] of Object.entries(slide.slots)) {
      if (slot.factual || !fromNotes(slot.text)) continue
      problems.push(
        `slides.${i}.slots.${key}: "${slot.text}" states a number no fact gives. Use only the facts' numbers.`,
      )
    }
  })
  return problems
}

/**
 * Where a version departs from the editor's outline (GD32): another number of slides, or, slide
 * for slide, another layout. Its points are the model's to say; the layouts and count are code's
 * to check.
 */
function outlineDeparture(version: Pick<DraftVersion, 'slides'>, outline: DraftOutline): string[] {
  const want = outline.slides
  if (version.slides.length !== want.length) {
    return [
      `slides: DATA.outline has ${want.length} slides; write exactly ${want.length}, one for each, in its order.`,
    ]
  }
  return version.slides.flatMap((slide, i) =>
    slide.layout === want[i].layout
      ? []
      : [`slides.${i}.layout: DATA.outline gives this slide the ${want[i].layout} layout.`],
  )
}

/**
 * Each version's problems, by its position: its own, where it departs from the outline when there
 * is one, plus an empty angle or one an earlier version took.
 */
function versionProblems(
  template: Template,
  answer: DraftAnswer,
  facts: Fact[],
  notes: string | null,
  outline: DraftOutline | null,
  language: Language,
): string[][] {
  const taken = new Map<string, number>()
  return answer.versions.map((version, i) => {
    const problems = problemsIn(template, version, facts, notes, language)
    if (outline) problems.push(...outlineDeparture(version, outline))
    const angle = version.angle.trim().toLowerCase()
    const earlier = taken.get(angle)
    if (angle === '') {
      problems.push('angle: name this version’s angle in a few words.')
    } else if (earlier !== undefined) {
      problems.push(
        `angle: "${version.angle}" is version ${earlier + 1}'s angle; give this one its own.`,
      )
    } else {
      taken.set(angle, i)
    }
    return problems
  })
}

/** The whole answer's problems for the model: the count, then each version's, prefixed by its position. */
function answerProblems(answer: DraftAnswer, perVersion: string[][]): string[] {
  const problems = answer.versions.length === VERSIONS_PER_TEMPLATE ? [] : [COUNT_PROBLEM]
  perVersion.forEach((list, i) => {
    for (const problem of list) problems.push(`versions.${i}.${problem}`)
  })
  return problems
}

/** What the model sees of a slot: its key, label, factual flag and limit. */
const slotData = (spec: SlideSpec) =>
  spec.slots.map(({ key, label, factual, limit }) => ({ key, label, factual, limit }))

/**
 * What the model sees of a template: its slides and repeats with each slot. A look's slides give
 * only their kinds and counts, and its layouts their kinds and slots, for each slide to choose
 * from (GD4).
 */
function templateData(template: Template) {
  const { id, name } = template
  if (!isLook(template)) {
    return {
      id,
      name,
      slides: template.slides.map(({ spec, repeat }) => ({
        kind: spec.kind,
        repeat,
        slots: slotData(spec),
      })),
    }
  }
  return {
    id,
    name,
    slides: template.slides.map(({ spec, repeat }) => ({ kind: spec.kind, repeat })),
    layouts: Object.entries(template.layouts ?? {}).map(([layout, spec]) => ({
      id: layout,
      kind: spec.kind,
      slots: slotData(spec),
    })),
  }
}

/** The idea(s) the editor chose (GD2) as DATA carries them: nothing when none; more than one to combine. */
function ideaData(idea: DraftIdea | null | undefined): { idea?: object } {
  if (!idea || idea.cards.length === 0) return {}
  return {
    idea: {
      combine: idea.cards.length > 1,
      cards: idea.cards.map(({ angle, hook, audience }) => ({ angle, hook, audience })),
    },
  }
}

/** The page's copy style as DATA carries it (criterion 105): the field when given, nothing when not. */
function copyStyleData(copyStyle: string | null | undefined): { copy_style?: string } {
  const style = copyStyle?.trim()
  return style ? { copy_style: style } : {}
}

export async function draftStructures(input: {
  templateIds: string[]
  source: Body<'source'>
  facts: Fact[]
  attempt: number
  postId: string
  /** What the drafts record stores (emotions/index.ts, `emotionOf`); none when absent. */
  emotion?: string | null
  /** The copy style of the post's page, when that page has a design language (criterion 105). */
  copyStyle?: string | null
  /** The guideline whose voice the call carries; the brand guideline when absent. Tests pass a changed one. */
  guideline?: Guideline
  /** The idea card the editor chose, or up to four to combine (GD2); none for a draft from ticked templates. */
  idea?: DraftIdea | null
  /** The editor's outline every version follows (GD32); none for a draft without one. */
  outline?: DraftOutline | null
}): Promise<{ ok: true; items: DraftItem[]; replays: string[] } | { ok: false; error: string }> {
  const { templateIds, source, facts, attempt, postId } = input
  const outline = input.outline ?? null
  const emotion = emotionOf(input.emotion)
  const templates = templateIds.map(templateById)
  if (templates.some((t) => t === null)) return { ok: false, error: AI_ERRORS.failed }
  // The model is shown, and may cite, only the supported facts.
  const supported = facts.filter((f) => f.supported)
  // Every version in the post's language (GD37).
  const language = postLanguage(source.language)

  const drafted = await Promise.all(
    (templates as Template[]).map(async (template) => {
      // Frozen now: the item keeps the template it was drafted against.
      const frozen = structuredClone(template)
      const step = `draft:${template.id}:${attempt}`
      // The last answer the ladder checked, with each version's problems. When no rung fixes every
      // version, the three still reach the editor, each with its problems beside it, rather than
      // nothing (criterion 97). An answer with problems is never cached (client.ts), so this is the
      // only way it is kept.
      const seen: { last: { answer: DraftAnswer; perVersion: string[][] } | null } = { last: null }
      const verify = (answer: DraftAnswer) => {
        const perVersion = versionProblems(
          frozen,
          answer,
          supported,
          source.notes ?? null,
          outline,
          language,
        )
        seen.last = { answer, perVersion }
        return answerProblems(answer, perVersion)
      }
      const data = {
        template: templateData(frozen),
        brand_voice: guidelineText('copy', input.guideline),
        // Only when chosen, so a draft from ticked templates sends the data it always did.
        ...ideaData(input.idea),
        // The outline each version follows, slide by slide (GD32); only when there is one.
        ...(outline && {
          outline: {
            format: outline.format,
            slides: outline.slides.map((s, i) => ({ slide: i + 1, ...s })),
          },
        }),
        // The rules read it for the feel of every slot and the art prompt's mood (criterion 100).
        emotion: emotion ? { label: emotion.label, tone: emotion.tone } : null,
        // Only when the page has one, so a post with none sends the data it always did.
        ...copyStyleData(input.copyStyle),
        // The editor's notes, as opinion (GD21): only when given, and never among the paragraphs.
        ...(source.notes ? { editor_notes: source.notes } : {}),
        market: 'default',
        facts: supported.map(({ id, text }) => ({ id, text })),
        paragraphs: source.paragraphs,
      }
      // Written in the post's language (GD37).
      const call = inLanguage(DRAFT, data, language)
      const res = await withReplay(source.demoKey, step, DRAFT.schema, () =>
        ai.generateJson(call.spec, { data: call.data, postId, attemptKey: attempt, verify }),
      )
      let answer: DraftAnswer
      let perVersion: string[][]
      if (res.ok) {
        // A recording is verified again, like any answer.
        if (res.replay && verify(res.value).length > 0) {
          return { ok: false as const, error: AI_ERRORS.failed }
        }
        answer = res.value
        perVersion = answer.versions.map(() => [])
      } else {
        // Three versions that each convert stand, marked; fewer, or none at all, is a failed step.
        const last = seen.last
        if (!last || last.answer.versions.length !== VERSIONS_PER_TEMPLATE) return res
        answer = last.answer
        perVersion = last.perVersion
      }
      const items: DraftItem[] = []
      for (const [i, version] of answer.versions.entries()) {
        const converted = toStructure(frozen, version, supported)
        if (!converted.ok) return { ok: false as const, error: AI_ERRORS.failed }
        items.push({
          structure: converted.structure,
          template: frozen,
          angle: version.angle.trim(),
          problems: perVersion[i],
        })
      }
      return { ok: true as const, items, replay: res.ok && res.replay ? step : null }
    }),
  )

  const items: DraftItem[] = []
  const replays: string[] = []
  for (const d of drafted) {
    if (!d.ok) return { ok: false, error: d.error }
    items.push(...d.items)
    if (d.replay) replays.push(d.replay)
  }
  return { ok: true, items, replays }
}

// ── Another take on one slide (criterion 99) ─────────────────────────────────────────────────

const SAME_WORDING = 'slots: this is the wording the slide has; write another take.'

/** Null inside the limit, else the problem: the length it has against what the slot takes; Thai words by word, characters as a reader sees them. */
function limitProblem(text: string, limit: SlotSpec['limit']): string | null {
  const n =
    limit.unit === 'points'
      ? text.split('\n').filter((line) => line.trim() !== '').length
      : limit.unit === 'words'
        ? wordCount(text)
        : charCount(text)
  if (n >= limit.min && n <= limit.max) return null
  return `${n} ${limit.unit}; this slot takes ${limit.min}–${limit.max}. Stay inside its limit.`
}

/** A slide's words, slot by slot, in the template's order. */
function slideWords(slide: Slide, template: Template): string[] {
  const spec = findSlideSpec(template, slide)
  return (spec?.slots ?? []).flatMap((s) => slide.slots[s.key]?.text ?? [])
}

/**
 * The structure with one slide's wording replaced by the answer, its facts bound as they were,
 * or the problems the model can fix: a slot missing, unknown or repeated, left empty or outside
 * its limit, a banned phrase, a number its facts lack, text not in the post's language (GD37), or
 * the wording it already had.
 */
export function withSlideTake(
  item: Pick<DraftItem, 'structure' | 'template'>,
  slide: number,
  answer: SlideAnswer,
  facts: Fact[],
  language: Language = postLanguage(null),
): { ok: true; structure: Structure } | { ok: false; problems: string[] } {
  const { structure, template } = item
  const was = structure.slides[slide - 1]
  const spec = was && findSlideSpec(template, was)
  if (!was || !spec)
    return { ok: false, problems: [`slide: ${slide} is not a slide of this post.`] }

  const problems: string[] = []
  const slots: Slide['slots'] = {}
  for (const [i, slot] of answer.slots.entries()) {
    const slotSpec = spec.slots.find((s) => s.key === slot.key)
    const old = was.slots[slot.key]
    if (!slotSpec || !old) {
      problems.push(`slots.${i}: ${slot.key} is not a slot on this slide.`)
      continue
    }
    if (slots[slot.key]) {
      problems.push(`slots.${i}: ${slot.key} appears more than once.`)
      continue
    }
    const text = slot.text.trim()
    if (text === '') problems.push(`slots.${slot.key}: write the slot's text.`)
    const limit = limitProblem(text, slotSpec.limit)
    if (limit) problems.push(`slots.${slot.key}: ${limit}`)
    for (const phrase of bannedPhrases(text)) {
      problems.push(`slots.${slot.key}: remove "${phrase}".`)
    }
    slots[slot.key] = { ...old, text }
  }
  const keys = Object.keys(was.slots)
  for (const key of keys) {
    if (!slots[key]) problems.push(`slots: ${key} is missing.`)
  }
  if (keys.some((key) => !slots[key])) return { ok: false, problems }

  // Every slot is there: its numbers are read too, so one retry hears everything at once.
  const next: Structure = {
    ...structure,
    slides: structure.slides.map((s, i) => (i === slide - 1 ? { ...was, slots } : s)),
  }
  // One problem per slot, naming its sentences; "No source" is for the editor, not the model.
  const bySlot = new Map<string, string[]>()
  for (const u of unboundSlots(next, template, facts)) {
    if (u.slide !== slide || u.reason !== 'Number not in its fact') continue
    bySlot.set(u.slot, [...(bySlot.get(u.slot) ?? []), u.text])
  }
  for (const [key, texts] of bySlot) {
    problems.push(
      `slots.${key}: ${texts.map((t) => `"${t}"`).join(' ')} states a number its facts do not. Use only their numbers.`,
    )
  }
  // In the post's language and script, Western digits only (GD37).
  const taken = Object.entries(slots).map(([key, s]): [string, string] => [`slots.${key}`, s.text])
  problems.push(...scriptProblems('slots', taken, language))
  if (problems.length > 0) return { ok: false, problems }
  if (keys.every((key) => slots[key].text === was.slots[key].text.trim())) {
    return { ok: false, problems: [SAME_WORDING] }
  }
  return { ok: true, structure: next }
}

/**
 * Another take on one slide of a version (criterion 99): the same slots, bound to the same facts,
 * reworded in the version's angle and the drafts' emotion; the model sees only the facts this
 * slide binds. The answer is verified like a draft, and every other slide stays byte for byte.
 */
export async function redraftSlide(input: {
  item: DraftItem
  /** Numbered from 1, as the layout engine numbers slides. */
  slide: number
  facts: Fact[]
  emotion?: string | null
  /** The copy style of the post's page, when that page has a design language (criterion 105). */
  copyStyle?: string | null
  /** The guideline whose voice the call carries; the brand guideline when absent. Tests pass a changed one. */
  guideline?: Guideline
  postId: string
  /** A text chip's instruction (GD10): the direction the slide is rewritten in; null for another take. */
  nudge?: string | null
  /** Distinct per press, so the cache never answers "another take" with the last one. */
  attempt: number
  /** The post's language (GD37); English when absent. */
  language?: LanguageId
}): Promise<{ ok: true; structure: Structure } | { ok: false; error: string }> {
  const { item, slide, postId, attempt } = input
  const { structure, template } = item
  const was = structure.slides[slide - 1]
  const spec = was && findSlideSpec(template, was)
  if (!was || !spec) return { ok: false, error: AI_ERRORS.failed }
  const supported = input.facts.filter((f) => f.supported)
  const emotion = emotionOf(input.emotion)
  const language = postLanguage(input.language)
  const bound = new Set(Object.values(was.slots).flatMap((s) => s.factIds))

  const data = {
    angle: item.angle,
    slide: { number: slide, kind: was.kind },
    slots: spec.slots.flatMap(({ key, label, factual, limit }) => {
      const slot = was.slots[key]
      return slot ? [{ key, label, factual, limit, text: slot.text, fact_ids: slot.factIds }] : []
    }),
    facts: supported.filter((f) => bound.has(f.id)).map(({ id, text }) => ({ id, text })),
    others: structure.slides.flatMap((s, i) =>
      i === slide - 1 ? [] : [{ number: i + 1, kind: s.kind, text: slideWords(s, template) }],
    ),
    brand_voice: guidelineText('copy', input.guideline),
    emotion: emotion ? { label: emotion.label, tone: emotion.tone } : null,
    ...copyStyleData(input.copyStyle),
    nudge: input.nudge ?? null,
  }
  const verify = (answer: SlideAnswer) => {
    const converted = withSlideTake(item, slide, answer, supported, language)
    return converted.ok ? [] : converted.problems
  }
  // Written in the post's language (GD37).
  const call = inLanguage(DRAFT_SLIDE, data, language)
  const res = await ai.generateJson(call.spec, {
    data: call.data,
    postId,
    attemptKey: attempt,
    verify,
  })
  if (!res.ok) return { ok: false, error: res.error }
  const converted = withSlideTake(item, slide, res.value, supported, language)
  return converted.ok
    ? { ok: true, structure: converted.structure }
    : { ok: false, error: AI_ERRORS.failed }
}

// ── A whole version in a nudge's direction (GD10) ──────────────────────────────────────────────

const ONE_VERSION = 'versions: return exactly one version.'

/** One version as DATA.base carries it: the answer's own shape, each slide's slots in its spec's order. */
function baseData(item: DraftItem): DraftVersion {
  const { structure, template } = item
  return {
    angle: item.angle,
    slides: structure.slides.map((slide) => {
      const keys = findSlideSpec(template, slide)?.slots.map((s) => s.key) ?? []
      return {
        kind: slide.kind,
        layout: slide.layout ?? null,
        slots: keys.flatMap((key) => {
          const slot = slide.slots[key]
          return slot ? [{ key, text: slot.text, fact_ids: slot.factIds }] : []
        }),
      }
    }),
    art_prompt: structure.artPrompt,
  }
}

/**
 * One version rewritten in a text chip's direction (GD10): one DRAFT call with the version as
 * DATA.base and the chip's instruction as DATA.nudge, asking for one version back. The answer is
 * checked as any draft is (`problemsIn`: structure, fact ids, art prompt, banned phrases, numbers
 * its facts lack); a version still failing after the ladder is no answer. The item keeps its
 * template and angle, and comes back with no problems.
 */
export async function redraftVersion(input: {
  item: DraftItem
  facts: Fact[]
  /** The chip's instruction. */
  nudge: string
  emotion?: string | null
  /** The copy style of the post's page, when that page has a design language (criterion 105). */
  copyStyle?: string | null
  /** The guideline whose voice the call carries; the brand guideline when absent. Tests pass a changed one. */
  guideline?: Guideline
  postId: string
  /** Distinct per press, so the cache never answers a nudge with the last one. */
  attempt: number
  /** The post's language (GD37); English when absent. */
  language?: LanguageId
}): Promise<{ ok: true; item: DraftItem } | { ok: false; error: string }> {
  const { item, postId, attempt } = input
  const supported = input.facts.filter((f) => f.supported)
  const emotion = emotionOf(input.emotion)
  const language = postLanguage(input.language)
  const data = {
    template: templateData(item.template),
    brand_voice: guidelineText('copy', input.guideline),
    emotion: emotion ? { label: emotion.label, tone: emotion.tone } : null,
    ...copyStyleData(input.copyStyle),
    market: 'default',
    facts: supported.map(({ id, text }) => ({ id, text })),
    base: baseData(item),
    nudge: input.nudge,
  }
  const verify = (answer: DraftAnswer) => {
    const problems = answer.versions.length === 1 ? [] : [ONE_VERSION]
    const [version] = answer.versions
    if (version) {
      for (const problem of problemsIn(item.template, version, supported, null, language)) {
        problems.push(`versions.0.${problem}`)
      }
    }
    return problems
  }
  // Written in the post's language (GD37).
  const call = inLanguage(DRAFT, data, language)
  const res = await ai.generateJson(call.spec, {
    data: call.data,
    postId,
    attemptKey: attempt,
    verify,
  })
  if (!res.ok) return { ok: false, error: res.error }
  const [version] = res.value.versions
  const converted = version && toStructure(item.template, version, supported)
  if (!converted?.ok) return { ok: false, error: AI_ERRORS.failed }
  return { ok: true, item: { ...item, structure: converted.structure, problems: [] } }
}
