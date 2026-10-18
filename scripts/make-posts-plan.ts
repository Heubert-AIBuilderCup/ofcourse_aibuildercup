// The pure parts of scripts/make-posts.ts: the spec file read and checked, the order the posts
// are made in, who makes and who approves them, the settings each is saved with, and the scene
// hint a slide's picture takes. No database, no model: the script does the rest.

import { z } from 'zod'
import type { LanguageId } from '../src/features/content/languages'
import { defaultSettings } from '../src/features/content/lib/settings-defaults'
import type { VersionProblem } from '../src/features/content/lib/version-status'
import { type Fact, type FeedSettings, LAYOUT_IDS } from '../src/features/content/model/types'
import { TAG_GROUPS, type TagGroup, tagById } from '../src/features/content/tags'
import { LOOKS } from '../src/features/content/templates'
import { canEdit, canReview } from '../src/shared/lib/auth/access'

/** The looks a spec may name: the presets a look post draws in, and the feed brand's themes. */
export const LOOK_IDS = ['pop', 'subdued', 'paper', 'ink', 'signal'] as const
/** A planned scene's longest text, as the Images step takes it (commands/images.ts editImageScene). */
const SCENE_MAX = 200

/**
 * A scene the art prompt guard takes (ai/draft.ts artPromptError): no digit and no quote mark.
 * Refused here so a spec fails before any post is touched; the command applies the whole rule.
 */
