// A post's outline (GD32): the slides a look takes, and the editor's changes to an outline, each
// refused when it would leave the look's counts or order, so the drafts can always follow it.
// Pure and client-safe: the command, the outline step's controls and the model's checks read it.

import {
  type LayoutId,
  OUTLINE_SLIDES,
  type OutlineJob,
  type OutlineSlide,
  POINT_MAX,
  type SlideSpec,
  type Template,
} from '../model/types'
import { charCount } from '../text/script'

export const OUTLINE_ERRORS = {
  slide: 'That slide is not in the outline.',
  point: `Write the point in 1 to ${POINT_MAX} characters.`,
} as const

/** A slide's job as the outline step names it. */
export const JOB_LABELS: Record<OutlineJob, string> = {
  hook: 'Hook',
  point: 'Point',
  proof: 'Proof',
  compare: 'Compare',
  step: 'Step',
  takeaway: 'Takeaway',
  sources: 'Sources',
}

/** One change to an outline, slides and places numbered from 1. */
export type OutlineOp =
  | { op: 'move'; slide: number; to: number }
  | { op: 'add'; at: number; slide: OutlineSlide }
  | { op: 'remove'; slide: number }
  | { op: 'change'; slide: number; job?: OutlineJob; layout?: LayoutId; point?: string }

/** A slide kind as the editor reads it: the slides between the cover and the takeaway are the middle. */
const KIND_WORDS: Record<SlideSpec['kind'], string> = {
  cover: 'cover',
  body: 'middle',
  take: 'takeaway',
  single: 'single',
}

/** How many slides an outline in this look has: its slides' repeats, inside 3 to 10. */
export function outlineRange(template: Template): { min: number; max: number } {
  const min = template.slides.reduce((n, s) => n + s.repeat.min, 0)
  const max = template.slides.reduce((n, s) => n + s.repeat.max, 0)
  return { min: Math.max(min, OUTLINE_SLIDES.min), max: Math.min(max, OUTLINE_SLIDES.max) }
}

/**
 * Why slides with these layouts are not a post in this look, in words, or none: a count outside
 * its range, a layout it lacks, a kind outside its repeat, kinds out of its order.
 */
export function outlineShape(template: Template, layouts: readonly string[]): string[] {
  const problems: string[] = []
  const { name } = template
  const { min, max } = outlineRange(template)
  if (layouts.length < min || layouts.length > max) {
    problems.push(`A ${name} post has ${min} to ${max} slides.`)
  }
  const kinds: SlideSpec['kind'][] = []
  for (const layout of layouts) {
    const spec = template.layouts?.[layout as LayoutId]
    if (spec) kinds.push(spec.kind)
    else problems.push(`${name} has no ${layout} layout.`)
  }
  for (const { spec, repeat } of template.slides) {
    const count = kinds.filter((k) => k === spec.kind).length
    if (count < repeat.min || count > repeat.max) {
      const allowed = repeat.min === repeat.max ? `${repeat.min}` : `${repeat.min} to ${repeat.max}`
      const slides = repeat.max === 1 ? 'slide' : 'slides'
      problems.push(
        `${name} takes ${allowed} ${KIND_WORDS[spec.kind]} ${slides}; this outline has ${count}.`,
      )
    }
  }
  const order = template.slides.map((s) => s.spec.kind)
  const places = kinds.map((k) => order.indexOf(k))
  if (places.some((place, i) => i > 0 && place < places[i - 1])) {
    problems.push(
      `Keep the slides in the look's order: ${order.map((k) => KIND_WORDS[k]).join(', then ')}.`,
    )
  }
  return problems
}

type Edited = { ok: true; slides: OutlineSlide[] } | { ok: false; error: string }

/** The point trimmed, or null when it is empty or over the limit in characters as a reader sees them. */
function pointOf(text: string): string | null {
  const point = text.trim()
  const length = charCount(point)
  return length >= 1 && length <= POINT_MAX ? point : null
}

/** The slides after the change, or why it is refused: a slide or place not there, a bad point, or a shape the look does not take. */
export function editOutline(
  template: Template,
  slides: readonly OutlineSlide[],
  op: OutlineOp,
): Edited {
  const fail = (error: string): Edited => ({ ok: false, error })
  const isSlide = (n: number) => Number.isInteger(n) && n >= 1 && n <= slides.length
  let next: OutlineSlide[]
  switch (op.op) {
    case 'move': {
      if (!isSlide(op.slide) || !isSlide(op.to)) return fail(OUTLINE_ERRORS.slide)
      next = slides.filter((_, i) => i !== op.slide - 1)
      next.splice(op.to - 1, 0, slides[op.slide - 1])
      break
    }
    case 'add': {
      if (!Number.isInteger(op.at) || op.at < 1 || op.at > slides.length + 1) {
        return fail(OUTLINE_ERRORS.slide)
      }
      const point = pointOf(op.slide.point)
      if (point === null) return fail(OUTLINE_ERRORS.point)
      next = [...slides]
      next.splice(op.at - 1, 0, { ...op.slide, point })
      break
    }
    case 'remove': {
      if (!isSlide(op.slide)) return fail(OUTLINE_ERRORS.slide)
      next = slides.filter((_, i) => i !== op.slide - 1)
      break
    }
    case 'change': {
      if (!isSlide(op.slide)) return fail(OUTLINE_ERRORS.slide)
      const was = slides[op.slide - 1]
      const point = op.point === undefined ? was.point : pointOf(op.point)
      if (point === null) return fail(OUTLINE_ERRORS.point)
      const changed = { job: op.job ?? was.job, layout: op.layout ?? was.layout, point }
      next = slides.map((s, i) => (i === op.slide - 1 ? changed : s))
      break
    }
  }
  const [problem] = outlineShape(
    template,
    next.map((s) => s.layout),
  )
  return problem ? fail(problem) : { ok: true, slides: next }
}
