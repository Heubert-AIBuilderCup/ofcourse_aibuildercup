// The one layout engine: every word of a structure placed as a measured line in its template box.
// Draft previews, fit checks, the render and the export all read this layout, so what an editor
// approves is what is drawn. Pure given `measure`: the same input always gives the same layout.

import { type LanguageId, linesOf, SEARCH_PHRASE } from '../languages'
import { type PostSource, sourceLabel, sourceNames } from '../lib/sites'
import {
  type Box,
  type Brand,
  type Fact,
  type LaidLine,
  type LaidSlide,
  SEARCH_SLOT,
  type Slide,
  type SlideSpec,
  type SlotFit,
  type SlotSpec,
  SOURCES_SLOT,
  type SourcesAt,
  type Structure,
  type Template,
} from '../model/types'
import { isLook, slideSpec, templateById } from '../templates'
import { measure, wrap } from './measure'

export { paragraphSite, paragraphSites } from '../lib/sites'

/** Lives with the templates so client code can use it; re-exported for the engine's callers. */
export { slideSpec }

export const PHONE_WIDTH_PX = 328
/** 37: 11 px at 328 px phone width (ADR-112). */
export const LEGIBILITY_FLOOR_PX = Math.ceil((11 * 1080) / PHONE_WIDTH_PX)

export const CANVAS = { width: 1080, height: 1350 } as const
/**
 * Where the source line sits on a slide with `sourceLine`; a rate line sits one line below it. On
 * the last slide the search line's rows end on this baseline and the source line moves up above
 * them, one `advance` per row (ADR-131).
 */
export const SOURCE_LINE = {
  x: 96,
  y: 1270,
  fontPx: 38,
  width: 888,
  rateY: 1316,
  advance: 38 * 1.2,
} as const

/**
 * The last slide's closing line (ADR-131): what a reader types into Google to find the post again,
 * in the post's language (GD39), "OfCourse" and the title as written. A function replaces, so a
 * "$&" in a title stays as it is.
 */
export const SEARCH_LINE = (title: string, language?: LanguageId): string =>
  linesOf(language).search.replace(SEARCH_PHRASE, () => `“OfCourse ${title}”`)

/**
 * The line that names a look post's sources on its last slide and ends its caption (GD31), after
 * `heading`: the sources line of the post's language, the caption's own in a caption (GD39).
 */
export const SOURCES_LINE = (names: string[], heading: string = linesOf('en').sources): string =>
  `${heading}: ${names.join(', ')}`

/** An English sources slide's heading, and the most sources it lists, one row each (GD31). */
export const SOURCES_HEADING = linesOf('en').sources
export const SOURCES_MAX = 6

/**
 * The sources slide (GD31) as one more slide of the post: the heading and one row per source by
 * its site and title, never its link, each starting its own line, in the slots of the look's
 * `sourcesLayout` (heading, rows).
 */
function sourcesSlide(spec: SlideSpec, sources: readonly PostSource[], heading: string): Slide {
  const slot = (text: string) => ({ text, factIds: [], factual: false })
  return {
    kind: spec.kind,
    slots: {
      heading: slot(heading),
      rows: slot(sources.slice(0, SOURCES_MAX).map(sourceLabel).join('\n')),
    },
  }
}

/** The source line's baseline on a slide whose search line takes `searchRows` rows. */
export function sourceLineY(searchRows: number): number {
  return round(SOURCE_LINE.y - searchRows * SOURCE_LINE.advance)
}

/**
 * A look's frame (GD6), in the foot row on the source baseline, right-aligned: "Swipe" (in the
 * post's language, GD39) and an arrow on every slide but the last, then one dot per slide. The
 * arrow is drawn, not typed: the brand fonts have no "→". The cue is bold in the heading face at
 * `swipePx`, a step above the foot row's text, so a reader sees there is more.
 */