const SceneText = z
  .string()
  .trim()
  .min(1)
  .max(SCENE_MAX)
  .refine((t) => !/\p{Nd}/u.test(t) && !/["“”]/.test(t), 'no digits or quote marks in a scene')
const slideNo = z.number().int().min(1).max(99)

const TagValues = z.array(z.string().trim().min(1).max(64)).max(20)
const PostSchema = z
  .object({
    /** A post made before, to publish again now, so it takes its place in this spec's order. */
    id: z.uuid().optional(),
    idea: z.string().trim().min(1).max(10_000).optional(),
    source: z
      .url({ protocol: /^https$/ })
      .max(2048)
      .optional(),
    kind: z.enum(['feed', 'blog']),
    look: z.enum(LOOK_IDS).optional(),
    tags: z
      .object({
        destination: TagValues.optional(),
        theme: TagValues.optional(),
        home: z.string().trim().min(1).max(64).optional(),
        age: TagValues.optional(),
      })
      .strict()
      .optional(),
    language: z.enum(['en']).default('en'),
    featured: z.boolean().default(false),
    title: z.string().trim().min(1).max(200).optional(),
    /**
     * Scene hints for the pictures (scenesFor): a slide whose text says `when` is drawn as
     * `scene`; a hint with no `when` goes to the next picture no other hint names.
     */
    scenes: z
      .array(
        z.object({
          when: z.string().trim().min(1).max(200).optional(),
          scene: z.string().trim().min(1).max(SCENE_MAX),
        }),
      )
      .max(20)
      .default([]),
    /** The look the picked version is moved to before approval (GD4), by id. */
    template: z
      .string()
      .refine((id) => LOOKS.some((l) => l.id === id), 'not a look')
      .optional(),
    /** The picked version's slides before approval: another layout, then each slot's exact words. */
    edits: z
      .array(
        z
          .object({
            slide: slideNo,
            layout: z.enum(LAYOUT_IDS).optional(),
            text: z.record(z.string().max(64), z.string().trim().min(1).max(2000)).optional(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    /**
     * Our own pictures, in place of the image model's: each pictured slide's SVG (a path from the
     * spec file's folder), drawn to PNG, and the scene the plan names it by. With any given, every
     * pictured slide needs one, so nothing is left for the model to draw.
     */
    art: z
      .array(z.object({ slide: slideNo, svg: z.string().trim().min(1).max(500), scene: SceneText }))
      .max(20)
      .default([]),
  })
  .strict()

/** One post of the spec, its tags as tag ids in the tag file. */
export type PostSpec = Omit<z.infer<typeof PostSchema>, 'tags'> & {
  tags: string[]
  language: LanguageId
}

/** A tag as the spec writes it ("work-study-life", or "theme:work-study-life") as its id. */
const tagId = (group: TagGroup, value: string) =>
  value.startsWith(`${group}:`) ? value : `${group}:${value}`

/**
 * The spec file's posts, each checked: an idea or a source (an https link), not both, or the id
 * of a post to publish again (its idea or source, if given, only a note); a known
 * kind, look and language; every tag in the tag file. Every problem is named by its post.
 */
export function parseSpec(
  raw: unknown,
): { ok: true; posts: PostSpec[] } | { ok: false; errors: string[] } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, errors: ['The spec is an array of one or more posts.'] }
  }
  const errors: string[] = []
  const posts: PostSpec[] = []
  raw.forEach((item, i) => {
    const name = `Post ${i + 1}`
    const parsed = PostSchema.safeParse(item)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${name}: ${issue.path.join('.') || 'post'}: ${issue.message}`)
      }
      return
    }
    const { tags: given = {}, ...post } = parsed.data
    const named = [post.idea, post.source].filter((g) => g !== undefined).length
    if (named > 1 || (named === 0 && post.id === undefined)) {
      errors.push(`${name}: give an idea or a source, not both.`)
      return
    }
    const ids = TAG_GROUPS.flatMap((group) => {
      const values = given[group]
      const list = values === undefined ? [] : Array.isArray(values) ? values : [values]
      return list.map((v) => tagId(group, v))
    })
    const unknown = ids.filter((id) => tagById(id) === null)
    if (unknown.length > 0) {
      errors.push(`${name}: no such tag: ${unknown.join(', ')}`)
      return
    }
    posts.push({ ...post, tags: [...new Set(ids)] })
  })
  return errors.length > 0 ? { ok: false, errors } : { ok: true, posts }
}

/**
 * The order the posts are made in: last first. The feed shows the newest approval first, so the
 * spec's first post, approved last, shows first. `at` is the post's place in the spec, from 1.
 */
export function runOrder<T>(posts: readonly T[]): { at: number; post: T }[] {
  return posts.map((post, i) => ({ at: i + 1, post })).reverse()
}

/** An account as the script reads it from the user table. */
export type Account = {
  id: string
  email: string
  name: string
  role: string
  editor: boolean
  reviewer: boolean
  suspended: boolean
}

/**
 * Who makes the posts and who approves them: `asEmail`'s account, or the first that may edit
 * (`users` in the order they joined); it approves too when it may review, else the first other
 * account that may. Suspended accounts do neither.
 */
export function chooseActors(
  users: readonly Account[],
  asEmail?: string,
): { ok: true; maker: Account; reviewer: Account } | { ok: false; error: string } {
  const active = users.filter((u) => !u.suspended)
  const wanted = asEmail?.trim().toLowerCase()
  const maker = wanted
    ? active.find((u) => u.email.toLowerCase() === wanted)
    : active.find((u) => canEdit(u))
  if (!maker) {
    return {
      ok: false,
      error: wanted
        ? `No active account ${asEmail}.`
        : 'No active superadmin or editor account in the database.',
    }
  }
  if (!canEdit(maker)) return { ok: false, error: `${maker.email} may not make posts.` }
  const reviewer = canReview(maker) ? maker : active.find((u) => u.id !== maker.id && canReview(u))
  if (!reviewer) {
    return {
      ok: false,
      error: `${maker.email} may not approve, and no other active superadmin or reviewer can.`,
    }
  }
  return { ok: true, maker, reviewer }
}

/** The settings a post is saved with: the form's defaults, with exactly the spec's tags, and the featured layer when asked. */
export function settingsFor(
  facts: Fact[],
  language: LanguageId,
  spec: { tags: string[]; featured: boolean },
): FeedSettings {
  return {
    ...defaultSettings(facts, language),
    tags: spec.tags,
    layer: spec.featured ? 'featured' : 'general',
  }
}

/**
 * The scene each pictured slide is drawn as: the first hint whose `when` its text says, in any
 * case; else the next hint with no `when`, in order, each used once. A slide neither names keeps
 * its planned scene, and is left out.
 */
export function scenesFor(
  slides: readonly { slide: number; text: string }[],
  hints: readonly { when?: string; scene: string }[],
): { slide: number; scene: string }[] {
  const spare = hints.filter((h) => h.when === undefined)
  const out: { slide: number; scene: string }[] = []
  for (const { slide, text } of slides) {
    const said = text.toLowerCase()
    const named = hints.find((h) => h.when !== undefined && said.includes(h.when.toLowerCase()))
    const scene = named?.scene ?? spare.shift()?.scene
    if (scene !== undefined) out.push({ slide, scene })
  }
  return out
}

/** The next press on the picked text version before it is approved. */
export type Fix = { kind: 'ready' } | { kind: 'nudge'; slide: number } | { kind: 'next' }

/**
 * What to press next on the picked version, from its problems (lib/version-status.ts, without the
 * source check's): the shorter chip on a slide whose words do not fit, once per slide; else the
 * next version for any other problem; else ready. A sentence the source check could not find is
 * settled once the post is rendered, where the source's wording is refused when it would not fit.
 */
export function nextFix(problems: readonly VersionProblem[], tried: ReadonlySet<string>): Fix {
  if (problems.length === 0) return { kind: 'ready' }
  const fix = problems[0].fix
  return fix?.kind === 'nudge' && !tried.has(`nudge:${fix.slide}`)
    ? { kind: 'nudge', slide: fix.slide }
    : { kind: 'next' }
}

/** The longest title the script gives an idea by itself. */
const IDEA_TITLE_MAX = 80

/**
 * A post's title from its idea when the spec gives none: the idea's first sentence, or its first
 * 80 characters. The search line names the title, and the whole idea does not fit there.
 */
export function ideaTitle(idea: string): string {
  const first = /^[\s\S]*?[.!?](?=\s|$)/.exec(idea.trim())?.[0] ?? idea.trim()
  return first.slice(0, IDEA_TITLE_MAX).trim()
}

/** Words too common to tell one fact from another. */
const COMMON = new Set(['the', 'and', 'then', 'with', 'for', 'you', 'your'])
const wordsOf = (text: string) =>
  new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
      (w) => w.length >= 3 && !COMMON.has(w),
    ),
  )

/**
 * The supported fact our words for a slot come from: the one sharing the most words with them
 * (the first on a tie), or null when none shares any. The slot is bound to it before the words
 * are put on it, as "Fix" binds an unbound claim on the Text step.
 */
export function closestFact(text: string, facts: readonly Fact[]): Fact | null {
  const ours = wordsOf(text)
  let best: Fact | null = null
  let most = 0
  for (const fact of facts) {
    if (!fact.supported) continue
    const shared = [...wordsOf(fact.text)].filter((w) => ours.has(w)).length
    if (shared > most) {
      best = fact
      most = shared
    }
  }
  return best
}
