/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Staff } from '@/shared/lib/auth/access'
import { type Body, emptyPointers } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { FitCheck, LaidSlide } from '../../model/types'
import type { Saved } from '../../server/commands'
import { nativeOf } from '../../text/native-fixtures'

const refresh = mock(() => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh }),
}))

const { RenderStep } = await import('./RenderStep')

/** Where a link sits: in the step bar ("Step actions", 18 Oct) or anywhere else. */
const place = (el: Element) => (el.closest('[aria-label="Step actions"]') ? 'bar' : 'elsewhere')
type Props = Parameters<typeof RenderStep>[0]

/** The line beside "Try again" on a cover the image model could not draw (18 Oct). */
const GEMINI_FAILED =
  "Gemini couldn't draw this picture (it was busy or too slow). Try this one again."

const slide = (kind: LaidSlide['kind']): LaidSlide => ({
  kind,
  lines: [],
  // Only the cover holds art, as in every feed template.
  artBox: kind === 'cover' ? { x: 0, y: 0, w: 1080, h: 810 } : null,
  sourceLine: null,
  searchLine: null,
})

const PASS: FitCheck = {
  check: 'contrast',
  slide: null,
  slot: null,
  value: 14.4,
  limit: '4.5:1',
  pass: true,
  label: 'Contrast · Paper 14.4:1 · OK',
}
const OVER: FitCheck = {
  check: 'length',
  slide: 2,
  slot: 'body',
  value: 121,
  limit: '30–70 words',
  pass: false,
  label: 'Slide 2 · 121 words (30–70) · Over',
}

const layout = (fitChecks: FitCheck[]): CurrentPost['layout'] => ({
  id: 'lay1',
  body: {
    revisionId: 'rev1',
    slides: [slide('cover'), slide('body'), slide('take')],
    fits: [],
    fitChecks,
  },
})

const renderRecord = (fallback: Body<'render'>['art']['fallback']): CurrentPost['render'] => ({
  id: 'ren1',
  body: {
    revisionId: 'rev1',
    layoutId: 'lay1',
    art: {
      assetId: fallback === 'no_art' || fallback === 'daily_limit' ? null : 'art1',
      prompt: 'A desk.',
      version: 1,
      fallback,
    },
    slides: [
      { svgAssetId: 's1', pngAssetId: 'png1' },
      { svgAssetId: 's2', pngAssetId: 'png2' },
      { svgAssetId: 's3', pngAssetId: 'png3' },
    ],
  },
})

