// The shapes the content tables store, which the schema checks: the stages a post can be at, the
// kinds of record, and the post's pointers. One definition each; the content feature's model
// (src/features/content/model) re-exports them, so feature code keeps its imports. No feature
// imports here: shared code sits under every feature.

import { z } from 'zod'

/** Where a post is in its life (the board's columns are in the feature's model/stages.ts). */
export const STAGES = [
  'source',
  'structures',
  'approved',
  'rendered',
  'in_review',
  'ready',
  'live',
  'exported',
] as const
export type Stage = (typeof STAGES)[number]

/** The kinds of immutable record a post is made of; each has its body schema in the feature. */
export const ARTIFACT_KINDS = [
  'source',
  'facts',
  'drafts',
  'revision',
  'layout',
  'render',
  'source_check',
  'vision',
  'override',
  'settings',
  'send_back',
  'approval',
  'market',
  'caption',
  'export',
  'social_link',
  'covers',
  'ideas',
  'art_plan',
  'post_outline',
  'blog_outline',
  'blog_text',
  'blog_link',
  'blog_images',
] as const
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number]

const ref = z.string().nullable()

/** The post's pointers: the only mutable part of a post, saved with its version. */
export const PointersSchema = z.object({
  sourceId: ref,
  factsId: ref,
  draftsId: ref,
  ticked: z.array(z.string()).max(3),
  picked: z.number().int().nonnegative().nullable(),
  themeId: ref,
  revisionId: ref,
  layoutId: ref,
  renderId: ref,
  sourceCheckId: ref,
  visionId: ref,
  overrideId: ref,
  settingsId: ref,
  sendBackId: ref,
  approvalId: ref,
  marketId: ref,
  /** The Nepal version's own vision and override; absent on posts saved before 6 Oct 2026. */
  marketVisionId: ref.default(null),
  marketOverrideId: ref.default(null),
  captionId: ref,
  exportId: ref,
  /** The post's Instagram URL once posted (ADR-124); absent on posts saved before 7 Oct 2026. */
  socialLinkId: ref.default(null),
  /** The cover options made for the post's revision (criterion 102); absent before 9 Oct 2026. */
  coversId: ref.default(null),
  /**
   * The page the post is made for (criterion 105): a page brand's id, chosen at "Make post" and
   * changeable before approval; its design language steers the drafts and covers. None is null,
   * and posts saved before 9 Oct 2026 have no key: read `pageBrandId ?? null`.
   */
  pageBrandId: ref.default(null),
  /** The idea cards offered after the facts (GD1); absent on posts saved before 13 Oct 2026. */
  ideasId: ref.default(null),
  /** The images planned in words for the revision (GD12); absent on posts saved before it. */
  artPlanId: ref.default(null),
  /** The post's slide-by-slide outline (GD32); absent on posts saved before it. */
  outlineId: ref.default(null),
  /**
   * A blog's outline (BR2) and the text (BR3) written from it; absent on posts saved before blogs.
   * Named apart from `outlineId`, which is a post's slide outline.
   */
  blogOutlineId: ref.default(null),
  blogTextId: ref.default(null),
  /** A blog's drawn pictures and embedded posts (BR4); absent on posts saved before them. */
  blogImagesId: ref.default(null),
  social: z.object({ brandId: z.string(), platform: z.enum(['instagram', 'linkedin']) }).nullable(),
})
export type Pointers = z.infer<typeof PointersSchema>
