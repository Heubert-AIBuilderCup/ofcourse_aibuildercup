// What a text version still needs before it can be approved, as the workbench names it (GD22):
// "Ready", or each problem in one plain sentence with a one-click fix where one exists. Pure and
// client-safe: it reads the version, its fit rows, its facts and the source check's results.

import type { Body } from '../model/artifacts'
import type { ClaimResult, Fact, FitCheck, SlotSpec } from '../model/types'
import { findSlideSpec } from '../templates'
import { unboundSlots } from './claims'

type Item = Body<'drafts'>['items'][number]

/** The press that fixes a problem: the shorter chip on one slide (GD10), for words that do not fit. */
export type ProblemFix = { kind: 'nudge'; nudge: 'shorter'; slide: number }

export type VersionProblem = { text: string; fix?: ProblemFix }
export type VersionStatus = { ready: boolean; problems: VersionProblem[] }

const UNITS = { chars: 'characters', words: 'words', points: 'points' } as const

/** A version's letter by its position, A for the first: the cards and the history notes agree. */
export const versionLetter = (index: number): string => String.fromCharCode(65 + index)

/** A slot's spec on a slide of the version, if the template has one. */
function specOf(item: Item, slide: number, key: string): SlotSpec | undefined {
  const at = item.structure.slides[slide - 1]
  return at ? findSlideSpec(item.template, at)?.slots.find((s) => s.key === key) : undefined
}

/** "Slide 2 body": a slot by its slide and its label, as the editor sees it. */
function slotName(item: Item, slide: number, key: string): string {
  const label = specOf(item, slide, key)?.label ?? key
  return `Slide ${slide} ${label.charAt(0).toLowerCase()}${label.slice(1)}`
}

/** The colour pair a contrast row names: "Contrast · Pop block 3.1:1 · Too low" names "Pop block". */
const pairOf = (label: string) => (label.split(' · ')[1] ?? '').replace(/ [\d.]+:1$/, '')

/** A failing fit row as a sentence, with the shorter chip where the words are too many. */
function fitProblem(item: Item, row: FitCheck): VersionProblem {
  const { slide, slot } = row
  if (row.check === 'contrast')
    return { text: `Text on ${pairOf(row.label)} is ${row.value}:1; it needs ${row.limit}.` }
  if (row.check === 'legibility') {
    return { text: `The smallest text is ${row.value}px on a phone; it needs ${row.limit}.` }
  }
  if (slide === null || slot === null) return { text: row.label }
  const name = slotName(item, slide, slot)
  const shorter: ProblemFix = { kind: 'nudge', nudge: 'shorter', slide }
  if (row.check === 'box') {
    const room = Number.parseInt(row.limit, 10)
    return { text: `${name} needs ${row.value} lines; it has room for ${room}.`, fix: shorter }
  }
  if (row.check === 'glyph') {
    return {
      text: `${name} has ${row.value} character${row.value === 1 ? '' : 's'} the font cannot draw.`,
    }
  }
  const limit = specOf(item, slide, slot)?.limit
  if (!limit) return { text: row.label }
  const unit = UNITS[limit.unit]
  return row.value > limit.max
    ? { text: `${name} is ${row.value} ${unit}; the most is ${limit.max}.`, fix: shorter }
    : { text: `${name} is ${row.value} ${unit}; the least is ${limit.min}.` }
}

/**
 * The version's problems, each one sentence: its failing fit rows, the problems drafting left on
 * it, each claim with no supported fact behind it, and each sentence the source check could not
 * find (`claims`, the picked version's check). Ready when there are none.
 */
export function versionStatus(
  item: Item,
  checks: FitCheck[],
  facts: Fact[],
  claims: ClaimResult[] = [],
): VersionStatus {
  const problems: VersionProblem[] = [
    ...checks.filter((row) => !row.pass).map((row) => fitProblem(item, row)),
    ...(item.problems ?? []).map((text) => ({ text })),
    ...unboundSlots(item.structure, item.template, facts).map((u) => ({
      text:
        u.reason === 'No source'
          ? `${slotName(item, u.slide, u.slot)} is not in the source: “${u.text}”`
          : `${slotName(item, u.slide, u.slot)} has a number its fact does not give: “${u.text}”`,
    })),
    ...claims
      .filter((c) => c.result === 'not_found')
      .map((c) => ({
        text: `${slotName(item, c.slide, c.slot)} was not found in the source: “${c.text}”`,
      })),
  ]
  return { ready: problems.length === 0, problems }
}

/** The version picked for the editor when versions arrive (GD29): the first Ready one, or none. */
export function firstReady(statuses: readonly VersionStatus[]): number | null {
  const at = statuses.findIndex((s) => s.ready)
  return at < 0 ? null : at
}