export const FRAME = {
  right: 984,
  dotRadius: 7,
  dotPitch: 26,
  /** Between the dots and the arrow, and between the frame and the foot text beside it. */
  gap: 24,
  arrowWidth: 30,
  arrowGap: 10,
  label: 'Swipe',
  swipePx: 44,
} as const

/** The frame's width on a slide of a post of `total` slides; the swipe cue, `label` in the heading font `fontFile`, only before the last. */
export function frameWidth(
  total: number,
  swipe: boolean,
  fontFile: string,
  label: string = FRAME.label,
): number {
  const dots = (total - 1) * FRAME.dotPitch + 2 * FRAME.dotRadius
  if (!swipe) return dots
  const cue = measure(label, fontFile, FRAME.swipePx) + FRAME.arrowGap + FRAME.arrowWidth
  return dots + FRAME.gap + cue
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * A points slot's bullets (GD34): each point's rows start `indent` past the box's left edge, and
 * a dot whose radius is `radius` of the size is drawn in the gap before its first row. A look's
 * checklist items are indented the same, with a tick in place of the dot.
 */
export const BULLET = { indent: 56, radius: 0.16 } as const

/** The slot of a look's checklist layout that holds its items, one per line. */
export const CHECKLIST_SLOT = 'items'

/** One row of a slot as wrapped: its words, and the mark before it when it starts a point (GD34) or an item. */
type Row = { text: string; mark: 'bullet' | 'tick' | null }

/** Around a panel layout's slots: the card they sit on over the art. */
export const PANEL_PADDING = 48

/** Whether a line is in the foot row (the search line and the sources above it), not a slot's. */
const inFoot = (l: LaidLine) => l.slot === SEARCH_SLOT || l.slot === SOURCES_SLOT

/** The top of a line's letters, as the highlight under it is drawn; and the bottom of its descenders. */
const lineTop = (l: LaidLine) => l.y - 0.8 * l.fontPx
const lineBottom = (l: LaidLine) => l.y + 0.25 * l.fontPx

/**
 * How far a panel slide's text moves down so it stacks against the foot row, `PANEL_PADDING`
 * above it: the gaps between its slots kept, never moved up. The card then shows only what the
 * text needs and the picture shows above it.
 */
function panelShift(lines: LaidLine[], footTop: number): number {
  const text = lines.filter((l) => !inFoot(l))
  if (text.length === 0) return 0
  return round(Math.max(0, footTop - PANEL_PADDING - Math.max(...text.map(lineBottom))))
}

/**
 * The card under a panel slide's text: as wide as the spec's slot boxes and the foot row, from the
 * top of the first laid-out line down past the foot row (source line, search line and frame, from
 * `footTop` down to the source baseline), plus the padding, kept on the canvas: the foot row's
 * muted text then sits on the card, never on the art (GD9).
 */
function panelBox(spec: SlideSpec, footTop: number, lines: LaidLine[]): Box {
  const foot: Box = {
    x: SOURCE_LINE.x,
    y: footTop,
    w: FRAME.right - SOURCE_LINE.x,
    h: SOURCE_LINE.y - footTop,
  }
  const boxes = [...spec.slots.map((s) => s.box), foot]
  const tops = lines.filter((l) => !inFoot(l)).map(lineTop)
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - PANEL_PADDING)
  const y = round(Math.max(0, Math.min(footTop, ...tops) - PANEL_PADDING))
  const right = Math.min(CANVAS.width, Math.max(...boxes.map((b) => b.x + b.w)) + PANEL_PADDING)
  const bottom = Math.min(CANVAS.height, SOURCE_LINE.y + PANEL_PADDING)
  return { x, y, w: right - x, h: round(bottom - y) }
}

function maxLines(boxHeight: number, px: number, lineHeight: number): number {
  return Math.floor(boxHeight / (px * lineHeight) + 1e-9)
}

/**
 * "Source: <name> · ¶2, ¶3", the refs being the paragraphs of the facts bound on the slide; with
 * more than one name (the sites of a source read from several links), "Sources: a, b · …". A line
 * wider than `width` keeps the most whole words of the title that fit with an ellipsis, without
 * the comma or dash a cut would leave; only a first word too long for the line is cut inside it.
 * `full` is the whole line, for places with room for it (the feed card, criterion 71).
 */
