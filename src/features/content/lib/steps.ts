// The workbench's steps, each its own screen at /admin/posts/<id>/<step> (GD27): which step a
// stage is at, the step bar's states in plain words (GD25), and which steps may be opened. Pure
// and client-safe, so the pages, the step bar and the steps' forward actions read one definition.

import type { SendBackStep } from '../model/artifacts'
import type { CurrentPost } from '../model/current'
import type { Stage } from '../model/stages'
import type { BlogEmbed, BlogTarget } from '../model/types'
import { artSlides, isLook, isPanorama } from '../templates'
import { embeddedAt } from './blog-pictures'

export const STEP_IDS = [
  'source',
  'ideas',
  'outline',
  'text',
  'images',
  'settings',
  'review',
  'live',
  'blog',
] as const
export type StepId = (typeof STEP_IDS)[number]

/** The step bar's words (GD25). For a post from before the looks, Images is the render and covers. */
const LABELS: Record<StepId, string> = {
  source: 'Source',
  ideas: 'Ideas',
  outline: 'Outline',
  text: 'Text',
  images: 'Images',
  settings: 'Settings',
  review: 'Review',
  live: 'Live',
  blog: 'Blog',
}

export const isStepId = (value: string): value is StepId =>
  (STEP_IDS as readonly string[]).includes(value)

/** The step the cards are found in (server/commands/ideas.ts IDEAS_STEP). */
const FINDING_IDEAS = 'ideas'

/**
 * Whether the idea cards stand in for the versions: the post is at structures with no versions
 * and no outline, and has cards, is finding them, or failed to (GD1; the failed step offers "Try
 * again").
 */
export function ideasShown(view: {
  stage: Stage
  current: { ideas: unknown; outline: unknown; drafts: unknown }
  running: readonly string[]
  failed?: readonly string[]
}): boolean {
  if (view.stage !== 'structures' || view.current.drafts || view.current.outline) return false
  return (
    view.current.ideas !== null ||
    view.running.includes(FINDING_IDEAS) ||
    (view.failed?.includes(FINDING_IDEAS) ?? false)
  )
}

/**
 * Whether the post's render has every picture: each art-box slide of a look post its own (one
 * panorama counts as slide 1's), none held at the daily limit, failed or missing; for a post from
 * before the looks, its one cover art.
 */
export function picturesDrawn(current: Pick<CurrentPost, 'revision' | 'render'>): boolean {
  const { revision, render } = current
  if (!revision || !render) return false
  const { template, structure } = revision.body
  if (!isLook(template)) return render.body.art.assetId !== null
  const wanted = isPanorama(template) ? [1] : artSlides(template, structure)
  const art = render.body.slideArt ?? []
  return wanted.every((n) => art.some((a) => a.slide === n && a.assetId !== null))
}

/** What blogPicturesDrawn reads of a blog: its planned pictures, and those drawn or embedded. */
type BlogPictures = {
  artPlan?: { body: { scenes: readonly { slide: number; target?: BlogTarget }[] } } | null
  blogImages?: {
    body: {
      images: readonly { slide: number; assetId: string | null }[]
      embeds: readonly BlogEmbed[]
    }
  } | null
}

/**
 * Whether a blog has every picture (BR4): a plan, and each place it planned either drawn or
 * holding a linked post's slides; none missing, failed or held at the daily limit.
 */
export function blogPicturesDrawn({ artPlan, blogImages }: BlogPictures): boolean {
  if (!artPlan || !blogImages) return false
  const { images, embeds } = blogImages.body
  return artPlan.body.scenes.every(
    (s) =>
      (s.target !== undefined && embeddedAt(embeds, s.target)) ||
      images.some((p) => p.slide === s.slide && p.assetId !== null),
  )
}

/**
 * What the steps read of a post: its stage, whether it shows Ideas, whether it is at them,
 * whether its pictures are all drawn, whether it shows the Outline and is at it (GD32), and
 * whether it has the Blog step after Live (a feed post's).
 */
export type StepPost = {
  stage: Stage
  ideas: boolean
  atIdeas: boolean
  pictures: boolean
  outline: boolean
  atOutline: boolean
  blog: boolean
}

/**
 * A post's StepPost: Ideas shows for a post with an ideas record, or one at its cards; the
 * Outline for a post with an outline, or one at its cards, where it is the step ahead. The
 * outline stands in for the versions while it has none. A blog (BR1, BR2) shows every step: at
 * structures it is at its angles until one is picked, then at its outline until its text is
 * written; rendered, at its images until every picture is drawn or embedded (BR4). A feed post,
 * not a comic (RC2), has the Blog step after Live, where it makes or links its blog (BR8).
 */
