// Domain types for content: zod schemas and their types. One definition, used by the server,
// the actions, the model layer's converters and (type-only) the components. Not model-facing:
// the model sees the simpler schemas in ai/prompts.ts.

import { z } from 'zod'
import { charCount } from '../text/script'

/** Text of at most `max` characters as a reader sees them: a Devanagari conjunct or a Thai letter with its marks is one. */
export const upTo = (max: number) => z.string().refine((text) => charCount(text) <= max)

export const ParagraphSchema = z.object({ ref: z.string().regex(/^¶\d+$/), text: z.string() })

export const SpanSchema = z.object({
  ref: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
})

/** One claim the source makes, tied to the paragraph it rests on. */
export const FactSchema = z.object({
  id: z.string(),
  text: z.string(),
  value: z.object({ number: z.number(), unit: z.string() }).nullable(),
  ref: z.string(),
  quote: z.string().nullable(),
  supported: z.boolean(),
  /** Why the claim is not supported: the code's number finding. */
  why: z.string().nullable(),
  /** What to highlight in the paragraph when the claim is not supported. */
  span: SpanSchema.nullable(),
  /** The source sentence the fact is, like ¶2.3 (criterion 95); none on facts before it. */
  sentenceId: z.string().optional(),
  /** A title sentence no paragraph supports: "Headline claim not in the article" (criterion 96). */
  headline: z.boolean().optional(),
})

export const SlotSchema = z.object({
  text: z.string(),
  factIds: z.array(z.string()),
  factual: z.boolean(),
})

/**
 * The slide layouts every look shares (GD4): the same ids and slot keys in each, so changing a look
 * or a layout maps text by slot key. Cover is a `cover` slide, takeaway a `take`, the rest `body`.
 */
export const LAYOUT_IDS = [
  'cover',
  'picture',
  'number',
  'bars',
  'quote',
  'checklist',
  'bullets',
  'takeaway',
] as const

/**
 * The comic's own layout (RC2): an art box over a caption, kept out of LAYOUT_IDS so the looks'
 * outlines, layout pickers and model answers never offer it to a feed post.
 */
export const COMIC_LAYOUT_IDS = ['panel'] as const

/** The three looks' template ids (GD4), as the idea cards suggest them (templates/index.ts LOOKS). */
export const LOOK_IDS = ['field-notes', 'data-desk', 'postcard'] as const

/** The ten formats a post can take (GD33), in the format file's order (formats/index.ts FORMATS). */
export const FORMAT_IDS = [
  'myth-vs-fact',
  'things-nobody-tells-you',
  'this-or-that',
  'step-by-step',
  'one-idea-per-slide',
  'bullet-points',
  'day-in-the-life',
  'question-and-answer',
  'before-you-go',
  'then-vs-now',
] as const

/**
 * One idea card (GD1): an angle on the source, its hook line, who it is for, and the look and
 * number of slides it suggests. The one definition, read by the ideas record and the drafts.
 */
export const IdeaCardSchema = z.object({
  angle: z.string(),
  hook: z.string(),
  audience: z.string(),
  look: z.enum(LOOK_IDS),
  /** The format the card offers (GD33), from the format file; absent on cards stored before formats. */
  format: z.enum(FORMAT_IDS).optional(),
  slides: z.number().int(),
  /**
   * One of the top three the model ranked when the first cards were found (GD29), shown first and
   * marked "Recommended". False on the cards "More ideas" adds; absent on cards stored before ranks.
   */
  recommended: z.boolean().optional(),
})

/** What a slide does in a post's story (GD32): the jobs an outline gives its slides. */
export const OUTLINE_JOBS = [
  'hook',
  'point',
  'proof',
  'compare',
  'step',
  'takeaway',
  'sources',
] as const

/** How many slides an outline holds; a look narrows it to its own counts (lib/outline.ts). */
export const OUTLINE_SLIDES = { min: 3, max: 10 } as const

/** The longest point an outline slide makes, the model's and the editor's alike. */
export const POINT_MAX = 120

/** One slide of a post's outline (GD32): its job, its layout and the one-line point it makes. */
export const OutlineSlideSchema = z.object({
  job: z.enum(OUTLINE_JOBS),
  layout: z.enum(LAYOUT_IDS),
  point: upTo(POINT_MAX).min(1),
})