const EMPTY: CurrentPost = {
  source: null,
  facts: null,
  drafts: null,
  revision: null,
  layout: null,
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

const VIEW: Props['view'] = {
  id: 'p1',
  title: 'Paid work',
  stage: 'approved',
  version: 7,
  pointers: { ...emptyPointers(), layoutId: 'lay1', revisionId: 'rev1' },
  current: { ...EMPTY, layout: layout([PASS]) },
  createdAt: '2026-10-05T09:12:00.000Z',
  running: [],
  draftChecks: [],
}

const saved = async (): Promise<Saved> => ({ ok: true, id: 'p1', version: 8 })
const actions = {
  renderAction: mock(async (_id: unknown, _at: unknown) => saved()),
  retryArtAction: mock(async (_id: unknown, _at: unknown) => saved()),
  lightEditAction: mock(async (_id: unknown, _at: unknown, _edit: unknown) => saved()),
  makeCoversAction: mock(async (_id: unknown, _at: unknown, _idea: unknown) => saved()),
  chooseCoverAction: mock(async (_id: unknown, _at: unknown, _option: unknown) => saved()),
  backAction: mock(async (_id: unknown, _at: unknown, _to: unknown) => saved()),
}

const EDITOR: Staff = { role: 'user', editor: true }
const ADMIN: Staff = { role: 'admin' }

/** The filmstrip under the stage: one thumbnail per slide. */
const strip = () => screen.getByRole('list', { name: 'All slides' })

/** Selects slide n on the stage, by its thumbnail in the filmstrip. */
const select = (n: number) =>
  fireEvent.click(within(strip()).getByRole('button', { name: `Slide ${n}` }))

/** Slide n selected: the stage, with the slide and what shows under it (the cover's fallback). */
function stageAt(n: number): HTMLElement {
  select(n)
  return screen.getByRole('group', { name: 'Slides, one at a time' })
}

/** Slide n selected: its version, phrases, image swap and moves, in the "This slide" tab. */
function controlsOf(n: number): HTMLElement {
  select(n)
  const tab = screen.queryByRole('tab', { name: 'This slide' })
  if (tab) fireEvent.click(tab)
  return within(screen.getByRole('region', { name: 'Actions' })).getByRole('region', {
    name: `Slide ${n}`,
  })
}

/** The buttons that change something: every one but the filmstrip's thumbnails. */
const controls = () => screen.queryAllByRole('button').filter((b) => !strip().contains(b))

const view = (over: Partial<Props['view']> = {}, viewer: Staff = EDITOR) =>
  render(<RenderStep view={{ ...VIEW, ...over }} viewer={viewer} actions={actions} />)

afterEach(() => {
  cleanup()
  refresh.mockClear()
  for (const a of Object.values(actions)) a.mockClear()
})

describe('RenderStep', () => {
  it("draws the approved layout's slides from the preview route", () => {
    view()
    // One slide at a time on the stage, every one in the filmstrip.
    expect(within(strip()).getAllByRole('button').length).toBe(3)
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual([
      '/admin/posts/p1/preview?layout=lay1&slide=1',
    ])
    select(3)
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual([
      '/admin/posts/p1/preview?layout=lay1&slide=3',
    ])
  })

  it('shows a failing fit row and keeps Render disabled with the fit message', () => {
    view({ current: { ...EMPTY, layout: layout([OVER, PASS]) } })
    const row = screen.getByText('Slide 2 · 121 words (30–70) · Over').closest('li')
    if (!row) throw new Error('no fit row')
    expect(within(row).getByText('Fail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Render' })).toBeDisabled()
    expect(screen.getByText('Fix the failing fit checks before rendering.')).toBeInTheDocument()
  })

  it('offers the way to fix a failing fit check: the Text step with its Checks open (18 Oct)', () => {
    view({ current: { ...EMPTY, layout: layout([OVER, PASS]) } })
    expect(screen.getByRole('link', { name: 'Fix it on Text · Checks' }).getAttribute('href')).toBe(
      '/admin/posts/p1/text?tab=Checks',
    )
    cleanup()
    view()
    expect(screen.queryByRole('link', { name: 'Fix it on Text · Checks' }) === null).toBe(true)
  })

  it('sends a contrast failure to where the colours are chosen, Text · Style, not to Checks (18 Oct)', () => {
    const faint: FitCheck = {
      ...PASS,
      value: 4.2,
      pass: false,
      label: 'Contrast · Signal 4.2:1 · Too low',
    }
    view({ current: { ...EMPTY, layout: layout([faint]) } })
    expect(
      screen.getByRole('link', { name: 'Pick other colours on Text · Style' }).getAttribute('href'),
    ).toBe('/admin/posts/p1/text?tab=Style')
    expect(screen.queryByRole('link', { name: 'Fix it on Text · Checks' }) === null).toBe(true)
    cleanup()
    view({ current: { ...EMPTY, layout: layout([faint, OVER]) } })
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(
      expect.arrayContaining(['Pick other colours on Text · Style', 'Fix it on Text · Checks']),
    )
  })

  it('renders when every fit check passes', async () => {
    view()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Render' }))
    })
    expect(actions.renderAction).toHaveBeenCalledWith('p1', 7)
    expect(refresh).toHaveBeenCalled()
  })

  it('shows a running render as "Running…"', () => {
    view({ running: ['render'] })
    expect(screen.queryByRole('button', { name: 'Render' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled()
  })

  it('shows the stored PNGs after render', () => {
    view({
      stage: 'rendered',
      current: { ...EMPTY, layout: layout([PASS]), render: renderRecord(null) },
    })
    select(2)
    expect(screen.getByRole('img', { name: /^Slide 2\b/ }).getAttribute('src')).toBe(
      '/admin/assets/png2',
    )
    expect(screen.queryByRole('button', { name: 'Render' }) === null).toBe(true)
    expect(within(stageAt(1)).queryByText('No art') === null).toBe(true)
  })

  it('after render, opens the covers first, the selected slide’s controls under "This slide"', () => {
    view({
      stage: 'rendered',
      current: { ...EMPTY, layout: layout([PASS]), render: renderRecord(null) },
    })
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['This slide', 'Covers'])
    expect(
      screen
        .getAllByRole('tab')
        .filter((t) => t.getAttribute('aria-selected') === 'true')
        .map((t) => t.textContent),
    ).toEqual(['Covers'])
    expect(screen.queryAllByRole('button', { name: 'Make covers' }).length).toBe(1)
    const actionsArea = within(screen.getByRole('region', { name: 'Actions' }))
    // Only the open tab's panel is there.
    expect(actionsArea.queryAllByRole('region', { name: /^Slide \d$/ }).length).toBe(0)
    expect(controlsOf(2).textContent).toContain('No art')
    expect(actionsArea.queryAllByRole('region', { name: /^Slide \d$/ }).length).toBe(1)
  })

  it('marks a replayed cover', () => {
    view({
      stage: 'rendered',
      current: { ...EMPTY, layout: layout([PASS]), render: renderRecord('replay') },
    })
    expect(screen.getByText('Replay')).toBeInTheDocument()
  })

  it('offers "Try again" on a cover with no art, saying plainly Gemini could not draw it (18 Oct)', async () => {
    view({
      stage: 'rendered',
      current: { ...EMPTY, layout: layout([PASS]), render: renderRecord('no_art') },
    })
    expect(within(stageAt(1)).queryAllByText('No art').length).toBe(1)
    expect(screen.queryAllByText(GEMINI_FAILED).length).toBe(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(actions.retryArtAction).toHaveBeenCalledWith('p1', 7)
  })

  it('shows the render read-only once in review or live: no "Try again" and no edit (111)', () => {
    for (const stage of ['in_review', 'live'] as const) {
      view({ stage, current: { ...EMPTY, layout: layout([PASS]), render: renderRecord('no_art') } })
      expect(within(stageAt(1)).queryAllByText('No art').length).toBe(1)
      expect(screen.queryByText(GEMINI_FAILED) === null).toBe(true)
      for (const n of [1, 2, 3]) {
        select(n)
        expect(controls().map((b) => b.textContent)).toEqual([])
      }
      cleanup()
    }
  })

  it('says the daily image limit on a cover refused for the cap, and offers "Try again" (6)', async () => {
    view({
      stage: 'rendered',
      current: { ...EMPTY, layout: layout([PASS]), render: renderRecord('daily_limit') },
    })
    // The day's limit shows under the cover, on the stage.
    expect(within(stageAt(1)).queryAllByText('Limit').length).toBe(1)
    expect(within(stageAt(1)).queryAllByText('Daily image limit reached.').length).toBe(1)
    expect(within(stageAt(1)).queryByText('No art') === null).toBe(true)
    expect(within(stageAt(2)).queryByText('Daily image limit reached.') === null).toBe(true)
    expect(screen.queryByText(GEMINI_FAILED) === null).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(actions.retryArtAction).toHaveBeenCalledWith('p1', 7)
  })

  it("shows a reviewer's request for changes naming the covers beside the covers, and no other (120)", () => {
    const at = (step: 'covers' | 'settings' | null) =>
      view({
        stage: 'rendered',
        current: {
          ...EMPTY,
          layout: layout([PASS]),
          render: renderRecord(null),
          sendBack: {
            id: 'sb1',
            body: {
              revisionId: 'rev1',
              reason: 'Slide 2 is too long',
              by: { userId: 'u-ravi', name: 'Ravi K.', at: '2026-10-05T10:00:00.000Z' },
              step,
            },
          },
        },
      })
    at('covers')
    expect(
      within(screen.getByRole('region', { name: 'Covers' })).getByText(
        /Changes requested by Ravi K\..*Slide 2 is too long/,
      ),
    ).toBeInTheDocument()
    for (const step of ['settings', null] as const) {
      cleanup()
      at(step)
      expect(screen.queryByText(/Slide 2 is too long/)).toBeNull()
    }
  })

  it('shows no vision check and no way to run one, for the render or a market version (103)', () => {
    const current = { ...EMPTY, layout: layout([PASS]), render: renderRecord(null) }
    view({ stage: 'rendered', current })
    expect(screen.queryByText(/vision check/i)).toBeNull()
    expect(screen.queryByText('Not checked')).toBeNull()
    expect(screen.queryByRole('button', { name: /vision check/i })).toBeNull()
  })

  describe('light edits and the cover', () => {
    const KINDS: LaidSlide['kind'][] = ['cover', 'body', 'body', 'take']
    const slot = (text: string) => ({ text, factIds: [], factual: false })
    const revision = {
      id: 'rev1',
      body: {
        structure: {
          templateId: 'the-line',
          artPrompt: 'A desk.',
          slides: [
            { kind: 'cover', slots: { kicker: slot('Money'), phrase: slot('Paid work') } },
            { kind: 'body', slots: { heading: slot('One') } },
            { kind: 'body', slots: { heading: slot('Two') } },
            { kind: 'take', slots: { takeaway: slot('So.') } },
          ],
        },
      },
    } as unknown as CurrentPost['revision']
    const fourSlides = (art: Partial<Body<'render'>['art']> = {}): CurrentPost['render'] => {
      const base = renderRecord(null)
      if (!base) throw new Error('no render')
      return {
        ...base,
        body: {
          ...base.body,
          art: { ...base.body.art, ...art },
          slides: KINDS.map((_, i) => ({ svgAssetId: `s${i + 1}`, pngAssetId: `png${i + 1}` })),
        },
      }
    }
    const edited = (
      over: Partial<Props['view']> = {},
      viewer: Staff = EDITOR,
      render = fourSlides(),
      covers: CurrentPost['covers'] = null,
    ) =>
      view(
        {
          stage: 'rendered',
          current: {
            ...EMPTY,
            revision,
            layout: {
              id: 'lay1',
              body: { revisionId: 'rev1', slides: KINDS.map(slide), fits: [], fitChecks: [PASS] },
            },
            render,
            covers,
          },
          ...over,
        },
        viewer,
      )
    const option = (
      n: number,
      set: number,
      fallback: Body<'covers'>['options'][number]['fallback'] = null,
    ) => ({
      assetId: fallback === null ? `art${n}` : null,
      previewAssetId: fallback === null ? `pv${n}` : null,
      prompt: 'A desk.',
      set,
      fallback,
    })
    const COVERS: CurrentPost['covers'] = {
      id: 'cov1',
      body: {
        revisionId: 'rev1',
        options: [option(1, 1), option(2, 1), option(3, 1, 'no_art'), option(4, 2, 'daily_limit')],
      },
    }

    it('shows Version 1 under the cover with no art prompt to write, and No art under text slides (102)', () => {
      edited()
      const cover = within(controlsOf(1))
      expect(cover.queryAllByText('Version 1').length).toBe(1)
      expect(cover.queryByText('No art') === null).toBe(true)
      expect(screen.queryByLabelText('Art prompt') === null).toBe(true)
      expect(screen.queryByRole('button', { name: 'Regenerate this slide only' }) === null).toBe(
        true,
      )
      for (const n of [2, 3, 4]) {
        expect(within(controlsOf(n)).queryAllByText('No art').length).toBe(1)
        expect(within(controlsOf(n)).queryByText(/^Version/) === null).toBe(true)
      }
    })

    it('makes covers with the optional idea, and offers "Another set" once there are some (102)', async () => {
      edited()
      const idea = screen.getByLabelText('Cover idea (optional)')
      // Held to 120 characters as a reader sees them: a Thai idea of 120 whole (GD37).
      fireEvent.change(idea, { target: { value: `${nativeOf('th', 120)}ก` } })
      expect(idea).toHaveValue(nativeOf('th', 120))
      fireEvent.change(idea, { target: { value: 'A rainy window' } })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Make covers' }))
      })
      expect(actions.makeCoversAction).toHaveBeenCalledWith('p1', 7, 'A rainy window')
      expect(refresh).toHaveBeenCalled()
      cleanup()

      edited({}, EDITOR, fourSlides(), COVERS)
      expect(screen.queryByRole('button', { name: 'Make covers' })).toBeNull()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Another set' }))
      })
      expect(actions.makeCoversAction).toHaveBeenLastCalledWith('p1', 7, '')
    })

    it('while "Make covers" draws, says so, only it waiting as "Running…" and "Try again" as it reads', async () => {
      let answer: (saved: Saved) => void = () => {}
      actions.makeCoversAction.mockImplementationOnce(
        () =>
          new Promise<Saved>((resolve) => {
            answer = resolve
          }),
      )
      edited({}, EDITOR, fourSlides({ fallback: 'no_art' }))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Make covers' }))
      })
      const buttons = (label: string) =>
        screen
          .queryAllByRole('button')
          .filter((b) => b.textContent === label)
          .map((b) => (b as HTMLButtonElement).disabled)
      try {
        expect(screen.queryAllByRole('status').map((s) => s.textContent)).toEqual([
          'Drawing three covers · about a minute',
        ])
        expect(buttons('Running…')).toEqual([true])
        expect(buttons('Try again')).toEqual([true])
      } finally {
        // A transition left hanging would hold every later one in this file.
        await act(async () => answer({ ok: true, id: 'p1', version: 8 }))
      }
    })

    it('shows each option as the cover drawn with its art, labels one with none, and uses the one picked (6, 102, 103)', async () => {
      edited({}, EDITOR, fourSlides(), COVERS)
      const options = within(screen.getByRole('list', { name: 'Cover options' }))
      expect(options.getByRole('img', { name: 'Cover option 2' })).toHaveAttribute(
        'src',
        '/admin/assets/pv2',
      )
      expect(options.getByText('No art')).toBeInTheDocument()
      expect(options.getByText('Daily image limit reached.')).toBeInTheDocument()
      // The cover in use says so, instead of offering itself again.
      expect(options.getByText('In use')).toBeInTheDocument()
      const use = options.getAllByRole('button', { name: 'Use this cover' })
      expect(use).toHaveLength(1)
      await act(async () => {
        fireEvent.click(use[0])
      })
      expect(actions.chooseCoverAction).toHaveBeenCalledWith('p1', 7, 1)
    })

    it('shows a set being drawn as "Running…", and holds the cover controls while it runs', () => {
      edited({ running: ['covers'] }, EDITOR, fourSlides(), COVERS)
      expect(screen.getByRole('button', { name: 'Running…' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Another set' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Use this cover' })).toBeDisabled()
    })

    it('edits the cover phrase inline', async () => {
      edited()
      const cover = within(controlsOf(1))
      expect((cover.getByLabelText('Phrase') as HTMLInputElement).value).toBe('Paid work')
      expect(cover.queryByLabelText('Kicker') === null).toBe(true)
      fireEvent.change(cover.getByLabelText('Phrase'), { target: { value: 'Side jobs' } })
      await act(async () => {
        fireEvent.click(cover.getByRole('button', { name: 'Update phrase' }))
      })
      expect(actions.lightEditAction).toHaveBeenCalledWith('p1', 7, {
        kind: 'phrase',
        slide: 1,
        slot: 'phrase',
        text: 'Side jobs',
      })
    })

    it('moves body slides up and down, never past the cover or the take', async () => {
      edited()
      const moves = (n: number) =>
        within(controlsOf(n))
          .queryAllByRole('button', { name: /^Move slide/ })
          .map(
            (b) =>
              `${b.getAttribute('aria-label')}${(b as HTMLButtonElement).disabled ? ' (off)' : ''}`,
          )
      // The cover and the take never move; each body slide only its own way.
      expect(moves(1)).toEqual([])
      expect(moves(2)).toEqual(['Move slide 2 up (off)', 'Move slide 2 down'])
      expect(moves(3)).toEqual(['Move slide 3 up', 'Move slide 3 down (off)'])
      expect(moves(4)).toEqual([])
      const down = within(controlsOf(2)).getByRole('button', { name: 'Move slide 2 down' })
      await act(async () => {
        fireEvent.click(down)
      })
      expect(actions.lightEditAction).toHaveBeenCalledWith('p1', 7, {
        kind: 'reorder',
        from: 1,
        to: 2,
      })
    })

    it('swaps the image for an earlier version or a library image', async () => {
      const earlierArt = [
        { assetId: 'art0', version: 1, prompt: 'A chair.' },
        { assetId: 'art1', version: 2, prompt: 'A desk.' },
      ]
      edited({ earlierArt }, EDITOR, fourSlides({ assetId: 'art1', version: 2 }))
      fireEvent.click(within(controlsOf(1)).getByRole('button', { name: 'Swap image' }))
      const choices = within(screen.getByRole('group', { name: 'Swap image' }))
      expect(choices.getByRole('button', { name: 'Version 1' })).toBeInTheDocument()
      expect(choices.queryByRole('button', { name: 'Version 2' })).toBeNull()
      expect(choices.getByRole('button', { name: 'New head' })).toBeInTheDocument()
      await act(async () => {
        fireEvent.click(choices.getByRole('button', { name: 'Open book' }))
      })
      expect(actions.lightEditAction).toHaveBeenCalledWith('p1', 7, {
        kind: 'swapImage',
        image: { library: 'open-book' },
      })
      await act(async () => {
        fireEvent.click(choices.getByRole('button', { name: 'Version 1' }))
      })
      expect(actions.lightEditAction).toHaveBeenLastCalledWith('p1', 7, {
        kind: 'swapImage',
        image: { assetId: 'art0' },
      })
    })

    it('shows an admin the version but no control', () => {
      edited({}, ADMIN)
      expect(within(controlsOf(1)).queryAllByText('Version 1').length).toBe(1)
      // The slide's version alone: no tabs.
      expect(screen.queryAllByRole('tab').length).toBe(0)
      for (const n of [1, 2, 3, 4]) {
        select(n)
        expect(controls().length).toBe(0)
      }
      expect(screen.queryByLabelText('Cover idea (optional)') === null).toBe(true)
    })
  })

  it('offers an admin no button', () => {
    view({}, ADMIN)
    expect(controls().length).toBe(0)
    expect(within(strip()).getAllByRole('button').length).toBe(3)
  })
})

describe('Download slides (Images on)', () => {
  /** Each "Download slides" link: its address, and whether it downloads. */
  const downloads = () =>
    screen
      .queryAllByRole('link', { name: 'Download slides' })
      .map((a) => `${a.getAttribute('href')} ${a.hasAttribute('download')} ${place(a)}`)

  it('is offered once rendered, with or without cover art, in the step bar (18 Oct)', () => {
    for (const fallback of [null, 'no_art'] as const) {
      view({
        stage: 'rendered',
        current: { ...EMPTY, layout: layout([PASS]), render: renderRecord(fallback) },
      })
      expect(downloads()).toEqual(['/admin/posts/p1/slides true bar'])
      cleanup()
    }
  })

  it('is not offered before render, nor while one renders', () => {
    view()
    expect(downloads()).toEqual([])
    cleanup()
    view({
      stage: 'rendered',
      running: ['render'],
      current: { ...EMPTY, layout: layout([PASS]), render: renderRecord(null) },
    })
    expect(downloads()).toEqual([])
  })
})
