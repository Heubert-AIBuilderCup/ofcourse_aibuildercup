// A road from its spec, on Priya's road's shape: every tile keeps her tile's kind, state, place
// and labels, and takes its id and words from the spec's slot; the options beside its study step
// and its 485 (options.ts) follow them. The walk, the first arrival, the year ruler and the
// weights are hers with the ids renamed. Pure: never changes PRIYA.

import { PRIYA } from '@/features/road/model/fixture'
import type { BadgeId, HereCopy, Road, Tile, Walk } from '@/features/road/model/road-data'
import type { StoredAnswers } from '@/shared/types/student'
import { courseById } from '../data/courses'
import { entryOf } from '../data/entry'
import { PRIYA_SLOT, type RoadSpec, SLOTS, type SlotId } from '../data/types'
import { courseConditions, englishScore } from './conditions'
import { herFields, relatedMark } from './details'
import { optionsBeside } from './options'
import { isWhySlot, type WhyMatch, whyTemplate, whyTitle } from './why'

/** Her answers, and the match that chose the road, so each card's why names the rules it used. */
export type RoadContext = { answers: StoredAnswers; match?: WhyMatch }

const SLOT_OF_PRIYA = new Map(SLOTS.map((slot) => [PRIYA_SLOT[slot], slot]))

/** The object without its undefined keys, so a tile carries only what it has. */
const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

/** The slot whose tile has this id on the spec's road, else null. */
export function slotOf(spec: RoadSpec, tileId: string): SlotId | null {
  return SLOTS.find((slot) => spec.slots[slot].id === tileId) ?? null
}

/** "Bachelor's · IELTS 6.5 · AUD 30k a year for fees", from what she has said; else "Where you start". */
function startLine(answers: StoredAnswers): string {
  const known = (v: unknown): v is string => typeof v === 'string' && v !== 'Unknown'
  const qual = answers.qual?.value
  const eng = answers.eng?.value
  const amount = answers.amount?.value
  const parts = [
    known(qual) ? qual : null,
    known(eng) ? eng : null,
    typeof amount === 'number' ? `AUD ${amount}k a year for fees` : null,
  ].filter((p): p is string => p !== null)
  return parts.length ? parts.join(' · ') : 'Where you start'
}

/**
 * The road's badges with the course's own entry conditions, read against her answers: the English
 * badge names its score and says met, not met or to take the test, and a course that asks a
 * degree in its field carries that on the `maths` slot (a finder course's typical score says it is
 * a sample). A course with no entry rule keeps the spec's badges.
 */
function entryBadges(spec: RoadSpec, answers: StoredAnswers): Road['badges'] {
  const badges = { ...spec.badges }
  const entry = entryOf(spec.courseId)
  for (const condition of courseConditions(spec.courseId, answers)) {
    if (condition.id === 'english' && entry) {
      badges.ielts = {
        ...badges.ielts,
        value: `${condition.met === false ? 'Not met: ' : ''}${englishScore(entry, true)}`,
        explanation: condition.explanation,
      }
    } else if (condition.id === 'degree') {
      badges.maths = {
        kind: 'Condition',
        value: condition.text,
        explanation: condition.explanation,
        icon: 'alert',
      }
    }
  }
  return badges
}

