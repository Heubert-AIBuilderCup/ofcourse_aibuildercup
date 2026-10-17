import { describe, expect, it } from 'bun:test'
import { FEED_BRAND } from '../brands'
import type { CurrentPost } from '../model/current'
import type { Stage } from '../model/stages'
import type { SlideArt } from '../model/types'
import { templateById } from '../templates'
import {
  canOpen,
  ideasShown,
  picturesDrawn,
  type STEP_IDS,
  stepOf,
  stepOfNote,
  stepOfStage,
  stepPath,
  stepPost,
  stepsFor,
  withQuery,
} from './steps'

describe('stepOfNote', () => {
  it('opens the step a request for changes names', () => {
    expect(stepOfNote('structures')).toBe('text')
    expect(stepOfNote('covers')).toBe('images')
    expect(stepOfNote('settings')).toBe('settings')
  })

  it('names no step for a note that names none, so the post opens where it is', () => {
    expect(stepOfNote(null)).toBeNull()
  })
})

describe('stepOfStage', () => {
  it('maps every stage to its step (GD27)', () => {
    const expected: Record<Stage, string> = {
      source: 'source',
      structures: 'text',
      approved: 'images',
      rendered: 'images',
      in_review: 'review',
      ready: 'review',
      live: 'live',
      exported: 'live',
    }
    for (const [stage, step] of Object.entries(expected)) {
      expect(stepOfStage(stage as Stage, false)).toBe(step as (typeof STEP_IDS)[number])
    }
  })

  it('opens the ideas at structures only while the cards show in place of the versions', () => {
    expect(stepOfStage('structures', true)).toBe('ideas')
    expect(stepOfStage('structures', false)).toBe('text')
    // The cards only stand in for the versions at structures.
    expect(stepOfStage('source', true)).toBe('source')
    expect(stepOfStage('rendered', true)).toBe('images')
  })

  it('opens the outline at structures while it stands in for the versions (GD32)', () => {
    expect(stepOfStage('structures', false, false, true)).toBe('outline')
    // The cards come before the outline; past structures the outline is not where a post is.
    expect(stepOfStage('structures', true, false, true)).toBe('ideas')
    expect(stepOfStage('approved', false, false, true)).toBe('images')
  })

  it('opens a rendered post on Settings once its pictures are in, and on Images until then', () => {
    expect(stepOfStage('rendered', false, true)).toBe('settings')
    expect(stepOfStage('rendered', false, false)).toBe('images')
    // Before the render there is nothing drawn to move on from.
    expect(stepOfStage('approved', false, true)).toBe('images')
    expect(stepOfStage('in_review', false, true)).toBe('review')
  })
})

const template = (id: string) => {
  const found = templateById(id)
  if (!found) throw new Error(`no ${id} template`)
  return found
}
const slot = { heading: { text: 'A line', factIds: [], factual: false } }
/** A look post's three slides: the cover and the picture have an art box, the number none. */
const LOOK_SLIDES = [
  { kind: 'cover' as const, layout: 'cover' as const, slots: slot },
  { kind: 'body' as const, layout: 'picture' as const, slots: slot },
  { kind: 'body' as const, layout: 'number' as const, slots: slot },
]
const revisionIn = (id: string, slides: unknown[]): CurrentPost['revision'] => ({
  id: 'r1',
  body: {
    factsId: 'f1',
    structure: { templateId: id, artPrompt: 'A desk.', slides } as never,
    template: template(id),
    brand: FEED_BRAND,
    themeId: 'pop',
    by: { userId: 'u1', name: 'Ed', at: '2026-10-13T09:00:00.000Z' },
    note: 'approved',
    emotion: null,
  },
})
const picture = (slide: number, over: Partial<SlideArt> = {}): SlideArt => ({
  slide,
  assetId: `a${slide}`,
  scene: 'A bench.',
  take: 1,
  nudge: null,
  fallback: null,
  ...over,
})
const renderWith = (
  art: { assetId: string | null; fallback: 'replay' | 'no_art' | 'daily_limit' | null },
  slideArt?: SlideArt[],
): CurrentPost['render'] => ({
  id: 'ren1',
  body: {
    revisionId: 'r1',
    layoutId: 'l1',
    art: { ...art, prompt: 'A desk.', version: 1 },
    slides: [],
    ...(slideArt && { slideArt }),
  },
})
const NO_ART = { assetId: null, fallback: null }

