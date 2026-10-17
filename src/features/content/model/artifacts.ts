// The immutable records a post is made of. Each is written once, identified by a hash of its
// kind, post and body (server/hash.ts), and never changed. A post is a row of pointers to them;
// model/current.ts decides which pointed-to records still link up and so count.

import { z } from 'zod'
import {
  ARTIFACT_KINDS,
  type ArtifactKind,
  type Pointers,
  PointersSchema,
} from '@/shared/lib/db/content-shapes'
import { LANGUAGE_IDS } from '../languages'
import { MARKET_IDS } from '../markets'
import { charCount } from '../text/script'
import {
  BLOG_INLINE_MAX,
  BlogEmbedSchema,
  BlogPictureSchema,
  BlogTargetSchema,
  BrandSchema,
  ClaimResultSchema,
  ConversionSchema,
  FactSchema,
  FeedSettingsSchema,
  FitCheckSchema,
  FORMAT_IDS,
  IdeaCardSchema,
  LaidSlideSchema,
  OUTLINE_SLIDES,
  OutlineSlideSchema,
  ParagraphSchema,
  PersonStampSchema,
  RenderedSlideSchema,
  SlideArtSchema,
  SlotFitSchema,
  StructureSchema,
  TemplateSchema,
  upTo,
} from './types'

const id = z.string().min(1)

/**
 * How much "Make post" takes (GD18): links, the framing line's and the notes' characters; and
 * the characters of an idea to find sources for (BR12).
 */
export const SOURCE_LIMITS = { links: 5, framing: 200, notes: 2000, idea: 200 } as const
/** Its refusals, the same in the form and on the server. */
export const SOURCE_ERRORS = {
  links: 'Up to five links.',
  empty: 'Paste a link or some text.',
  framing: 'Keep it to 200 characters.',
  both: 'Use either links or pasted text.',
  /** What a link that could not be read is listed with, whatever the reason (GD19). */
  unread: 'Could not read this page',
  ideaEmpty: 'Write the idea to find sources for.',
  ideaLength: 'Keep the idea to 200 characters.',
  ideaLink: 'Write the idea in words, not as a link.',
} as const

/** Text that is a web address and nothing else. */
const ONLY_A_LINK = /^https?:\/\/\S+$/i

/**
 * Why text searched with Google (an idea, BR12; a claim to research, BR14) is refused, in the
 * caller's words, or null: trimmed, 1 to 200 characters, and more than a link. Digits and quote
 * marks are fine ("20 hours", "subclass 500"): it is search text, never an image prompt.
 */
export function searchTextError(
  text: string,
  errors: { empty: string; length: string; link: string },
): string | null {
  const trimmed = text.trim()
  if (trimmed === '') return errors.empty
  if (charCount(trimmed) > SOURCE_LIMITS.idea) return errors.length
  return ONLY_A_LINK.test(trimmed) ? errors.link : null
}

/**
 * The framing line as the source stores it (GD20): the refusal and the stored body count its
 * characters the same way, as a reader sees them, and so does the form.
 */
export const FramingSchema = upTo(SOURCE_LIMITS.framing)

/** A link read into a source (GD19): where it came from, and the paragraphs its text fills. */
export const SourcePartSchema = z.object({
  url: z.string(),
  site: z.string(),
  title: z.string(),
  from: z.number().int().positive(),
  to: z.number().int().positive(),
})
export type SourcePart = z.infer<typeof SourcePartSchema>

/** The steps a reviewer's request for changes names (criterion 120). */
export const SEND_BACK_STEPS = ['structures', 'covers', 'settings'] as const
export type SendBackStep = (typeof SEND_BACK_STEPS)[number]

