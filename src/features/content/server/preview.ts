import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/lib/db'
import { contentArtifact, contentPost } from '@/shared/lib/db/schema'
import { FEED_BRAND } from '../brands'
import type { LanguageId } from '../languages'
import { layoutStructure, paragraphSites } from '../layout/engine'
import { fitChecks } from '../layout/fit'
import { toPng } from '../layout/png'
import { slideColours, svgSlides } from '../layout/svg'
import { searchTitleOf } from '../lib/comic-rules'
import type { ArtifactKind, Body } from '../model/artifacts'
import type { Fact, FitCheck } from '../model/types'
import { bodyOf } from './store'

// Previews drawn by the same engine as the render: layoutStructure, then svgSlides with an empty
// art box, then toPng, on the inputs approveStructure (./commands/structures.ts) lays out. Ids are the
// caller's, so every record is read by its id, its kind and the post it must belong to.

/** One record of a post by id and kind, or null when it is missing or another post's. */
async function recordOf<K extends ArtifactKind>(
  postId: string,
  id: string,
  kind: K,
): Promise<Body<K> | null> {
  const [row] = await db
    .select({ body: contentArtifact.body })
    .from(contentArtifact)
    .where(
      and(
        eq(contentArtifact.id, id),
        eq(contentArtifact.postId, postId),
        eq(contentArtifact.kind, kind),
      ),
    )
    .limit(1)
  // Through its schema, so an older body reads in the current shape; one that no longer parses is none.
  return row ? bodyOf(kind, row.body, id) : null
}

/**
 * PNG of one slide of a draft, laid out exactly as approval would lay it out, with an empty art
 * box: `planned` (scenes by slide index) writes the slide's planned scene in it (GD12). Without
 * it, a slide's own scene does (a comic panel's, RC2); the drafts id names the scenes with the text.
 */
export async function draftPreviewPng(input: {
  postId: string
  draftsId: string
  index: number
  slide: number
  themeId: string | null
  planned?: (string | null)[]
}): Promise<Uint8Array | null> {
  const { postId, draftsId, index, slide, themeId, planned } = input
  const drafts = await recordOf(postId, draftsId, 'drafts')
  const item = drafts?.items[index]
  const colours = item
    ? slideColours({ template: item.template, brand: FEED_BRAND, themeId })
    : null
  if (!drafts || !item || !colours) return null
  const facts = await recordOf(postId, drafts.factsId, 'facts')
  const source = facts ? await recordOf(postId, facts.sourceId, 'source') : null
  const [post] = await db
    .select({ courseId: contentPost.courseId, title: contentPost.title })
    .from(contentPost)
    .where(eq(contentPost.id, postId))
    .limit(1)
  if (!facts || !source || !post) return null

  const laid = layoutStructure({
    structure: item.structure,
    template: item.template,
    brand: FEED_BRAND,
    sourceTitle: source.title,
    title: searchTitleOf(post, source.title),
    sourceSite: source.site,
    sites: paragraphSites(source),
    facts: facts.facts,
    language: source.language,
  })
  if (!Number.isInteger(slide) || slide < 1 || slide > laid.slides.length) return null
  const [svg] = svgSlides({
    layout: [laid.slides[slide - 1]],
    ...colours,
    brand: FEED_BRAND,
    art: null,
    planned: [(planned ?? item.structure.slides.map((s) => s.scene || null))[slide - 1] ?? null],
  })
  return toPng(svg, FEED_BRAND)
}

/**
 * PNG of one slide of an approved layout before render (empty art box, or its planned scene from
 * `planned`, by slide index), from the revision's frozen brand and theme.
 */
export async function layoutPreviewPng(input: {
  postId: string
  layoutId: string
  slide: number
  planned?: (string | null)[]
}): Promise<Uint8Array | null> {
  const { postId, layoutId, slide, planned } = input
  const layout = await recordOf(postId, layoutId, 'layout')
  const revision = layout ? await recordOf(postId, layout.revisionId, 'revision') : null
  if (!layout || !revision) return null
  const colours = slideColours({
    template: revision.template,
    brand: revision.brand,
    themeId: revision.themeId,
  })
  const laid = layout.slides[slide - 1]
  if (!colours || !Number.isInteger(slide) || !laid) return null
  const [svg] = svgSlides({
    layout: [laid],
    ...colours,
    brand: revision.brand,
    art: null,
    planned: [planned?.[slide - 1] ?? null],
  })
  return toPng(svg, revision.brand)
}

/**
 * The scenes of one of the post's image plans as `planned` for its layout (GD12), by slide index:
 * each planned slide's scene, a panorama's one scene on every art-box slide, null elsewhere. Null
 * when the plan or the layout is missing or another post's, or the plan is for other text.
 */
export async function plannedScenes(
  postId: string,
  planId: string,
  layoutId: string,
): Promise<(string | null)[] | null> {
  const [plan, layout] = await Promise.all([
    recordOf(postId, planId, 'art_plan'),
    recordOf(postId, layoutId, 'layout'),
  ])
  if (!plan || !layout || plan.revisionId !== layout.revisionId) return null
  return layout.slides.map((slide, i) => {
    if (slide.artBox === null) return null
    if (plan.panorama) return plan.scenes[0]?.scene ?? null
    return plan.scenes.find((s) => s.slide === i + 1)?.scene ?? null
  })
}

/**
 * The fit checks of each draft with the given theme (the brand's first theme when none is chosen
 * or the brand lacks it), a look's contrast on its preset's surfaces (GD9): what the workbench
 * shows before approval. `title` is the one the search line names (searchTitleOf), the source
 * title when absent. Its fixed lines are in the post's `language` (GD39), English when absent.
 */
export function draftFitChecks(
  drafts: Body<'drafts'>,
  themeId: string | null,
  facts: Fact[],
  sourceTitle: string,
  title?: string,
  language?: LanguageId,
): FitCheck[][] {
  return draftLayouts(drafts, themeId, facts, sourceTitle, title, language).checks
}

/**
 * As `draftFitChecks`, from the same one layout per draft, with how far each slide's text moved
 * down (LaidSlide `shift`, Postcard's card; 0 where it did not), for the hotspots over its slots.
 */
export function draftLayouts(
  drafts: Body<'drafts'>,
  themeId: string | null,
  facts: Fact[],
  sourceTitle: string,
  title?: string,
  language?: LanguageId,
): { checks: FitCheck[][]; shifts: number[][] } {
  const laid = drafts.items.map(({ structure, template }) => {
    const { theme, surfaces } = slideColours({ template, brand: FEED_BRAND, themeId }) ?? {
      theme: FEED_BRAND.themes[0],
    }
    const laid = layoutStructure({
      structure,
      template,
      brand: FEED_BRAND,
      sourceTitle,
      title,
      facts,
      language,
    })
    return {
      checks: fitChecks({ structure, template, theme, surfaces, brand: FEED_BRAND, layout: laid }),
      shifts: laid.slides.map((s) => s.shift ?? 0),
    }
  })
  return { checks: laid.map((d) => d.checks), shifts: laid.map((d) => d.shifts) }
}