describe('picturesDrawn', () => {
  const look = revisionIn('field-notes', LOOK_SLIDES)

  it('counts a look post drawn once every art-box slide has a picture', () => {
    expect(
      picturesDrawn({ revision: look, render: renderWith(NO_ART, [picture(1), picture(2)]) }),
    ).toBe(true)
  })

  it('does not while an art-box slide is held at the daily limit, failed or missing', () => {
    for (const second of [
      [picture(2, { assetId: null, fallback: 'daily_limit' })],
      [picture(2, { assetId: null, fallback: 'no_art' })],
      [],
    ]) {
      const render = renderWith(NO_ART, [picture(1), ...second])
      expect(picturesDrawn({ revision: look, render })).toBe(false)
    }
    expect(picturesDrawn({ revision: look, render: renderWith(NO_ART) })).toBe(false)
    expect(picturesDrawn({ revision: look, render: null })).toBe(false)
  })

  it('counts a slide saved on purpose without a picture ("Skip pictures") as done', () => {
    const skipped = picture(2, { assetId: null, fallback: 'skipped' })
    expect(
      picturesDrawn({ revision: look, render: renderWith(NO_ART, [picture(1), skipped]) }),
    ).toBe(true)
  })

  it("counts a panorama drawn by its one wide picture, slide 1's", () => {
    const postcard = revisionIn('postcard', LOOK_SLIDES)
    expect(picturesDrawn({ revision: postcard, render: renderWith(NO_ART, [picture(1)]) })).toBe(
      true,
    )
    const held = renderWith(NO_ART, [picture(1, { assetId: null, fallback: 'daily_limit' })])
    expect(picturesDrawn({ revision: postcard, render: held })).toBe(false)
  })

  it('counts a post from before the looks drawn once its render has art', () => {
    const legacy = revisionIn('the-line', [{ kind: 'body', slots: slot }])
    const drawn = renderWith({ assetId: 'art1', fallback: null })
    expect(picturesDrawn({ revision: legacy, render: drawn })).toBe(true)
    const held = renderWith({ assetId: null, fallback: 'daily_limit' })
    expect(picturesDrawn({ revision: legacy, render: held })).toBe(false)
  })
})

const at = (
  stage: Stage,
  ideas = false,
  atIdeas = false,
  pictures = false,
  outline = false,
  atOutline = false,
  blog = false,
) => ({ stage, ideas, atIdeas, pictures, outline, atOutline, blog })
const states = (post: ReturnType<typeof at>) => stepsFor(post).map((s) => `${s.label}:${s.state}`)

describe('stepsFor', () => {
  it('reads Source, Text, Images, Settings, Review, Live for a post without ideas (GD25)', () => {
    expect(states(at('rendered'))).toEqual([
      'Source:done',
      'Text:done',
      'Images:current',
      'Settings:todo',
      'Review:todo',
      'Live:todo',
    ])
  })

  it('moves a rendered post on to Settings once its pictures are in', () => {
    expect(states(at('rendered', false, false, true))).toEqual([
      'Source:done',
      'Text:done',
      'Images:done',
      'Settings:current',
      'Review:todo',
      'Live:todo',
    ])
  })

  it('adds Ideas after Source for a post with ideas, current while the cards show', () => {
    expect(states(at('structures', true, true))).toEqual([
      'Source:done',
      'Ideas:current',
      'Text:todo',
      'Images:todo',
      'Settings:todo',
      'Review:todo',
      'Live:todo',
    ])
    expect(states(at('structures', true, false)).slice(0, 3)).toEqual([
      'Source:done',
      'Ideas:done',
      'Text:current',
    ])
  })

  it('puts Outline between Ideas and Text for a post with an outline, current while it is shaped (GD32)', () => {
    expect(states(at('structures', true, false, false, true, true))).toEqual([
      'Source:done',
      'Ideas:done',
      'Outline:current',
      'Text:todo',
      'Images:todo',
      'Settings:todo',
      'Review:todo',
      'Live:todo',
    ])
    expect(states(at('structures', true, false, false, true, false)).slice(0, 4)).toEqual([
      'Source:done',
      'Ideas:done',
      'Outline:done',
      'Text:current',
    ])
    // At the cards, the outline is the step ahead.
    expect(states(at('structures', true, true, false, true)).slice(0, 4)).toEqual([
      'Source:done',
      'Ideas:current',
      'Outline:todo',
      'Text:todo',
    ])
  })

  it('leaves every step after the source to do once a post with ideas is back at its source', () => {
    expect(states(at('source', true))).toEqual([
      'Source:current',
      'Ideas:todo',
      'Text:todo',
      'Images:todo',
      'Settings:todo',
      'Review:todo',
      'Live:todo',
    ])
  })

  it('marks every step done before Live once live', () => {
    expect(stepsFor(at('exported')).map((s) => s.state)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
      'current',
    ])
  })
})