function sourceLine(
  names: string[],
  refs: string[],
  fontFile: string,
  width: number,
): { line: string; full: string } {
  const label = names.length > 1 ? 'Sources' : 'Source'
  const title = names.join(', ')
  const tail = refs.length > 0 ? ` · ${refs.join(', ')}` : ''
  const full = `${label}: ${title}${tail}`
  const fits = (t: string) =>
    measure(`${label}: ${t}${tail}`, fontFile, SOURCE_LINE.fontPx) <= width
  if (fits(title)) return { line: full, full }
  const words = title.split(/\s+/)
  const byWords = (n: number) =>
    `${words
      .slice(0, n)
      .join(' ')
      .replace(/[\s,;:·–-]+$/, '')}…`
  const chars = Array.from(title)
  const byChars = (n: number) => `${chars.slice(0, n).join('').trimEnd()}…`
  const kept = most(words.length - 1, (n) => fits(byWords(n)))
  const cut = kept > 0 ? byWords(kept) : byChars(most(chars.length, (n) => fits(byChars(n))))
  return { line: `${label}: ${cut}${tail}`, full }
}

/**
 * The largest n in 0..max for which `fits(n)` holds, 0 when none does. A longer prefix is never
 * narrower, so halving finds it in O(log n) measures instead of one per step.
 */
function most(max: number, fits: (n: number) => boolean): number {
  let good = 0
  let bad = max + 1
  while (bad - good > 1) {
    const mid = Math.floor((good + bad) / 2)
    if (fits(mid)) good = mid
    else bad = mid
  }
  return good
}

/**
 * Places every slot of the structure in its template box. Each slot starts at its fontPx; when the
 * wrapped lines need more height than the box, the size steps down 1 px at a time to the legibility
 * floor. At the floor, the slot is laid out anyway and its fit is false. Deterministic: the same
 * structure, template and brand always give the same layout.
 *
 * Slides are numbered from 1, cover first: `SlotFit.slide` and the `slotOverrides` keys
 * ("<slide>:<slot>" → text, for a market version) use that number.
 */