export function stepPost(
  view: Parameters<typeof ideasShown>[0] & {
    kind?: string
    courseId?: string | null
    pointers: { ideasId: string | null; outlineId: string | null }
    current: Pick<CurrentPost, 'revision' | 'render'> &
      BlogPictures & {
        blogOutline?: unknown
        blogText?: unknown
      }
  },
): StepPost {
  if (view.kind === 'blog') {
    const outlined = view.stage === 'structures' && (view.current.blogOutline ?? null) !== null
    return {
      stage: view.stage,
      ideas: true,
      atIdeas: view.stage === 'structures' && !outlined,
      pictures: blogPicturesDrawn(view.current),
      outline: true,
      atOutline: outlined && (view.current.blogText ?? null) === null,
      blog: false,
    }
  }
  const atIdeas = ideasShown(view)
  const atOutline =
    view.stage === 'structures' && !view.current.drafts && view.current.outline !== null
  return {
    stage: view.stage,
    ideas: view.pointers.ideasId !== null || atIdeas,
    atIdeas,
    pictures: picturesDrawn(view.current),
    outline: view.pointers.outlineId !== null || atIdeas || atOutline,
    atOutline,
    blog: view.kind === 'feed' && !view.courseId,
  }
}

/**
 * The step a stage is at; at structures, the ideas while the cards stand in for the versions,
 * then the outline while it does (GD32); a rendered post at the images until its pictures are
 * all drawn, then at the settings.
 */
export function stepOfStage(
  stage: Stage,
  atIdeas: boolean,
  pictures = false,
  atOutline = false,
): StepId {
  switch (stage) {
    case 'source':
      return 'source'
    case 'structures':
      return atIdeas ? 'ideas' : atOutline ? 'outline' : 'text'
    case 'approved':
      return 'images'
    case 'rendered':
      return pictures ? 'settings' : 'images'
    case 'in_review':
    case 'ready':
      return 'review'
    case 'live':
    case 'exported':
      return 'live'
  }
}

/**
 * The step a request for changes names (model/artifacts.ts SEND_BACK_STEPS): the versions are the
 * Text, the covers the Images. A note naming none has no step of its own: the post opens where it is.
 */
export function stepOfNote(step: SendBackStep | null): StepId | null {
  switch (step) {
    case 'structures':
      return 'text'
    case 'covers':
      return 'images'
    case 'settings':
      return 'settings'
    case null:
      return null
  }
}

/** A step passed, the one the post is at, one it may open without being at it (Blog), or one not reached. */
export type StepState = 'done' | 'current' | 'open' | 'todo'

/** The step a post is at: the page a post's address opens. */
export const stepOf = (post: StepPost): StepId =>
  stepOfStage(post.stage, post.atIdeas, post.pictures, post.atOutline)

/**
 * The step bar: every step in order, Ideas only for a post with ideas, Outline for one with an
 * outline and Blog for a feed post's, each done, current or to do. A post stays at Live once
 * live; its Blog then opens beside it, as the way on rather than where the post is.
 */
export function stepsFor(post: StepPost): { id: StepId; label: string; state: StepState }[] {
  const ids = STEP_IDS.filter(
    (id) =>
      (post.ideas || id !== 'ideas') &&
      (post.outline || id !== 'outline') &&
      (post.blog || id !== 'blog'),
  )
  const step = stepOf(post)
  const at = ids.indexOf(step)
  return ids.map((id, i) => ({
    id,
    label: LABELS[id],
    state:
      i < at ? 'done' : i === at ? 'current' : id === 'blog' && step === 'live' ? 'open' : 'todo',
  }))
}

/** A done, current or open step opens; a step not reached, or not on the post's bar, does not. */
export function canOpen(step: StepId, post: StepPost): boolean {
  const state = stepsFor(post).find((s) => s.id === step)?.state
  return state !== undefined && state !== 'todo'
}

/** A post's address, which opens the step it is at (src/app/admin/(console)/posts/[id]/page.tsx). */
export const postPath = (id: string) => `/admin/posts/${encodeURIComponent(id)}`

/** A step's address. */
export const stepPath = (id: string, step: StepId) => `${postPath(id)}/${step}`

/** An address with the query a page was opened with, as a redirect sends it on ("from", "market"). */
export function withQuery(
  path: string,
  query: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const one of [value ?? []].flat()) params.append(key, one)
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}