describe('canOpen', () => {
  it('opens done and current steps and refuses one not reached', () => {
    const post = at('approved', true)
    expect(canOpen('source', post)).toBe(true)
    expect(canOpen('ideas', post)).toBe(true)
    expect(canOpen('images', post)).toBe(true)
    expect(canOpen('settings', post)).toBe(false)
    expect(canOpen('review', post)).toBe(false)
    expect(canOpen('live', post)).toBe(false)
  })

  it('opens Settings once a rendered post has its pictures, and for every post past it', () => {
    expect(canOpen('settings', at('rendered'))).toBe(false)
    expect(canOpen('settings', at('rendered', false, false, true))).toBe(true)
    expect(canOpen('images', at('rendered', false, false, true))).toBe(true)
    expect(canOpen('settings', at('in_review'))).toBe(true)
  })

  it('refuses Ideas for a post that has none', () => {
    expect(canOpen('ideas', at('live'))).toBe(false)
  })
})

/** A post at `stage` as the workbench and the pages see it. */
const view = (
  stage: Stage,
  p: {
    ideasId?: string | null
    ideas?: boolean
    outlineId?: string | null
    outline?: boolean
    drafts?: boolean
    running?: string[]
    render?: CurrentPost['render']
  } = {},
) => ({
  stage,
  pointers: { ideasId: p.ideasId ?? null, outlineId: p.outlineId ?? null },
  current: {
    ideas: p.ideas ? {} : null,
    outline: p.outline ? {} : null,
    drafts: p.drafts ? {} : null,
    revision: revisionIn('field-notes', LOOK_SLIDES),
    render: p.render ?? null,
  },
  running: p.running ?? [],
  failed: [],
})

describe('ideasShown and stepPost', () => {
  it('shows the cards at structures with ideas and no versions, or while they are found', () => {
    expect(ideasShown(view('structures', { ideas: true }))).toBe(true)
    expect(ideasShown(view('structures', { running: ['ideas'] }))).toBe(true)
    expect(ideasShown(view('structures', { ideas: true, drafts: true }))).toBe(false)
    expect(ideasShown(view('approved', { ideas: true }))).toBe(false)
  })

  it('counts Ideas for a post with an ideas record, or one whose cards are being found', () => {
    expect(stepPost(view('rendered', { ideasId: 'i1', ideas: true, drafts: true }))).toEqual(
      at('rendered', true, false),
    )
    // At the cards, the outline shows as the step ahead (GD32).
    expect(stepPost(view('structures', { running: ['ideas'] }))).toEqual(
      at('structures', true, true, false, true),
    )
    expect(stepPost(view('structures'))).toEqual(at('structures'))
  })

  it('shows the outline in place of the cards once an idea is outlined, until its slides are written (GD32)', () => {
    const outlined = view('structures', {
      ideasId: 'i1',
      ideas: true,
      outlineId: 'o1',
      outline: true,
      running: ['draft'],
    })
    expect(ideasShown(outlined)).toBe(false)
    expect(stepPost(outlined)).toEqual(at('structures', true, false, false, true, true))
    expect(stepOf(stepPost(outlined))).toBe('outline')
    // Written, the post is at its text; the outline stays on the bar, passed.
    const written = view('structures', {
      ideasId: 'i1',
      ideas: true,
      outlineId: 'o1',
      outline: true,
      drafts: true,
    })
    expect(stepPost(written)).toEqual(at('structures', true, false, false, true, false))
    expect(stepOf(stepPost(written))).toBe('text')
    // An idea being outlined is still at the cards, with the outline ahead.
    const outlining = view('structures', { ideasId: 'i1', ideas: true, running: ['outline'] })
    expect(stepPost(outlining)).toEqual(at('structures', true, true, false, true, false))
  })

  it('leaves Outline off the bar of a post drafted from its cards before outlines', () => {
    const before = view('rendered', { ideasId: 'i1', ideas: true, drafts: true })
    expect(stepPost(before).outline).toBe(false)
    expect(stepsFor(stepPost(before)).map((s) => s.id)).not.toContain('outline')
  })

  it('says whether the pictures are in, which opens a rendered post on Settings', () => {
    const drawn = renderWith(NO_ART, [picture(1), picture(2)])
    expect(stepPost(view('rendered', { render: drawn }))).toEqual(
      at('rendered', false, false, true),
    )
  })
})