export const SlideSchema = z.object({
  kind: z.enum(['cover', 'body', 'take', 'single']),
  slots: z.record(z.string(), SlotSchema),
  /**
   * The look layout the slide uses. Absent on old templates and on slides stored before looks:
   * optional rather than defaulted, so slides built in code before looks need not name one.
   */
  layout: z.enum(LAYOUT_IDS).nullable().optional(),
  /**
   * The art planned for the slide, in words (RC2): a comic panel's scene. Absent on slides stored
   * before it; optional rather than defaulted, as `layout` is, so slides built in code need not name one.
   */
  scene: upTo(300).nullable().optional(),
})

export const StructureSchema = z.object({
  templateId: z.string(),
  slides: z.array(SlideSchema),
  /** Scene, mood and composition only: no words, numbers or brand names (AD-R3). */
  artPrompt: z.string().max(400),
})

export const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
})

export const LimitSchema = z.object({
  /** A `points` slot holds one point per line, each drawn after a bullet mark (GD34), and counts its points. */
  unit: z.enum(['chars', 'words', 'points']),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
})

export const SlotSpecSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** A factual slot must be bound to a supported fact (AD-R2); others read "not a fact · checked". */
  factual: z.boolean(),
  /** Reworded for a market (G5); never carries a fact's number. */
  presentational: z.boolean(),
  limit: LimitSchema,
  font: z.enum(['heading', 'body']),
  /** Starting size in px on the 1080 px canvas; auto-fit may step it down to the legibility floor. */
  fontPx: z.number().positive(),
  lineHeight: z.number().positive(),
  box: BoxSchema,
  mark: z.enum(['none', 'highlight', 'underline']),
})

export const SlideSpecSchema = z.object({
  kind: z.enum(['cover', 'body', 'take', 'single']),
  slots: z.array(SlotSpecSchema),
  /** Where the art goes; text boxes never overlap it, so art never moves a word. */
  artBox: BoxSchema.nullable(),
  sourceLine: z.boolean(),
  /** Which of the preset's colour sets (brands/guideline.ts) a look draws the slide in; old templates keep one theme. */
  surface: z.enum(['base', 'block', 'deep']).default('base'),
  /** The slots sit on a light card over full-bleed art, so they may overlap the artBox. */
  panel: z.boolean().default(false),
})

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  format: z.enum(['single', 'carousel']),
  description: z.string(),
  slides: z.array(
    z.object({
      spec: SlideSpecSchema,
      repeat: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
    }),
  ),
  canvas: z.object({ width: z.literal(1080), height: z.literal(1350) }),
  /** A look (GD4): slides pick their spec from `layouts` by their layout; `slides` is the drafting order. */
  look: z.boolean().default(false),
  /**
   * Partial, so a look frozen into a record before a layout was added (bullets, GD34) still parses;
   * a layout it lacks is read from the look of its id (templates/index.ts findSlideSpec).
   */
  layouts: z
    .partialRecord(z.enum([...LAYOUT_IDS, ...COMIC_LAYOUT_IDS]), SlideSpecSchema)
    .optional(),
  /**
   * A look's sources slide (GD31): a heading and one row per source, drawn by code after the last
   * slide when the post's sources go on a slide of their own. Looks frozen before it lack it.
   */
  sourcesLayout: SlideSpecSchema.optional(),
})

export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  bg: z.string().regex(/^#[0-9A-F]{6}$/i),
  ink: z.string().regex(/^#[0-9A-F]{6}$/i),
  highlight: z.string().regex(/^#[0-9A-F]{6}$/i),
  /** The words drawn on the highlight, where they are not in `ink` (Pop's deep blue: ink on yellow). */
  highlightInk: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  muted: z.string().regex(/^#[0-9A-F]{6}$/i),
})

export const BrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['feed', 'page']),
  fonts: z.object({
    heading: z.object({ family: z.string(), file: z.string() }),
    body: z.object({ family: z.string(), file: z.string() }),
  }),
  tone: z.string(),
  byline: z.string(),
  themes: z.array(ThemeSchema).min(1),
  /** The page's Instagram account (ADR-124); none for the feed, and for brands frozen before it. */
  instagram: z
    .object({ handle: z.string().regex(/^[a-z0-9._]{1,30}$/), url: z.url() })
    .nullable()
    .default(null),
  /**
   * The page's LinkedIn page, for a blog's "Follow us" (BR9): https only, since it becomes a link.
   * The addresses are placeholders until the pages are named (intent open question 1).
   */
  linkedin: z
    .object({ url: z.url({ protocol: /^https$/ }) })
    .nullable()
    .default(null),
})

