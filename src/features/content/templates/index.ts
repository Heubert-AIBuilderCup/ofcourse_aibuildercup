// The template registry. Adding a template is one JSON file plus one import line here.
// Each file is parsed at module load, so a malformed template fails at start-up and in the tests.

import {
  type LayoutId,
  type Slide,
  type SlideSpec,
  type Structure,
  type Template,
  TemplateSchema,
} from '../model/types'
import comic from './comic.json'
import dataDesk from './data-desk.json'
import fieldNotes from './field-notes.json'
import postcard from './postcard.json'
import quoteCard from './quote-card.json'
import sketchInsight from './sketch-insight.json'
import theLine from './the-line.json'
import theLongRead from './the-long-read.json'
import theQuestion from './the-question.json'

/** The three looks (GD4): the same eight layouts and slot keys, different boxes, art and surfaces. */
export const LOOKS: readonly Template[] = [fieldNotes, dataDesk, postcard].map((raw) =>
  TemplateSchema.parse(raw),
)

/** The templates posts made before the looks carry (GD8): found by id, never offered for a new post. */
export const LEGACY_TEMPLATES: readonly Template[] = [
  theLine,
  theQuestion,
  theLongRead,
  sketchInsight,
].map((raw) => TemplateSchema.parse(raw))

/** The templates "Make post" offers. */
export const TEMPLATES: readonly Template[] = LOOKS

/**
 * Whether a post's ticks name a template from before the looks: such a post ticks from
 * LEGACY_TEMPLATES, so its own ticked template stays in the list (GD8); any other from TEMPLATES.
 */
export function ticksLegacy(ticked: readonly string[]): boolean {
  return ticked.some((id) => LEGACY_TEMPLATES.some((t) => t.id === id))
}

/**
 * The quote card "Make the set" draws from a live post's strongest fact (criterion 108): one
 * slide, the quote, the source line and the search line. Not in the editor's list.
 */
export const QUOTE_CARD: Template = TemplateSchema.parse(quoteCard)

/**
 * The comic (RC2): a cover panel then two to five more, each an art box over its caption, the
 * last carrying the search line; drawn as a look. Made from a path, never offered by "Make post".
 */
const COMIC: Template = TemplateSchema.parse(comic)
export const COMIC_TEMPLATE_ID = 'comic'

const ALL: readonly Template[] = [...LOOKS, ...LEGACY_TEMPLATES, QUOTE_CARD, COMIC]

export function templateById(id: string): Template | null {
  return ALL.find((t) => t.id === id) ?? null
}

/** Whether slides pick their spec by layout, on the preset's surfaces, with the frame. */
export function isLook(template: Template): boolean {
  return template.look && template.layouts !== undefined
}

/**
 * A look's spec for a layout: its own, or for a look frozen into a record before that layout was
 * added (bullets, GD34), the look of its id's; none when neither has it.
 */
export function layoutSpec(template: Template, layout: LayoutId): SlideSpec | undefined {
  return template.layouts?.[layout] ?? templateById(template.id)?.layouts?.[layout]
}

/** The template's spec for a slide: by its layout in a look (`layoutSpec`), else the first spec of its kind; none when it has neither. */
export function findSlideSpec(
  template: Template,
  slide: Pick<Slide, 'kind' | 'layout'>,
): SlideSpec | undefined {
  if (isLook(template) && slide.layout) {
    const byLayout = layoutSpec(template, slide.layout)
    if (byLayout) return byLayout
  }
  return template.slides.find((s) => s.spec.kind === slide.kind)?.spec
}

/** As `findSlideSpec`, for a slide the template must have. */
export function slideSpec(template: Template, slide: Pick<Slide, 'kind' | 'layout'>): SlideSpec {
  const spec = findSlideSpec(template, slide)
  if (!spec) throw new Error(`Template ${template.id} has no ${slide.kind} slide`)
  return spec
}

/** The looks drawn as one wide image cut into a window per slide (GD4): Postcard. */
const PANORAMA_LOOKS: readonly string[] = ['postcard']

export function isPanorama(template: Template): boolean {
  return isLook(template) && PANORAMA_LOOKS.includes(template.id)
}

/** The slides, numbered from 1, whose spec has an art box: where a look's images go (GD12). */
export function artSlides(template: Template, structure: Pick<Structure, 'slides'>): number[] {
  return structure.slides.flatMap((slide, i) =>
    findSlideSpec(template, slide)?.artBox ? [i + 1] : [],
  )
}

/** The images "Draw images" draws (GD14): one per art-box slide, or one panorama. */
export function imagesFor(template: Template, structure: Pick<Structure, 'slides'>): number {
  return isPanorama(template) ? 1 : artSlides(template, structure).length
}
