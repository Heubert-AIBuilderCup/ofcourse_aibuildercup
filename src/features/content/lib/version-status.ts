// What a text version still needs before it can be approved, as the workbench names it (GD22):
// "Ready", or each problem in one plain sentence with a one-click fix where one exists. Pure and
// client-safe: it reads the version, its fit rows, its facts and the source check's results.

import { FEED_BRAND } from '../brands'
import { PRESETS } from '../brands/guideline'
import type { Body, Pointers } from '../model/artifacts'
import type { ClaimResult, Fact, FitCheck, SlotSpec } from '../model/types'
import { findSlideSpec, isLook } from '../templates'
import { unboundSlots } from './claims'

type Item = Body<'drafts'>['items'][number]

/**
 * The press that fixes a problem: the shorter chip on one slide (GD10), for words that do not fit;
 * a supported fact bound in an unbound slot's place (criterion 28); or the source's wording in
 * place of a sentence the check could not find, by its place in the check (criterion 104).
 */
export type ProblemFix =
  | { kind: 'nudge'; nudge: 'shorter'; slide: number }
  | { kind: 'bind'; slide: number; slot: string }
  | { kind: 'wording'; claim: number }

/**
 * One problem: its sentence (the version cards list them), and for the Checks tab's card where it
 * is ("Slide 3 · Body"), what is wrong in a few words ("Too long") and the evidence (the length and
 * its limit, the sentence at fault, the source's paragraph it should match). A problem the drafting
 * left is its sentence alone.
 */
export type VersionProblem = {
  text: string
  where?: string
  what?: string
  evidence?: string[]
  fix?: ProblemFix
}
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

/** "Slide 2 · Body": where a slot's problem is, on its card. */
const slotPlace = (item: Item, slide: number, key: string) =>
  `Slide ${slide} · ${specOf(item, slide, key)?.label ?? key}`

/** The colour pair a contrast row names: "Contrast · Pop block 3.1:1 · Too low" names "Pop block". */
const pairOf = (label: string) => (label.split(' · ')[1] ?? '').replace(/ [\d.]+:1$/, '')

/** A failing fit row as a sentence, with the shorter chip where the words are too many. */
function fitProblem(item: Item, row: FitCheck): VersionProblem {
  const { slide, slot } = row
  if (row.check === 'contrast')
    return {
      text: `Text on ${pairOf(row.label)} is ${row.value}:1; it needs ${row.limit}.`,
      where: `Colours · ${pairOf(row.label)}`,
      what: 'Contrast too low',
      evidence: [`${row.value}:1 · needs ${row.limit}`],
    }
  if (row.check === 'legibility') {
    return {
      text: `The smallest text is ${row.value}px on a phone; it needs ${row.limit}.`,
      where: 'Smallest text',
      what: 'Too small on a phone',
      evidence: [`${row.value}px · needs ${row.limit}`],
    }
  }
  if (slide === null || slot === null) return { text: row.label }
  const name = slotName(item, slide, slot)
  const where = slotPlace(item, slide, slot)
  const shorter: ProblemFix = { kind: 'nudge', nudge: 'shorter', slide }
  if (row.check === 'box') {
    const room = Number.parseInt(row.limit, 10)
    return {
      text: `${name} needs ${row.value} lines; it has room for ${room}.`,
      where,
      what: 'Does not fit its box',
      evidence: [`Needs ${row.value} lines · room for ${room}`],
      fix: shorter,
    }
  }
  if (row.check === 'glyph') {
    const characters = `${row.value} character${row.value === 1 ? '' : 's'}`
    return {
      text: `${name} has ${characters} the font cannot draw.`,
      where,
      what: `The font cannot draw ${characters}`,
    }
  }
  const limit = specOf(item, slide, slot)?.limit
  if (!limit) return { text: row.label }
  const unit = UNITS[limit.unit]
  const evidence = [`${row.value} ${unit} · limit ${limit.min}–${limit.max}`]
  return row.value > limit.max
    ? {
        text: `${name} is ${row.value} ${unit}; the most is ${limit.max}.`,
        where,
        what: 'Too long',
        evidence,
        fix: shorter,
      }
    : {
        text: `${name} is ${row.value} ${unit}; the least is ${limit.min}.`,
        where,
        what: 'Too short',
        evidence,
      }
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
    ...unboundSlots(item.structure, item.template, facts).map(
      (u): VersionProblem => ({
        text:
          u.reason === 'No source'
            ? `${slotName(item, u.slide, u.slot)} is not in the source: “${u.text}”`
            : `${slotName(item, u.slide, u.slot)} has a number its fact does not give: “${u.text}”`,
        where: slotPlace(item, u.slide, u.slot),
        what: u.reason === 'No source' ? 'Not in the source' : 'A number its fact does not give',
        evidence: [`“${u.text}”`],
        fix: { kind: 'bind', slide: u.slide, slot: u.slot },
      }),
    ),
    ...claims.flatMap((c, claim): VersionProblem[] =>
      c.result === 'not_found'
        ? [
            {
              text: `${slotName(item, c.slide, c.slot)} was not found in the source: “${c.text}”`,
              where: slotPlace(item, c.slide, c.slot),
              what: 'Not found in the source',
              evidence: [
                `“${c.text}”`,
                ...(c.suggestion ? [`Source ${c.suggestion.ref}: ${c.suggestion.text}`] : []),
              ],
              ...(c.suggestion ? { fix: { kind: 'wording' as const, claim } } : {}),
            },
          ]
        : [],
    ),
  ]
  return { ready: problems.length === 0, problems }
}

/**
 * What is chosen for the editor when versions are drafted, so nothing waits on a choice nobody
 * made: her pick while it is still among the new versions and clean, else the first version the
 * drafting left without problems (version A, as a rule), or none when every one has some
 * (criterion 97: such a version is never picked); and her colours while they still suit the
 * versions, else Pop for looks (GD9, as a comic is) and the feed brand's first theme for a
 * template from before the looks.
 */
export function draftChoices(
  was: Pick<Pointers, 'picked' | 'themeId'>,
  items: readonly Item[],
): { picked: number | null; themeId: string } {
  const clean = (at: number) => at < items.length && (items[at].problems ?? []).length === 0
  const first = items.findIndex((_, at) => clean(at))
  const picked = was.picked !== null && clean(was.picked) ? was.picked : first < 0 ? null : first
  const looks = items.some((item) => isLook(item.template))
  const themes: readonly string[] = looks ? PRESETS : FEED_BRAND.themes.map((t) => t.id)
  const themeId = was.themeId !== null && themes.includes(was.themeId) ? was.themeId : themes[0]
  return { picked, themeId }
}

/**
 * The colours the versions are shown and approved in: hers, or, on a post drafted before
 * draftChoices (no theme stored), the default it gives (Pop for looks, the brand's first theme).
 */
export const themeOrDefault = (themeId: string | null, items: readonly Item[]): string =>
  themeId ?? draftChoices({ picked: null, themeId: null }, items).themeId

/** The version picked for the editor when versions arrive (GD29): the first Ready one, or none. */
export function firstReady(statuses: readonly VersionStatus[]): number | null {
  const at = statuses.findIndex((s) => s.ready)
  return at < 0 ? null : at
}