export function layoutStructure(input: {
  structure: Structure
  template: Template
  brand: Brand
  sourceTitle: string
  /** The title the search line names (a comic's own, RC7); the source title when absent. */
  title?: string
  /** The site of a source read from a link: the source line names it in place of the title (criterion 94). */
  sourceSite?: string
  /** A source read from several links: each paragraph ref to its site (`paragraphSites`, GD19). */
  sites?: Record<string, string>
  facts: Fact[]
  slotOverrides?: Record<string, string>
  /**
   * Where a look post's sources go (GD31), the caption when absent: no slide of a look carries a
   * source line; `last_slide` names them above the search line, `sources_slide` adds a last slide
   * listing them. A template from before the looks keeps its source lines and ignores it (GD8).
   */
  sourcesAt?: SourcesAt
  /** The post's sources (`postSources`); the one source by its site or title when absent. */
  sources?: readonly PostSource[]
  /** The post's language (GD39): the search line, the sources and the swipe cue are in it; English when absent. */
  language?: LanguageId
}): { slides: LaidSlide[]; fits: SlotFit[] } {
  const { structure, template, brand, sourceTitle, sourceSite, sites = {}, facts } = input
  const { slotOverrides = {} } = input
  const fixed = linesOf(input.language)
  const refOf = new Map(facts.map((f) => [f.id, f.ref]))
  const fits: SlotFit[] = []
  const look = isLook(template)
  const sources = input.sources ?? [{ site: sourceSite ?? null, title: sourceTitle, url: null }]
  const sourcesAt: SourcesAt = look ? (input.sourcesAt ?? 'caption') : 'caption'
  // A look frozen into a revision before the sources slide draws it from the look of its id.
  const sourcesSpec =
    sourcesAt === 'sources_slide'
      ? (template.sourcesLayout ?? templateById(template.id)?.sourcesLayout)
      : undefined
  const planned = structure.slides.map((slide) => ({ slide, spec: slideSpec(template, slide) }))
  if (sourcesSpec)
    planned.push({ slide: sourcesSlide(sourcesSpec, sources, fixed.sources), spec: sourcesSpec })
  const total = planned.length
  // A look starts each line break on a new line (a checklist's items); old templates never did.
  // A points slot's lines are its points (GD34): each starts after a bullet, its rows indented.
  // A look's checklist items are laid out the same, each after a tick.
  const listMark = (slot: SlotSpec): Row['mark'] =>
    slot.limit.unit === 'points' ? 'bullet' : look && slot.key === CHECKLIST_SLOT ? 'tick' : null
  const wrapSlot = (slot: SlotSpec, text: string, fontFile: string, px: number): Row[] => {
    const mark = listMark(slot)
    if (mark) {
      return text
        .split('\n')
        .filter((part) => part.trim() !== '')
        .flatMap((part) =>
          wrap(part, fontFile, px, slot.box.w - BULLET.indent).map((row, i) => ({
            text: row,
            mark: i === 0 ? mark : null,
          })),
        )
    }
    const rows = look
      ? text.split('\n').flatMap((part) => wrap(part, fontFile, px, slot.box.w))
      : wrap(text, fontFile, px, slot.box.w)
    return rows.map((row) => ({ text: row, mark: null }))
  }

  const slides = planned.map(({ slide, spec }, index): LaidSlide => {
    const number = index + 1
    const last = index === total - 1
    const lines: LaidLine[] = []
    // A look's search line and sources share the foot row with the frame, so they wrap beside it.
    const footWidth = look
      ? SOURCE_LINE.width -
        frameWidth(total, !last, brand.fonts.heading.file, fixed.swipe) -
        FRAME.gap
      : SOURCE_LINE.width

    for (const slot of spec.slots) {
      const text = slotOverrides[`${number}:${slot.key}`] ?? slide.slots[slot.key]?.text ?? ''
      const fontFile = brand.fonts[slot.font].file
      let px = slot.fontPx
      let wrapped = wrapSlot(slot, text, fontFile, px)
      while (
        wrapped.length > maxLines(slot.box.h, px, slot.lineHeight) &&
        px > LEGIBILITY_FLOOR_PX
      ) {
        px -= 1
        wrapped = wrapSlot(slot, text, fontFile, px)
      }
      const room = maxLines(slot.box.h, px, slot.lineHeight)
      const advance = px * slot.lineHeight
      fits.push({
        slide: number,
        slot: slot.key,
        fontPx: px,
        lines: wrapped.length,
        maxLines: room,
        fits: wrapped.length <= room,
      })
      const indent = listMark(slot) ? BULLET.indent : 0
      wrapped.forEach(({ text: line, mark }, i) => {
        lines.push({
          slot: slot.key,
          text: line,
          x: slot.box.x + indent,
          // Baseline: the cap height centred in the line's slot.
          y: round(slot.box.y + i * advance + advance / 2 + 0.35 * px),
          fontPx: px,
          font: slot.font,
          mark: slot.mark,
          width: round(measure(line, fontFile, px)),
          ...(mark === 'bullet' ? { bullet: true } : mark === 'tick' ? { tick: true } : {}),
        })
      })
    }

    let source: string | null = null
    let fullSource: string | null = null
    // A look's slides carry no source line (GD31); an old template's keep theirs (GD8).
    const sourceLined = spec.sourceLine && !look
    if (sourceLined) {
      const ids = new Set(Object.values(slide.slots).flatMap((s) => s.factIds))
      const refs = [...new Set([...ids].flatMap((id) => refOf.get(id) ?? []))].sort(
        (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
      )
      // The sites the slide's facts come from, in paragraph order; with none, the one name.
      const named = [...new Set(refs.flatMap((ref) => sites[ref] ?? []))]
      const names = named.length > 0 ? named : [sourceSite ?? sourceTitle]
      const made = sourceLine(names, refs, brand.fonts.body.file, footWidth)
      source = made.line
      fullSource = made.full
    }

    let search: string | null = null
    if (last) {
      search = SEARCH_LINE(input.title ?? sourceTitle, input.language)
      const fontFile = brand.fonts.body.file
      const px = SOURCE_LINE.fontPx
      const rows = wrap(search, fontFile, px, footWidth)
      // "Sources: …" above the search line, on a look whose sources go on the last slide (GD31).
      const named =
        sourcesAt === 'last_slide'
          ? wrap(SOURCES_LINE(sourceNames(sources), fixed.sources), fontFile, px, footWidth)
          : []
      // The foot of the slide holds one row per `advance` between the lowest slot box and the
      // source baseline (the top row's cap height included); the source line takes one of them.
      const slotsEnd = Math.max(0, ...spec.slots.map((s) => s.box.y + s.box.h))
      const footRows =
        Math.floor((SOURCE_LINE.y - 0.7 * px - slotsEnd) / SOURCE_LINE.advance + 1e-9) + 1
      const room = Math.max(0, footRows - (sourceLined ? 1 : 0) - named.length)
      if (named.length > 0) {
        fits.push({
          slide: number,
          slot: SOURCES_SLOT,
          fontPx: px,
          lines: named.length,
          maxLines: Math.max(0, footRows - rows.length),
          fits: named.length + rows.length <= footRows,
        })
        named.forEach((row, i) => {
          lines.push({
            slot: SOURCES_SLOT,
            text: row,
            x: SOURCE_LINE.x,
            y: round(SOURCE_LINE.y - (rows.length + named.length - 1 - i) * SOURCE_LINE.advance),
            fontPx: px,
            font: 'body',
            mark: 'none',
            width: round(measure(row, fontFile, px)),
          })
        })
      }
      fits.push({
        slide: number,
        slot: SEARCH_SLOT,
        fontPx: px,
        lines: rows.length,
        maxLines: room,
        fits: rows.length <= room,
      })
      rows.forEach((row, i) => {
        lines.push({
          slot: SEARCH_SLOT,
          text: row,
          x: SOURCE_LINE.x,
          y: round(SOURCE_LINE.y - (rows.length - 1 - i) * SOURCE_LINE.advance),
          fontPx: px,
          font: 'body',
          mark: 'none',
          width: round(measure(row, fontFile, px)),
        })
      })
    }

    const laid: LaidSlide = {
      kind: slide.kind,
      lines,
      artBox: spec.artBox,
      sourceLine: source,
      searchLine: search,
      // Only a shortened line stores the whole one, so a layout whose lines fit is as before.
      ...(fullSource !== null && fullSource !== source ? { fullSourceLine: fullSource } : {}),
    }
    if (!look) return laid
    // The foot row's top: the search line's rows on the last slide, and the sources above them.
    const footYs = lines.filter(inFoot).map((l) => l.y)
    const footTop = Math.min(SOURCE_LINE.y, ...footYs) - SOURCE_LINE.fontPx
    // A panel slide's text stacks against the foot row, at its own x; the cover stays as designed.
    const shift = spec.panel && slide.kind !== 'cover' ? panelShift(lines, footTop) : 0
    const placed =
      shift > 0 ? lines.map((l) => (inFoot(l) ? l : { ...l, y: round(l.y + shift) })) : lines
    return {
      ...laid,
      lines: placed,
      ...(shift > 0 ? { shift } : {}),
      surface: spec.surface,
      // Only a cue not in English stores its words, so an English layout is as before.
      frame: {
        slide: number,
        total,
        ...(!last && fixed.swipe !== FRAME.label ? { swipe: fixed.swipe } : {}),
      },
      ...(spec.panel ? { panel: panelBox(spec, footTop, placed) } : {}),
    }
  })

  return { slides, fits }
}