describe("a feed post's Blog step, after Live", () => {
  const live = (stage: Stage) => at(stage, false, false, true, false, false, true)

  it('ends the step bar of a live feed post with Blog, which opens', () => {
    expect(states(live('live'))).toEqual([
      'Source:done',
      'Text:done',
      'Images:done',
      'Settings:done',
      'Review:done',
      'Live:current',
      'Blog:open',
    ])
    expect(stepsFor(live('exported')).at(-1)).toEqual({ id: 'blog', label: 'Blog', state: 'open' })
    expect(canOpen('blog', live('live'))).toBe(true)
    // The post's address still opens Live.
    expect(stepOf(live('live'))).toBe('live')
  })

  it('does not open Blog before the post is live', () => {
    for (const stage of ['source', 'structures', 'approved', 'rendered', 'in_review'] as const) {
      expect(canOpen('blog', live(stage))).toBe(false)
      expect(stepsFor(live(stage)).at(-1)).toEqual({ id: 'blog', label: 'Blog', state: 'todo' })
    }
  })

  it('gives the step to a feed post only: not a blog, not a comic', () => {
    expect(stepPost({ ...view('live'), kind: 'feed' }).blog).toBe(true)
    expect(stepPost({ ...view('live'), kind: 'feed', courseId: 'c1' }).blog).toBe(false)
    const blog = { ...view('live'), kind: 'blog' as const }
    expect(stepPost({ ...blog, current: { ...blog.current, revision: null } }).blog).toBe(false)
    expect(stepsFor(at('live')).map((s) => s.id)).not.toContain('blog')
    expect(canOpen('blog', at('live'))).toBe(false)
  })
})

describe("a blog's steps (BR1, BR2)", () => {
  /** A blog at `stage`, outlined and written as asked. */
  const blog = (stage: Stage, p: { outlined?: boolean; written?: boolean } = {}) => ({
    ...view(stage),
    kind: 'blog' as const,
    current: {
      ...view(stage).current,
      revision: null,
      blogOutline: p.outlined ? {} : null,
      blogText: p.written ? {} : null,
    },
  })

  it('opens a blog at its angles until one is picked, even before the cards are found', () => {
    expect(stepOf(stepPost(blog('structures')))).toBe('ideas')
  })

  it('opens a blog with an angle picked and no text at its outline, then at its text once written', () => {
    expect(stepOf(stepPost(blog('structures', { outlined: true })))).toBe('outline')
    expect(stepOf(stepPost(blog('structures', { outlined: true, written: true })))).toBe('text')
  })

  it('shows every step on a blog’s bar, from the source on', () => {
    expect(stepsFor(stepPost(blog('source'))).map((s) => s.id)).toEqual([
      'source',
      'ideas',
      'outline',
      'text',
      'images',
      'settings',
      'review',
      'live',
    ])
    expect(states(stepPost(blog('structures', { outlined: true })))).toEqual([
      'Source:done',
      'Ideas:done',
      'Outline:current',
      'Text:todo',
      'Images:todo',
      'Settings:todo',
      'Review:todo',
      'Live:todo',
    ])
  })

  /** A rendered blog with a cover and two pictures planned, as drawn and embedded. */
  const pictured = (
    images: { slide: number; assetId: string | null }[],
    embeds: { after: number; postId: string }[] = [],
  ) => ({
    ...blog('rendered', { outlined: true, written: true }),
    current: {
      ...blog('rendered', { outlined: true, written: true }).current,
      artPlan: {
        body: {
          scenes: [
            { slide: 1, target: 'cover' as const },
            { slide: 2, target: { after: 1 } },
            { slide: 3, target: { after: 2 } },
          ],
        },
      },
      blogImages: { body: { images, embeds } },
    },
  })

  it("opens a blog's settings once every planned picture is drawn or holds a post's slides (BR4)", () => {
    const all = [1, 2, 3].map((slide) => ({ slide, assetId: `a${slide}` }))
    expect(stepOf(stepPost(pictured(all)))).toBe('settings')
    const third = [
      { slide: 1, assetId: 'a1' },
      { slide: 2, assetId: 'a2' },
    ]
    expect(stepOf(stepPost(pictured(third, [{ after: 2, postId: 'p9' }])))).toBe('settings')
  })

  it('keeps a blog at its images while a planned picture is missing or failed (BR4)', () => {
    expect(stepOf(stepPost(pictured([{ slide: 1, assetId: 'a1' }])))).toBe('images')
    const failed = [
      { slide: 1, assetId: 'a1' },
      { slide: 2, assetId: null },
      { slide: 3, assetId: 'a3' },
    ]
    expect(stepOf(stepPost(pictured(failed)))).toBe('images')
    expect(stepOf(stepPost(blog('rendered', { outlined: true, written: true })))).toBe('images')
  })
})

it('addresses a step under its post', () => {
  expect(stepPath('p 1', 'images')).toBe('/admin/posts/p%201/images')
})

it('keeps the query a page was opened with when it sends it on to a step', () => {
  expect(withQuery('/admin/posts/p1/text', { from: 'social', market: 'NP' })).toBe(
    '/admin/posts/p1/text?from=social&market=NP',
  )
  expect(withQuery('/admin/posts/p1/text', {})).toBe('/admin/posts/p1/text')
  expect(withQuery('/admin/posts/p1/text', { a: ['1', '2 3'], b: undefined })).toBe(
    '/admin/posts/p1/text?a=1&a=2+3',
  )
})