export const FitCheckSchema = z.object({
  check: z.enum(['length', 'box', 'glyph', 'contrast', 'legibility']),
  slide: z.number().int().nullable(),
  slot: z.string().nullable(),
  value: z.number(),
  limit: z.string(),
  pass: z.boolean(),
  /** The row as shown, e.g. "Slide 2 · 121 words (30–70) · Over". */
  label: z.string(),
})

export const LaidLineSchema = z.object({
  slot: z.string(),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  fontPx: z.number(),
  font: z.enum(['heading', 'body']),
  mark: z.enum(['none', 'highlight', 'underline']),
  width: z.number(),
  /** The first row of a point in a `points` slot (GD34): a bullet mark is drawn before it. Absent on every other row. */
  bullet: z.boolean().optional(),
  /** The first row of a look's checklist item: a tick is drawn before it. Absent on every other row and on layouts stored before ticks. */
  tick: z.boolean().optional(),
})

/** The slot key of the search line's rows on a post's last slide (ADR-131); no template slot uses it. */
export const SEARCH_SLOT = 'search'

/** The slot key of the rows of the last slide's "Sources: …" line (GD31); no template slot uses it. */
export const SOURCES_SLOT = 'sources'

export const LaidSlideSchema = z.object({
  kind: z.enum(['cover', 'body', 'take', 'single']),
  lines: z.array(LaidLineSchema),
  artBox: BoxSchema.nullable(),
  sourceLine: z.string().nullable(),
  /** The whole source line when the slide shortened it to fit beside its frame, for the feed card (criterion 71). */
  fullSourceLine: z.string().optional(),
  /** "To find this again, search “OfCourse <title>”" on the last slide (ADR-131); layouts stored before it parse as none. */
  searchLine: z.string().nullable().default(null),
  /** A look's slide only (absent on old templates, so their layouts are unchanged): the spec's surface. */
  surface: z.enum(['base', 'block', 'deep']).optional(),
  /** A look's panel layout only: the card under the slots, from the top of their text down past the foot row, plus padding. */
  panel: BoxSchema.optional(),
  /**
   * A panel slide's text moved down by this much to stack against the foot row; absent when it did
   * not move (every other look, a cover, layouts stored before it). Hotspots over the slot boxes add it.
   */
  shift: z.number().positive().optional(),
  /** A look's slide only: its place in the post, for the slide dots and the swipe cue (GD6). */
  frame: z
    .object({
      slide: z.number().int().positive(),
      total: z.number().int().positive(),
      /** The swipe cue in the post's language when it is not English (GD39); absent is "Swipe". */
      swipe: z.string().min(1).optional(),
    })
    .optional(),
})

export const SlotFitSchema = z.object({
  slide: z.number().int(),
  slot: z.string(),
  fontPx: z.number(),
  lines: z.number().int(),
  maxLines: z.number().int(),
  fits: z.boolean(),
})

export const ClaimResultSchema = z.object({
  text: z.string(),
  slide: z.number().int(),
  slot: z.string(),
  result: z.enum(['found', 'not_found', 'opinion']),
  ref: z.string().nullable(),
  /**
   * A hash of what the sentence was read against (ai/source-check.ts): the same sentence on the
   * same basis is not read again. None on results before 9 Oct 2026, which are always read again.
   */
  basis: z.string().optional(),
  /** For a sentence not found, the source sentence it should match (criterion 104). */
  suggestion: z.object({ ref: z.string(), text: z.string() }).optional(),
})

export const LAYERS = ['general', 'featured', 'personal'] as const

/** Where a post's sources go (GD31): the caption only, a line on the last slide, or a slide of their own. */
export const SOURCES_AT = ['caption', 'last_slide', 'sources_slide'] as const
export type SourcesAt = (typeof SOURCES_AT)[number]

export const FeedSettingsSchema = z.object({
  layer: z.enum(LAYERS),
  audience: z.object({ mode: z.enum(['everyone', 'matched']), rules: z.array(z.string()) }),
  whyLine: upTo(140).nullable(),
  expiry: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({ kind: z.literal('days'), days: z.union([z.literal(30), z.literal(90)]) }),
    z.object({ kind: z.literal('date'), date: z.iso.date() }),
  ]),
  studioLink: z.string().max(60).nullable(),
  /** Tag ids from the tag file (ADR-122); rows saved before Task 38 parse as none. */
  tags: z.array(z.string()).default([]),
  /** Where the sources go (GD31); settings saved before it parse as the caption. */
  sourcesAt: z.enum(SOURCES_AT).default('caption'),
})