export const BODIES = {
  source: z.object({
    title: upTo(200).min(1),
    kind: z.string().min(1).max(60),
    text: z.string(),
    paragraphs: z.array(ParagraphSchema),
    /** Set only when the pasted text is a demo source exactly: its failures may replay. */
    demoKey: z.string().nullable(),
    /** A source read from a link (criterion 94): the page's address, and its site for the source line. */
    url: z.string().optional(),
    site: z.string().optional(),
    /**
     * One per link read (GD19), in order: its paragraphs are ¶from to ¶to of the one sequence all
     * parts' paragraphs run in. None on a pasted source or one made before 12 Oct 2026.
     */
    parts: z.array(SourcePartSchema).optional(),
    /**
     * A source made from a live blog (BR6): the headings of its sections, one per part, in order.
     * The idea cards are drawn from them. None on any other source.
     */
    blogSections: z.array(z.string()).max(8).optional(),
    /** The links that could not be read, each with why. */
    failed: z.array(z.object({ url: z.string(), error: z.string() })).optional(),
    /** The editor's framing line (GD20): the story the post should tell. */
    framing: FramingSchema.nullable().optional(),
    /** The editor's own notes (GD21): opinion, never a fact, never source text. */
    notes: upTo(SOURCE_LIMITS.notes).nullable().optional(),
    /** The language the post is written in (GD36); a source made before languages is English. */
    language: z.enum(LANGUAGE_IDS).default('en'),
  }),
  facts: z.object({
    sourceId: id,
    keyIdeas: z.array(z.string()).max(3),
    facts: z.array(FactSchema),
    replays: z.array(z.string()),
  }),
  drafts: z.object({
    factsId: id,
    attempt: z.number().int().positive(),
    /**
     * The versions, flattened: three per ticked template in template order (criterion 97); the
     * post's `picked` pointer is an index into this list. Rows before 9 Oct 2026 hold one per
     * template with no angle or problems: read `angle ?? ''` and `problems ?? []`.
     */
    items: z.array(
      z.object({
        structure: StructureSchema,
        template: TemplateSchema,
        /** The version's angle, as the model labelled it. */
        angle: z.string().optional(),
        /** What still failed verification when the ladder gave up; such a version cannot be picked. */
        problems: z.array(z.string()).optional(),
      }),
    ),
    replays: z.array(z.string()),
    /** The emotion the editor chose (emotions/index.ts, `emotionOf`); none on rows before criterion 100. */
    emotion: z.string().nullable().default(null),
    /** What made this record, as the history shows it: "Drafted", "Slide 2 edited"; none on rows before criterion 101. */
    note: z.string().nullable().default(null),
    /**
     * The idea card the versions were drafted for, or up to four combined (GD2). None on rows before
     * ideas and on drafts from ticked templates: read `idea ?? null`. Optional rather than
     * defaulted, so the drafts built before ideas need not name one.
     */
    idea: z
      .object({ cards: z.array(IdeaCardSchema).min(1).max(4) })
      .nullable()
      .optional(),
  }),
  /**
   * The idea cards offered for the facts (GD1, GD3): each "More ideas" press writes a new record
   * with the cards shown before and the new ones after, and `rounds` counts the calls.
   * `formats` are the three formats the first cards' call ranked best for the source, best first
   * (GD33); none on records from before formats.
   */
  ideas: z.object({
    factsId: id,
    cards: z.array(IdeaCardSchema).max(12),
    rounds: z.number().int().positive(),
    formats: z.array(z.enum(FORMAT_IDS)).max(3).optional(),
  }),
  /**
   * A post's slide-by-slide outline (GD32), made when an idea is picked and shaped by the editor
   * before any text is written: each slide's job, layout and point, in the first card's look. The
   * drafts follow it. `format` is the format it takes (GD33): the picked card's, or the one the
   * editor changed it to; none on outlines from before formats and for cards without one. `note`
   * says what made the record: "Outlined", "Slide 3 moved". `attempt` counts the outline calls
   * since the pick, so a format changed outlines again rather than reading the cache; none is 1.
   */
  post_outline: z.object({
    factsId: id,
    ideas: z.array(IdeaCardSchema).min(1).max(4),
    format: z.enum(FORMAT_IDS).nullable(),
    attempt: z.number().int().positive().optional(),
    slides: z.array(OutlineSlideSchema).min(OUTLINE_SLIDES.min).max(OUTLINE_SLIDES.max),
    note: z.string(),
  }),
  /**
   * A blog's outline (BR2), made from its facts and shaped by the editor before any text is
   * written: its sections, takeaways and questions, each with the point it makes. `idea` is the
   * card it was outlined for, or none; `note` says what made the record.
   */
  blog_outline: z.object({
    factsId: id,
    idea: IdeaCardSchema.nullable(),
    sections: z
      .array(z.object({ heading: z.string().min(1), point: z.string().min(1) }))
      .min(1)
      .max(8),
    takeaways: z.array(z.string().min(1)).min(3).max(5),
    faq: z
      .array(z.object({ q: z.string().min(1), point: z.string().min(1) }))
      .min(3)
      .max(5),
    note: z.string().nullable(),
  }),
  /** A blog's text written from one outline (BR3): each section and answer names the facts it rests on. */
  blog_text: z.object({
    outlineId: id,
    sections: z.array(
      z.object({ heading: z.string(), body: z.string(), factIds: z.array(z.string()) }),
    ),
    takeaways: z.array(z.string()),
    faq: z.array(z.object({ q: z.string(), a: z.string(), factIds: z.array(z.string()) })),
    emotion: z.string().nullable(),
    note: z.string().nullable(),
  }),
  /**
   * A post linked to a blog (BR6–BR8): made from the blog, linked to it after, or unlinked from
   * it; the history of linking, on the post.
   */
  blog_link: z.object({
    kind: z.enum(['from_blog', 'linked', 'unlinked']),
    blogId: id,
    postId: id,
  }),
  /**
   * The images planned in words for one revision (GD12): a scene per art-box slide, or one
   * panorama. Or for a blog's approved text (BR4), which has no revision: a scene per picture,
   * each with its place. Linked to exactly one of the two.
   */
  art_plan: z
    .object({
      revisionId: id.optional(),
      blogTextId: id.optional(),
      scenes: z.array(
        z.object({
          slide: z.number().int().positive(),
          scene: z.string(),
          /**
           * The picture this scene keeps from an earlier revision whose slide had the very same
           * text (story 14), so "Draw images" draws it only when the scene is edited; absent on a
           * scene to draw.
           */
          assetId: z.string().optional(),
          /** Where a blog's picture sits; absent on a post's slides. */
          target: BlogTargetSchema.optional(),
        }),
      ),
      panorama: z.boolean(),
      /** A scene is in the editor's words (editImageScene), so "Plan again" asks first; absent on a model's plan. */
      edited: z.boolean().optional(),
    })
    .refine((b) => (b.revisionId === undefined) !== (b.blogTextId === undefined), {
      message: 'An image plan is for a revision or a blog text',
    }),
  /**
   * A blog's pictures for one approved text (BR4): the cover and the inline ones as drawn, each
   * with its original and tinted copy; `version` counts the art drawn again, so each new take is
   * its own image call. `embeds` are linked live posts whose slides sit after a section, in place
   * of a picture there.
   */
  blog_images: z.object({
    blogTextId: id,
    version: z.number().int().positive(),
    images: z.array(BlogPictureSchema),
    embeds: z.array(BlogEmbedSchema).max(BLOG_INLINE_MAX),
  }),
  /** The approved wording, with frozen copies of its template and brand. */
  revision: z.object({
    factsId: id,
    structure: StructureSchema,
    template: TemplateSchema,
    brand: BrandSchema,
    themeId: z.string(),
    by: PersonStampSchema,
    /** What made this revision: "approved", "light edit: phrase", "reorder", "social: Cerebral". */
    note: z.string(),
    /** The drafts' emotion, carried onto every version (criterion 100); none on earlier rows. */
    emotion: z.string().nullable().default(null),
  }),
  layout: z.object({
    revisionId: id,
    slides: z.array(LaidSlideSchema),
    fits: z.array(SlotFitSchema),
    fitChecks: z.array(FitCheckSchema),
  }),
  render: z.object({
    revisionId: id,
    layoutId: id,
    art: z.object({
      assetId: z.string().nullable(),
      prompt: z.string(),
      version: z.number().int().positive(),
      /** 'daily_limit': no art because the day's image cap refused the call (criterion 6). */
      fallback: z.enum(['replay', 'no_art', 'daily_limit']).nullable(),
    }),
    slides: z.array(RenderedSlideSchema),
    /** An image per art box (GD12); a render without it draws its single `art` (renders before it). */
    slideArt: z.array(SlideArtSchema).optional(),
    /** One wide image cut into a window per slide (Postcard, GD4). */
    panorama: z.object({ assetId: z.string() }).nullable().optional(),
    /** The post's page a look's images were drawn for (story 14); absent before 13 Oct 2026. */
    pageBrandId: z.string().nullable().optional(),
  }),
  /**
   * What the source check found, linked to the text it read: an approved revision, or before
   * approval (criterion 98) the picked version of one drafts record, with revisionId null, or a
   * blog's text (BR3), with revisionId null. Every check before 9 Oct 2026 names a revision.
   */
  source_check: z.object({
    revisionId: id.nullable(),
    draft: z.object({ draftsId: id, index: z.number().int().nonnegative() }).optional(),
    blogTextId: id.optional(),
    claims: z.array(ClaimResultSchema),
    replays: z.array(z.string()),
  }),
  /**
   * A slide vision check, written before 9 Oct 2026. Nothing writes or reads one any more
   * (criterion 103); the kind stays so those rows still load.
   */
  vision: z.object({
    renderId: id,
    readable: z.boolean(),
    figuresMatch: z.boolean(),
    strayText: z.boolean(),
    notes: z.string(),
    replays: z.array(z.string()),
  }),
  /**
   * A reviewer's recorded decision to publish a render, or a market version, that the vision check
   * flagged (visionId names that vision) or never read: "Not checked" (visionId null). renderId
   * names the render, or the market version's market record, either way. Overrides written before
   * 6 Oct 2026 carry no renderId; each names a vision. None is written after 9 Oct 2026 (103).
   */
  override: z.object({
    visionId: id.nullable(),
    renderId: id,
    reason: upTo(200).min(1),
    by: PersonStampSchema,
  }),
  settings: FeedSettingsSchema,
  /**
   * A reviewer's "Request changes" (criterion 120): the note, and the step it names; none on
   * records written before 12 Oct 2026, which count only for their revision (model/current.ts).
   */
  send_back: z
    .object({
      /** The revision the reviewer read, or a blog's text (BR5), which has none: exactly one. */
      revisionId: id.optional(),
      blogTextId: id.optional(),
      reason: upTo(200).min(1),
      by: PersonStampSchema,
      step: z.enum(SEND_BACK_STEPS).nullable().default(null),
    })
    .refine((b) => (b.revisionId === undefined) !== (b.blogTextId === undefined), {
      message: 'A request for changes names a revision or a blog text',
    }),
  /**
   * What the reviewer approved, pinned by id: publishing points here. A feed post's names its
   * revision and render; a blog's (BR5), which has neither, its text and pictures.
   */
  approval: z
    .object({
      revisionId: id.optional(),
      renderId: id.optional(),
      sourceCheckId: id,
      settingsId: id,
      /** The slide vision check and its override; null on approvals from 9 Oct 2026 (103). */
      visionId: z.string().nullable(),
      overrideId: z.string().nullable(),
      marketId: z.string().nullable(),
      /** The market version's vision and override; absent on approvals written before 6 Oct 2026. */
      marketVisionId: z.string().nullable().optional(),
      marketOverrideId: z.string().nullable().optional(),
      /** The post's page when published, so Discard brings it back (119); absent before 13 Oct 2026. */
      pageBrandId: z.string().nullable().optional(),
      /**
       * A blog's approved text (BR3, BR5): a blog has no revision, so its approval pins the text it
       * read. Absent on a feed post's approval.
       */
      blogTextId: z.string().nullable().optional(),
      /** A blog's pictures and embedded posts as approved (BR4, BR5); absent on a feed post's approval. */
      blogImagesId: z.string().nullable().optional(),
      by: PersonStampSchema,
      selfReviewed: z.boolean(),
    })
    .refine(
      (b) =>
        (b.revisionId !== undefined && b.renderId !== undefined) !==
        ((b.blogTextId ?? null) !== null),
      { message: 'An approval names a revision and render, or a blog text' },
    ),
  /** A market version, drawn from one render's art: it counts only while that render is current. */
  market: z.object({
    revisionId: id,
    renderId: id,
    market: z.enum(MARKET_IDS),
    slots: z.array(z.object({ slide: z.number().int(), slot: z.string(), text: z.string() })),
    feedExcerpt: z.string(),
    conversions: z.array(ConversionSchema),
    layout: z.array(LaidSlideSchema),
    fitChecks: z.array(FitCheckSchema),
    slides: z.array(RenderedSlideSchema),
    replays: z.array(z.string()),
    /** Whether the model reworded the presentational slots (criterion 110); absent, and so false, on versions made before 9 Oct 2026. */
    reworded: z.boolean().optional(),
  }),
  caption: z.object({
    renderId: id,
    platform: z.enum(['instagram', 'linkedin']),
    text: z.string(),
    hashtags: z.array(z.string()).max(8),
    approvedText: z.string(),
    approvedHashtags: z.array(z.string()).max(8),
    checked: z.boolean(),
    notFound: z.array(z.string()),
  }),
  export: z.object({ renderId: id, captionId: id, fileName: z.string(), by: PersonStampSchema }),
  /**
   * The cover options made for one revision (criterion 102), newest last: each "Make covers" or
   * "Another set" press adds three (`set` counts the presses) to the ones before, keeping the
   * newest twelve. An option has art (`assetId`, and `previewAssetId`: the cover slide drawn with
   * it) or none, labelled by `fallback` as a render's art is.
   */
  covers: z.object({
    revisionId: id,
    options: z.array(
      z.object({
        assetId: z.string().nullable(),
        previewAssetId: z.string().nullable(),
        prompt: z.string(),
        set: z.number().int().positive(),
        fallback: z.enum(['replay', 'no_art', 'daily_limit']).nullable(),
      }),
    ),
    /** The post's page the art was drawn for (criterion 105); absent before 13 Oct 2026. */
    pageBrandId: z.string().nullable().optional(),
  }),
  /** Where the exported Instagram version was posted, added by hand after posting (ADR-124). */
  social_link: z.object({
    exportId: id,
    platform: z.literal('instagram'),
    url: z.url(),
    by: PersonStampSchema,
  }),
  /**
   * A live feed post shared to the pages' accounts (criteria 9–11), by account id per network
   * (model/share.ts SHARE_ACCOUNTS), at least one; nothing is posted. Sharing again is another.
   */
  share: z
    .object({
      instagram: z.array(z.string().max(64)).max(20),
      linkedin: z.array(z.string().max(64)).max(20),
      by: PersonStampSchema,
    })
    .refine((b) => b.instagram.length + b.linkedin.length > 0),
} as const satisfies Record<ArtifactKind, z.ZodType>

export { ARTIFACT_KINDS, type ArtifactKind, type Pointers, PointersSchema }
export type Body<K extends ArtifactKind> = z.infer<(typeof BODIES)[K]>
export type Artifact<K extends ArtifactKind = ArtifactKind> = {
  id: string
  kind: K
  postId: string
  body: Body<K>
  createdAt: string
  createdByUserId: string | null
}

export function emptyPointers(): Pointers {
  return {
    sourceId: null,
    factsId: null,
    draftsId: null,
    ticked: [],
    picked: null,
    themeId: null,
    revisionId: null,
    layoutId: null,
    renderId: null,
    sourceCheckId: null,
    visionId: null,
    overrideId: null,
    settingsId: null,
    sendBackId: null,
    approvalId: null,
    marketId: null,
    marketVisionId: null,
    marketOverrideId: null,
    captionId: null,
    exportId: null,
    socialLinkId: null,
    coversId: null,
    pageBrandId: null,
    ideasId: null,
    artPlanId: null,
    outlineId: null,
    blogOutlineId: null,
    blogTextId: null,
    blogImagesId: null,
    social: null,
  }
}
