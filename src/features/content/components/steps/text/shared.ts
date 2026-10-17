// What the text step's parts share (StructuresStep, ChosenVersion, VersionDetails): the version's
// type, a control's gate, the source check's state, and the pure helpers that name and count slides.

import { LAYOUT_LABELS, layoutIn } from '../../../layout/relayout'
import { unboundSlots } from '../../../lib/claims'
import type { VersionStatus } from '../../../lib/version-status'
import type { Body } from '../../../model/artifacts'
import type { ClaimResult, Fact, FitCheck, Slide } from '../../../model/types'
import { findSlideSpec, isLook } from '../../../templates'
import { charCount, wordCount } from '../../../text/script'

export type Item = Body<'drafts'>['items'][number]

/** A control's place: hidden when the viewer may never use it, else its refusal or null. */
export type Gate = { shown: boolean; reason: string | null }

/** The picked version's source check as the page has it (criteria 98, 104). */
export type CheckState = {
  /** Its results, when a check of the picked text counts. */
  claims: ClaimResult[] | null
  running: boolean
  failed: boolean
  wordingGate: Gate
  retryGate: Gate
  onUseWording: (claim: number) => void
  onTryAgain: () => void
}

/** Another take's step on one slide, as server/commands/structures.ts runs it (SLIDE_STEP). */
export const slideStep = (slide: number) => `draft_slide:${slide}`

/** What a slide of an old template is called in the film strip: its kind, as it has no layout. */
const KIND_NAMES: Record<Slide['kind'], string> = {
  cover: 'Cover',
  body: 'Body',
  take: 'Takeaway',
  single: 'Single',
}

/** A slide's name in the film strip: its layout in a look, else its kind. */
export const slideName = (item: Item, slide: Slide) =>
  isLook(item.template) ? LAYOUT_LABELS[layoutIn(slide)] : KIND_NAMES[slide.kind]

/** A slide not laid out yet, as the words its slots hold in the template's order: its alt text. */
export const wordsOf = (item: Item, slide: Slide) =>
  (findSlideSpec(item.template, slide)?.slots ?? []).flatMap(
    (spec) => slide.slots[spec.key]?.text ?? [],
  )

/** The status tag (Industry: one word, or a count): "Ready", or "<n> to fix". */
export const statusText = (status: VersionStatus) =>
  status.ready ? 'Ready' : `${status.problems.length} to fix`

/** What a slot's label says when it needs attention (GD23); a slot that does not says nothing. */
const ATTENTION = {
  missing: 'Not in the source',
  number: 'Number not in its fact',
  opinion: 'Opinion',
} as const

/** The slots that need attention, by "<slide>:<slot>": unbound, not found, or kept as opinion. */
export function attentionOf(item: Item, facts: Fact[], claims: ClaimResult[]): Map<string, string> {
  const labels = new Map<string, string>()
  for (const c of claims) {
    if (c.result === 'opinion') labels.set(`${c.slide}:${c.slot}`, ATTENTION.opinion)
    if (c.result === 'not_found') labels.set(`${c.slide}:${c.slot}`, ATTENTION.missing)
  }
  for (const u of unboundSlots(item.structure, item.template, facts)) {
    labels.set(
      `${u.slide}:${u.slot}`,
      u.reason === 'No source' ? ATTENTION.missing : ATTENTION.number,
    )
  }
  return labels
}

/** The facts bound on a slide, each once, in slot order (GD23). */
export function slideFacts(slide: Slide, facts: Fact[]): Fact[] {
  const ids = [...new Set(Object.values(slide.slots).flatMap((slot) => slot.factIds))]
  return ids.flatMap((id) => facts.find((f) => f.id === id) ?? [])
}

/** A slot's length as its limit counts it: "16 of 1–40 characters" as a reader sees them, "4 of 3–5 points" (GD34), Thai words by word. */
export function countOf(
  text: string,
  limit: { unit: 'chars' | 'words' | 'points'; min: number; max: number },
) {
  const value =
    limit.unit === 'points'
      ? text.split('\n').filter((line) => line.trim() !== '').length
      : limit.unit === 'words'
        ? wordCount(text)
        : charCount(text)
  const unit = limit.unit === 'chars' ? 'characters' : limit.unit
  return { text: `${value} of ${limit.min}–${limit.max} ${unit}`, over: value > limit.max }
}

/** One fit row in the Checks tab's table: slot · length · limit · status, and whether it passes. */
export type FitRow = { slot: string; length: string; limit: string; status: string; pass: boolean }
/** The fit rows of one slide ("Slide 2"), or of the whole post (contrast, legibility), last. */
export type FitGroup = { title: string; rows: FitRow[] }

/** The group of the rows that belong to no slide. */
export const WHOLE_POST = 'Whole post'

/**
 * A version's fit rows as the Checks tab's table (17 Oct): grouped by slide in slide order, each
 * row its slot by its label, its length in its limit's unit, its limit and its verdict (the
 * label's last word: "OK", "Over", "Too low"); the rows that belong to no slide last.
 */
export function fitTable(item: Item, checks: readonly FitCheck[]): FitGroup[] {
  const slides = new Map<number, FitRow[]>()
  const post: FitRow[] = []
  for (const c of checks) {
    const status = c.label.split(' · ').at(-1) ?? ''
    if (c.slide === null || c.slot === null) {
      // "Contrast · Pop block 3.1:1 · Too low" names the colour pair it measured.
      const pair = (c.label.split(' · ')[1] ?? '').replace(/ [\d.]+:1$/, '')
      post.push(
        c.check === 'contrast'
          ? {
              slot: `Contrast · ${pair}`,
              length: `${c.value}:1`,
              limit: c.limit,
              status,
              pass: c.pass,
            }
          : { slot: 'Smallest text', length: `${c.value}px`, limit: c.limit, status, pass: c.pass },
      )
      continue
    }
    const at = item.structure.slides[c.slide - 1]
    const spec = at ? findSlideSpec(item.template, at)?.slots.find((s) => s.key === c.slot) : null
    // The limit's unit ("15–25 words", "4 lines", "0 missing") is the length's.
    const unit = c.limit.split(' ').slice(1).join(' ')
    const row = {
      slot: spec?.label ?? c.slot,
      length: `${c.value} ${unit}`,
      limit: c.limit,
      status,
      pass: c.pass,
    }
    slides.set(c.slide, [...(slides.get(c.slide) ?? []), row])
  }
  return [
    ...[...slides.entries()]
      .sort(([a], [b]) => a - b)
      .map(([slide, rows]) => ({ title: `Slide ${slide}`, rows })),
    ...(post.length > 0 ? [{ title: WHOLE_POST, rows: post }] : []),
  ]
}

/** The source check in one line: "12 found · 1 not found · 0 opinion". */
export function claimSummary(claims: readonly ClaimResult[]): string {
  const count = (result: ClaimResult['result']) => claims.filter((c) => c.result === result).length
  return `${count('found')} found · ${count('not_found')} not found · ${count('opinion')} opinion`
}
