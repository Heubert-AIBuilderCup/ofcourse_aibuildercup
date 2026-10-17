/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { FEED_BRAND } from '../../brands'
import { emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { LaidSlide, SlideArt, Structure } from '../../model/types'
import type { Saved } from '../../server/commands'
import { templateById } from '../../templates'

// The images step of a look post (GD12–GD14): plan, edit a scene in place, draw, nudge one image,
// swap it back, and draw what the daily limit left. The pictures are the server's: nothing here
// asserts how they look.

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { BlogImagesStep, ImagesStep } = await import('./ImagesStep')
type Props = Parameters<typeof ImagesStep>[0]

const FIELD_NOTES = templateById('field-notes')
if (!FIELD_NOTES) throw new Error('no field-notes template')

const text = (t: string) => ({ text: t, factIds: [], factual: false })
/** A cover and a picture slide hold art; the number slide and the takeaway do not: 2 images. */
const STRUCTURE: Structure = {
  templateId: 'field-notes',
  artPrompt: 'A quiet desk at dusk.',
  slides: [
    { kind: 'cover', layout: 'cover', slots: { heading: text('The line') } },
    { kind: 'body', layout: 'picture', slots: { heading: text('Shifts') } },
    { kind: 'body', layout: 'number', slots: { heading: text('20 hours') } },
    { kind: 'take', layout: 'takeaway', slots: { heading: text('Keep to 20') } },
  ],
}

const laid = (artBox: LaidSlide['artBox']): LaidSlide => ({
  kind: 'body',
  lines: [],
  artBox,
  sourceLine: null,
  searchLine: null,
})

const COVER_BOX = { x: 0, y: 0, w: 1080, h: 780 }
const PICTURE_BOX = { x: 0, y: 0, w: 1080, h: 540 }

const BASE: CurrentPost = {
  source: null,
  facts: null,
  drafts: null,
  revision: {
    id: 'rev1',
    body: {
      factsId: 'facts1',
      structure: STRUCTURE,
      template: FIELD_NOTES,
      brand: FEED_BRAND,
      themeId: 'pop',
      by: { userId: 'u1', name: 'Ed', at: '2026-10-05T09:12:00.000Z' },
      note: 'approved',
      emotion: null,
    },
  },
  layout: {
    id: 'lay1',
    body: {
      revisionId: 'rev1',
      slides: [laid(COVER_BOX), laid(PICTURE_BOX), laid(null), laid(null)],
      fits: [],
      fitChecks: [],
    },
  },
  render: null,
  covers: null,
  artPlan: null,
  outline: null,
  blogOutline: null,
  blogText: null,
  blogImages: null,
  ideas: null,
  sourceCheck: null,
  settings: null,
  sendBack: null,
  approval: null,
  market: null,
  caption: null,
  export: null,
}

const PLAN: CurrentPost['artPlan'] = {
  id: 'plan1',
  body: {
    revisionId: 'rev1',
    scenes: [
      { slide: 1, scene: 'A student at a cafe counter at dusk.' },
      { slide: 2, scene: 'A timetable pinned above a desk.' },
    ],
    panorama: false,
  },
}

const art = (slide: number, over: Partial<SlideArt> = {}): SlideArt => ({
  slide,
  assetId: `art${slide}`,
  scene: PLAN.body.scenes[slide - 1].scene,
  take: 1,
  nudge: null,
  fallback: null,
  ...over,
})

const rendered = (slideArt: SlideArt[]): CurrentPost['render'] => ({
  id: 'ren1',
  body: {
    revisionId: 'rev1',
    layoutId: 'lay1',
    art: { assetId: null, prompt: '', version: 1, fallback: null },
    slides: [1, 2, 3, 4].map((n) => ({ svgAssetId: `s${n}`, pngAssetId: `png${n}` })),
    slideArt,
  },
})

const VIEW: Props['view'] = {
  id: 'p1',
  title: 'Paid work',
  stage: 'approved',
  version: 7,
  pointers: { ...emptyPointers(), revisionId: 'rev1', layoutId: 'lay1' },
  current: BASE,
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 8 })
const actions = {
  planImagesAction: mock(async (_id: unknown, _at: unknown) => saved()),
  editImageSceneAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved()),
  drawImagesAction: mock(async (_id: unknown, _at: unknown) => saved()),
  skipPicturesAction: mock(async (_id: unknown, _at: unknown) => saved()),
  nudgeImageAction: mock(async (_id: unknown, _at: unknown, _input: unknown) => saved()),
  lightEditAction: mock(async (_id: unknown, _at: unknown, _edit: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }

const view = (over: Partial<Props['view']> = {}) =>
  render(<ImagesStep view={{ ...VIEW, ...over }} viewer={EDITOR} actions={actions} />)

const planned = {
  pointers: { ...VIEW.pointers, artPlanId: 'plan1' },
  current: { ...BASE, artPlan: PLAN },
}

/** After drawing: the post rendered with these images. */
const drawn = (slideArt: SlideArt[], over: Partial<Props['view']> = {}) =>
  view({
    ...planned,
    stage: 'rendered',
    current: { ...planned.current, render: rendered(slideArt) },
    ...over,
  })

/** The figure that holds slide n: its picture and what shows under it. */
function figureOf(n: number): HTMLElement {
  const figure = screen.getByRole('img', { name: new RegExp(`^Slide ${n}\\b`) }).closest('figure')
  if (!figure) throw new Error(`no figure for slide ${n}`)
  return figure
}

/** Slide n's chips, scene and takes, in the actions area beside the pictures (GD30). */
function controlsOf(n: number): HTMLElement {
  return within(screen.getByRole('region', { name: 'Actions' })).getByRole('region', {
    name: `Slide ${n}`,
  })
}

const press = async (button: HTMLElement) => {
  await act(async () => {
    fireEvent.click(button)
  })
}

afterEach(() => {
  cleanup()
  push.mockClear()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('ImagesStep', () => {
  it('plans the images first: "Draw images" waits for a plan', async () => {
    view()
    expect(screen.getByRole('button', { name: 'Draw images (2 images)' })).toBeDisabled()
    expect(screen.getByText('Plan the images first.')).toBeInTheDocument()
    await press(screen.getByRole('button', { name: 'Plan images' }))
    expect(actions.planImagesAction).toHaveBeenCalledWith('p1', 7)
  })

  it('previews each art-box slide with its planned scene, from the plan (GD12)', () => {
    view(planned)
    expect(screen.queryByRole('button', { name: 'Plan images' })).toBeNull()
    expect(screen.getByRole('img', { name: /^Slide 2\b/ })).toHaveAttribute(
      'src',
      '/admin/posts/p1/preview?layout=lay1&slide=2&plan=plan1',
    )
    expect(screen.queryByRole('img', { name: /^Slide 3\b/ })).toBeNull()
  })

  it('saves a planned scene edited in place (GD12)', async () => {
    view(planned)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Slide 2 · Scene' }))
    const field = screen.getByRole('textbox', { name: 'Slide 2 · Scene' })
    expect(field).toHaveValue('A timetable pinned above a desk.')
    fireEvent.change(field, { target: { value: 'A rota on a fridge door.' } })
    await press(screen.getByRole('button', { name: 'Save' }))
    expect(actions.editImageSceneAction).toHaveBeenCalledWith('p1', 7, {
      slide: 2,
      text: 'A rota on a fridge door.',
    })
  })

  it('shows how many images it draws, and draws them (GD12, GD14)', async () => {
    view(planned)
    await press(screen.getByRole('button', { name: 'Draw images (2 images)' }))
    expect(actions.drawImagesAction).toHaveBeenCalledWith('p1', 7)
  })

  it('says "Images are being drawn" beside the disabled draw button while they are drawn in the background (GD14)', () => {
    view({ ...planned, running: ['images'] })
    const draw = screen.getByRole('button', { name: 'Draw images (2 images)' })
    expect(draw).toBeDisabled()
    expect(draw.parentElement).toHaveTextContent('Images are being drawn')
    cleanup()
    // The first picture has landed: it shows, and the rest are still being drawn.
    drawn([art(1)], { running: ['images'] })
    expect(screen.getByRole('img', { name: /^Slide 1\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/png1',
    )
    // Slide 2's picture is on its way, not missing: nothing is left to draw while the run goes on.
    expect(within(figureOf(2)).queryByText('No art') === null).toBe(true)
    expect(screen.queryByRole('button', { name: 'Draw remaining' }) === null).toBe(true)
    expect(screen.getByText('Images are being drawn')).toBeInTheDocument()
  })

  it('offers "Draw remaining" only once a finished run left a slide without its picture', () => {
    // Two failed calls then a picture: every slide is drawn, nothing is left.
    drawn([art(1), art(2)])
    expect(screen.queryByRole('button', { name: 'Draw remaining' }) === null).toBe(true)
    expect(screen.queryByText('Could not draw')).toBeNull()
    cleanup()

    // Every attempt failed: the slide says so, with its own retry and "Draw remaining".
    drawn([art(1), art(2, { assetId: null, fallback: 'no_art' })])
    expect(within(figureOf(2)).getByText('Could not draw')).toBeInTheDocument()
    expect(
      within(figureOf(2)).getByRole('button', { name: 'Try this one again' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draw remaining' })).toBeInTheDocument()
    cleanup()

    // Not while a run goes on, even over a slide an earlier run could not draw.
    drawn([art(1), art(2, { assetId: null, fallback: 'no_art' })], { running: ['images'] })
    expect(screen.queryByRole('button', { name: 'Draw remaining' }) === null).toBe(true)
  })

  it('while the images are drawn, says which image of how many, with a loader on each slide still waiting for its picture', () => {
    view({ ...planned, running: ['images'], progress: { images: { done: 0, total: 2 } } })
    expect(screen.getByText('Drawing image 1 of 2').closest('[role="status"]')).not.toBeNull()
    for (const n of [1, 2]) {
      expect(
        within(figureOf(n)).getByRole('status', { name: `Slide ${n} · being drawn` }),
      ).toBeInTheDocument()
    }
    cleanup()

    // The first picture has landed: only slide 2 still waits.
    drawn([art(1)], { running: ['images'], progress: { images: { done: 1, total: 2 } } })
    expect(screen.getByText('Drawing image 2 of 2')).toBeInTheDocument()
    expect(within(figureOf(1)).queryByRole('status')).toBeNull()
    expect(
      within(figureOf(2)).getByRole('status', { name: 'Slide 2 · being drawn' }),
    ).toBeInTheDocument()
    cleanup()

    // Nothing waits once the drawing is over.
    drawn([art(1), art(2)])
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })

  it('shows a loader with the words while the scenes are planned', () => {
    view({ running: ['scene_plan'] })
    expect(screen.getByRole('status')).toHaveTextContent('Images are being planned')
  })

  it('shows the pictures in the slides area, and each drawn picture’s chips and scene in the actions area beside them (GD30)', () => {
    drawn([art(1), art(2)])
    const slides = screen.getByRole('region', { name: 'Slides' })
    expect(within(slides).getByRole('figure', { name: 'Slide 2 picture' })).toBe(figureOf(2))
    expect(within(figureOf(2)).queryByRole('button', { name: 'Closer' })).toBeNull()
    for (const n of [1, 2]) {
      expect(within(controlsOf(n)).getByRole('button', { name: 'Closer' })).toBeInTheDocument()
      expect(within(controlsOf(n)).getByRole('button', { name: 'Edit scene' })).toBeInTheDocument()
    }
    expect(
      within(screen.getByRole('region', { name: 'Actions' })).getByRole('list', {
        name: 'Slide order',
      }),
    ).toBeInTheDocument()
  })

  it('nudges one drawn image with the chip pressed for it (GD13)', async () => {
    drawn([art(1), art(2)])
    expect(screen.getByRole('img', { name: /^Slide 2\b/ })).toHaveAttribute(
      'src',
      '/admin/assets/png2',
    )
    expect(screen.queryByRole('button', { name: /^Draw/ })).toBeNull()
    // Each picture's figure has a name the browser specs find it by.
    expect(screen.getByRole('figure', { name: 'Slide 2 picture' })).toBe(figureOf(2))
    await press(within(controlsOf(2)).getByRole('button', { name: 'Closer' }))
    expect(actions.nudgeImageAction).toHaveBeenCalledWith('p1', 7, { slide: 2, nudge: 'closer' })
  })

  it('"New picture" draws only that slide’s picture again, with no chip', async () => {
    drawn([art(1), art(2)])
    await press(within(controlsOf(2)).getByRole('button', { name: 'New picture' }))
    expect(actions.nudgeImageAction).toHaveBeenCalledWith('p1', 7, { slide: 2, nudge: null })
  })

  it('"Edit scene" for a drawn image saves its planned scene; once changed, "Draw this one" draws only that slide', async () => {
    drawn([art(1), art(2)])
    // Saved unchanged, nothing is sent.
    fireEvent.click(within(controlsOf(2)).getByRole('button', { name: 'Edit scene' }))
    await press(within(controlsOf(2)).getByRole('button', { name: 'Save scene' }))
    expect(actions.editImageSceneAction).not.toHaveBeenCalled()
    fireEvent.click(within(controlsOf(2)).getByRole('button', { name: 'Edit scene' }))
    const field = within(controlsOf(2)).getByRole('textbox', { name: 'Scene for slide 2' })
    expect(field).toHaveValue('A timetable pinned above a desk.')
    fireEvent.change(field, { target: { value: 'A rota on a fridge door.' } })
    await press(within(controlsOf(2)).getByRole('button', { name: 'Save scene' }))
    expect(actions.editImageSceneAction).toHaveBeenCalledWith('p1', 7, {
      slide: 2,
      text: 'A rota on a fridge door.',
    })
    cleanup()

    // The plan's scene for slide 2 is no longer the one its picture was drawn from.
    drawn([art(1), art(2, { scene: 'An older scene.' })])
    expect(within(controlsOf(2)).queryByRole('button', { name: 'New picture' })).toBeNull()
    expect(within(controlsOf(1)).getByRole('button', { name: 'New picture' })).toBeInTheDocument()
    await press(within(controlsOf(2)).getByRole('button', { name: 'Draw this one' }))
    expect(actions.nudgeImageAction).toHaveBeenCalledWith('p1', 7, { slide: 2, nudge: null })
  })

  it("swaps a slide's image back to an earlier take of that slide (GD13)", async () => {
    drawn([art(1), art(2, { assetId: 'art2b', take: 2, nudge: 'closer' })], {
      slideArt: [
        art(2, { assetId: 'art2b', take: 2 }),
        art(1),
        art(2),
        art(1, { assetId: 'old1' }),
      ],
    })
    const slide = controlsOf(2)
    fireEvent.click(within(slide).getByRole('button', { name: 'Swap image' }))
    const takes = within(slide).getByRole('group', { name: 'Swap image' })
    expect(
      within(takes)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Take 1'])
    await press(within(takes).getByRole('button', { name: 'Take 1' }))
    expect(actions.lightEditAction).toHaveBeenCalledWith('p1', 7, {
      kind: 'swapImage',
      slide: 2,
      image: { assetId: 'art2' },
    })
  })

  it('marks a slide the daily limit left undrawn, and draws the rest with "Draw remaining" (GD14)', async () => {
    drawn([art(1), art(2, { assetId: null, fallback: 'daily_limit' })])
    expect(within(figureOf(2)).getByText('Limit')).toBeInTheDocument()
    expect(within(figureOf(2)).getByText('Daily image limit reached.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Slide 2' })).toBeNull()
    expect(within(figureOf(1)).queryByText('Daily image limit reached.')).toBeNull()
    await press(screen.getByRole('button', { name: 'Draw remaining' }))
    expect(actions.drawImagesAction).toHaveBeenCalledWith('p1', 7)
  })

  it('says a slide whose image could not be drawn so, with "Try this one again", which draws that slide alone', async () => {
    drawn([art(1), art(2, { assetId: null, fallback: 'no_art' })])
    const slide = within(figureOf(2))
    expect(slide.getByText('Could not draw')).toBeInTheDocument()
    expect(within(figureOf(1)).queryByRole('button', { name: 'Try this one again' })).toBeNull()
    await press(slide.getByRole('button', { name: 'Try this one again' }))
    expect(actions.nudgeImageAction).toHaveBeenCalledWith('p1', 7, { slide: 2, nudge: null })
    expect(actions.drawImagesAction).not.toHaveBeenCalled()
  })

  it('goes on by itself, once, with a drawing that stopped before every planned slide was reached', async () => {
    // Slide 2 has no entry in the render: the drawing never got to it.
    await act(async () => {
      drawn([art(1)])
    })
    expect(actions.drawImagesAction).toHaveBeenCalledTimes(1)
    expect(actions.drawImagesAction).toHaveBeenCalledWith('p1', 7)
    expect(within(figureOf(2)).getByText('Not drawn yet')).toBeInTheDocument()
    cleanup()
    actions.drawImagesAction.mockClear()

    // Not while it still runs, not when every slide was reached, not in review.
    for (const open of [
      () => drawn([art(1)], { running: ['images'] }),
      () => drawn([art(1), art(2, { assetId: null, fallback: 'no_art' })]),
      () => drawn([art(1), art(2, { assetId: null, fallback: 'daily_limit' })]),
      () => drawn([art(1)], { stage: 'in_review' }),
    ]) {
      await act(async () => {
        open()
      })
      cleanup()
    }
    expect(actions.drawImagesAction).not.toHaveBeenCalled()
  })

  it('offers "Draw remaining" for a scene changed since its image was drawn', () => {
    drawn([art(1), art(2, { scene: 'An older scene.' })])
    expect(screen.getByRole('button', { name: 'Draw remaining' })).toBeInTheDocument()
  })

  it('plans again at once over the model’s plan, and asks first over scenes in the editor’s words (GD12)', async () => {
    view(planned)
    await press(screen.getByRole('button', { name: 'Plan again' }))
    expect(actions.planImagesAction).toHaveBeenCalledWith('p1', 7)
    cleanup()
    actions.planImagesAction.mockClear()
    const plan = PLAN as NonNullable<CurrentPost['artPlan']>
    view({
      ...planned,
      current: { ...BASE, artPlan: { ...plan, body: { ...plan.body, edited: true } } },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Plan again' }))
    expect(actions.planImagesAction).not.toHaveBeenCalled()
    const ask = screen.getByRole('region', { name: 'Plan the images again?' })
    expect(within(ask).getByText('Your own scenes are replaced.')).toBeInTheDocument()
    await press(within(ask).getByRole('button', { name: 'Plan again' }))
    expect(actions.planImagesAction).toHaveBeenCalledWith('p1', 7)
  })

  describe('light edits (40)', () => {
    const move = (n: number, way: 'up' | 'down') =>
      screen.getByRole('button', { name: `Move slide ${n} ${way}` })

    it('moves a body slide down or up with its picture, never past the cover or the takeaway', async () => {
      drawn([art(1), art(2)])
      const order = screen.getByRole('list', { name: 'Slide order' })
      expect(within(order).getAllByRole('listitem')).toHaveLength(4)
      // Slides 2 and 3 are the body slides; the cover and the takeaway never move.
      expect(screen.queryByRole('button', { name: /^Move slide [14]/ })).toBeNull()
      expect(move(2, 'up')).toBeDisabled()
      expect(move(3, 'down')).toBeDisabled()
      await press(move(2, 'down'))
      expect(actions.lightEditAction).toHaveBeenCalledWith('p1', 7, {
        kind: 'reorder',
        from: 1,
        to: 2,
      })
      await press(move(3, 'up'))
      expect(actions.lightEditAction).toHaveBeenLastCalledWith('p1', 7, {
        kind: 'reorder',
        from: 2,
        to: 1,
      })
    })

    it('has no phrase to edit on a look post: its slots are edited on Text', () => {
      drawn([art(1), art(2)])
      expect(screen.queryByLabelText('Phrase')).toBeNull()
      expect(screen.queryByRole('button', { name: /^Update/ })).toBeNull()
    })

    it('holds the moves while the images are drawn, and offers none before drawing or in review', () => {
      drawn([art(1)], { running: ['images'] })
      expect(move(2, 'down')).toBeDisabled()
      cleanup()
      view(planned)
      expect(screen.queryByRole('list', { name: 'Slide order' })).toBeNull()
      cleanup()
      drawn([art(1), art(2)], { stage: 'in_review' })
      expect(screen.queryByRole('list', { name: 'Slide order' })).toBeNull()
    })
  })

  it('in review, keeps every scene edit disabled with the running step in words while one runs (122)', () => {
    drawn([art(1), art(2)], { stage: 'in_review', running: ['market'] })
    expect(screen.getByText('The market version is being made')).toBeInTheDocument()
    for (const edit of screen.getAllByRole('button')) expect(edit).toBeDisabled()
  })

  it('in review, offers only each scene to edit, which moves the post back by itself (111, GD28)', async () => {
    drawn([art(1), art(2, { assetId: null, fallback: 'no_art' })], { stage: 'in_review' })
    expect(within(figureOf(2)).getByText('Could not draw')).toBeInTheDocument()
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent)
    expect(new Set(names)).toEqual(
      new Set(['Edit scene', 'Edit Slide 1 · Scene', 'Edit Slide 2 · Scene']),
    )
    fireEvent.click(within(controlsOf(1)).getByRole('button', { name: 'Edit scene' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scene for slide 1' }), {
      target: { value: 'A student on a bus at dawn.' },
    })
    await press(screen.getByRole('button', { name: 'Save scene' }))
    expect(actions.editImageSceneAction).toHaveBeenCalledWith('p1', 7, {
      slide: 1,
      text: 'A student on a bus at dawn.',
    })
  })

  it('while a chip redraws one picture, says so, the pressed chip waiting and that slide alone pulsing', async () => {
    let answer: (saved: Saved) => void = () => {}
    actions.nudgeImageAction.mockImplementationOnce(
      () =>
        new Promise<Saved>((resolve) => {
          answer = resolve
        }),
    )
    drawn([art(1), art(2)])
    const closer = within(controlsOf(2)).getByRole('button', { name: 'Closer' })
    await press(closer)
    try {
      const statuses = screen.queryAllByRole('status')
      expect(statuses.map((s) => s.textContent).filter(Boolean)).toEqual([
        'Drawing this picture · about half a minute',
      ])
      expect(statuses.map((s) => s.getAttribute('aria-label')).filter(Boolean)).toEqual([
        'Slide 2 · being drawn',
      ])
      expect((closer as HTMLButtonElement).disabled).toBe(true)
    } finally {
      // A transition left hanging would hold every later one in this file.
      await act(async () => answer({ ok: true, id: 'p1', version: 8 }))
    }
  })

  it('says a failed plan failed, and why, with the text kept', () => {
    view({ failed: ['scene_plan'], failedReasons: { scene_plan: 'busy' } })
    expect(
      screen.queryAllByText(
        "Planning failed. Your text is kept. Google's model is busy. Try again in a minute.",
      ).length,
    ).toBe(1)
  })

  it('says a failed drawing failed, and why, with the plan kept', () => {
    drawn([art(1), art(2, { assetId: null, fallback: 'no_art' })], {
      failed: ['images'],
      failedReasons: { images: 'timeout' },
    })
    expect(
      screen.queryAllByText('Drawing failed. Your plan is kept. It took too long. Try again.')
        .length,
    ).toBe(1)
  })
})

describe('Skip pictures', () => {
  const SKIP = 'Skip pictures · use the text slides'
  const WHY = 'Each slide is saved as it looks now, without a picture.'

  it('is offered to a writer beside Draw images, with why, and saves the slides as they are', async () => {
    view(planned)
    expect(screen.queryByText(WHY) !== null).toBe(true)
    await press(screen.getByRole('button', { name: SKIP }))
    expect(actions.skipPicturesAction).toHaveBeenCalledWith('p1', 7)
    expect(actions.drawImagesAction).not.toHaveBeenCalled()
  })

  it('is not offered to a viewer who may not draw', () => {
    render(
      <ImagesStep
        view={{ ...VIEW, ...planned }}
        viewer={{ role: 'user', editor: false, reviewer: true }}
        actions={actions}
      />,
    )
    expect(screen.queryByRole('button', { name: SKIP })).toBeNull()
    expect(screen.queryByText(WHY)).toBeNull()
  })

  it('shows the loader while the slides are saved', async () => {
    let answer: (saved: Saved) => void = () => {}
    actions.skipPicturesAction.mockImplementationOnce(
      () =>
        new Promise<Saved>((resolve) => {
          answer = resolve
        }),
    )
    view(planned)
    const skip = screen.getByRole('button', { name: SKIP })
    await press(skip)
    try {
      expect(
        screen
          .queryAllByRole('status')
          .map((s) => s.textContent)
          .filter(Boolean),
      ).toEqual(['Saving the slides…'])
      expect((skip as HTMLButtonElement).disabled).toBe(true)
      expect(
        (screen.getByRole('button', { name: 'Draw images (2 images)' }) as HTMLButtonElement)
          .disabled,
      ).toBe(true)
    } finally {
      await act(async () => answer({ ok: true, id: 'p1', version: 8 }))
    }
  })

  it('is still offered after some pictures were drawn, while a slide has none', async () => {
    drawn([art(1), art(2, { assetId: null, fallback: 'no_art' })])
    await press(screen.getByRole('button', { name: SKIP }))
    expect(actions.skipPicturesAction).toHaveBeenCalledWith('p1', 7)
  })

  it('afterwards a skipped slide reads "Text only", never "Could not draw", with nothing to retry and nothing left to skip', () => {
    drawn([art(1), art(2, { assetId: null, fallback: 'skipped' })])
    const slide = within(figureOf(2))
    expect(slide.queryByText('Text only') !== null).toBe(true)
    expect(screen.queryByText('Could not draw')).toBeNull()
    expect(slide.queryByRole('button', { name: 'Try this one again' })).toBeNull()
    expect(screen.queryByRole('button', { name: SKIP })).toBeNull()
  })

  it('a slide whose drawing failed says why beside "Could not draw"', () => {
    drawn([art(1), art(2, { assetId: null, fallback: 'no_art', reason: 'busy' })])
    const slide = within(figureOf(2))
    expect(slide.queryByText('Could not draw') !== null).toBe(true)
    expect(slide.queryByText("Google's model is busy. Try again in a minute.") !== null).toBe(true)
    cleanup()
    drawn([art(1), art(2, { assetId: null, fallback: 'no_art', reason: 'timeout' })])
    expect(within(figureOf(2)).queryByText('It took too long. Try again.') !== null).toBe(true)
  })

  it('is not offered for a comic, whose panels are its pictures', () => {
    view({ ...planned, courseId: 'c1', characterApproved: true })
    expect(screen.queryByRole('button', { name: SKIP })).toBeNull()
  })
})

describe("a comic's panels (RC10)", () => {
  const comic = { ...planned, courseId: 'c1' }

  it('waits for the comic character: "Draw panels" is disabled, with a link to approve it', () => {
    view({ ...comic, characterApproved: false })
    expect(screen.getByRole('button', { name: 'Draw panels' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Approve the comic character first' })).toHaveAttribute(
      'href',
      '/admin/comics/character',
    )
    expect(screen.queryByRole('button', { name: /^Draw images/ })).toBeNull()
  })

  it('draws the panels once the character is approved, and then the remaining panels', async () => {
    view({ ...comic, characterApproved: true })
    expect(screen.queryByRole('link', { name: 'Approve the comic character first' })).toBeNull()
    await press(screen.getByRole('button', { name: 'Draw panels' }))
    expect(actions.drawImagesAction).toHaveBeenCalledWith('p1', 7)
    cleanup()

    drawn([art(1)], { courseId: 'c1', characterApproved: true })
    await press(screen.getByRole('button', { name: 'Draw remaining panels' }))
    expect(actions.drawImagesAction).toHaveBeenCalledTimes(2)
  })
})

describe("a blog's pictures (BR4)", () => {
  const POST_ID = '1c1d4b63-8a7d-4d7b-8e4f-2a1b6a6a5c22'
  const BLOG_TEXT: NonNullable<CurrentPost['blogText']> = {
    id: 'bt1',
    body: {
      outlineId: 'bo1',
      sections: [
        { heading: 'How many hours?', body: 'Twenty in term.', factIds: [] },
        { heading: 'Does it hurt grades?', body: 'Past twenty, it can.', factIds: [] },
        { heading: 'And the holidays?', body: 'Full time.', factIds: [] },
      ],
      takeaways: ['a', 'b', 'c'],
      faq: [],
      emotion: null,
      note: 'Written',
    },
  }
  const BLOG_PLAN: CurrentPost['artPlan'] = {
    id: 'plan1',
    body: {
      blogTextId: 'bt1',
      scenes: [
        { slide: 1, scene: 'A desk at dusk.', target: 'cover' },
        { slide: 2, scene: 'A timetable.', target: { after: 2 } },
      ],
      panorama: false,
    },
  }
  const blogActions = { ...actions, embedPostSlidesAction: mock(async () => saved()) }
  const blog = (over: Partial<Props['view']> = {}, viewer: Staff = EDITOR) =>
    render(
      <BlogImagesStep
        view={{
          ...VIEW,
          kind: 'blog',
          current: {
            ...BASE,
            revision: null,
            layout: null,
            blogText: BLOG_TEXT,
            artPlan: BLOG_PLAN,
          },
          blogPosts: [
            { id: POST_ID, title: 'The 20-hour line', live: true },
            { id: 'p3', title: 'Not live yet', live: false },
          ],
          ...over,
        }}
        viewer={viewer}
        actions={blogActions}
      />,
    )

  afterEach(() => {
    blogActions.embedPostSlidesAction.mockClear()
    blogActions.drawImagesAction.mockClear()
  })

  it('shows each planned scene at its place and draws them', async () => {
    blog()
    expect(screen.getByRole('figure', { name: 'Cover picture' })).toHaveTextContent(
      'A desk at dusk.',
    )
    expect(screen.getByRole('figure', { name: 'Picture after section 2' })).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draw images (2 images)' }))
    })
    expect(blogActions.drawImagesAction).toHaveBeenCalledWith('p1', 7)
  })

  const picture = (
    slide: number,
    over: Partial<NonNullable<CurrentPost['blogImages']>['body']['images'][number]> = {},
  ): NonNullable<CurrentPost['blogImages']>['body']['images'][number] => {
    const planned = BLOG_PLAN.body.scenes[slide - 1]
    return {
      slide,
      target: planned.target ?? 'cover',
      scene: planned.scene,
      take: 1,
      nudge: null,
      fallback: null,
      assetId: `art${slide}`,
      tintedAssetId: `tint${slide}`,
      ...over,
    }
  }
  /** After drawing: the blog rendered with these pictures, and these posts' slides embedded. */
  const blogDrawn = (
    images: NonNullable<CurrentPost['blogImages']>['body']['images'],
    over: Partial<Props['view']> = {},
    embeds: NonNullable<CurrentPost['blogImages']>['body']['embeds'] = [],
  ) =>
    blog({
      stage: 'rendered',
      current: {
        ...BASE,
        revision: null,
        layout: null,
        blogText: BLOG_TEXT,
        artPlan: BLOG_PLAN,
        blogImages: {
          id: 'bi1',
          body: { blogTextId: 'bt1', version: 1, images, embeds },
        },
      },
      ...over,
    })

  it('says a picture that could not be drawn so, with "Try this one again", which draws that picture alone', async () => {
    blogDrawn([picture(1), picture(2, { assetId: null, tintedAssetId: null, fallback: 'no_art' })])
    const place = within(screen.getByRole('figure', { name: 'Picture after section 2' }))
    expect(place.getByText('Could not draw')).toBeInTheDocument()
    expect(
      within(screen.getByRole('figure', { name: 'Cover picture' })).queryByRole('button', {
        name: 'Try this one again',
      }),
    ).toBeNull()
    await press(place.getByRole('button', { name: 'Try this one again' }))
    expect(actions.nudgeImageAction).toHaveBeenCalledWith('p1', 7, { slide: 2, nudge: null })
    expect(actions.drawImagesAction).not.toHaveBeenCalled()
  })

  it('says why a picture could not be drawn when its last call said', () => {
    blogDrawn([
      picture(1),
      picture(2, { assetId: null, tintedAssetId: null, fallback: 'no_art', reason: 'timeout' }),
    ])
    const place = within(screen.getByRole('figure', { name: 'Picture after section 2' }))
    expect(place.queryByText('Could not draw') !== null).toBe(true)
    expect(place.queryByText('It took too long. Try again.') !== null).toBe(true)
  })

  it('offers "Draw remaining" only once a finished run left a picture undrawn, never while one runs', () => {
    blogDrawn([picture(1), picture(2)])
    expect(screen.queryByRole('button', { name: 'Draw remaining' }) === null).toBe(true)
    cleanup()
    const failed = picture(2, { assetId: null, tintedAssetId: null, fallback: 'no_art' })
    blogDrawn([picture(1), failed])
    expect(screen.getByRole('button', { name: 'Draw remaining' })).toBeInTheDocument()
    cleanup()
    for (const images of [[picture(1)], [picture(1), failed]]) {
      blogDrawn(images, { running: ['images'] })
      expect(screen.queryByRole('button', { name: 'Draw remaining' }) === null).toBe(true)
      cleanup()
    }
  })

  it('goes on by itself, once, with a drawing that stopped before every planned picture was reached', async () => {
    // The picture after section 2 has no entry: the drawing never got to it.
    await act(async () => {
      blogDrawn([picture(1)])
    })
    expect(actions.drawImagesAction).toHaveBeenCalledTimes(1)
    expect(actions.drawImagesAction).toHaveBeenCalledWith('p1', 7)
    expect(
      within(screen.getByRole('figure', { name: 'Picture after section 2' })).getByText(
        'Not drawn yet',
      ),
    ).toBeInTheDocument()
    cleanup()
    actions.drawImagesAction.mockClear()

    // Not while it still runs, not when every picture was reached, not where a post's slides sit,
    // not in review.
    for (const open of [
      () => blogDrawn([picture(1)], { running: ['images'] }),
      () => blogDrawn([picture(1), picture(2, { assetId: null, fallback: 'no_art' })]),
      () => blogDrawn([picture(1), picture(2, { assetId: null, fallback: 'daily_limit' })]),
      () => blogDrawn([picture(1)], {}, [{ after: 2, postId: POST_ID }]),
      () => blogDrawn([picture(1)], { stage: 'in_review' }),
    ]) {
      await act(async () => {
        open()
      })
      cleanup()
    }
    expect(actions.drawImagesAction).not.toHaveBeenCalled()
  })

  it("embeds a live linked post's slides after the section chosen, offering only live posts", async () => {
    blog()
    const post = screen.getByRole('combobox', { name: 'Post' })
    expect(within(post).queryByRole('option', { name: 'Not live yet' })).toBeNull()
    fireEvent.change(post, { target: { value: POST_ID } })
    fireEvent.change(screen.getByRole('combobox', { name: 'After section' }), {
      target: { value: '3' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Embed slides' }))
    })
    expect(blogActions.embedPostSlidesAction).toHaveBeenCalledWith('p1', 7, {
      postId: POST_ID,
      at: 3,
    })
  })

  it('shows a viewer who may not edit the pictures with no control', () => {
    blog({}, { role: 'user', reviewer: true })
    expect(screen.getByRole('figure', { name: 'Cover picture' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })
})