export const PersonStampSchema = z.object({
  userId: z.string(),
  name: z.string(),
  at: z.iso.datetime(),
})

/**
 * A currency conversion is a fact with its own rate source and date (AD-R7). The pair defaults to
 * the one every version before ADR-123 converted, so stored bodies still parse.
 */
export const ConversionSchema = z.object({
  factId: z.string(),
  from: z.string(),
  to: z.string(),
  rate: z.number().positive(),
  rateSource: z.string(),
  rateDate: z.iso.date(),
  fromCurrency: z.string().default('AUD'),
  toCurrency: z.string().default('NPR'),
})

export const RenderedSlideSchema = z.object({ svgAssetId: z.string(), pngAssetId: z.string() })

/**
 * The image in one slide's art box (GD12–GD14): the scene it was drawn from, which take it is, the
 * nudge that made it, or why there is none ('daily_limit': the day's image cap refused the call).
 */
export const SlideArtSchema = z.object({
  slide: z.number().int().positive(),
  assetId: z.string().nullable(),
  scene: z.string(),
  take: z.number().int().positive(),
  nudge: z.string().nullable(),
  fallback: z.enum(['no_art', 'daily_limit']).nullable(),
})

/** Where a blog's picture sits (BR4): its cover, or after a section, counted from 1. */
export const BlogTargetSchema = z.union([
  z.literal('cover'),
  z.object({ after: z.number().int().positive() }),
])

/**
 * One of a blog's pictures (BR4): a slide's image by its number in the plan (1 the cover, then the
 * inline ones in section order), with its place, and its picture tinted to the brand palette
 * (GD16) beside the original, null when there is none.
 */
export const BlogPictureSchema = SlideArtSchema.extend({
  target: BlogTargetSchema,
  tintedAssetId: z.string().nullable(),
})

/** The most pictures between a blog's sections, and the most posts' slides it embeds (BR4). */
export const BLOG_INLINE_MAX = 3

/** A linked live post whose slides sit after a section of a blog, in place of a picture there (BR4). */
export const BlogEmbedSchema = z.object({
  after: z.number().int().positive(),
  postId: z.string().min(1),
})

export type Paragraph = z.infer<typeof ParagraphSchema>
export type Span = z.infer<typeof SpanSchema>
export type Fact = z.infer<typeof FactSchema>
export type Slot = z.infer<typeof SlotSchema>
export type LayoutId = (typeof LAYOUT_IDS)[number]
export type LookId = (typeof LOOK_IDS)[number]
export type FormatId = (typeof FORMAT_IDS)[number]
export type IdeaCard = z.infer<typeof IdeaCardSchema>
export type OutlineJob = (typeof OUTLINE_JOBS)[number]
export type OutlineSlide = z.infer<typeof OutlineSlideSchema>
export type Slide = z.infer<typeof SlideSchema>
export type Structure = z.infer<typeof StructureSchema>
export type Box = z.infer<typeof BoxSchema>
export type SlotSpec = z.infer<typeof SlotSpecSchema>
export type SlideSpec = z.infer<typeof SlideSpecSchema>
export type Template = z.infer<typeof TemplateSchema>
export type Theme = z.infer<typeof ThemeSchema>
export type Brand = z.infer<typeof BrandSchema>
export type FitCheck = z.infer<typeof FitCheckSchema>
export type LaidLine = z.infer<typeof LaidLineSchema>
export type LaidSlide = z.infer<typeof LaidSlideSchema>
export type SlotFit = z.infer<typeof SlotFitSchema>
export type ClaimResult = z.infer<typeof ClaimResultSchema>
export type FeedSettings = z.infer<typeof FeedSettingsSchema>
export type PersonStamp = z.infer<typeof PersonStampSchema>
export type Conversion = z.infer<typeof ConversionSchema>
export type RenderedSlide = z.infer<typeof RenderedSlideSchema>
export type SlideArt = z.infer<typeof SlideArtSchema>
export type BlogTarget = z.infer<typeof BlogTargetSchema>
export type BlogPicture = z.infer<typeof BlogPictureSchema>
export type BlogEmbed = z.infer<typeof BlogEmbedSchema>