export function buildRoad(spec: RoadSpec, ctx: RoadContext): Road {
  const slotOfPriya = (id: string) => SLOT_OF_PRIYA.get(id) as SlotId
  const rename = (id: string) => spec.slots[slotOfPriya(id)].id
  const renameAll = (ids: string[]) => ids.map(rename)
  const fees: Partial<Record<SlotId, number | undefined>> = {
    course: courseById(spec.courseId)?.feeK,
    'alt-course': courseById(spec.altCourseId)?.feeK,
  }

  // The degree condition takes the `maths` slot, so it stands on the course's own card and the
  // alternative's own maths condition makes way for it on this road.
  const badges = entryBadges(spec, ctx.answers)
  const degree = badges.maths !== spec.badges.maths
  const badgesOf = (slot: SlotId, listed: BadgeId[] | undefined): BadgeId[] | undefined => {
    if (!degree) return listed
    if (slot === 'course') return [...(listed ?? []), 'maths']
    if (slot === 'alt-course') return listed?.filter((b) => b !== 'maths')
    return listed
  }

  // A stack row whose course is in a field next to hers says so; its course id stays here.
  const picked = herFields(spec, ctx.answers)
  const stackRows = spec.stackRows.map(({ courseId, ...row }) => {
    const related = relatedMark(courseId, picked)
    return related ? { ...row, related } : row
  })

  const tiles = PRIYA.tiles.map((priya): Tile => {
    const slot = slotOfPriya(priya.id)
    const copy = spec.slots[slot]
    const tileBadges = badgesOf(slot, copy.here?.badges)
    return {
      id: copy.id,
      kind: priya.kind,
      state: priya.state,
      gx: priya.gx,
      gy: priya.gy,
      lab: { ...priya.lab },
      name: copy.name,
      ...defined({
        gx1: priya.gx1,
        gy1: priya.gy1,
        w: priya.w,
        sz: priya.sz,
        level: priya.level,
        branch: priya.branch,
        inStack: priya.inStack,
        short: copy.short,
        kicker: copy.kicker,
        sub: copy.sub,
        gains: copy.gains,
        costs: copy.costs,
        when: copy.when,
        courseStepName: copy.courseStepName,
        routeId: priya.routeId && copy.id,
        badges: tileBadges?.length ? [...tileBadges] : undefined,
        fees: fees[slot],
        ielts: slot === 'course' ? entryOf(spec.courseId)?.ielts : undefined,
      }),
    }
  })

  const options = optionsBeside(spec, tiles)

  const here: Record<string, HereCopy> = {}
  for (const slot of SLOTS) {
    const copy = spec.slots[slot].here
    if (!copy) continue
    here[spec.slots[slot].id] = {
      ...copy,
      badges: badgesOf(slot, copy.badges) ?? [],
      ...(slot === 'point-a' && { sub: startLine(ctx.answers) }),
    }
  }

  /** Every tile id in a walk renamed; `fork` and `openLevel` as they are. */
  const renameWalk = <W extends Partial<Walk>>(w: W): W =>
    Object.fromEntries(
      Object.entries(w).map(([key, value]) => [
        key,
        Array.isArray(value)
          ? renameAll(value)
          : typeof value === 'string' && key !== 'openLevel'
            ? rename(value)
            : value,
      ]),
    ) as W

  return {
    tiles: [...tiles, ...options.tiles],
    badges,
    // A tile her answers decided carries why it is on her road: the template, until the model's,
    // under its heading (on her roadmap, or beside it).
    cards: {
      ...Object.fromEntries(
        SLOTS.map((slot) => {
          const card = spec.slots[slot].card
          if (!isWhySlot(slot)) return [spec.slots[slot].id, card]
          const why = whyTemplate(spec, slot, ctx.answers, ctx.match)
          return [spec.slots[slot].id, { ...card, why, whyTitle: whyTitle(slot) }]
        }),
      ),
      ...options.cards,
    },
    here,
    stackRows,
    lesson: { ...spec.lesson, tileIds: renameAll(PRIYA.lesson.tileIds) },
    overview: spec.overview,
    years: { ...PRIYA.years, ticks: PRIYA.years.ticks.map((t) => ({ ...t })) },
    weights: PRIYA.weights.map((w) => ({ ...w })),
    walk: renameWalk(PRIYA.walk),
    arrival: {
      hint: rename(PRIYA.arrival.hint),
      line: spec.arrivalLine,
      walk: renameWalk(PRIYA.arrival.walk),
      tiles: Object.fromEntries(
        Object.entries(PRIYA.arrival.tiles).map(([id, change]) => [
          rename(id),
          { ...change, ...(change.lab && { lab: { ...change.lab } }) },
        ]),
      ),
    },
  }
}
